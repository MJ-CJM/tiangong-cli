# Agent 交互式创建 - 逐步确认方案

> **更新日期**: 2025-10-06
> **状态**: 实现方案设计

---

## 🎯 目标

实现一个**真正的逐步交互式**创建流程，让用户：
1. 逐步确认 Agent 的名字
2. 逐步确认作用域
3. 逐步确认模型
4. 逐步确认工具权限配置
5. 选择是否用 AI 生成内容
6. 如果用 AI，输入 purpose 并预览生成内容
7. 最后确认才创建 Agent

---

## 📐 架构限制分析

### 当前 CLI 架构

```typescript
// CommandContext - 命令上下文
interface CommandContext {
  services: { config, settings, git, logger }
  ui: { addItem, setPendingItem, clear, ... }
  session: { stats, sessionShellAllowlist }
}

// 命令执行模式
action: (context: CommandContext, args: string) =>
  void | SlashCommandActionReturn | Promise<...>
```

### 可用的交互机制

1. **`confirm_action`** - 是/否确认
   ```typescript
   {
     type: 'confirm_action',
     prompt: ReactNode,  // 显示的确认提示
     originalInvocation: { raw: string }  // 确认后重新执行的命令
   }
   ```

   **限制**: 只能做布尔选择，不能收集自由文本输入

2. **消息 + 等待下一条命令** - 状态机模式
   ```typescript
   // 第一步：显示提示
   context.ui.addItem({ type: 'info', text: 'Enter name:' })

   // 用户输入: my-agent

   // 第二步：处理输入
   context.ui.addItem({ type: 'info', text: 'Enter scope (1/2):' })

   // ...继续
   ```

---

## ✅ 推荐方案：多步状态机 + 命令链

### 核心思路

使用**会话状态**记录创建进度，每一步用户回复后触发下一步。

### 实现架构

```
/agents begin                    ← 启动交互式创建
  ↓
[步骤 1: 输入名字]
  显示: "Enter agent name:"
  等待用户输入: my-agent
  ↓
  保存状态: { step: 'name', name: 'my-agent' }
  显示: "Enter scope (1=project, 2=global):"
  ↓
[步骤 2: 选择作用域]
  等待用户输入: 1
  ↓
  保存状态: { step: 'scope', name: 'my-agent', scope: 'project' }
  显示: "Choose model (1-6):"
  ↓
[步骤 3: 选择模型]
  等待用户输入: 1
  ↓
  保存状态: { ..., model: 'gemini-2.0-flash' }
  显示: "Content method (1=AI, 2=Manual):"
  ↓
[步骤 4: 选择内容创建方式]
  等待用户输入: 1
  ↓
  保存状态: { ..., method: 'ai' }
  显示: "Enter purpose description:"
  ↓
[步骤 5: 输入 Purpose]
  等待用户输入: "Debug Python errors"
  ↓
  保存状态: { ..., purpose: "Debug Python errors" }
  显示: "Generating AI content..."
  调用 AI 生成
  显示: [生成的完整内容]
  显示: "Confirm creation? (yes/no)"
  ↓
[步骤 6: 最终确认]
  等待用户输入: yes
  ↓
  创建 Agent 文件
  显示: "✅ Agent created!"
```

---

## 🔧 技术实现

### 1. 会话状态管理 (已实现)

**文件**: `packages/core/src/agents/AgentCreationSession.ts`

```typescript
export class AgentCreationSession {
  private state: AgentCreationState;

  // 当前步骤
  getCurrentStep(): CreationStep

  // 设置各个字段
  setName(name: string): CreationStep
  setScope(scope: 'project' | 'global'): CreationStep
  setModel(model: string): CreationStep
  setPurpose(purpose: string): CreationStep

  // 获取当前步骤的提示文本
  getPromptForCurrentStep(): string

  // 序列化/反序列化
  toJSON(): string
  static fromJSON(json: string): AgentCreationSession
}
```

### 2. CLI 命令实现

#### 方式 A: 使用普通消息检测 (简单但不完美)

**问题**: 无法区分用户输入是给 Agent 创建的还是其他命令

```typescript
// /agents begin 启动创建
{
  name: 'begin',
  action: async (context) => {
    const session = new AgentCreationSession();
    // 保存到某个地方 (临时文件或内存)

    const prompt = session.getPromptForCurrentStep();
    context.ui.addItem({ type: 'info', text: prompt });
  }
}

// 问题：如何接收用户的下一条输入？
// - 用户输入 "my-agent" 后，系统如何知道这是给创建流程的？
// - 用户可能输入其他命令 "/help"
```

#### 方式 B: 使用隐藏的内部命令 (推荐)

```typescript
// /agents begin - 启动创建，显示第一个提示
{
  name: 'begin',
  action: async (context) => {
    const session = new AgentCreationSession();
    const sessionId = session.getState().sessionId;

    // 保存会话到临时存储
    saveSession(sessionId, session);

    const prompt = session.getPromptForCurrentStep();
    context.ui.addItem({
      type: 'info',
      text: `${prompt}

**To continue, reply with:**
\`/agents next <sessionId> <your-input>\`

**To cancel:**
\`/agents cancel <sessionId>\``
    });
  }
}

// /agents next <sessionId> <input> - 处理用户输入并进入下一步
{
  name: 'next',
  hidden: true,  // 不在帮助中显示
  action: async (context, args) => {
    const [sessionId, ...inputParts] = args.split(' ');
    const input = inputParts.join(' ');

    // 恢复会话
    const session = loadSession(sessionId);
    const currentStep = session.getCurrentStep();

    // 处理当前步骤的输入
    switch (currentStep) {
      case CreationStep.NAME:
        session.setName(input);
        break;
      case CreationStep.SCOPE:
        if (input === '1') session.setScope('project');
        else if (input === '2') session.setScope('global');
        break;
      // ... 其他步骤
    }

    // 保存更新后的会话
    saveSession(sessionId, session);

    // 显示下一步提示
    const nextPrompt = session.getPromptForCurrentStep();
    context.ui.addItem({ type: 'info', text: nextPrompt });
  }
}
```

**缺点**:
- 用户需要手动输入 `/agents next <sessionId> ...`
- 不够流畅

#### 方式 C: 使用专用输入处理器 (最佳，需要架构修改)

需要在 CLI 主循环中添加"输入拦截器"：

```typescript
// 在 slashCommandProcessor.ts 中
if (activeAgentCreationSession) {
  // 拦截所有用户输入，发送给创建流程
  const session = activeAgentCreationSession;
  const result = handleCreationInput(session, userInput);

  if (result.completed) {
    // 创建完成
    activeAgentCreationSession = null;
  } else {
    // 显示下一步提示
    context.ui.addItem({ type: 'info', text: result.nextPrompt });
  }
  return; // 不执行其他命令
}
```

**优点**:
- 用户体验最好
- 直接输入，无需命令前缀

**缺点**:
- 需要修改核心输入处理逻辑
- 用户无法在创建过程中执行其他命令（需要先取消）

---

## 🎯 推荐的实际实现方案

考虑到架构限制和实现复杂度，我推荐**混合方案**：

### Phase 1: 改进的命令式交互 (立即可用)

使用简化的命令链，但让用户体验更流畅：

```bash
# 启动创建
/agents begin

# 显示:
📝 Agent Interactive Creation Started!

Step 1/8: Enter agent name (lowercase-with-hyphens)

Reply: /agents input my-agent

---

# 用户输入
/agents input my-agent

# 显示:
✅ Name set to: my-agent

Step 2/8: Choose scope
  1 - Project (.gemini/agents/)
  2 - Global (~/.gemini/agents/)

Reply: /agents input 1

---

# 继续这个流程直到完成
```

**实现要点**:
1. `/agents begin` - 启动会话，显示第一步
2. `/agents input <value>` - 提交当前步骤的输入
3. `/agents back` - 返回上一步
4. `/agents cancel` - 取消创建
5. `/agents status` - 查看当前状态

### Phase 2: 简化的快捷方式 (已实现)

对于不想逐步输入的用户，提供一行命令：

```bash
/agents create my-agent --ai --purpose "Debug errors"
```

这个已经在 P1 中实现了。

---

## 📝 实现步骤

### Step 1: 创建会话存储

```typescript
// packages/cli/src/services/AgentCreationSessionStore.ts
const sessions = new Map<string, AgentCreationSession>();

export function saveSession(id: string, session: AgentCreationSession) {
  sessions.set(id, session);
}

export function loadSession(id: string): AgentCreationSession | null {
  return sessions.get(id) || null;
}

export function deleteSession(id: string) {
  sessions.delete(id);
}
```

### Step 2: 实现 `/agents begin` 命令

```typescript
{
  name: 'begin',
  description: 'Start interactive agent creation',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext) => {
    const { AgentCreationSession } = await import('@google/gemini-cli-core');
    const session = new AgentCreationSession();
    const sessionId = session.getState().sessionId;

    // 保存会话
    saveSession(sessionId, session);

    // 显示第一步提示
    const prompt = session.getPromptForCurrentStep();

    context.ui.addItem({
      type: MessageType.INFO,
      text: `🎬 **Interactive Agent Creation Started!**

Session ID: \`${sessionId}\`

${prompt}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**To continue:**
\`\`\`
/agents input ${sessionId} <your-answer>
\`\`\`

**To cancel:**
\`\`\`
/agents cancel ${sessionId}
\`\`\`

**To check status:**
\`\`\`
/agents status ${sessionId}
\`\`\`
`
    }, Date.now());
  }
}
```

### Step 3: 实现 `/agents input` 命令

```typescript
{
  name: 'input',
  description: 'Provide input for interactive agent creation',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext, args: string) => {
    const parts = args.trim().split(/\s+/);
    const sessionId = parts[0];
    const input = parts.slice(1).join(' ');

    if (!sessionId || !input) {
      context.ui.addItem({
        type: MessageType.ERROR,
        text: 'Usage: /agents input <session-id> <your-input>'
      }, Date.now());
      return;
    }

    // 加载会话
    const session = loadSession(sessionId);
    if (!session) {
      context.ui.addItem({
        type: MessageType.ERROR,
        text: `Session ${sessionId} not found. It may have expired.`
      }, Date.now());
      return;
    }

    // 处理当前步骤的输入
    const currentStep = session.getCurrentStep();
    let error: string | null = null;

    switch (currentStep) {
      case CreationStep.NAME:
        if (!/^[a-z][a-z0-9-]*$/.test(input)) {
          error = 'Invalid name format. Use lowercase letters, numbers, and hyphens.';
        } else {
          session.setName(input);
        }
        break;

      case CreationStep.SCOPE:
        if (input === '1') {
          session.setScope('project');
        } else if (input === '2') {
          session.setScope('global');
        } else {
          error = 'Please enter 1 or 2';
        }
        break;

      case CreationStep.MODEL:
        const model = AgentCreationSession.parseModelChoice(input);
        if (model) {
          session.setModel(model);
        } else {
          error = 'Please enter a number between 1-6';
        }
        break;

      case CreationStep.CONTENT_METHOD:
        if (input === '1') {
          session.setContentMethod('ai');
        } else if (input === '2') {
          session.setContentMethod('manual');
        } else {
          error = 'Please enter 1 or 2';
        }
        break;

      case CreationStep.PURPOSE:
        if (input.length < 10) {
          error = 'Purpose description too short. Please be more specific.';
        } else {
          session.setPurpose(input);

          // 如果是 AI 模式，立即生成内容
          if (session.getState().contentMethod === 'ai') {
            context.ui.addItem({
              type: MessageType.INFO,
              text: '🤖 Generating AI content...'
            }, Date.now());

            // 调用 AI 生成
            const { AgentContentGenerator, ModelService } =
              await import('@google/gemini-cli-core');

            const modelService = new ModelService(context.services.config!);
            const generator = new AgentContentGenerator(modelService);
            const generated = await generator.generateContent(
              input,
              session.getState().name!,
              session.getState().title!
            );

            session.setGeneratedContent(generated.systemPrompt);

            context.ui.addItem({
              type: MessageType.INFO,
              text: `✨ **Generated Content:**

${'─'.repeat(70)}
${generated.systemPrompt}
${'─'.repeat(70)}
`
            }, Date.now());
          }
        }
        break;

      case CreationStep.CONFIRM:
        if (input.toLowerCase() === 'yes') {
          // 创建 Agent
          const state = session.getState();
          const agentManager = new AgentManager();

          await agentManager.createAgent({
            name: state.name!,
            title: state.title!,
            description: state.description,
            model: state.model!,
            scope: state.scope!,
            customSystemPrompt: state.generatedContent,
            allowTools: state.allowTools || ['read_file', 'grep', 'glob', 'bash'],
            denyTools: state.denyTools || [],
          });

          session.markComplete();
          deleteSession(sessionId);

          context.ui.addItem({
            type: MessageType.INFO,
            text: `✅ **Agent "${state.name}" Created Successfully!**

📁 File: ${state.scope === 'global' ? '~/' : ''}.gemini/agents/${state.name}.md

**Next Steps:**
  - View: \`/agents info ${state.name}\`
  - Edit: \`vim .gemini/agents/${state.name}.md\`
  - Validate: \`/agents validate ${state.name}\`
`
          }, Date.now());
          return;

        } else if (input.toLowerCase() === 'no') {
          deleteSession(sessionId);
          context.ui.addItem({
            type: MessageType.INFO,
            text: '❌ Agent creation cancelled.'
          }, Date.now());
          return;
        } else {
          error = 'Please enter "yes" or "no"';
        }
        break;
    }

    if (error) {
      context.ui.addItem({
        type: MessageType.ERROR,
        text: `❌ ${error}`
      }, Date.now());
      return;
    }

    // 保存会话并显示下一步
    saveSession(sessionId, session);

    const nextStep = session.getCurrentStep();
    if (nextStep === CreationStep.COMPLETE) {
      // 已完成
      return;
    }

    const nextPrompt = session.getPromptForCurrentStep();
    context.ui.addItem({
      type: MessageType.INFO,
      text: `${nextPrompt}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**To continue:**
\`\`\`
/agents input ${sessionId} <your-answer>
\`\`\`

**To go back:**
\`\`\`
/agents back ${sessionId}
\`\`\`

**To cancel:**
\`\`\`
/agents cancel ${sessionId}
\`\`\`
`
    }, Date.now());
  }
}
```

---

## 🎯 使用示例

### 完整的交互式创建流程

```bash
# 第 1 步：启动创建
> /agents begin

🎬 Interactive Agent Creation Started!

Session ID: `agent-create-1234567890-abc123`

📝 Step 1/8: Agent Name

Enter the agent name (lowercase with hyphens, e.g., "my-agent"):

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

To continue:
/agents input agent-create-1234567890-abc123 <your-answer>

---

# 第 2 步：输入名字
> /agents input agent-create-1234567890-abc123 my-debugger

✅ Name set to: my-debugger

📝 Step 2/8: Display Title (Optional)

Current name: my-debugger
Suggested title: My Debugger

Enter a custom title or press Enter to use the suggestion:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

To continue:
/agents input agent-create-1234567890-abc123 <your-answer>

---

# 第 3 步：跳过 title（使用默认）
> /agents input agent-create-1234567890-abc123

✅ Using suggested title: My Debugger

📝 Step 3/8: Description (Optional)

Name: my-debugger
Title: My Debugger

Enter a short description or press Enter to skip:

---

# 第 4 步：跳过 description
> /agents input agent-create-1234567890-abc123

📝 Step 4/8: Scope

Where should this agent be saved?

Reply with:
  1 - Project (.gemini/agents/) - Only this project
  2 - Global (~/.gemini/agents/) - All projects

Enter 1 or 2:

---

# 第 5 步：选择 project
> /agents input agent-create-1234567890-abc123 1

✅ Scope set to: project

📝 Step 5/8: Model Selection

Choose the AI model for this agent:

  1 - gemini-2.0-flash (Recommended - Fast, efficient)
  2 - gemini-2.0-flash-exp (Experimental features)
  3 - gemini-1.5-pro (More capable, slower)
  4 - claude-3.5-sonnet (Anthropic Claude)
  5 - gpt-4o (OpenAI GPT-4)
  6 - qwen-coder-turbo (Coding specialist)

Enter 1-6:

---

# 第 6 步：选择模型
> /agents input agent-create-1234567890-abc123 1

✅ Model set to: gemini-2.0-flash

📝 Step 6/8: Content Creation Method

How would you like to create the agent content?

  1 - AI Generate ⭐ - Describe purpose, AI creates content
  2 - Manual Template - Create empty template to fill yourself

Enter 1 or 2:

---

# 第 7 步：选择 AI 生成
> /agents input agent-create-1234567890-abc123 1

✅ Method set to: AI Generate

📝 Step 7/8: Agent Purpose (for AI generation)

Describe in detail what this agent should do.

Be specific! Good examples:
  ✅ "Debug Python and JavaScript errors with detailed explanations"
  ❌ "Debug code" (too vague)

Enter the purpose:

---

# 第 8 步：输入 purpose
> /agents input agent-create-1234567890-abc123 Debug Python and JavaScript errors with detailed explanations and step-by-step solutions

✅ Purpose set

🤖 Generating AI content...

✨ Generated Content:

──────────────────────────────────────────────────────────────────────
# Role

You are a debugging expert specializing in Python and JavaScript...

## Responsibilities

- Analyze error messages and stack traces
- Identify root causes of bugs
- Provide step-by-step debugging strategies
...

##Guidelines

...

## Constraints

...
──────────────────────────────────────────────────────────────────────

📝 Step 8/8: Tools (Optional)

Default tools: read_file, grep, glob, bash

Press Enter to use defaults:

---

# 第 9 步：使用默认工具
> /agents input agent-create-1234567890-abc123

✅ Using default tools

📋 Review Your Configuration:

  Name:        my-debugger
  Title:       My Debugger
  Description: (none)
  Scope:       project
  Model:       gemini-2.0-flash
  Method:      AI Generated
  Purpose:     Debug Python and JavaScript errors...
  Tools:       read_file, grep, glob, bash

Reply with:
  yes - Create this agent
  no - Cancel

---

# 第 10 步：确认创建
> /agents input agent-create-1234567890-abc123 yes

✅ Agent "my-debugger" Created Successfully!

📁 File: .gemini/agents/my-debugger.md

Next Steps:
  - View: /agents info my-debugger
  - Edit: vim .gemini/agents/my-debugger.md
  - Validate: /agents validate my-debugger
```

---

## 📊 方案对比

| 特性 | 一行命令 | 逐步交互式 |
|------|----------|------------|
| **速度** | 快 ⭐⭐⭐⭐⭐ | 慢 ⭐⭐ |
| **灵活性** | 高 ⭐⭐⭐⭐ | 中 ⭐⭐⭐ |
| **用户友好** | 需要记住参数 ⭐⭐ | 非常友好 ⭐⭐⭐⭐⭐ |
| **新手适用** | 不太适合 ⭐⭐ | 非常适合 ⭐⭐⭐⭐⭐ |
| **预览能力** | 支持 `--preview` ⭐⭐⭐⭐⭐ | 内置预览 ⭐⭐⭐⭐⭐ |
| **实现复杂度** | 简单 (已完成) | 中等 |

---

## ✅ 总结

### 已实现功能 (P1)
- ✅ 一行命令创建 (`/agents create name --ai --purpose "..."`)
- ✅ 预览模式 (`--preview`)
- ✅ 向导指南 (`/agents wizard`)

### 待实现功能 (P2)
- ⬜ 真正的逐步交互式创建 (`/agents begin` + `/agents input`)
- ⬜ 会话状态管理
- ⬜ 回退功能 (`/agents back`)
- ⬜ 会话状态查看 (`/agents status`)

### 推荐使用方式

**新手用户**:
```bash
/agents begin  # 启动逐步交互式创建 (P2 实现后)
```

**熟练用户**:
```bash
/agents create name --ai --purpose "..." [--preview]  # 一行命令 (P1 已支持)
```

---

**文档版本**: 1.0
**创建日期**: 2025-10-06

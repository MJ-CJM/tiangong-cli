# Interactive Creation - 交互式 Agent 创建

> **最后更新**: 2025-10-07
> **状态**: ✅ 已完成并测试

---

## 概述

交互式创建提供了逐步向导式的 Agent 创建体验，特别适合新手用户。

### 两种创建方式

| 方式 | 命令 | 适用场景 | 优势 |
|------|------|----------|------|
| **一行命令** | `/agents create` | 熟练用户、快速创建 | 高效、灵活 |
| **交互式** | `/agents begin` | 新手、学习、探索 | 引导式、清晰 |

---

## 交互式创建流程

### 9 个步骤

1. **NAME** - 输入 Agent 名称 (必需)
   - 格式: 小写字母、数字、连字符
   - 示例: `my-agent`, `code-reviewer`

2. **TITLE** - 输入显示标题 (可选)
   - 自动建议基于名称的标题
   - 可自定义或直接使用建议

3. **DESCRIPTION** - 输入描述 (可选)
   - 简短描述 Agent 的用途

4. **SCOPE** - 选择作用域
   - `1` - Project (`.gemini/agents/`)
   - `2` - Global (`~/.gemini/agents/`)

5. **MODEL** - 选择 AI 模型
   - `1` - gemini-2.0-flash (推荐)
   - `2` - gemini-2.0-flash-exp
   - `3` - gemini-2.5-pro
   - `4` - gemini-2.5-flash
   - `5` - claude-3.5-sonnet
   - `6` - gpt-4

6. **CONTENT_METHOD** - 选择内容生成方式
   - `1` - AI Generate (AI 自动生成)
   - `2` - Manual Template (手动编辑模板)

7. **PURPOSE** - 输入用途 (AI 模式必需)
   - 详细描述 Agent 的职责和任务
   - AI 根据此描述生成系统提示词

8. **TOOLS** - 配置工具权限 (可选)
   - 留空使用默认工具
   - 或输入自定义工具列表

9. **CONFIRM** - 最终确认
   - 审查所有配置
   - 确认创建或取消

---

## 命令参考

### `/agents begin`

启动交互式创建会话。

```bash
/agents begin

# 输出:
🎬 Interactive Agent Creation Started!

Session ID: `agent-create-1234567890-abc123`

📝 Step 1/9: Agent Name

Enter the agent name (lowercase with hyphens):

To continue: /agents next agent-create-1234567890-abc123 <your-answer>
```

### `/agents next <session-id> [input]`

提交当前步骤的输入并进入下一步。

```bash
# 输入名称
/agents next agent-create-1234567890-abc123 my-agent

# 跳过可选字段（按回车）
/agents next agent-create-1234567890-abc123

# 选择选项
/agents next agent-create-1234567890-abc123 1
```

**验证规则**:
- 名称必须是小写字母、数字、连字符
- Scope 必须是 1 或 2
- Model 必须是 1-6
- Purpose 至少 10 个字符（AI 模式）

### `/agents status [session-id]`

查看创建进度。

```bash
# 列出所有会话
/agents status

# 查看特定会话
/agents status agent-create-1234567890-abc123

# 输出:
📊 Creation Session Status

Session ID: agent-create-1234567890-abc123
Current Step: Model (model)
Started: 10/7/2025, 10:30:00 AM

Progress:
  ✅ Name
  ✅ Title
  ✅ Description
  ✅ Scope
  ⏳ Model
  ⬜ Content Method
  ⬜ Purpose
  ⬜ Tools
  ⬜ Confirmation
```

### `/agents cancel <session-id>`

取消创建并删除会话。

```bash
/agents cancel agent-create-1234567890-abc123

# 输出:
✅ Session cancelled and deleted.
```

---

## 完整示例

### 创建一个代码审查 Agent

```bash
# Step 1: 启动会话
> /agents begin
Session ID: agent-create-1759721587485-abc123

# Step 2: 输入名称
> /agents next agent-create-1759721587485-abc123 code-reviewer
✅ Input accepted.
📝 Step 2/9: Display Title

# Step 3: 使用建议的标题
> /agents next agent-create-1759721587485-abc123
📝 Step 3/9: Description

# Step 4: 添加描述
> /agents next agent-create-1759721587485-abc123 Reviews code for best practices and potential bugs
📝 Step 4/9: Scope

# Step 5: 选择 project
> /agents next agent-create-1759721587485-abc123 1
📝 Step 5/9: Model Selection

# Step 6: 选择 gemini-2.0-flash
> /agents next agent-create-1759721587485-abc123 1
📝 Step 6/9: Content Creation Method

# Step 7: 选择 AI 生成
> /agents next agent-create-1759721587485-abc123 1
📝 Step 7/9: Agent Purpose

# Step 8: 输入详细用途
> /agents next agent-create-1759721587485-abc123 Review code for best practices, security issues, and potential bugs. Provide detailed feedback with examples.

🤖 Generating AI content...

✨ AI Generated Content:
──────────────────────────────────────────────
# Role
You are a code review specialist...

## Responsibilities
- Analyze code for best practices violations
- Identify security vulnerabilities
- Detect potential bugs and edge cases
...
──────────────────────────────────────────────

📝 Step 8/9: Tools

# Step 9: 使用默认工具
> /agents next agent-create-1759721587485-abc123

📋 Review Your Configuration:
  Name:        code-reviewer
  Title:       Code Reviewer
  Description: Reviews code for best practices...
  Scope:       project
  Model:       gemini-2.0-flash
  Method:      AI Generated
  ...

Reply with 'yes' to create or 'no' to cancel.

# Step 10: 确认创建
> /agents next agent-create-1759721587485-abc123 yes

✅ Agent "code-reviewer" Created Successfully!

📁 File Location:
   .gemini/agents/code-reviewer.md

📝 Next Steps:
   1. Review: cat .gemini/agents/code-reviewer.md
   2. Validate: /agents validate code-reviewer
   3. Run: /agents run code-reviewer "review this code"
```

---

## 实现细节

### 核心类

#### AgentCreationSession

会话状态管理类，跟踪创建进度。

```typescript
class AgentCreationSession {
  private currentStep: CreationStep;
  private state: CreationState;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.currentStep = CreationStep.NAME;
    this.state = { /* 初始状态 */ };
  }

  // 提交输入并前进到下一步
  submitInput(input: string): { success: boolean; error?: string } {
    // 验证输入
    // 保存到状态
    // 前进到下一步
  }

  // 获取当前步骤的提示
  getCurrentPrompt(): string {
    // 根据当前步骤返回提示文本
  }
}
```

#### AgentCreationSessionStore

会话存储服务，管理所有活动会话。

```typescript
class AgentCreationSessionStore {
  private sessions: Map<string, AgentCreationSession>;

  save(session: AgentCreationSession): void {
    this.sessions.set(session.sessionId, session);
  }

  load(sessionId: string): AgentCreationSession | null {
    return this.sessions.get(sessionId) || null;
  }

  delete(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  listAll(): AgentCreationSession[] {
    return Array.from(this.sessions.values());
  }
}
```

### 状态机设计

```typescript
enum CreationStep {
  NAME = 'name',
  TITLE = 'title',
  DESCRIPTION = 'description',
  SCOPE = 'scope',
  MODEL = 'model',
  CONTENT_METHOD = 'content_method',
  PURPOSE = 'purpose',
  TOOLS = 'tools',
  CONFIRM = 'confirm',
  COMPLETE = 'complete',
}

const STEP_ORDER = [
  CreationStep.NAME,
  CreationStep.TITLE,
  CreationStep.DESCRIPTION,
  CreationStep.SCOPE,
  CreationStep.MODEL,
  CreationStep.CONTENT_METHOD,
  CreationStep.PURPOSE,  // 仅 AI 模式
  CreationStep.TOOLS,
  CreationStep.CONFIRM,
];
```

### 输入验证

每个步骤都有独立的验证逻辑：

```typescript
function validateInput(step: CreationStep, input: string): string | null {
  switch (step) {
    case CreationStep.NAME:
      if (!/^[a-z][a-z0-9-]*$/.test(input)) {
        return 'Name must start with a letter and contain only lowercase letters, numbers, and hyphens';
      }
      break;

    case CreationStep.SCOPE:
      if (!['1', '2'].includes(input)) {
        return 'Please enter 1 for project or 2 for global';
      }
      break;

    case CreationStep.MODEL:
      if (!['1', '2', '3', '4', '5', '6'].includes(input)) {
        return 'Please enter a number between 1 and 6';
      }
      break;

    case CreationStep.PURPOSE:
      if (input.length < 10) {
        return 'Purpose description should be at least 10 characters';
      }
      break;
  }
  return null;  // 验证通过
}
```

---

## AI 内容生成

当用户选择 AI 生成模式时，系统会：

1. 收集用户输入的 purpose
2. 调用 ModelService 生成内容
3. 解析生成的结构化内容
4. 显示完整的生成内容给用户
5. 保存到会话状态

```typescript
// AgentCreationSession.ts
async generateContent(modelService: ModelService): Promise<void> {
  const generator = new AgentContentGenerator(modelService);

  const result = await generator.generateContent(
    this.state.name!,
    this.state.purpose!,
    'project'  // TODO: 使用实际 scope
  );

  this.state.generatedContent = result.systemPrompt;
}
```

---

## 测试

### 单元测试

```typescript
describe('AgentCreationSession', () => {
  it('should start at NAME step', () => {
    const session = new AgentCreationSession('test-id');
    expect(session.getCurrentStep()).toBe(CreationStep.NAME);
  });

  it('should validate name format', () => {
    const session = new AgentCreationSession('test-id');
    const result = session.submitInput('InvalidName');
    expect(result.success).toBe(false);
    expect(result.error).toContain('lowercase');
  });

  it('should advance to next step on valid input', () => {
    const session = new AgentCreationSession('test-id');
    session.submitInput('valid-name');
    expect(session.getCurrentStep()).toBe(CreationStep.TITLE);
  });
});
```

### 集成测试

完整流程测试覆盖所有 9 个步骤。

---

## 优势对比

| 特性 | 一行命令 | 交互式创建 |
|------|---------|-----------|
| **创建速度** | ⚡ 快 | 🐢 较慢 |
| **学习曲线** | 📚 需要记参数 | 🎓 引导式学习 |
| **错误提示** | 一次性 | 实时反馈 |
| **适合用户** | 熟练 | 新手 |
| **灵活性** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **可取消性** | 命令前 | 任何步骤 |
| **进度查看** | ❌ | ✅ |

---

## 未来增强

### 1. 回退功能

```bash
/agents back <session-id>
# 返回上一步修改输入
```

### 2. 会话持久化

- 保存会话到文件
- CLI 重启后恢复会话

### 3. 编辑功能

```bash
/agents edit-session <session-id> <field>
# 在确认步骤修改任意字段
```

### 4. 模板保存

```bash
/agents save-template <session-id> <template-name>
# 保存当前配置为模板
/agents use-template <template-name>
# 应用模板快速创建
```

---

## 总结

交互式创建提供了友好的 Agent 创建体验：

- ✅ **9 步向导** - 清晰的创建流程
- ✅ **实时验证** - 每步独立验证
- ✅ **AI 集成** - 自动生成系统提示词
- ✅ **会话管理** - 支持多个并发会话
- ✅ **灵活取消** - 任何步骤都可以取消
- ✅ **进度追踪** - `/agents status` 查看进度

**状态**: ✅ 已完成，生产就绪

---

**文档版本**: 2.0 (整合版)
**创建日期**: 2025-10-06
**最后更新**: 2025-10-07

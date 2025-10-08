# Agent 上下文模式设计方案

> **设计目标**: 支持 agent 独立上下文和共享上下文两种模式

**设计日期**: 2025-10-06

---

## 📋 目录

- [需求分析](#需求分析)
- [设计方案](#设计方案)
- [实现细节](#实现细节)
- [使用示例](#使用示例)
- [实现步骤](#实现步骤)

---

## 需求分析

### 使用场景

#### 场景 1: 独立上下文（当前默认）

**适用情况**:
- 不同 agents 处理不同任务
- 希望避免上下文污染
- 每个 agent 专注于自己的领域

**示例**:
```bash
# code_review agent 分析代码
> @code_review 分析 file.py
Agent: [代码审查报告]

# test_runner agent 运行测试（看不到 code_review 的历史）
> @test_runner 运行测试
Agent: [测试结果]  # 从零开始，不知道之前的代码审查
```

#### 场景 2: 共享上下文（新需求）

**适用情况**:
- 多个 agents 协作完成同一任务
- 希望 agents 之间能看到彼此的对话
- 需要连贯的工作流

**示例**:
```bash
# code_review agent 分析代码
> @code_review 分析 file.py
Agent: [发现3个问题]

# fix_bugs agent 可以看到 code_review 的结果
> @fix_bugs 修复上述问题
Agent: 根据 code_review 发现的3个问题，我来修复...  # 能看到之前的上下文！
```

### 核心需求

1. **支持两种模式**:
   - **独立模式** (Isolated): 每个 agent 有自己的上下文
   - **共享模式** (Shared): 所有 agents 共享主会话上下文

2. **灵活配置**:
   - 全局配置（所有 agents 的默认行为）
   - Agent 级配置（单个 agent 覆盖全局设置）
   - 运行时配置（临时切换模式）

3. **向后兼容**:
   - 现有 agents 继续使用独立模式（默认）
   - 不破坏现有功能

---

## 设计方案

### 方案概览

```
┌─────────────────────────────────────────────────────────────┐
│                     主会话上下文                              │
│  User: 你好                                                  │
│  Gemini: 你好！有什么可以帮你？                              │
│  User: @code_review 分析 file.py                            │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
                          ↓ 共享模式
        ┌─────────────────┼─────────────────┐
        ↓                 ↓                 ↓
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ code_review   │  │  fix_bugs     │  │  test_runner  │
│ 独立上下文     │  │  独立上下文    │  │  共享上下文    │
│               │  │               │  │  (指向主上下文) │
│ User: 分析... │  │ User: 修复... │  │               │
│ Agent: ...    │  │ Agent: ...    │  │               │
└───────────────┘  └───────────────┘  └───────────────┘
```

### 上下文模式枚举

```typescript
enum ContextMode {
  ISOLATED = 'isolated',  // 独立上下文（默认）
  SHARED = 'shared',      // 共享主会话上下文
}
```

### 配置层级

**优先级**（从高到低）:

1. **运行时参数** - `/agents run <name> <prompt> --context shared`
2. **Agent 定义** - Agent 文件中的 `contextMode` 字段
3. **全局配置** - `settings.json` 中的 `agents.defaultContextMode`
4. **系统默认** - `isolated`

---

## 实现细节

### 1. Agent 定义扩展

在 Agent 的 YAML front-matter 中添加 `contextMode` 字段：

```yaml
---
kind: agent
name: fix-bugs
title: Bug Fixer
contextMode: shared  # ← 新增字段
tools:
  allow:
    - read_file
    - edit_file
---

# System Prompt
You are a bug fixer. You can see the conversation history
from other agents to understand the context.
```

### 2. 类型定义更新

**`packages/core/src/agents/types.ts`**:

```typescript
/**
 * Agent 定义
 */
export interface AgentDefinition {
  kind: 'agent';
  name: string;
  title: string;
  description?: string;
  model?: string;
  color?: string;
  scope?: 'global' | 'project';
  version?: string;

  /** 上下文模式 */
  contextMode?: 'isolated' | 'shared';  // ← 新增

  tools?: {
    allow?: string[];
    deny?: string[];
  };
  mcp?: {
    servers?: string[];
  };

  systemPrompt: string;
  filePath: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Agent 执行选项
 */
export interface AgentExecuteOptions {
  stream?: boolean;
  maxTokens?: number;
  temperature?: number;
  interactive?: boolean;

  /** 强制使用特定上下文模式（覆盖 agent 定义） */
  contextMode?: 'isolated' | 'shared';  // ← 新增

  onToolCall?: (toolName: string, args: any) => void;
  onToolResult?: (toolName: string, result: any, error?: Error) => void;
}
```

### 3. ContextManager 扩展

**`packages/core/src/agents/ContextManager.ts`**:

```typescript
/**
 * 上下文管理器 - 支持独立和共享模式
 */
export class ContextManager {
  private contexts: Map<string, AgentContext> = new Map();

  // ← 新增：主会话上下文引用
  private mainSessionContext: UnifiedMessage[] | null = null;

  /**
   * 设置主会话上下文（用于共享模式）
   */
  setMainSessionContext(context: UnifiedMessage[]): void {
    this.mainSessionContext = context;
  }

  /**
   * 获取主会话上下文
   */
  getMainSessionContext(): UnifiedMessage[] {
    return this.mainSessionContext || [];
  }

  /**
   * 获取或创建 agent 上下文
   *
   * @param agentName - Agent 名称
   * @param mode - 上下文模式
   */
  getContext(
    agentName: string,
    mode: 'isolated' | 'shared' = 'isolated'
  ): AgentContext {
    // 共享模式：返回指向主会话上下文的特殊 context
    if (mode === 'shared') {
      return this.getSharedContext(agentName);
    }

    // 独立模式：返回 agent 自己的上下文
    let context = this.contexts.get(agentName);

    if (!context) {
      context = {
        agentName,
        conversationHistory: [],
        metadata: { mode: 'isolated' },
        createdAt: new Date(),
        lastAccessedAt: new Date(),
      };
      this.contexts.set(agentName, context);
    } else {
      context.lastAccessedAt = new Date();
    }

    return context;
  }

  /**
   * 获取共享上下文
   */
  private getSharedContext(agentName: string): AgentContext {
    // 检查是否已有共享上下文记录
    let sharedContext = this.contexts.get(`__shared__${agentName}`);

    if (!sharedContext) {
      sharedContext = {
        agentName,
        conversationHistory: this.mainSessionContext || [],  // ← 指向主会话
        metadata: { mode: 'shared' },
        createdAt: new Date(),
        lastAccessedAt: new Date(),
      };
      this.contexts.set(`__shared__${agentName}`, sharedContext);
    } else {
      // 更新引用（确保指向最新的主会话上下文）
      sharedContext.conversationHistory = this.mainSessionContext || [];
      sharedContext.lastAccessedAt = new Date();
    }

    return sharedContext;
  }

  /**
   * 添加消息到上下文
   */
  addMessage(
    agentName: string,
    message: UnifiedMessage,
    mode: 'isolated' | 'shared' = 'isolated'
  ): void {
    if (mode === 'shared') {
      // 共享模式：添加到主会话上下文
      if (this.mainSessionContext) {
        this.mainSessionContext.push(message);
      }
    } else {
      // 独立模式：添加到 agent 自己的上下文
      const context = this.getContext(agentName, 'isolated');
      context.conversationHistory.push(message);
    }
  }

  /**
   * 获取上下文模式
   */
  getContextMode(agentName: string): 'isolated' | 'shared' {
    const isolatedContext = this.contexts.get(agentName);
    if (isolatedContext?.metadata?.mode === 'isolated') {
      return 'isolated';
    }

    const sharedContext = this.contexts.get(`__shared__${agentName}`);
    if (sharedContext?.metadata?.mode === 'shared') {
      return 'shared';
    }

    return 'isolated';  // 默认
  }

  /**
   * 清除上下文
   */
  clearHistory(agentName: string): void {
    // 清除独立上下文
    const isolatedContext = this.contexts.get(agentName);
    if (isolatedContext) {
      isolatedContext.conversationHistory = [];
      isolatedContext.lastAccessedAt = new Date();
    }

    // 清除共享上下文记录（但不清除主会话）
    const sharedContext = this.contexts.get(`__shared__${agentName}`);
    if (sharedContext) {
      this.contexts.delete(`__shared__${agentName}`);
    }
  }
}
```

### 4. AgentExecutor 更新

**`packages/core/src/agents/AgentExecutor.ts`**:

```typescript
/**
 * 执行 agent
 */
async execute(
  agentName: string,
  prompt: string,
  options: AgentExecuteOptions = {}
): Promise<AgentExecuteResponse> {
  const startTime = Date.now();

  // 获取 agent 定义
  const agent = this.agentManager.getAgent(agentName);
  if (!agent) {
    throw new Error(`Agent '${agentName}' not found`);
  }

  // 确定上下文模式（优先级：运行时 > agent 定义 > 默认）
  const contextMode =
    options.contextMode ||           // 运行时参数
    agent.contextMode ||              // agent 定义
    'isolated';                       // 默认值

  // 获取或创建上下文
  const context = this.contextManager.getContext(agentName, contextMode);

  // 添加用户消息
  const userMessage: UnifiedMessage = {
    role: MessageRole.USER,
    content: [{ type: 'text', text: prompt }],
  };

  this.contextManager.addMessage(agentName, userMessage, contextMode);

  // ... 其余执行逻辑保持不变

  // 在返回结果中包含上下文模式信息
  return {
    agentName,
    text: finalText,
    context,
    metadata: {
      model: agent.model || this.config.getModel() || 'gemini-2.0-flash',
      tokensUsed: totalTokensUsed,
      durationMs: Date.now() - startTime,
      iterations: iteration,
      contextMode,  // ← 添加上下文模式信息
    },
  };
}
```

### 5. Config 全局配置

**`~/.gemini/settings.json`**:

```json
{
  "agents": {
    "defaultContextMode": "isolated",
    "allowSharedContext": true
  }
}
```

### 6. 命令行支持

**`/agents run` 命令扩展**:

```bash
# 使用 agent 默认模式
/agents run fix-bugs 修复代码

# 强制使用独立模式
/agents run fix-bugs 修复代码 --context isolated

# 强制使用共享模式
/agents run fix-bugs 修复代码 --context shared
```

**自然语言支持**:

```bash
# 默认模式
@fix-bugs 修复代码

# 使用共享上下文（需要特殊语法）
@fix-bugs --shared 修复代码
```

### 7. 新增管理命令

```bash
# 查看 agent 上下文模式
/agents context <agent-name>

# 切换 agent 上下文模式（仅当前会话）
/agents context <agent-name> --mode shared|isolated

# 显示所有 agents 的上下文模式
/agents context --all
```

---

## 使用示例

### 示例 1: 代码审查 + 修复工作流（共享上下文）

#### Agent 定义

**`.gemini/agents/code-reviewer.md`**:
```yaml
---
kind: agent
name: code-reviewer
title: Code Reviewer
contextMode: isolated  # 独立审查，不需要历史
tools:
  allow: [read_file, grep]
---
Analyze code quality and identify issues.
```

**`.gemini/agents/bug-fixer.md`**:
```yaml
---
kind: agent
name: bug-fixer
title: Bug Fixer
contextMode: shared  # 共享上下文，能看到 code-reviewer 的结果
tools:
  allow: [read_file, edit_file]
---
Fix bugs based on code review feedback.
You can see the conversation history to understand what needs to be fixed.
```

#### 使用流程

```bash
# 步骤 1: 代码审查
> @code-reviewer 分析 src/utils.py

Code Reviewer:
发现3个问题：
1. 第12行：未处理空值
2. 第25行：变量名不规范
3. 第40行：缺少错误处理

# 步骤 2: 修复（bug-fixer 可以看到上面的审查结果）
> @bug-fixer 修复上述问题

Bug Fixer:
我看到 code-reviewer 发现了3个问题，现在开始修复：

1. 第12行添加空值检查...
   ╭────────────────────────────╮
   │ ✓  EditFile src/utils.py   │
   ╰────────────────────────────╯

2. 第25行重命名变量...
   ╭────────────────────────────╮
   │ ✓  EditFile src/utils.py   │
   ╰────────────────────────────╯

3. 第40行添加 try-catch...
   ╭────────────────────────────╮
   │ ✓  EditFile src/utils.py   │
   ╰────────────────────────────╯

所有问题已修复！
```

### 示例 2: 强制使用共享模式

```bash
# 即使 agent 默认是独立模式，也可以临时使用共享模式
/agents run code-reviewer 分析代码 --context shared
```

### 示例 3: 查看和切换上下文模式

```bash
# 查看当前模式
> /agents context bug-fixer

Agent: bug-fixer
Context Mode: shared
Linked to: Main Session

# 临时切换为独立模式（仅本次会话）
> /agents context bug-fixer --mode isolated

✓ Context mode changed to isolated for this session

# 再次查看
> /agents context bug-fixer

Agent: bug-fixer
Context Mode: isolated (session override)
Original Mode: shared
```

---

## 实现步骤

### Phase 1: 核心功能 (1-2天)

1. **更新类型定义**
   - [ ] `AgentDefinition` 添加 `contextMode` 字段
   - [ ] `AgentExecuteOptions` 添加 `contextMode` 选项
   - [ ] `AgentExecuteResponse.metadata` 添加 `contextMode`

2. **扩展 ContextManager**
   - [ ] 添加 `setMainSessionContext()`
   - [ ] 修改 `getContext()` 支持模式参数
   - [ ] 实现 `getSharedContext()`
   - [ ] 修改 `addMessage()` 支持模式参数

3. **更新 AgentExecutor**
   - [ ] 修改 `execute()` 确定上下文模式
   - [ ] 传递模式到 ContextManager
   - [ ] 返回模式信息

4. **更新 AgentValidator**
   - [ ] 验证 `contextMode` 字段值

### Phase 2: 主会话集成 (1天)

5. **GeminiClient 集成**
   - [ ] 将主会话上下文传递给 AgentExecutor
   - [ ] 在 Config 初始化时设置主会话上下文引用

### Phase 3: CLI 命令 (1天)

6. **更新 `/agents run` 命令**
   - [ ] 支持 `--context` 参数
   - [ ] 显示上下文模式信息

7. **新增 `/agents context` 命令**
   - [ ] 查看 agent 上下文模式
   - [ ] 临时切换模式

### Phase 4: 配置和文档 (0.5天)

8. **配置文件**
   - [ ] 添加 `agents.defaultContextMode` 配置
   - [ ] 添加 `agents.allowSharedContext` 开关

9. **文档**
   - [ ] 更新用户指南
   - [ ] 添加使用示例
   - [ ] 更新命令参考

### Phase 5: 测试 (0.5天)

10. **测试用例**
    - [ ] 独立模式测试
    - [ ] 共享模式测试
    - [ ] 模式切换测试
    - [ ] 多 agent 协作测试

---

## 技术考虑

### 1. 内存管理

**问题**: 共享模式下，主会话上下文可能很大

**解决方案**:
- 限制共享上下文的长度（如最近100条消息）
- 提供上下文窗口配置
- 自动压缩旧消息

### 2. 并发控制

**问题**: 多个 agents 同时修改主会话上下文

**解决方案**:
- 当前是单线程执行，不需要锁
- 未来如果支持并发，使用消息队列

### 3. 上下文污染

**问题**: 共享模式可能导致 agent 看到不相关的信息

**解决方案**:
- 提供上下文过滤（只共享特定类型的消息）
- Agent 可以配置 `contextFilter`
- 添加上下文标记（哪些消息来自哪个 agent）

### 4. 向后兼容

**保证**:
- 默认模式是 `isolated`
- 现有 agents 不受影响
- 新字段都是可选的

---

## 配置示例

### Agent 定义示例

**独立模式 agent**:
```yaml
---
kind: agent
name: code-reviewer
title: Code Reviewer
contextMode: isolated  # 或省略（默认）
---
```

**共享模式 agent**:
```yaml
---
kind: agent
name: bug-fixer
title: Bug Fixer
contextMode: shared
---
```

### 全局配置示例

```json
{
  "agents": {
    "defaultContextMode": "isolated",
    "allowSharedContext": true,
    "sharedContextMaxMessages": 100
  }
}
```

---

## 后续扩展

### 高级功能（未来）

1. **选择性共享**
   - 只共享特定 agent 的对话
   - 配置共享范围

2. **上下文命名空间**
   - 多个共享上下文组
   - Agent 可以选择加入哪个组

3. **上下文过滤**
   - 基于消息类型过滤
   - 基于时间过滤

4. **上下文可视化**
   - 显示上下文引用关系图
   - 查看哪些 agents 共享上下文

---

## 总结

### 核心设计原则

1. **简单优先**: 默认独立模式，需要时启用共享
2. **灵活配置**: 支持全局、agent 级、运行时三层配置
3. **向后兼容**: 不破坏现有功能
4. **清晰明确**: 用户知道 agent 使用的是哪种模式

### 预期效果

- ✅ 支持 agent 独立工作
- ✅ 支持 agents 协作工作流
- ✅ 用户可以灵活控制上下文共享
- ✅ 保持简单易用

---

**设计者**: Claude Code
**设计日期**: 2025-10-06
**预计实现时间**: 3-4 天

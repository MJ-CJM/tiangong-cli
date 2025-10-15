# Context Mode - 上下文模式

> **最后更新**: 2025-10-07
> **状态**: ✅ 已完成并测试

---

## 概述

Context Mode 是 Agents 系统的核心特性，控制 Agent 如何访问和使用对话历史。

### 两种模式

| 模式 | 说明 | 使用场景 |
|------|------|----------|
| **Isolated** | 独立上下文，Agent 无法访问主会话历史 | 专门任务、需要明确边界 |
| **Shared** | 共享上下文，Agent 可以访问主会话历史 | 需要连续性、引用之前讨论 |

---

## 设计原理

### Isolated 模式 (默认)

**核心原则**: Agent 只能访问其自己的对话历史。

**工作流程**:
```
Main Session History:
  User: 我们的项目使用 React
  Assistant: 好的，我会记住

Agent Execution (@my-agent "帮我写个组件"):
  ┌─────────────────────────────────┐
  │ Agent Context (Isolated)        │
  │                                  │
  │ History:                        │
  │   [Empty on first run]          │
  │                                  │
  │ User: 帮我写个组件               │
  │ Agent: 我不知道你们用什么框架... │
  └─────────────────────────────────┘
```

**特性**:
- ✅ 完全隔离，无上下文泄露
- ✅ 清晰的任务边界
- ✅ 避免上下文污染
- ✅ 每次执行独立可重复

**提示词注入**:
```markdown
**IMPORTANT - Context Mode: Isolated**

You are running in ISOLATED context mode. You do NOT have access to the main
conversation history. Your conversation history only includes messages directly
exchanged with the user in your isolated context.

When the user asks you to reference "previous content", clearly state:
"I'm running in isolated context mode and don't have access to previous
conversations. Could you please provide the specific content you'd like me
to work with?"
```

### Shared 模式

**核心原则**: Agent 可以访问主会话的对话历史。

**工作流程**:
```
Main Session History:
  User: 我们的项目使用 React
  Assistant: 好的，我会记住

Agent Execution (@my-agent --context-mode shared "帮我写个组件"):
  ┌─────────────────────────────────────────┐
  │ Agent Context (Shared)                  │
  │                                          │
  │ History (from Main Session):            │
  │   User: 我们的项目使用 React            │
  │   Assistant: 好的，我会记住              │
  │                                          │
  │ Current Task:                           │
  │   User: 帮我写个组件                    │
  │   Agent: 这是一个 React 组件...         │
  └─────────────────────────────────────────┘
```

**特性**:
- ✅ 可以引用主会话内容
- ✅ 上下文连续性
- ✅ 适合需要背景信息的任务
- ⚠️ 可能混入无关信息

**提示词注入**:
```markdown
**Context Mode**: You are running in SHARED context mode. You have access to
the main conversation history and can reference previous discussions from the
main session.
```

---

## 实现细节

### 核心类

#### ContextManager

**职责**: 管理所有 Agent 的上下文

```typescript
class ContextManager {
  private contexts: Map<string, AgentContext>;

  // 获取或创建上下文
  getContext(agentName: string, mode?: ContextMode): AgentContext {
    const key = mode === 'shared' ? '__main__' : agentName;
    // ...
  }

  // 添加消息到历史
  addMessage(agentName: string, message: UnifiedMessage, mode?: ContextMode): void {
    const context = this.getContext(agentName, mode);
    context.conversationHistory.push(message);
  }

  // 清空历史
  clearHistory(agentName: string, mode?: ContextMode): void {
    const context = this.getContext(agentName, mode);
    context.conversationHistory = [];
  }
}
```

#### AgentContext

**职责**: 存储单个 Agent 的上下文数据

```typescript
interface AgentContext {
  agentName: string;
  conversationHistory: UnifiedMessage[];
  metadata: {
    createdAt: number;
    lastAccessedAt: number;
    messageCount: number;
  };
}
```

### 上下文键映射

```typescript
// Isolated 模式: 每个 Agent 独立的键
isolated: agentName → 'my-agent'

// Shared 模式: 使用主会话键
shared: agentName → '__main__'
```

### 系统提示词构建

```typescript
private buildSystemMessage(
  agent: AgentDefinition,
  contextMode: 'isolated' | 'shared',
  context: AgentContext
): string {
  let systemMessage = agent.systemPrompt || '';

  if (contextMode === 'isolated') {
    const hasHistory = context.conversationHistory.length > 1;

    if (!hasHistory) {
      systemMessage += `\n\n**IMPORTANT - Context Mode: Isolated**\n\n` +
        `You are running in ISOLATED context mode...`;
    } else {
      systemMessage += `\n\n**Context Mode**: You are running in isolated ` +
        `context mode. You can reference your own conversation history...`;
    }
  } else if (contextMode === 'shared') {
    systemMessage += `\n\n**Context Mode**: You are running in SHARED ` +
      `context mode. You have access to the main conversation history...`;
  }

  return systemMessage;
}
```

---

## 配置方式

### Agent 定义中配置 (默认模式)

```yaml
---
name: my-agent
contextMode: isolated  # 或 shared
---
```

### 运行时覆盖

```bash
# 使用默认 contextMode
/agents run my-agent "prompt"

# 运行时指定 shared
/agents run my-agent --context-mode shared "prompt"

# 运行时指定 isolated
/agents run my-agent --context-mode isolated "prompt"
```

### 优先级

```
运行时参数 > Agent 定义 > 默认值 (isolated)
```

---

## 使用场景

### 适合 Isolated 模式

1. **调试分析** - 分析特定错误，不需要项目背景
   ```bash
   @debugger 分析这个错误: [错误信息]
   ```

2. **代码审查** - 审查特定代码片段
   ```bash
   @reviewer 审查这段代码: [代码]
   ```

3. **文档生成** - 基于提供的代码生成文档
   ```bash
   @doc-generator 为这个函数生成文档: [函数代码]
   ```

4. **通用任务** - 大多数不需要历史的任务
   ```bash
   @code-imple 实现快速排序算法
   ```

### 适合 Shared 模式

1. **基于上下文的任务** - 需要引用之前讨论
   ```bash
   Main: 我们的项目是个电商网站，用 React + Node.js

   @architect --context-mode shared 设计一个用户认证模块
   # Agent 可以看到项目技术栈
   ```

2. **连续性任务** - 多步骤工作流
   ```bash
   Main: 这是我们的数据库 schema [schema]

   @backend --context-mode shared 实现用户 API
   # Agent 可以看到 schema
   ```

3. **总结和归纳** - 总结主会话讨论
   ```bash
   Main: [长时间讨论...]

   @summarizer --context-mode shared 总结我们的讨论
   # Agent 可以访问完整讨论历史
   ```

---

## 常见问题

### Q1: 为什么 Isolated 是默认模式？

**A**: 基于以下原因：

1. **安全性** - 防止意外泄露敏感信息
2. **可预测性** - Agent 行为更可控
3. **清晰性** - 任务边界明确
4. **最小权限** - 遵循最小权限原则

用户需要 shared 模式时可以显式指定。

### Q2: Shared 模式会不会影响性能？

**A**: 有轻微影响：

- **Token 使用** - 主会话历史较长时会使用更多 token
- **响应时间** - 上下文更长，模型处理稍慢
- **建议** - 定期清理主会话历史 (`clear` 命令)

### Q3: 能否在同一会话中混合使用两种模式？

**A**: 可以，每次调用独立指定：

```bash
# 第一次用 isolated
@agent1 task1

# 第二次用 shared
@agent2 --context-mode shared task2

# 第三次又用 isolated
@agent1 task3
```

### Q4: Agent 自己的历史会保留吗？

**A**: 取决于模式：

- **Isolated**: Agent 自己的历史会保留，下次调用同一 Agent 可访问
- **Shared**: 使用主会话历史，Agent 特定历史不保留

### Q5: 如何清空 Agent 历史？

**A**: 使用 `/agents clear` 命令 (计划中)。

当前可以重启 CLI 清空所有历史。

---

## 实现历程

### Phase 1: 初始设计 (2025-10-04)
- ✅ 定义两种模式
- ✅ 设计 ContextManager 架构

### Phase 2: 核心实现 (2025-10-05)
- ✅ 实现 ContextManager
- ✅ 实现上下文键映射
- ✅ 集成到 AgentExecutor

### Phase 3: 提示词优化 (2025-10-06)
- ✅ 添加上下文模式说明
- ✅ 区分首次调用和后续调用
- ✅ 优化提示词内容

### Phase 4: 交互式创建集成 (2025-10-06)
- ✅ 在交互式创建中添加 contextMode 选项
- ✅ 提供清晰的模式说明

### Phase 5: 测试和修复 (2025-10-06)
- ✅ 发现并修复 isolated 模式引用问题
- ✅ 优化提示词清晰度
- ✅ 添加使用场景文档

---

## 测试

### 单元测试

```typescript
// packages/core/src/agents/ContextManager.test.ts

describe('ContextManager', () => {
  it('should create separate contexts for isolated mode', () => {
    const manager = new ContextManager();

    const ctx1 = manager.getContext('agent1', 'isolated');
    const ctx2 = manager.getContext('agent2', 'isolated');

    expect(ctx1).not.toBe(ctx2);
  });

  it('should share context in shared mode', () => {
    const manager = new ContextManager();

    const ctx1 = manager.getContext('agent1', 'shared');
    const ctx2 = manager.getContext('agent2', 'shared');

    expect(ctx1).toBe(ctx2);
  });

  it('should maintain separate histories', () => {
    const manager = new ContextManager();

    manager.addMessage('agent1', userMessage, 'isolated');
    manager.addMessage('agent2', userMessage, 'isolated');

    const ctx1 = manager.getContext('agent1', 'isolated');
    const ctx2 = manager.getContext('agent2', 'isolated');

    expect(ctx1.conversationHistory.length).toBe(1);
    expect(ctx2.conversationHistory.length).toBe(1);
  });
});
```

### 集成测试

```bash
# Test isolated mode
/agents run test-agent "Task 1"
# → Agent should not see main session history

# Test shared mode
Main session: "Context: project uses React"
/agents run test-agent --context-mode shared "Create a component"
# → Agent should see "project uses React"
```

---

## 未来增强

### 1. 上下文窗口控制
```yaml
contextMode: isolated
contextWindow: 10  # 只保留最近 10 条消息
```

### 2. 选择性共享
```yaml
contextMode: selective
sharePatterns:
  - "project uses *"
  - "tech stack: *"
```

### 3. 上下文摘要
```yaml
contextMode: summarized
summarizeAfter: 20  # 超过 20 条消息后自动摘要
```

---

## 总结

Context Mode 是 Agents 系统的核心特性，提供了灵活的上下文管理：

- ✅ **Isolated** - 默认模式，适合大多数场景
- ✅ **Shared** - 可选模式，适合需要上下文的场景
- ✅ **配置灵活** - Agent 定义或运行时指定
- ✅ **提示词清晰** - 模型明确知道自己的权限
- ✅ **性能优化** - 最小化不必要的上下文传递

**状态**: ✅ 已完成，生产就绪

---

**文档版本**: 2.0 (整合版)
**创建日期**: 2025-10-04
**最后更新**: 2025-10-07

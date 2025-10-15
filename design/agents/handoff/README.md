# Agents 移交系统

> **状态**: ✅ 已完成 | **版本**: 1.0 | **完成日期**: 2025-10-07

---

## 📋 概述

Agent 移交功能允许 Agent 在执行过程中将任务转移给其他专业 Agent,实现专业化分工和智能协作。

## ✨ 核心特性

- ✅ **Handoff-as-Tool 模式**: 与 OpenAI Swarm 对齐
- ✅ **自动工具注入**: 自动生成 `transfer_to_<agent>` 工具函数
- ✅ **上下文传递**: 支持完整对话历史传递
- ✅ **循环检测**: 自动防止 A → B → A 循环移交
- ✅ **深度限制**: 最大移交深度 5 层
- ✅ **追踪机制**: 每个移交链有唯一 correlation_id

## 🎯 移交模式

### Handoff-as-Tool

Agent 通过调用特殊的工具函数来触发移交,而不是通过配置文件的声明式移交。

**优点**:
- 灵活性高,由 AI 决定何时移交
- 与 OpenAI Swarm 语义对齐
- 易于理解和调试

**工具函数命名**: `transfer_to_<agent_name>`

### 移交触发时机

- `manual`: 由 AI 模型决定何时移交（推荐）
- `auto`: 满足条件自动移交
- `conditional`: 基于规则条件移交

## 🚀 快速开始

### 1. 配置移交关系

编辑 Agent 文件,添加 `handoffs`:

```yaml
---
kind: agent
name: code_review
title: 代码审查助手
handoffs:
  - to: code_imple
    when: manual
    description: "当用户需要实现代码、修复bug或编写功能时,移交给 code_imple agent"
    include_context: true
---
```

**字段说明**:
- `to`: 目标 Agent 名称
- `when`: 触发时机（manual/auto/conditional）
- `description`: 移交说明（会传递给 AI 模型）
- `include_context`: 是否包含完整对话历史（默认 true）

### 2. 系统提示词引导

在 Agent 的 system prompt 中明确说明移交规则:

```markdown
## 关键规则 - 首先判断任务类型

在做任何事情之前,先判断任务类型:

1. **如果用户要求实现/修复/编写代码**:
   - ❌ 不要读取任何文件
   - ❌ 不要进行任何分析
   - ✅ 立即使用 `transfer_to_code_imple` 工具移交任务

2. **如果用户要求审查/检查/分析代码**:
   - ✅ 读取必要的文件
   - ✅ 分析代码质量
   - ✅ 提供审查反馈
```

### 3. 触发移交

```bash
# 场景1: 用户误用 code_review agent 请求实现功能
> @code_review 帮我实现一个登录功能

# Agent 行为:
# [code_review]: 检测到这是代码实现任务,正在移交给 code_imple agent...
# [HandoffManager] Initiating handoff: code_review -> code_imple
# [code_imple]: 好的,我来帮你实现登录功能...
```

## 🏗️ 架构设计

### 核心组件

**HandoffManager**: 负责管理和执行 Agent 移交

```typescript
class HandoffManager {
  /**
   * 创建移交上下文
   */
  async createHandoff(
    fromAgent: string,
    toAgent: string,
    reason: string,
    options?: HandoffOptions
  ): Promise<HandoffContext>;

  /**
   * 检测循环移交
   */
  detectCircularHandoff(
    fromAgent: string,
    toAgent: string,
    handoffChain: string[]
  ): boolean;

  /**
   * 验证移交深度
   */
  validateHandoffDepth(depth: number): boolean;
}
```

### 移交流程

```
1. Agent 决定需要移交
    ↓
2. 调用 transfer_to_<agent> 工具
    ↓
3. HandoffManager.createHandoff()
    ↓
4. 循环检测
    ↓
5. 深度检测
    ↓
6. 创建移交上下文
    ↓
7. 传递对话历史（可选）
    ↓
8. AgentExecutor 执行目标 Agent
```

### 移交上下文

```typescript
interface HandoffContext {
  from_agent: string;
  to_agent: string;
  reason: string;
  timestamp: string;
  metadata: {
    chain_depth: number;
    correlation_id: string;
    handoff_chain: string[];
    include_context: boolean;
  };
}
```

## 🛡️ 安全机制

### 1. 循环检测

自动检测并拒绝循环移交:

```
A → B → A  ❌ 拒绝
A → B → C  ✅ 允许
```

**实现**:
```typescript
detectCircularHandoff(from: string, to: string, chain: string[]): boolean {
  return chain.includes(to);
}
```

### 2. 深度限制

最大移交深度: **5 层**

```
A → B → C → D → E → F  ❌ 超过限制
A → B → C → D → E      ✅ 允许
```

**实现**:
```typescript
validateHandoffDepth(depth: number): boolean {
  return depth <= MAX_HANDOFF_DEPTH;
}
```

### 3. 关联 ID 追踪

每个移交链有唯一的 `correlation_id`,用于调试和追踪:

```
correlation_id: "abc123"
handoff_chain: ["code_review", "code_imple"]
```

## 📊 移交元数据

每次移交都会携带以下元数据:

```typescript
{
  from_agent: "code-review",
  to_agent: "code-imple",
  reason: "需要实现新功能",
  timestamp: "2025-10-07T12:00:00Z",
  metadata: {
    chain_depth: 1,
    correlation_id: "abc123",
    handoff_chain: ["code-review"],
    include_context: true
  }
}
```

## 💡 使用场景

### 场景 1: 职责明确的分工

```yaml
# code_review: 只审查,不实现
handoffs:
  - to: code_imple
    when: manual
    description: "需要实现或修复代码时移交"
```

### 场景 2: 审查后需要修复

```bash
> @code_review 检查 auth.ts 的代码质量

# [code_review]: 发现以下问题:
# - 🔴 SQL 注入风险（必须修复）
# - 🟡 密码强度检查不足
#
# 需要我移交给 code_imple agent 进行修复吗?

> 是的,请修复

# [code_review]: 正在移交给 code_imple...
# [HandoffManager] Handoff: code_review -> code_imple
# [code_imple]: 我来修复这些问题...
```

### 场景 3: 多步骤协作

```
用户请求 → code_review (审查)
           ↓ (发现问题)
         code_imple (修复)
           ↓ (修复完成)
         test_writer (编写测试)
```

## 🧪 测试

### 单元测试

```bash
# 运行移交测试
npm test -- HandoffManager.test.ts
```

### 测试覆盖

- ✅ 创建移交上下文（19 tests）
- ✅ 循环检测（19 tests）
- ✅ 深度限制（19 tests）
- ✅ 上下文传递（19 tests）
- ✅ 元数据生成（19 tests）

**总计**: 95 tests passed

## 💡 最佳实践

### 1. 明确职责边界

每个 Agent 应该有明确的职责范围,并在 system prompt 中强调:

```markdown
⚠️ **你是代码审查专家 - 只负责审查代码质量,不实现代码**

如果用户要求实现代码:
- ❌ 不要尝试实现
- ✅ 立即使用 transfer_to_code_imple 移交
```

### 2. 提供清晰的移交说明

```yaml
handoffs:
  - to: code_imple
    description: "当用户需要实现代码、修复bug或编写功能时,移交给 code_imple agent"
    # ✅ 说明清晰,AI 知道何时移交

  - to: code_imple
    description: "移交"
    # ❌ 说明太简单,AI 可能不知道何时移交
```

### 3. 选择合适的触发时机

```yaml
# 推荐: manual（灵活,由 AI 决定）
handoffs:
  - to: code_imple
    when: manual

# 适用场景: auto（确定性强的场景）
handoffs:
  - to: test_writer
    when: auto
```

### 4. 合理使用上下文传递

```yaml
# 需要完整上下文（默认）
handoffs:
  - to: code_imple
    include_context: true  # 修复时需要知道审查结果

# 不需要上下文（新任务）
handoffs:
  - to: doc_writer
    include_context: false  # 文档编写是独立任务
```

## 🔗 相关资源

### 代码实现
- HandoffManager: `packages/core/src/agents/HandoffManager.ts`
- AgentExecutor: `packages/core/src/agents/AgentExecutor.ts`（集成移交逻辑）

### 测试
- `packages/core/src/agents/HandoffManager.test.ts`
- `packages/core/src/agents/integration.test.ts`

### 文档
- [P2 完成总结](../completion-summaries/p2-completion.md)
- [P2 路由移交设计](../completion-summaries/p2-routing-handoff-design.md)

---

**最后更新**: 2025-10-14

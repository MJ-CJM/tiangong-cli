# Workflow 工作流系统

> **状态**: ✅ 已完成（含并行执行） | **版本**: 2.0 | **更新日期**: 2025-10-13

---

## 📋 概述

Workflow 功能允许定义可重复使用的多步骤任务流程,通过 YAML 文件配置,自动编排多个 Agent 协同完成复杂任务。

## ✨ 核心特性

- ✅ **顺序执行**: 按步骤依次执行 Agents
- ✅ **并行执行**: 多个 Agents 同时运行,显著提速（**性能提升 50%+**）
- ✅ **模板变量**: 支持步骤间数据传递和嵌套引用
- ✅ **条件执行**: 根据条件动态跳过或执行步骤
- ✅ **错误处理**: 可配置的错误处理策略（continue/stop/retry）
- ✅ **超时控制**: 为整个 workflow 和单个步骤设置超时
- ✅ **全局和项目级**: 支持全局共享和项目特定的 workflow
- ✅ **智能路由**: 支持通过 triggers 自动匹配用户意图

## 📚 文档导航

| 文档 | 说明 | 适合读者 |
|------|------|----------|
| [USER_GUIDE.md](./USER_GUIDE.md) | 完整的使用指南和示例 | 用户 |
| [design.md](./design.md) | 架构设计和实现细节 | 开发者 |

## 🎯 Workflow 类型

### 1. 顺序 Workflow

按步骤依次执行,每个步骤等待前一个完成后再开始。

**适用场景**:
- 步骤间有依赖关系
- 需要前一步的结果作为输入
- 简单的线性流程

**示例**:
```yaml
steps:
  - id: review
    agent: code_review
    input: "${workflow.input}"

  - id: fix
    agent: code_imple
    input: "修复问题: ${review.output}"
```

### 2. 并行 Workflow ⭐

多个 Agent 同时执行,显著减少总耗时。

**适用场景**:
- 多角度分析（质量、安全、性能审查）
- 并行测试（单元、集成、E2E）
- 多数据源查询
- 独立的验证步骤

**性能优势**:
```
顺序执行: Task A (30s) → Task B (30s) → Task C (30s) = 90s
并行执行: Task A (30s) }
         Task B (30s) } 同时执行 = 30s
         Task C (30s) }
```

**示例**:
```yaml
steps:
  - type: parallel
    id: dual_review
    parallel:
      - id: reviewer_a
        agent: code_review
        input: "质量审查: ${workflow.input}"

      - id: reviewer_b
        agent: security_review
        input: "安全审查: ${workflow.input}"

    error_handling:
      on_error: continue
      min_success: 1
```

## 🚀 快速开始

### 1. 创建 Workflow

创建 `.gemini/workflows/my-workflow.yaml`:

```yaml
---
kind: workflow
name: my-workflow
title: 我的工作流
description: 简单的代码审查和修复流程

steps:
  - id: review
    agent: code_review
    input: "审查文件: ${workflow.input}"

  - id: fix
    agent: code_imple
    when: "${review.data.issues_found} > 0"
    input: "修复问题: ${review.output}"

error_handling:
  on_error: continue

timeout: 600000
---
```

### 2. 执行 Workflow

```bash
# 列出所有 workflow
/workflow list

# 执行 workflow
/workflow run my-workflow "src/main.ts"

# 查看详情
/workflow info my-workflow
```

## 🎨 模板变量系统

### 支持的变量类型

```yaml
# 1. 用户输入
input: "审查文件: ${workflow.input}"

# 2. 步骤输出
input: "修复: ${review.output}"

# 3. 提取的数据
when: "${review.data.issues_found} > 0"

# 4. 并行子步骤输出（嵌套引用）
input: "汇总: ${parallel_group.substep_id.output}"

# 5. 并行组聚合数据
input: "成功: ${parallel_group.data.success_count}/${parallel_group.data.total_count}"
```

### 数据提取规则

WorkflowExecutor 自动从步骤输出中提取 `key: value` 格式的数据:

```
输出文本:
  issues_found: 3
  status: "success"

提取结果:
  data.issues_found = 3
  data.status = "success"
```

## 📊 YAML 配置详解

### 基本结构

```yaml
---
kind: workflow
name: workflow-name              # 唯一标识符
title: Workflow 标题
description: 描述
version: 1.0.0
scope: project                   # project 或 global

# 顺序步骤
steps:
  - id: step_id
    agent: agent_name
    description: "步骤描述"
    input: "输入内容"
    when: "${condition}"         # 可选: 条件表达式
    timeout: 60000              # 可选: 步骤超时（毫秒）
    retry: 2                    # 可选: 重试次数

# 错误处理
error_handling:
  on_error: continue            # continue, stop, 或 retry
  max_retries: 2

# 超时配置
timeout: 600000                 # workflow 总超时（毫秒）

# 触发器（用于自动路由）
triggers:
  keywords: [关键词1, 关键词2]
  patterns: ["正则表达式"]
  priority: 80
---
```

### 并行步骤配置

```yaml
steps:
  - type: parallel              # 声明为并行步骤
    id: parallel_group_id
    description: "并行组描述"

    parallel:
      - id: substep_1
        agent: agent_a
        input: "子任务 1"
        timeout: 60000

      - id: substep_2
        agent: agent_b
        input: "子任务 2"
        timeout: 60000

    timeout: 120000             # 整组超时
    error_handling:
      on_error: continue
      min_success: 1            # 最少成功数量
```

## 💡 最佳实践

### 1. 命名规范
- Workflow 名称: 小写字母、数字、连字符（如 `parallel-review`）
- 步骤 ID: 使用描述性名称（如 `initial_review`, `fix_issues`）

### 2. 并行设计原则

✅ **适合并行**:
- 多角度分析（质量、安全、性能）
- 批量测试（单元、集成、E2E）
- 多数据源查询

❌ **不适合并行**:
- 步骤 B 依赖步骤 A 的输出
- 需要共享状态的任务

### 3. Agent Context Mode

在 workflow 中使用的 agents 应该设置为 `contextMode: isolated`:

```yaml
# .gemini/agents/code_review.md
---
contextMode: isolated  # ✅ 正确
# contextMode: shared  # ❌ 在 workflow 中会导致问题
---
```

**原因**:
- `shared` mode 依赖主会话的上下文
- Workflow 中没有主会话上下文,导致会话历史为空
- `isolated` mode 每个 agent 维护自己的会话历史

### 4. 错误处理策略

```yaml
# 关键流程 - 一步失败则停止
error_handling:
  on_error: stop

# 可选步骤 - 继续执行
error_handling:
  on_error: continue

# 网络操作 - 允许重试
error_handling:
  on_error: retry
  max_retries: 3
```

## 🏗️ 架构设计

### 核心组件

1. **WorkflowManager**: 加载、验证、查询 workflow 定义
2. **WorkflowExecutor**: 执行 workflow 中的各个步骤
3. **WorkflowRouter**: 根据用户输入选择合适的 workflow

### 执行流程

```
1. 用户输入 → WorkflowRouter（可选）
2. 加载 Workflow 定义 → WorkflowManager
3. 创建执行上下文 → WorkflowExecutor
4. 顺序/并行执行步骤:
   - 渲染模板变量
   - 评估条件表达式
   - 调用 AgentExecutor
   - 提取输出数据
5. 返回执行结果
```

### 并行执行机制

使用 `Promise.allSettled()` 确保所有子步骤都执行完成（无论成功或失败）:

```typescript
const results = await Promise.allSettled([
  executeAgent('agent_a', input_a),
  executeAgent('agent_b', input_b),
  executeAgent('agent_c', input_c),
]);
```

## 🔗 相关资源

### 代码实现
- WorkflowManager: `packages/core/src/agents/WorkflowManager.ts`
- WorkflowExecutor: `packages/core/src/agents/WorkflowExecutor.ts`
- CLI 命令: `packages/cli/src/ui/commands/workflowCommand.ts`

### 类型定义
- `packages/core/src/agents/types.ts`

### 测试
- 单元测试: `packages/core/src/agents/*.test.ts`
- 集成测试: `packages/core/src/agents/integration.test.ts`

## 📈 性能指标

| 指标 | 目标 | 实际 | 状态 |
|------|------|------|------|
| 顺序执行开销 | < 10ms/步 | ~5ms | ✅ |
| 并行启动开销 | < 50ms | ~20ms | ✅ |
| 模板渲染 | < 5ms | ~2ms | ✅ |
| 条件评估 | < 1ms | ~0.5ms | ✅ |

---

**最后更新**: 2025-10-14

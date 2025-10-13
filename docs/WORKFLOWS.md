# Workflow 完整指南

> **版本**: 2.0 | **更新日期**: 2025-10-13 | **状态**: ✅ 功能完整

---

## 📋 目录

- [概述](#概述)
- [快速开始](#快速开始)
- [Workflow 类型](#workflow-类型)
- [YAML 配置详解](#yaml-配置详解)
- [并行 Workflow](#并行-workflow)
- [模板变量系统](#模板变量系统)
- [CLI 命令](#cli-命令)
- [示例 Workflow](#示例-workflow)
- [最佳实践](#最佳实践)
- [故障排除](#故障排除)

---

## 概述

Workflow 功能允许定义可重复使用的多步骤任务流程，通过 YAML 文件配置，自动编排多个 Agent 协同完成复杂任务。

### ✨ 核心特性

- ✅ **顺序执行**: 按步骤依次执行 Agents
- ✅ **并行执行**: 多个 Agents 同时运行，显著提速
- ✅ **模板变量**: 支持步骤间数据传递 (`${workflow.input}`, `${stepId.output}`)
- ✅ **条件执行**: 根据条件动态跳过或执行步骤 (`when` 表达式)
- ✅ **错误处理**: 可配置的错误处理策略 (continue/stop/retry)
- ✅ **超时控制**: 为整个 workflow 和单个步骤设置超时
- ✅ **全局和项目级**: 支持全局共享和项目特定的 workflow

---

## 快速开始

### 1. 创建 Workflow 目录

```bash
# 项目级 workflow
mkdir -p .gemini/workflows

# 全局 workflow（可选）
mkdir -p ~/.gemini/workflows
```

### 2. 创建简单的 Workflow

创建 `.gemini/workflows/my-first-workflow.yaml`：

```yaml
---
kind: workflow
name: my-first-workflow
title: 我的第一个 Workflow
description: 简单的代码审查和修复流程

steps:
  - id: review
    agent: code_review
    description: "审查代码"
    input: "审查文件：${workflow.input}"

  - id: fix
    agent: code_imple
    description: "修复问题"
    input: "修复审查中发现的问题：${review.output}"
---
```

### 3. 执行 Workflow

```bash
/workflow run my-first-workflow "src/main.py"
```

---

## Workflow 类型

### 1. 顺序 Workflow

按步骤依次执行，每个步骤等待前一个完成后再开始。

```yaml
steps:
  - id: step1
    agent: agent_a
    input: "任务 1"

  - id: step2
    agent: agent_b
    input: "基于上一步：${step1.output}"
```

**适用场景**：
- 步骤间有依赖关系
- 需要前一步的结果作为输入
- 简单的线性流程

### 2. 并行 Workflow

多个 Agent 同时执行，显著减少总耗时。

```yaml
steps:
  - type: parallel
    id: parallel_group
    description: "并行执行多个任务"
    parallel:
      - id: task1
        agent: agent_a
        input: "任务 1"

      - id: task2
        agent: agent_b
        input: "任务 2"

    timeout: 120000
    error_handling:
      on_error: continue
      min_success: 1
```

**适用场景**：
- 多角度分析（质量、安全、性能审查）
- 并行测试（单元、集成、E2E）
- 多数据源查询
- 独立的验证步骤

**⚠️ 限制**：
- 并行步骤应该是**互不依赖**的独立任务
- 不支持嵌套并行（并行组内只能有顺序步骤）

---

## YAML 配置详解

### 基本结构

```yaml
---
# 元数据
kind: workflow              # 必须是 "workflow"
name: workflow-name         # 唯一标识符 (小写字母、数字、连字符)
title: Workflow 标题        # 显示名称
description: 描述文本       # 可选：描述用途
version: 1.0.0             # 可选：版本号
scope: project             # 可选: project 或 global

# 顺序步骤
steps:
  - id: step_id            # 步骤唯一 ID
    agent: agent_name      # 要调用的 agent
    description: "描述"     # 步骤描述
    input: "输入文本"       # 支持模板变量
    when: "${condition}"   # 可选：条件表达式
    timeout: 60000        # 可选：步骤超时（毫秒）
    retry: 2              # 可选：重试次数

# 错误处理配置
error_handling:
  on_error: continue       # continue, stop, 或 retry
  max_retries: 2          # 最大重试次数

# 超时配置
timeout: 600000           # workflow 总超时（毫秒）

# 触发器配置（用于自动路由）
triggers:
  keywords: [关键词1, 关键词2]
  patterns: ["正则表达式"]
  priority: 80
---
```

### 顺序步骤配置

| 字段 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `id` | string | ✅ | 步骤唯一标识符 |
| `agent` | string | ✅ | 要调用的 Agent 名称 |
| `description` | string | - | 步骤描述 |
| `input` | string | ✅ | 输入内容（支持模板变量） |
| `when` | string | - | 条件表达式 |
| `timeout` | number | - | 超时时间（毫秒） |
| `retry` | number | - | 重试次数 |

### 错误处理配置

```yaml
error_handling:
  on_error: continue  # 继续执行后续步骤
  # on_error: stop    # 立即停止整个 workflow
  # on_error: retry   # 重试失败的步骤
  max_retries: 2      # 最大重试次数
```

---

## 并行 Workflow

### 语法结构

```yaml
steps:
  - type: parallel          # 声明为并行步骤
    id: parallel_group_id   # 并行组 ID
    description: "并行组描述"

    # 并行执行的子步骤
    parallel:
      - id: substep_1
        agent: agent_a
        input: "子任务 1"
        timeout: 60000      # 子步骤超时

      - id: substep_2
        agent: agent_b
        input: "子任务 2"
        timeout: 60000

    # 并行组配置
    timeout: 120000         # 整组超时
    error_handling:
      on_error: continue    # 或 stop
      min_success: 1        # 最少成功数量
```

### 并行步骤配置

| 字段 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `type` | string | ✅ | 必须是 `parallel` |
| `id` | string | ✅ | 并行组唯一标识符 |
| `description` | string | - | 并行组描述 |
| `parallel` | array | ✅ | 子步骤数组（每个都是标准步骤） |
| `timeout` | number | - | 整组超时时间 |
| `error_handling` | object | - | 错误处理配置 |

### 错误处理配置

```yaml
error_handling:
  on_error: continue    # 单个子步骤失败时的行为
                        # continue: 继续执行其他子步骤
                        # stop: 立即停止所有子步骤
  min_success: 2        # 最少成功数量
                        # 成功数 >= min_success 则整组成功
                        # 否则整组失败
```

### 引用并行步骤的结果

```yaml
# 后续步骤中引用
steps:
  - type: parallel
    id: dual_review
    parallel:
      - id: reviewer_a
        agent: code_review
        input: "审查代码"
      - id: reviewer_b
        agent: security_review
        input: "安全审查"

  # 引用子步骤输出
  - id: merge
    agent: merger
    input: |
      质量审查：${dual_review.reviewer_a.output}
      安全审查：${dual_review.reviewer_b.output}

      成功数：${dual_review.data.success_count}
      总数：${dual_review.data.total_count}
```

### 并行组聚合数据

每个并行组自动提供以下数据：

| 变量 | 说明 |
|-----|------|
| `${groupId.data.success_count}` | 成功的子步骤数量 |
| `${groupId.data.failed_count}` | 失败的子步骤数量 |
| `${groupId.data.total_count}` | 子步骤总数 |

### 执行机制

使用 `Promise.allSettled()` 确保所有子步骤都执行完成（无论成功或失败）：

```typescript
// 伪代码
const results = await Promise.allSettled([
  executeAgent('agent_a', input_a),
  executeAgent('agent_b', input_b),
  executeAgent('agent_c', input_c),
]);
```

### 性能优势

并行执行可以将总耗时从 **O(n)** 降低到 **O(max(t1, t2, ..., tn))**：

```
顺序执行：Task A (30s) → Task B (30s) → Task C (30s) = 90s
并行执行：Task A (30s)
         Task B (30s)  } 同时执行 = 30s
         Task C (30s)
```

---

## 模板变量系统

### 变量类型

#### 1. 用户输入

```yaml
input: "审查文件：${workflow.input}"
```

#### 2. 步骤输出（顺序步骤）

```yaml
input: "基于审查结果修复：${review.output}"
```

#### 3. 并行子步骤输出

```yaml
# 引用并行组中的子步骤输出
input: "汇总：${parallel_group.substep_id.output}"
```

#### 4. 提取的数据

```yaml
when: "${review.data.issues_found} > 0"
input: "修复 ${review.data.issue_count} 个问题"
```

#### 5. 并行组聚合数据

```yaml
input: "总计 ${parallel_group.data.success_count}/${parallel_group.data.total_count} 成功"
```

### 数据提取规则

WorkflowExecutor 自动从步骤输出中提取 `key: value` 格式的数据：

```
输出文本：
  issues_found: 3
  status: "success"
  count: 42

提取结果：
  data.issues_found = 3
  data.status = "success"
  data.count = 42
```

### 条件执行

使用 `when` 表达式控制步骤是否执行：

```yaml
steps:
  - id: check
    agent: code_review
    input: "${workflow.input}"

  # 仅当有问题时执行
  - id: fix
    agent: code_imple
    when: "${check.data.has_issues}"
    input: "修复问题"

  # 总是执行
  - id: verify
    agent: code_review
    when: true
    input: "验证修复"
```

**支持的条件**：
- `true` / `false` - 布尔值
- `${stepId.data.value}` - 数值比较（> 0 为 true）
- 任何非空字符串视为 true

---

## CLI 命令

### 列出所有 Workflow

```bash
/workflow list
```

输出示例：
```
📋 Available Workflows (3)

Project Workflows (2):
  • parallel-review         并行代码审查流程
  • review-and-implement    顺序审查流程

Global Workflows (1):
  • standard-pipeline       标准质量流水线
```

### 查看 Workflow 详情

```bash
/workflow info parallel-review
```

### 执行 Workflow

```bash
# 基本用法
/workflow run <workflow-name> "<input>"

# 示例
/workflow run parallel-review "multi_agent_system/agent.py"
/workflow run code-quality-pipeline "审查 src/auth.ts"
```

### 验证 Workflow 定义

```bash
/workflow validate parallel-review
```

### 删除 Workflow

```bash
/workflow delete old-workflow
```

---

## 示例 Workflow

### 1. 并行代码审查（推荐）⭐

```yaml
---
kind: workflow
name: parallel-review
title: 并行代码审查流程
description: 两个审查员并行审查，专业汇总，统一修复

steps:
  # Step 1: 并行审查
  - type: parallel
    id: dual_review
    description: "两个审查员并行审查代码"
    parallel:
      - id: reviewer_a
        agent: code_review
        description: "代码质量审查"
        input: |
          请审查此文件：/path/to/project/${workflow.input}
          重点关注：
          - 代码结构和设计
          - 可读性和可维护性
          - 潜在的 bug
        timeout: 90000

      - id: reviewer_b
        agent: code_review_pro
        description: "安全审查"
        input: |
          请审查此文件：/path/to/project/${workflow.input}
          重点关注：
          - 安全漏洞
          - 输入验证
          - 权限控制
        timeout: 90000

    timeout: 120000
    error_handling:
      on_error: continue
      min_success: 1

  # Step 2: 汇总审查结果
  - id: aggregate_reviews
    agent: review_aggregator
    description: "汇总两个审查员的意见"
    input: |
      请汇总以下两个审查员的独立审查意见：

      ## 审查员 A（代码质量）：
      ${dual_review.reviewer_a.output}

      ## 审查员 B（安全性）：
      ${dual_review.reviewer_b.output}
    timeout: 60000

  # Step 3: 统一修复
  - id: implement_fixes
    agent: code_imple
    description: "根据汇总的审查意见修复代码"
    input: |
      请根据以下审查汇总报告修复代码问题：
      ${aggregate_reviews.output}
    timeout: 180000

error_handling:
  on_error: continue

timeout: 600000
---
```

**优势**：
- ⚡ 并行执行，时间减半
- 🎯 多维度审查（质量 + 安全）
- 📊 专业汇总，优先级明确
- 🔧 一键完成审查和修复

### 2. 顺序代码审查

```yaml
---
kind: workflow
name: review-and-implement
title: 顺序审查流程
description: 传统的顺序审查和修复流程

steps:
  - id: review
    agent: code_review
    description: "代码质量审查"
    input: "审查文件：${workflow.input}"
    timeout: 90000

  - id: implement
    agent: code_imple
    description: "修复问题"
    input: "修复审查中发现的问题：${review.output}"
    timeout: 180000

error_handling:
  on_error: stop

timeout: 600000
---
```

### 3. 功能开发流程

```yaml
---
kind: workflow
name: feature-development
title: 功能开发流程
description: 需求分析 → 实现 → 测试 → 文档

steps:
  - id: analyze
    agent: requirements_analyzer
    description: "分析需求"
    input: "分析需求：${workflow.input}"

  - id: implement
    agent: code_imple
    description: "实现功能"
    input: |
      实现功能：${workflow.input}
      需求分析：${analyze.output}

  - id: test
    agent: test_writer
    description: "编写测试"
    input: "为新功能编写完整的测试用例"

  - id: document
    agent: doc_writer
    description: "编写文档"
    input: "为新功能编写使用文档和 API 说明"

error_handling:
  on_error: stop

timeout: 900000
---
```

### 4. 多维度并行测试

```yaml
---
kind: workflow
name: parallel-testing
title: 并行测试流程

steps:
  - id: build
    agent: builder
    input: "构建项目：${workflow.input}"

  - type: parallel
    id: test_suite
    description: "并行运行所有测试"
    parallel:
      - id: unit_tests
        agent: unit_tester
        input: "单元测试：${build.output}"

      - id: integration_tests
        agent: integration_tester
        input: "集成测试：${build.output}"

      - id: e2e_tests
        agent: e2e_tester
        input: "E2E 测试：${build.output}"

    timeout: 300000
    error_handling:
      on_error: continue
      min_success: 2

  - id: report
    agent: reporter
    input: |
      生成测试报告：
      单元测试：${test_suite.unit_tests.output}
      集成测试：${test_suite.integration_tests.output}
      E2E 测试：${test_suite.e2e_tests.output}

      总计：${test_suite.data.success_count}/${test_suite.data.total_count} 成功

error_handling:
  on_error: continue

timeout: 600000
---
```

---

## 最佳实践

### 1. 命名规范

- **Workflow 名称**: 小写字母、数字、连字符（如 `parallel-review`）
- **文件名**: 与 workflow `name` 保持一致（如 `parallel-review.yaml`）
- **步骤 ID**: 使用描述性名称（如 `initial_review`, `fix_issues`）

### 2. 步骤设计

- **单一职责**: 每个步骤只做一件事
- **合理粒度**: 不要太细（增加复杂度）也不要太粗（难以调试）
- **描述清晰**: 为每个步骤添加 `description`

### 3. 并行设计原则

✅ **适合并行**：
- 多角度分析（质量、安全、性能）
- 批量测试（单元、集成、E2E）
- 多数据源查询
- 独立验证步骤

❌ **不适合并行**：
- 步骤 B 依赖步骤 A 的输出
- 需要共享状态的任务
- 顺序依赖的流水线

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

### 5. 超时配置

```yaml
# 并行组超时 > 最长子步骤超时
- type: parallel
  id: tests
  timeout: 600000  # 10 分钟总超时
  parallel:
    - id: slow_test
      timeout: 500000  # 8.3 分钟子超时
```

### 6. Agent Context Mode

在 workflow 中使用的 agents 应该设置为 `contextMode: isolated`：

```yaml
# .gemini/agents/code_review.md
---
kind: agent
name: code_review
contextMode: isolated  # ✅ 正确
# contextMode: shared  # ❌ 在 workflow 中会导致问题
---
```

**原因**：
- `shared` mode 依赖主会话的上下文
- Workflow 中没有主会话上下文，导致会话历史为空
- `isolated` mode 每个 agent 维护自己的会话历史

### 7. 模板变量使用

```yaml
# ✅ 充分利用步骤间数据传递
input: "修复 ${review.data.issue_count} 个问题"

# ✅ 使用描述性的数据键名
data:
  issue_count: 3
  has_security_issues: true

# ✅ 在 when 条件中引用关键数据
when: "${review.data.issue_count} > 0"
```

### 8. 版本管理

```yaml
---
kind: workflow
name: my-workflow
title: My Workflow
version: 2.1.0  # 使用语义化版本
description: |
  v2.1.0: 添加并行审查支持
  v2.0.0: 重构为三步流程
  v1.0.0: 初始版本
---
```

---

## 故障排除

### 问题 1: Workflow 未被加载

**症状**：`/workflow list` 看不到定义的 workflow

**检查**：
1. 文件路径是否正确（`.gemini/workflows/*.yaml`）
2. YAML 语法是否正确
3. 运行 `/workflow validate <name>` 查看验证错误

### 问题 2: 并行步骤输出为空

**症状**：并行审查步骤没有生成文本输出

**原因**：Agent 的 `contextMode: shared` 导致会话历史为空

**解决**：将 agent 改为 `contextMode: isolated`

```yaml
# .gemini/agents/code_review.md
---
contextMode: isolated  # 改为 isolated
---
```

### 问题 3: 模板变量未渲染

**症状**：输入中的 `${stepId.output}` 没有被替换

**检查**：
1. 步骤 ID 是否正确
2. 前置步骤是否已执行完成
3. 是否拼写错误

### 问题 4: 条件执行不生效

**症状**：`when` 条件没有按预期工作

**检查**：
1. 数据是否被正确提取（查看步骤输出）
2. 条件表达式语法是否正确
3. 尝试使用简单的 `true` / `false` 测试

### 问题 5: 并行组整体失败

**症状**：虽然有子步骤成功，但整组标记为失败

**原因**：`min_success` 配置不满足

**解决**：调整 `min_success` 值：

```yaml
error_handling:
  min_success: 1  # 至少 1 个成功即可
  # min_success: 2  # 至少 2 个成功
```

### 问题 6: 超时错误

**症状**：Workflow 执行时间过长被终止

**解决**：
1. 增加 workflow 总超时时间
2. 增加慢步骤的单独超时
3. 考虑将顺序改为并行

```yaml
# 调整前
timeout: 300000  # 5 分钟（可能不够）

# 调整后
timeout: 900000  # 15 分钟
```

---

## 常见问题

### Q: Workflow 和 Workflow Agent 有什么区别？

**A**:
- **Workflow 定义文件** (`.gemini/workflows/*.yaml`): 静态预定义流程，适合标准化、可重复的任务
- **Workflow Agent** (`.gemini/agents/workflow.md`): AI 动态编排，根据自然语言理解任务并动态决定执行流程

### Q: 并行执行能节省多少时间？

**A**: 理论上可以节省到最长子任务的时间。例如：
- 顺序：30s + 30s + 30s = 90s
- 并行：max(30s, 30s, 30s) = 30s
- **节省 67% 时间**

实际节省取决于任务独立性和 API 并发限制。

### Q: 可以嵌套并行组吗？

**A**: 不支持。并行组内只能包含顺序步骤。如需复杂编排，考虑分拆为多个 workflow。

### Q: 如何在步骤间传递复杂数据？

**A**: 目前通过文本输出传递。WorkflowExecutor 会自动提取 `key: value` 格式的数据。

### Q: Workflow 可以调用另一个 Workflow 吗？

**A**: 当前版本不支持。可以考虑将公共步骤抽取为独立的 Agent。

### Q: 并行组的子步骤执行顺序是什么？

**A**: 同时启动，完成顺序不确定。但结果顺序与定义顺序一致。

---

## 文件结构

```
项目根目录/
├── .gemini/
│   ├── agents/
│   │   ├── code_review.md        # Agent 定义
│   │   ├── code_review_pro.md
│   │   └── review_aggregator.md
│   └── workflows/
│       ├── parallel-review.yaml   # 并行审查 workflow
│       ├── review-and-implement.yaml
│       └── feature-development.yaml

用户主目录/
└── ~/.gemini/
    └── workflows/
        └── personal-workflow.yaml  # 全局 workflow
```

---

## 相关文档

- [Agent 系统文档](./AGENTS.md)
- [并行 Workflow 设计](../design/agents/PARALLEL_WORKFLOWS.md)

---

## 反馈和贡献

如有问题或建议，欢迎提交 Issue 或 Pull Request。

---

**文档版本**: 2.0
**创建日期**: 2025-10-07
**更新日期**: 2025-10-13
**状态**: ✅ 功能完整

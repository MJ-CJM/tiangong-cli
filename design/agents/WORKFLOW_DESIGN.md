# Workflow 系统设计文档

> **版本**: 2.0 | **日期**: 2025-10-13 | **状态**: ✅ 已完成（含并行功能）

---

## 📋 概述

实现多 Agent 编排功能，支持两种方式：
1. **Workflow Agent**: AI 理解自然语言，动态编排多个 Agent
2. **Workflow 定义文件**: YAML 配置文件，预定义执行流程

---

## 🎯 核心功能

### 1. Workflow Agent（动态编排）

**特点**:
- AI 理解自然语言意图
- 动态决定 Agent 调用顺序
- 灵活处理复杂逻辑

**示例**:
```bash
@workflow 先用 code_review 审查代码，如果发现问题就用 code_imple 修复，最后用 test_writer 写测试

# Workflow Agent 的执行流程
[workflow] 分析任务：审查 → 修复（条件）→ 测试
[workflow] Step 1: 调用 code_review
[code_review] 执行...
[workflow] Step 2: 检测到问题，调用 code_imple
[code_imple] 执行...
[workflow] Step 3: 调用 test_writer
[test_writer] 执行...
[workflow] 所有步骤完成
```

### 2. Workflow 定义文件（静态编排）

**特点**:
- 预定义执行流程
- 支持条件、循环、并行
- 可复用、可版本控制

**示例**:
```yaml
# .gemini/workflows/code-quality-pipeline.yaml
---
kind: workflow
name: code-quality-pipeline
title: 代码质量流水线
description: 完整的代码质量检查流程

triggers:
  keywords: [质量检查, quality check, 完整审查]
  patterns: [".*质量.*流水线.*"]
  priority: 90

steps:
  - id: review
    agent: code_review
    description: "审查代码质量"
    input: "${workflow.input}"

  - id: fix
    agent: code_imple
    description: "修复发现的问题"
    when: "${review.issues_found} > 0"
    input: "修复以下问题：${review.issues}"

  - id: test
    agent: test_writer
    description: "编写测试用例"
    input: "为修复后的代码编写测试"

  - id: final_review
    agent: code_review
    description: "最终验证"
    input: "验证修复和测试是否完整"

error_handling:
  on_error: continue  # continue | stop | retry
  max_retries: 2

timeout: 600000  # 10 分钟
---
```

---

## 🏗️ 架构设计

### 类型定义

```typescript
// packages/core/src/agents/types.ts

/**
 * Workflow 定义
 */
export interface WorkflowDefinition {
  /** 类型标识 */
  kind: 'workflow';

  /** 唯一标识符 */
  name: string;

  /** 显示名称 */
  title: string;

  /** 描述 */
  description?: string;

  /** 触发器（用于路由） */
  triggers?: {
    keywords?: string[];
    patterns?: string[];
    priority?: number;
  };

  /** 执行步骤 */
  steps: WorkflowStep[];

  /** 错误处理 */
  error_handling?: {
    on_error: 'continue' | 'stop' | 'retry';
    max_retries?: number;
  };

  /** 超时时间（毫秒） */
  timeout?: number;

  /** 文件路径 */
  filePath: string;

  /** 作用域 */
  scope?: 'global' | 'project';

  /** 创建时间 */
  createdAt: Date;

  /** 更新时间 */
  updatedAt: Date;
}

/**
 * Workflow 步骤
 */
export interface WorkflowStep {
  /** 步骤 ID */
  id: string;

  /** 要调用的 Agent */
  agent: string;

  /** 步骤描述 */
  description?: string;

  /** 输入（支持模板变量） */
  input: string;

  /** 执行条件（表达式） */
  when?: string;

  /** 超时时间 */
  timeout?: number;

  /** 重试次数 */
  retry?: number;
}

/**
 * Workflow 执行上下文
 */
export interface WorkflowContext {
  /** Workflow 名称 */
  workflowName: string;

  /** 用户原始输入 */
  input: string;

  /** 步骤结果 */
  stepResults: Map<string, WorkflowStepResult>;

  /** 当前步骤索引 */
  currentStepIndex: number;

  /** 开始时间 */
  startTime: number;

  /** 元数据 */
  metadata: Record<string, any>;
}

/**
 * Workflow 步骤结果
 */
export interface WorkflowStepResult {
  /** 步骤 ID */
  stepId: string;

  /** Agent 名称 */
  agentName: string;

  /** 执行状态 */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

  /** 输出内容 */
  output: string;

  /** 错误信息 */
  error?: string;

  /** 开始时间 */
  startTime: number;

  /** 结束时间 */
  endTime?: number;

  /** 提取的数据（用于条件判断） */
  data?: Record<string, any>;
}

/**
 * Workflow 执行结果
 */
export interface WorkflowExecutionResult {
  /** Workflow 名称 */
  workflowName: string;

  /** 执行状态 */
  status: 'completed' | 'failed' | 'timeout';

  /** 所有步骤结果 */
  steps: WorkflowStepResult[];

  /** 最终输出 */
  output: string;

  /** 错误信息 */
  error?: string;

  /** 总耗时 */
  duration: number;
}
```

### 核心组件

#### 1. WorkflowManager

```typescript
/**
 * Workflow 管理器
 * 负责加载、验证、查询 workflow 定义
 */
export class WorkflowManager {
  constructor(private config: Config);

  /**
   * 加载所有 workflow
   */
  async loadWorkflows(): Promise<void>;

  /**
   * 获取指定 workflow
   */
  getWorkflow(name: string): WorkflowDefinition | null;

  /**
   * 列出所有 workflow
   */
  listWorkflows(): Array<{
    name: string;
    title: string;
    scope: 'global' | 'project';
    filePath: string;
    updatedAt: Date;
  }>;

  /**
   * 验证 workflow 定义
   */
  validateWorkflow(workflow: WorkflowDefinition): {
    valid: boolean;
    errors: string[];
  };

  /**
   * 删除 workflow
   */
  async deleteWorkflow(name: string): Promise<void>;
}
```

#### 2. WorkflowExecutor

```typescript
/**
 * Workflow 执行器
 * 负责执行 workflow 中的各个步骤
 */
export class WorkflowExecutor {
  constructor(
    private config: Config,
    private agentExecutor: AgentExecutor,
    private workflowManager: WorkflowManager
  );

  /**
   * 执行 workflow
   */
  async execute(
    workflowName: string,
    input: string,
    options?: {
      onStepStart?: (step: WorkflowStep) => void;
      onStepComplete?: (result: WorkflowStepResult) => void;
      onStepError?: (error: Error, step: WorkflowStep) => void;
    }
  ): Promise<WorkflowExecutionResult>;

  /**
   * 执行单个步骤
   */
  private async executeStep(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<WorkflowStepResult>;

  /**
   * 评估条件表达式
   */
  private evaluateCondition(
    condition: string,
    context: WorkflowContext
  ): boolean;

  /**
   * 渲染模板变量
   */
  private renderTemplate(
    template: string,
    context: WorkflowContext
  ): string;

  /**
   * 提取步骤输出中的数据
   */
  private extractData(
    output: string,
    stepId: string
  ): Record<string, any>;
}
```

#### 3. WorkflowRouter

```typescript
/**
 * Workflow 路由器
 * 根据用户输入选择合适的 workflow
 */
export class WorkflowRouter {
  constructor(
    private workflowManager: WorkflowManager
  );

  /**
   * 路由到 workflow
   */
  async route(input: string): Promise<{
    workflow: WorkflowDefinition;
    score: number;
    confidence: number;
    matchedKeywords: string[];
    matchedPatterns: string[];
  } | null>;
}
```

#### 4. Workflow Agent

特殊的 Agent，使用 AI 理解和编排任务。

```markdown
# .gemini/agents/workflow.md
---
kind: agent
name: workflow
title: Workflow 编排助手
description: 理解复杂的多步骤任务，自动编排多个 Agent 执行
model: gemini-2.0-flash
contextMode: isolated

# 可以调用的所有 Agent
handoffs:
  - to: code_review
    when: manual
    description: "需要审查代码时调用"
  - to: code_imple
    when: manual
    description: "需要实现功能时调用"
  - to: test_writer
    when: manual
    description: "需要编写测试时调用"
  - to: doc_writer
    when: manual
    description: "需要编写文档时调用"
---

你是一个智能的 Workflow 编排助手。

## 职责

1. 理解用户描述的多步骤任务
2. 分解任务为具体的执行步骤
3. 依次调用其他 Agent 执行
4. 汇总结果并呈现给用户

## 工作流程

当用户描述一个复杂任务时：

1. **分析任务**：识别需要哪些 Agent 参与
2. **制定计划**：确定执行顺序和条件
3. **执行步骤**：
   - 明确告诉用户当前执行的步骤
   - 使用 `transfer_to_<agent>` 工具调用对应 Agent
   - 等待 Agent 返回结果
   - 根据结果决定下一步
4. **汇总结果**：将所有步骤的结果整合呈现

## 示例

用户输入：
> 先审查 src/auth.ts 的代码质量，如果发现问题就修复，然后写测试

你的执行流程：
```
📋 我理解您的任务，需要以下步骤：
1. 使用 code_review 审查代码
2. 如果发现问题，使用 code_imple 修复
3. 使用 test_writer 编写测试

开始执行...

[步骤 1/3] 代码审查
[调用 transfer_to_code_review]
(等待 code_review 返回结果)

code_review 发现了 3 个问题：
- 缺少输入验证
- 错误处理不完整
- 缺少日志记录

[步骤 2/3] 代码修复
[调用 transfer_to_code_imple，传递问题列表]
(等待 code_imple 返回结果)

code_imple 已完成修复。

[步骤 3/3] 编写测试
[调用 transfer_to_test_writer]
(等待 test_writer 返回结果)

test_writer 已完成测试编写。

✅ 所有步骤完成！
```

## 重要规则

1. **明确步骤**：每次调用 Agent 前，明确告诉用户当前步骤
2. **传递上下文**：向下一个 Agent 传递必要的信息
3. **汇总结果**：最后提供完整的执行摘要
4. **错误处理**：如果某步骤失败，告知用户并询问如何处理
```

---

## 📁 文件结构

```
packages/core/src/agents/
├── types.ts                    # 扩展类型定义
├── WorkflowManager.ts          # Workflow 管理器
├── WorkflowExecutor.ts         # Workflow 执行器
├── WorkflowRouter.ts           # Workflow 路由器
└── AgentExecutor.ts            # 修改以支持 workflow

packages/cli/src/ui/commands/
└── workflowCommand.ts          # 新增 /workflow 命令

.gemini/
├── agents/
│   └── workflow.md             # Workflow Agent 定义
└── workflows/
    ├── code-quality-pipeline.yaml
    ├── feature-development.yaml
    └── bug-fix-workflow.yaml
```

---

## 🎮 CLI 命令

### `/workflow` 命令

```bash
# 列出所有 workflow
/workflow list

# 查看 workflow 详情
/workflow info code-quality-pipeline

# 执行 workflow
/workflow run code-quality-pipeline "审查并修复 src/auth.ts"

# 路由到 workflow（测试）
/workflow route "完整的代码质量检查"

# 路由并执行
/workflow route "完整的代码质量检查" --execute

# 验证 workflow
/workflow validate code-quality-pipeline

# 删除 workflow
/workflow delete code-quality-pipeline

# 创建 workflow（交互式）
/workflow create --interactive
```

---

## 🔄 与现有系统集成

### 1. 路由系统集成

扩展 Router 支持 workflow：

```typescript
// Router.ts
async route(input: string): Promise<RoutingResult | WorkflowRoutingResult | null> {
  // 1. 先尝试路由到 Agent
  const agentResult = await this.routeToAgent(input);
  if (agentResult && agentResult.confidence > 80) {
    return agentResult;
  }

  // 2. 尝试路由到 Workflow
  const workflowResult = await this.routeToWorkflow(input);
  if (workflowResult && workflowResult.confidence > 70) {
    return workflowResult;
  }

  // 3. 返回最高分的结果
  return agentResult || workflowResult || null;
}
```

### 2. Agent 调用 Workflow

Agent 可以通过特殊工具调用 workflow：

```typescript
// 注入 execute_workflow 工具
{
  name: 'execute_workflow',
  description: 'Execute a predefined workflow',
  parameters: {
    workflow_name: 'string',
    input: 'string'
  }
}
```

---

## 🎯 实现计划

### Phase 1: 核心功能（3-4 天）

- [x] 设计类型定义
- [ ] 实现 WorkflowManager
- [ ] 实现 WorkflowExecutor
- [ ] 实现 WorkflowRouter
- [ ] 创建 Workflow Agent 模板

### Phase 2: CLI 集成（2-3 天）

- [ ] 添加 `/workflow` 命令
- [ ] 集成到路由系统
- [ ] 添加错误处理和日志

### Phase 3: 测试和文档（2-3 天）

- [ ] 单元测试
- [ ] 集成测试
- [ ] 用户文档
- [ ] 示例 workflow

**预计总时间**: 7-10 天

---

## 📊 使用场景

### 场景 1: 代码质量流水线

```bash
@workflow 完整检查 src/auth.ts 的代码质量

# 或使用预定义 workflow
/workflow run code-quality-pipeline "src/auth.ts"

# 执行流程
1. code_review 审查
2. code_imple 修复问题
3. test_writer 编写测试
4. code_review 最终验证
```

### 场景 2: 功能开发流程

```bash
/workflow run feature-development "实现用户登录功能"

# 执行流程
1. requirements_analyzer 分析需求
2. planner 制定计划
3. code_imple 实现功能
4. test_writer 编写测试
5. doc_writer 编写文档
```

### 场景 3: Bug 修复流程

```bash
/workflow run bug-fix-workflow "修复登录失败的问题"

# 执行流程
1. code_review 定位问题
2. code_imple 修复代码
3. test_writer 添加回归测试
4. code_review 验证修复
```

---

## 🔒 限制和注意事项

### 限制

1. **Workflow Agent 依赖 AI**：动态编排依赖模型理解能力
2. ~~**串行执行**~~：~~当前只支持顺序执行，不支持并行~~ ✅ **已支持并行执行**
3. **状态传递**：步骤间通过文本传递，不支持结构化数据
4. **超时控制**：长流程可能超时

### 注意事项

1. **Token 消耗**：多 Agent 调用会消耗大量 token
2. **执行时间**：完整流程可能需要数分钟
3. **错误传播**：一个步骤失败可能影响后续步骤
4. **循环风险**：需要防止无限循环

---

## 📝 更新日志

### v2.0 - 2025-10-13
- ✅ 并行 Workflow 功能完成
- ✅ 支持 `type: parallel` 和 `parallel: []` 语法
- ✅ 支持 `error_handling.min_success` 配置
- ✅ 支持嵌套模板变量引用 `${groupId.substepId.output}`
- ✅ 修复 Agent context mode 问题（isolated vs shared）
- ✅ 完整文档和示例

### v1.0 - 2025-10-07
- ✅ 顺序 Workflow 功能完成
- ✅ WorkflowManager, WorkflowExecutor 实现
- ✅ 模板变量系统
- ✅ 条件执行和错误处理
- ✅ CLI 命令集成

---

**文档版本**: 2.0
**创建日期**: 2025-10-07
**更新日期**: 2025-10-13
**状态**: ✅ 已完成（含并行功能）

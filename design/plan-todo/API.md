# Plan+Todo 模式 - API 参考

> 完整的命令和工具 API 参考

---

## 📋 目录

- [快捷键](#快捷键)
- [Slash 命令](#slash-命令)
- [工具 API](#工具-api)
- [类型定义](#类型定义)

---

## 快捷键

| 快捷键 | 功能 | 说明 |
|--------|------|------|
| `Ctrl+P` | 切换 Plan 模式 | 进入/退出 Plan 模式 |
| `Ctrl+C` | 中断执行 | 停止当前任务或批量执行 |

---

## Slash 命令

### /plan 命令组

#### /plan show

**功能**: 显示当前计划的详细内容

**语法**:
```bash
/plan show
```

**输出示例**:
```markdown
# 📋 Implement User Login

**Overview**: Add JWT-based authentication...

## 🔢 Steps (5)

1. **step-1**: Create User model
   - 📦 Module: backend/models
   - ⏱️  Estimated: 30min

...
```

---

#### /plan to-todos

**功能**: 将当前计划转换为可执行的 todo 列表

**语法**:
```bash
/plan to-todos
```

**效果**:
- 创建 todos（内存存储）
- 自动分配优先级
- 保留依赖关系

**输出示例**:
```
✅ Created 5 todos from plan "Implement User Login"

💡 Next steps:
- /todos list - View all todos
- /todos execute <id> - Execute a todo
```

**注意**:
- ⚠️ 会覆盖已存在的 todos
- ⚠️ 内存存储，会话结束后清空

---

#### /plan clear

**功能**: 清除当前计划

**语法**:
```bash
/plan clear
```

**效果**:
- 删除当前 plan 数据
- 不影响已创建的 todos

---

### /todos 命令组

#### /todos list

**功能**: 显示所有 todo 列表

**语法**:
```bash
/todos list
```

**显示内容**:
- 统计信息（总数、各状态数量）
- 按优先级分组的活跃任务
- 已完成和已取消的任务

**输出示例**:
```
📋 Todo List (5 total)

✅ 2 completed | 🔄 1 in progress | ⬜ 2 pending | ❌ 0 cancelled

### HIGH Priority

⬜ step-1 - Create User model ⏱️ 30min
   📦 Module: backend/models

⬜ step-2 - Implement JWT ⏱️ 45min
   📦 Module: backend/auth
   🔗 Dependencies: step-1
   ⚠️  Token security vulnerabilities
```

---

#### /todos execute

**功能**: 执行指定的 todo

**语法**:
```bash
/todos execute <id> [--mode=auto_edit|default]
```

**参数**:
- `<id>`: 必需，todo 的 ID（如 `step-1`）
- `--mode`: 可选，执行模式
  - `default`: 默认模式，需要确认（默认值）
  - `auto_edit`: 自动模式，自动批准

**示例**:
```bash
# 使用默认模式
/todos execute step-1

# 使用自动模式
/todos execute step-1 --mode=auto_edit

# 明确指定默认模式
/todos execute step-1 --mode=default
```

**执行流程**:
1. 检查依赖是否完成
2. 设置执行模式
3. 显示任务信息
4. 开始执行
5. 提示更新状态

**依赖检查示例**:
```bash
> /todos execute step-3

❌ Cannot execute step-3. Dependencies not completed:
- step-1
- step-2

Complete dependencies first.
```

---

#### /todos execute-all

**功能**: 批量执行所有待执行的 todos

**语法**:
```bash
/todos execute-all [--mode=auto_edit|default]
```

**参数**:
- `--mode`: 可选，执行模式
  - `default`: 默认模式，需要确认（默认值）
  - `auto_edit`: 自动模式，自动批准所有操作

**特性**:
- 🔄 自动按顺序执行所有待执行 todos
- 🔗 自动检查依赖关系
- 📊 实时显示进度
- ⏸️ Ctrl+C 随时中断
- 🛡️ 错误自动恢复

**示例 1 - Default 模式**:
```bash
> /todos execute-all --mode=default

🚀 Starting Batch Execution

📊 Total todos: 5
⚙️ Approval mode: default
🎯 First todo: Create User model

---

▶️  [1/5] Create User model ⏱️ 30min

⚠️ write_file backend/models/User.ts
Confirm? (y/n): y
✓ write_file backend/models/User.ts

✅ Task 1 completed

---

▶️  [2/5] Implement JWT ⏱️ 45min
[...]

---

✅ Batch Execution Complete!
📊 Executed 5/5 todos
```

**示例 2 - Auto-edit 模式**:
```bash
> /todos execute-all --mode=auto_edit

🚀 Starting Batch Execution

📊 Total todos: 5
⚙️ Approval mode: auto_edit

---

▶️  [1/5] Create User model ⏱️ 30min
✓ write_file backend/models/User.ts (auto-approved)

▶️  [2/5] Implement JWT ⏱️ 45min
✓ write_file backend/auth/jwt.ts (auto-approved)

[...]

✅ Batch Execution Complete!
📊 Executed 5/5 todos in 2.5 minutes
```

**中断执行**:
```bash
> /todos execute-all --mode=auto_edit

▶️  [2/5] Implement JWT...

^C  ← 按 Ctrl+C

⏸️  Batch Execution Interrupted
Completed: 1/5 todos

Use /todos list to see current progress
Use /todos execute-all to resume
```

**错误处理**:
```bash
> /todos execute-all

▶️  [3/5] Create API endpoints...

❌ Error: File already exists

❌ Batch Execution Failed
Todo 3/5 encountered an error.
Progress: 2 completed, 1 failed

💡 Fix the issue and run /todos execute-all to continue
```

**适用场景**:
- ✅ 信任的任务列表（auto_edit）
- ✅ 简单的批量操作
- ✅ 测试或文档任务
- ⚠️ 不适合核心业务逻辑

**注意事项**:
- 按顺序执行所有 `pending` 状态的 todos
- 跳过 `completed` 或 `cancelled` 的 todos
- 自动检查依赖关系
- 中断后可随时恢复

---

#### /todos update

**功能**: 更新 todo 的状态

**语法**:
```bash
/todos update <id> <status>
```

**参数**:
- `<id>`: todo 的 ID
- `<status>`: 新状态
  - `pending`: 待执行
  - `in_progress`: 执行中
  - `completed`: 已完成
  - `cancelled`: 已取消

**示例**:
```bash
# 标记为已完成
/todos update step-1 completed

# 标记为取消
/todos update step-5 cancelled

# 重置为待执行
/todos update step-2 pending
```

**输出示例**:
```
✅ Updated step-1 → completed

📋 Current progress:
✅ 1 completed | 🔄 0 in progress | ⬜ 4 pending
```

---

#### /todos export

**功能**: 导出 todos 为 JSON 格式

**语法**:
```bash
/todos export
```

**输出格式**:
```json
{
  "version": "1.0",
  "generatedAt": "2025-10-16T12:00:00.000Z",
  "sourcePlan": "Plan title",
  "todos": [
    {
      "id": "step-1",
      "description": "Create User model",
      "status": "completed",
      "priority": "high",
      "module": "backend/models",
      "dependencies": [],
      "risks": ["Data validation"],
      "estimatedTime": "30min",
      "createdFrom": "plan",
      "createdAt": "2025-10-16T11:00:00.000Z",
      "completedAt": "2025-10-16T11:25:00.000Z"
    }
  ],
  "statistics": {
    "total": 5,
    "pending": 1,
    "in_progress": 0,
    "completed": 3,
    "cancelled": 1
  }
}
```

**用途**:
- 📊 进度报告
- 🔄 外部工具集成
- 📝 项目文档
- 💾 备份记录

---

#### /todos clear

**功能**: 清除所有 todos

**语法**:
```bash
/todos clear
```

**效果**:
- 删除内存中的所有 todos
- 不影响 plan 数据

---

## 工具 API

### create_plan

**工具名称**: `create_plan`

**描述**: 创建结构化的执行计划

**参数类型**:
```typescript
interface PlanToolParams {
  title: string;              // 计划标题（必需）
  overview: string;           // 计划概述（必需）
  steps: PlanStep[];          // 执行步骤（必需）
  risks?: string[];           // 整体风险（可选）
  testingStrategy?: string;   // 测试策略（可选）
  estimatedDuration?: string; // 总体时间估计（可选）
}

interface PlanStep {
  id: string;                 // 步骤 ID（必需）
  description: string;        // 步骤描述（必需）
  module?: string;            // 模块名称（可选）
  dependencies?: string[];    // 依赖的步骤 ID（可选）
  risks?: string[];           // 步骤风险（可选）
  estimatedTime?: string;     // 时间估计（可选）
}
```

**返回值**:
```typescript
interface ToolResult {
  success: boolean;
  message: string;
  data?: PlanToolParams;
}
```

**使用示例** (AI 调用):
```json
{
  "tool": "create_plan",
  "parameters": {
    "title": "Implement User Login",
    "overview": "Add JWT-based authentication",
    "steps": [
      {
        "id": "step-1",
        "description": "Create User model",
        "module": "backend/models",
        "estimatedTime": "30min"
      },
      {
        "id": "step-2",
        "description": "Implement JWT",
        "module": "backend/auth",
        "dependencies": ["step-1"],
        "risks": ["Token security"],
        "estimatedTime": "45min"
      }
    ],
    "risks": ["Session management complexity"],
    "testingStrategy": "Unit tests + Integration tests"
  }
}
```

**验证规则**:
- `title`: 非空字符串
- `overview`: 非空字符串
- `steps`: 至少包含 1 个步骤
- 每个步骤必须有唯一的 `id`
- `dependencies` 必须引用已存在的步骤 ID

---

### write_todos

**工具名称**: `write_todos`

**描述**: 创建或更新 todo 列表

**参数类型**:
```typescript
interface ExtendedTodo {
  id: string;                       // Todo ID（必需）
  description: string;              // 描述（必需）
  status: TodoStatus;               // 状态（必需）
  priority?: 'high' | 'medium' | 'low';
  module?: string;
  dependencies?: string[];
  risks?: string[];
  estimatedTime?: string;
  createdFrom?: 'plan' | 'manual';
  createdAt?: string;
  completedAt?: string;
}

type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
```

**注意**: 用户通常不直接调用此工具，而是通过 `/plan to-todos` 自动创建

---

## 类型定义

### PlanData

```typescript
interface PlanData {
  title: string;
  overview: string;
  steps: PlanStep[];
  risks?: string[];
  testingStrategy?: string;
  estimatedDuration?: string;
}
```

### ExtendedTodo

```typescript
interface ExtendedTodo extends Todo {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority?: 'high' | 'medium' | 'low';
  module?: string;
  dependencies?: string[];
  risks?: string[];
  estimatedTime?: string;
  createdFrom?: 'plan' | 'manual';
  createdAt?: string;
  completedAt?: string;
}
```

### ExecutionQueue

```typescript
interface ExecutionQueue {
  active: boolean;         // 是否正在批量执行
  mode: 'default' | 'auto_edit'; // 执行模式
  currentIndex: number;    // 当前执行索引
  totalCount: number;      // 总 todo 数量
  executingTodoId?: string; // 当前执行的 todo ID
}
```

---

## 命令速查表

### 基本操作

| 操作 | 命令/快捷键 |
|------|------------|
| 进入 Plan 模式 | `Ctrl+P` |
| 退出 Plan 模式 | `Ctrl+P` |
| 取消当前操作 | `Ctrl+C` |

### Plan 命令

| 命令 | 说明 |
|------|------|
| `/plan show` | 显示当前计划 |
| `/plan to-todos` | 转换为 todos |
| `/plan clear` | 清除计划 |

### Todo 命令

| 命令 | 说明 |
|------|------|
| `/todos list` | 列出所有 todos |
| `/todos execute <id>` | 执行单个 todo（default 模式） |
| `/todos execute <id> --mode=auto_edit` | 执行单个 todo（auto-edit 模式） |
| `/todos execute-all` | 批量执行（default 模式） |
| `/todos execute-all --mode=auto_edit` | 批量执行（auto-edit 模式） |
| `/todos update <id> <status>` | 更新 todo 状态 |
| `/todos export` | 导出为 JSON |
| `/todos clear` | 清除所有 todos |

---

**最后更新**: 2025-10-16  
**版本**: 1.0.0


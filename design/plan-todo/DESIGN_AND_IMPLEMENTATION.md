# Plan+Todo 模式 - 设计与实现

> 架构设计、核心组件、实现细节和关键修复

---

## 📋 目录

- [架构设计](#架构设计)
- [核心组件](#核心组件)
- [状态管理](#状态管理)
- [执行流程](#执行流程)
- [批量执行机制](#批量执行机制)
- [关键 Bug 修复](#关键-bug-修复)

---

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                      AppContainer                        │
│  ┌────────────────────────────────────────────────────┐ │
│  │ State Management                                    │ │
│  │ - planModeActive                                    │ │
│  │ - currentPlan                                       │ │
│  │ - todos                                             │ │
│  │ - executionQueue                                    │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
           │                              │
           ▼                              ▼
┌──────────────────────┐      ┌──────────────────────┐
│  useGeminiStream     │      │ slashCommandProcessor│
│  - handleNextTodo    │      │ - planCommand        │
│  - sendUserMessage   │      │ - todosCommand       │
│  - Plan mode sync    │      │                      │
└──────────────────────┘      └──────────────────────┘
           │                              │
           ▼                              ▼
┌──────────────────────┐      ┌──────────────────────┐
│  GeminiClient        │      │  TodoUtils           │
│  - getPlanModeActive │      │  - formatTodosDisplay│
│  - getUnifiedTools   │      │  - planToTodos       │
│  - system prompt     │      │  - checkDependencies │
└──────────────────────┘      └──────────────────────┘
           │
           ▼
┌──────────────────────┐
│  Core Tools          │
│  - CreatePlanTool    │
│  - WriteTodosTool    │
└──────────────────────┘
```

### 核心设计原则

1. **关注点分离**
   - Core 层：工具定义和验证
   - CLI 层：UI 逻辑和状态管理
   - Command 层：用户交互和命令处理

2. **状态管理**
   - 内存存储：todos 和 plan 数据
   - React hooks：响应式 UI 更新
   - Refs 避免闭包陷阱

3. **安全性**
   - Plan 模式工具过滤
   - 执行模式选择（default/auto_edit）
   - 依赖关系验证

---

## 核心组件

### 1. CreatePlanTool

**文件**: `packages/core/src/tools/create-plan.ts`

**职责**: 允许 AI 创建结构化计划

**接口定义**:
```typescript
export interface PlanStep {
  id: string;
  description: string;
  module?: string;
  dependencies?: string[];
  risks?: string[];
  estimatedTime?: string;
}

export interface PlanToolParams {
  title: string;
  overview: string;
  steps: PlanStep[];
  risks?: string[];
  testingStrategy?: string;
  estimatedDuration?: string;
}
```

**关键特性**:
- 结构化输出（title, overview, steps, risks, testing）
- 依赖关系验证
- 参数验证（必填字段检查）

---

### 2. WriteTodosTool 扩展

**文件**: `packages/core/src/tools/write-todos.ts`

**ExtendedTodo 接口**:
```typescript
export interface ExtendedTodo extends Todo {
  id: string;
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

**新增字段**:
- `priority`: 优先级自动分配（前 3 步为 high，4-6 为 medium，7+ 为 low）
- `dependencies`: 依赖的 todo ID 列表
- `risks`: 风险提示
- `estimatedTime`: 预计完成时间

---

### 3. Plan 模式系统提示词

**文件**: `packages/core/src/core/prompts.ts`

**功能**: 在 Plan 模式下注入专用系统提示词

**提示词结构**:
```typescript
export function getPlanModeSystemPrompt(): string {
  return `
# 🎯 PLAN MODE - Structured Planning Only

You are in **PLAN MODE**. Your goal is to analyze requirements 
and create detailed execution plans, NOT to execute them.

## Constraints

✅ **YOU CAN:**
- Read files (read_file, read_many_files)
- Search codebase (grep, rg, glob, ls)
- Research information (web_search, web_fetch)
- **Create structured plan (create_plan)** ⭐

❌ **YOU CANNOT:**
- Write or edit files (edit, write_file, smart_edit)
- Execute commands (bash, shell)
- Make any changes to the codebase

## Your Workflow

1. **Understand**: Read relevant files, search for patterns
2. **Analyze**: Identify what needs to be done, dependencies, risks
3. **Plan**: Call the \`create_plan\` tool with structured output
`;
}
```

---

### 4. 工具过滤

**文件**: `packages/core/src/core/client.ts`

**实现**:
```typescript
getUnifiedTools(): UnifiedToolInfo[] {
  const allTools = this.getAllTools();
  
  if (this.planModeActive) {
    // Plan 模式：只允许只读工具 + create_plan
    const READ_ONLY_TOOLS = [
      'read_file', 'read_many_files', 'ls', 'glob', 
      'grep', 'rg', 'web_fetch', 'web_search', 'create_plan'
    ];
    
    return allTools.filter(tool => 
      READ_ONLY_TOOLS.includes(tool.name)
    );
  }
  
  return allTools; // 普通模式：所有工具
}
```

**效果**: Plan 模式下 AI 无法使用写工具

---

### 5. Slash 命令

#### /plan 命令

**文件**: `packages/cli/src/ui/commands/planCommand.ts`

**子命令**:
- `show`: 显示当前计划
- `to-todos`: 将计划转换为 todos
- `clear`: 清除计划

**关键实现**:
```typescript
case 'to-todos': {
  if (!session.currentPlan) {
    return '❌ No active plan';
  }
  
  const todos = planToTodos(session.currentPlan);
  session.setTodos(todos);
  
  return `✅ Created ${todos.length} todos from plan "${plan.title}"`;
}
```

#### /todos 命令

**文件**: `packages/cli/src/ui/commands/todosCommand.ts`

**子命令**:
- `list`: 列出所有 todos
- `execute <id> [--mode]`: 执行单个 todo
- `execute-all [--mode]`: 批量执行所有 todos
- `update <id> <status>`: 更新状态
- `export`: 导出 JSON
- `clear`: 清除所有

---

### 6. Todo 工具函数

**文件**: `packages/cli/src/utils/todoUtils.ts`

**核心函数**:

```typescript
// 格式化显示
export function formatTodosDisplay(todos: ExtendedTodo[]): string

// 计划转 todos
export function planToTodos(plan: PlanData): ExtendedTodo[]

// 检查依赖
export function checkDependencies(
  todo: ExtendedTodo, 
  allTodos: ExtendedTodo[]
): { satisfied: boolean; missing: string[] }

// 获取下一个可执行 todo
export function getNextExecutableTodo(
  todos: ExtendedTodo[]
): ExtendedTodo | null

// 导出 JSON
export function exportTodosToJson(
  todos: ExtendedTodo[], 
  sourcePlan?: PlanData
): string
```

---

## 状态管理

### AppContainer 状态

**文件**: `packages/cli/src/ui/AppContainer.tsx`

```typescript
// Plan 模式状态
const [planModeActive, setPlanModeActive] = useState(false);
const [currentPlan, setCurrentPlan] = useState<PlanData | null>(null);

// Todo 列表（内存）
const [todos, setTodos] = useState<ExtendedTodo[]>([]);

// Todo 更新函数
const updateTodo = useCallback((id: string, updates: Partial<ExtendedTodo>) => {
  setTodos(prev => prev.map(t => 
    t.id === id ? { ...t, ...updates } : t
  ));
}, []);

// 批量执行队列
const [executionQueue, setExecutionQueue] = useState<ExecutionQueue | null>(null);
```

### 状态传递

**通过 session context**:
```typescript
const sessionContext = {
  // ... 现有字段
  todos,
  setTodos,
  updateTodo,
  currentPlan,
  setCurrentPlan,
  planModeActive,
  executionQueue,
  setExecutionQueue,
};
```

**传递到**:
- `useSlashCommandProcessor`: 命令处理器
- `useGeminiStream`: AI 交互管理

---

## 执行流程

### Plan 模式流程

```
用户按 Ctrl+P
    ↓
setPlanModeActive(true)
    ↓
geminiClient.setPlanModeActive(true)
    ↓
提示符显示 [PLAN] >
    ↓
用户输入规划需求
    ↓
AI 调用 create_plan 工具
    ↓
setCurrentPlan(planData)
    ↓
显示计划内容
    ↓
用户按 Ctrl+P 退出
    ↓
setPlanModeActive(false)
```

### Todo 执行流程

```
用户: /plan to-todos
    ↓
planToTodos(currentPlan) → 创建 todos
    ↓
setTodos(newTodos)
    ↓
用户: /todos execute step-1 --mode=auto_edit
    ↓
检查依赖: checkDependencies(step-1, allTodos)
    ↓
设置审批模式: setApprovalMode(auto_edit)
    ↓
提交提示词: "Execute todo: step-1 ..."
    ↓
AI 执行任务
    ↓
用户: /todos update step-1 completed
    ↓
updateTodo('step-1', { status: 'completed' })
```

---

## 批量执行机制

### 架构

```
用户: /todos execute-all --mode=auto_edit
    ↓
todosCommand.ts (execute-all action)
    ├─ 检查待执行 todos 数量
    ├─ 找到第一个可执行 todo
    ├─ 初始化 executionQueue 状态
    ├─ 设置审批模式
    └─ 提交执行提示词
    ↓
useGeminiStream.ts (sendUserMessage)
    ├─ 处理 AI 响应
    ├─ 执行工具调用
    └─ finally { 触发 handleNextTodo }
    ↓
handleNextTodo()
    ├─ 标记当前 todo 为 completed
    ├─ 查找下一个可执行 todo
    ├─ 更新 executionQueue
    ├─ 显示进度
    └─ 提交下一个 todo 执行提示词
    ↓
循环直到:
    ├─ 所有 todos 完成 → 显示完成消息
    ├─ 用户中断 (Ctrl+C) → 显示中断消息
    └─ 发生错误 → 显示错误消息
```

### 关键实现

**executionQueue 状态**:
```typescript
interface ExecutionQueue {
  active: boolean;
  mode: 'default' | 'auto_edit';
  currentIndex: number;
  totalCount: number;
  executingTodoId?: string;
}
```

**handleNextTodo 函数**:
```typescript
const handleNextTodo = useCallback(async () => {
  const currentQueue = executionQueueRef.current;
  if (!currentQueue?.active) return null;

  // 1. 标记当前 todo 完成
  if (currentQueue.executingTodoId) {
    updateTodoRef.current(currentQueue.executingTodoId, {
      status: 'completed',
      completedAt: new Date().toISOString()
    });
  }

  // 2. 查找下一个可执行 todo
  const nextTodo = getNextExecutableTodo(todosRef.current);

  if (!nextTodo) {
    // 所有完成
    setExecutionQueueRef.current(null);
    return '✅ Batch Execution Complete!';
  }

  // 3. 更新队列状态
  setExecutionQueueRef.current({
    ...currentQueue,
    currentIndex: currentQueue.currentIndex + 1,
    executingTodoId: nextTodo.id
  });

  // 4. 返回下一个 todo 的提示词
  return `[${currentQueue.currentIndex + 1}/${currentQueue.totalCount}] ${nextTodo.description}`;
}, []);
```

**自动续接**:
```typescript
// useGeminiStream.ts - sendUserMessage 的 finally 块
finally {
  setIsResponding(false);
  
  // 检查批量执行队列
  if (executionQueueRef.current?.active) {
    setTimeout(async () => {
      const nextPrompt = await handleNextTodo();
      if (nextPrompt) {
        // 自动提交下一个 todo
        submitQueryRef.current(nextPrompt);
      }
    }, 500);
  }
}
```

---

## 关键 Bug 修复

### Bug 1: API 错误 - 孤儿 tool 响应

**问题描述**:
```
API Error: messages with role "tool" must be a response 
to a preceeding message with "tool_calls".
```

**根本原因**:
- `APITranslator.validateAndFixToolCalls` 删除了无效的 `tool_calls`
- 但没有删除对应的 `tool` 响应消息
- 导致 `tool` 消息成为"孤儿"

**解决方案**:

**文件**: `packages/core/src/adapters/utils/apiTranslator.ts`

```typescript
validateAndFixToolCalls(messages: APIMessage[]): APIMessage[] {
  const result: APIMessage[] = [];
  const removedToolCallIds = new Set<string>();

  for (const msg of messages) {
    if (msg.role === 'assistant' && msg.tool_calls) {
      const validToolCalls = msg.tool_calls.filter(tc => 
        isValidToolCall(tc)
      );
      
      // 跟踪被删除的 tool_call ID
      const removed = msg.tool_calls
        .filter(tc => !validToolCalls.includes(tc))
        .map(tc => tc.id);
      removed.forEach(id => removedToolCallIds.add(id));

      if (validToolCalls.length > 0) {
        result.push({ ...msg, tool_calls: validToolCalls });
      } else {
        result.push({ role: 'assistant', content: msg.content || '' });
      }
    } 
    else if (msg.role === 'tool') {
      // 跳过孤儿 tool 响应
      if (!removedToolCallIds.has(msg.tool_call_id)) {
        result.push(msg);
      }
    } 
    else {
      result.push(msg);
    }
  }

  return result;
}
```

**效果**: 确保 `tool` 消息始终有对应的 `tool_calls`

---

### Bug 2: 闭包陷阱 - 批量执行停止

**问题描述**:
- `/todos execute-all` 只执行第一个 todo 就停止
- Debug 日志显示 `hasExecutionQueue: false`
- 但 `executionQueue` 状态实际上是 active

**根本原因**:
- `sendUserMessage` 是一个 `useCallback`
- 它在创建时捕获了 `executionQueue` 的初始值（null）
- 当 `executionQueue` 更新时，`sendUserMessage` 仍然使用旧值
- 这是典型的 React **闭包陷阱**

**解决方案**:

**文件**: `packages/cli/src/ui/hooks/useGeminiStream.ts`

**步骤 1: 创建 refs**
```typescript
const executionQueueRef = useRef<ExecutionQueue | null>(null);
const todosRef = useRef<ExtendedTodo[]>([]);
const updateTodoRef = useRef(updateTodo);
const setExecutionQueueRef = useRef(setExecutionQueue);
const submitQueryRef = useRef<(query: string) => void>();
```

**步骤 2: 同步 refs 和 props/state**
```typescript
useEffect(() => {
  executionQueueRef.current = executionQueue;
}, [executionQueue]);

useEffect(() => {
  todosRef.current = todos;
}, [todos]);

useEffect(() => {
  updateTodoRef.current = updateTodo;
}, [updateTodo]);

useEffect(() => {
  setExecutionQueueRef.current = setExecutionQueue;
}, [setExecutionQueue]);
```

**步骤 3: 在 callback 中使用 refs**
```typescript
const handleNextTodo = useCallback(async () => {
  const currentQueue = executionQueueRef.current; // 使用 ref
  if (!currentQueue?.active) return null;

  const currentTodos = todosRef.current; // 使用 ref
  const nextTodo = getNextExecutableTodo(currentTodos);

  if (nextTodo) {
    setExecutionQueueRef.current({ // 使用 ref
      ...currentQueue,
      executingTodoId: nextTodo.id
    });
  }
  
  // ...
}, []); // 空依赖数组，因为使用 refs
```

**步骤 4: sendUserMessage finally 块**
```typescript
finally {
  setIsResponding(false);
  
  if (executionQueueRef.current?.active) { // 使用 ref
    setTimeout(async () => {
      const nextPrompt = await handleNextTodo();
      if (nextPrompt) {
        submitQueryRef.current?.(nextPrompt); // 使用 ref
      }
    }, 500);
  }
}
```

**效果**: 
- `sendUserMessage` 始终访问最新的 `executionQueue` 状态
- 批量执行正常连续进行

---

### Bug 3: 依赖检查不准确

**问题描述**:
有依赖的 todo 被错误地允许执行

**解决方案**:

**文件**: `packages/cli/src/utils/todoUtils.ts`

```typescript
export function checkDependencies(
  todo: ExtendedTodo,
  allTodos: ExtendedTodo[]
): { satisfied: boolean; missing: string[] } {
  if (!todo.dependencies || todo.dependencies.length === 0) {
    return { satisfied: true, missing: [] };
  }

  const missing: string[] = [];

  for (const depId of todo.dependencies) {
    const depTodo = allTodos.find(t => t.id === depId);
    
    if (!depTodo) {
      missing.push(depId); // 依赖不存在
    } else if (depTodo.status !== 'completed') {
      missing.push(depId); // 依赖未完成
    }
  }

  return {
    satisfied: missing.length === 0,
    missing
  };
}
```

**效果**: 严格验证依赖，确保正确的执行顺序

---

## 技术亮点

### 1. React Hooks 最佳实践

- 使用 `useRef` 避免闭包陷阱
- `useCallback` 优化性能
- `useEffect` 同步 props 和 refs

### 2. 类型安全

- 完整的 TypeScript 类型定义
- 编译时类型检查
- 运行时参数验证

### 3. 错误处理

- API 错误：自动修复消息格式
- 执行错误：清理状态，恢复审批模式
- 中断处理：Ctrl+C 支持

### 4. 用户体验

- 清晰的进度反馈
- 友好的错误消息
- 灵活的执行模式

---

## 性能考虑

- **内存管理**: todos 在内存中，轻量高效
- **UI 响应性**: 使用 setTimeout 延迟确保 UI 更新
- **批量优化**: 自动续接避免用户手动干预

---

## 未来优化

1. **并行执行**: 对无依赖的 todos 并行执行
2. **持久化**: 可选的 todos 文件存储
3. **撤销功能**: 支持回滚已执行的 todo
4. **执行报告**: 生成详细的执行日志

---

**最后更新**: 2025-10-16  
**版本**: 1.0.0  
**状态**: ✅ 已完成


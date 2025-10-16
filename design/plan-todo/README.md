# Plan+Todo 模式

> **Plan+Todo 模式**让你先规划后执行，通过结构化的计划和任务列表提升开发效率。

---

## 📋 概述

Plan+Todo 模式是一个两阶段的任务执行流程：

1. **Plan 阶段（规划）**：AI 在只读模式下分析需求，创建结构化计划
2. **Todo 阶段（执行）**：将计划转换为可执行的任务列表，逐步完成

### 核心特性

- 🔒 **安全的 Plan 模式**：只读模式，只分析不修改
- 📋 **结构化计划**：包含步骤、风险、测试策略
- ✅ **智能依赖检查**：自动验证任务依赖关系
- ⚙️ **灵活执行模式**：支持自动和手动审批
- 🚀 **批量执行**：一键执行所有待办任务
- 📊 **进度追踪**：清晰的任务状态显示

---

## 📚 文档导航

### 快速开始
- [USER_GUIDE.md](./USER_GUIDE.md) - 完整用户手册，包含快速开始和最佳实践

### 技术文档
- [DESIGN_AND_IMPLEMENTATION.md](./DESIGN_AND_IMPLEMENTATION.md) - 架构设计和实现细节
- [API.md](./API.md) - 命令和工具 API 参考

---

## 🚀 快速示例

### 基本流程

```bash
# 1. 进入 Plan 模式
> [Ctrl+P]

# 2. 创建计划
[PLAN] > 帮我规划实现用户登录功能

# 3. 退出 Plan 模式
> [Ctrl+P]

# 4. 转换为 todos
> /plan to-todos

# 5. 执行 todos
> /todos execute step-1 --mode=auto_edit

# 6. 批量执行所有 todos
> /todos execute-all --mode=default
```

---

## 📊 功能状态

| 功能 | 状态 | 说明 |
|------|------|------|
| Plan 模式 | ✅ 完成 | Ctrl+P 触发，只读规划 |
| Todo 管理 | ✅ 完成 | 内存存储，状态管理 |
| 单个执行 | ✅ 完成 | `/todos execute` |
| 批量执行 | ✅ 完成 | `/todos execute-all` |
| 依赖检查 | ✅ 完成 | 自动验证依赖 |
| 进度追踪 | ✅ 完成 | `/todos list` |
| JSON 导出 | ✅ 完成 | `/todos export` |

---

## 🎯 典型用例

### 1. 功能开发
先用 Plan 模式规划架构和步骤，再逐步实现

### 2. 代码重构
分析风险，制定安全的重构步骤

### 3. 学习代码库
使用 Plan 模式分析代码结构和依赖关系

### 4. 数据库迁移
详细规划迁移步骤、回滚方案和风险评估

---

## 🔗 相关资源

### 用户文档
- [完整用户手册](../../docs/PLAN_TODO_MODE_USER_GUIDE.md)

### 代码实现
- Core: `packages/core/src/tools/create-plan.ts`
- Core: `packages/core/src/tools/write-todos.ts`
- CLI: `packages/cli/src/ui/commands/planCommand.ts`
- CLI: `packages/cli/src/ui/commands/todosCommand.ts`

---

**实施日期**: 2025-10-16  
**状态**: ✅ 已完成  
**版本**: 1.0.0


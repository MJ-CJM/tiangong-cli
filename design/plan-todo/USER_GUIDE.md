# Plan+Todo 模式 - 用户指南

> 快速开始、实用场景和最佳实践

---

## 📋 目录

- [快速开始](#快速开始)
- [核心概念](#核心概念)
- [实用场景](#实用场景)
- [最佳实践](#最佳实践)
- [常见问题](#常见问题)

---

## 快速开始

### 5 分钟上手

#### 第 1 步：进入 Plan 模式

```bash
> [Ctrl+P]

📋 Plan Mode Activated
✅ Read-only mode enabled
💡 Press Ctrl+P again to exit
```

提示符变为：`[PLAN] >`

#### 第 2 步：创建计划

```bash
[PLAN] > 帮我规划实现用户登录功能
```

AI 会分析代码并创建结构化计划：

```
✅ Plan Created: "Implement User Login"

Steps (5):
1. step-1: Create User model ⏱️ 30min
2. step-2: Implement JWT [deps: step-1] ⏱️ 45min
3. step-3: Create API endpoints [deps: step-2] ⏱️ 30min
4. step-4: Add frontend login form [deps: step-3] ⏱️ 1h
5. step-5: Write tests [deps: step-1, step-2, step-3] ⏱️ 1h

Risks: Password hashing, Token security
```

#### 第 3 步：退出 Plan 模式

```bash
[PLAN] > [Ctrl+P]

📋 Exited Plan Mode
💡 Use /plan to-todos to convert to executable todos
```

#### 第 4 步：转换并执行

```bash
# 转换为 todos
> /plan to-todos
✅ Created 5 todos

# 查看列表
> /todos list

# 执行第一个（自动模式）
> /todos execute step-1 --mode=auto_edit
✓ write_file models/User.ts
✅ Task completed

# 标记完成
> /todos update step-1 completed

# 或一键批量执行
> /todos execute-all --mode=auto_edit
```

---

## 核心概念

### Plan 模式

**什么是 Plan 模式？**
- 只读模式，AI 只分析不修改代码
- 创建结构化计划（步骤、风险、测试）
- 通过 `Ctrl+P` 切换

**Plan 模式下 AI 可以做什么？**
- ✅ 读取文件
- ✅ 搜索代码
- ✅ 创建计划
- ❌ 不能修改文件
- ❌ 不能执行命令

**为什么需要 Plan 模式？**
- 先规划后执行，避免盲目修改
- 识别风险，制定测试策略
- 让 AI 专注于思考和分析

---

### Todo 管理

**Todo 生命周期**:
```
Plan 创建 → /plan to-todos → pending → execute → in_progress → update → completed
```

**Todo 状态**:
- `pending` ⬜: 待执行
- `in_progress` 🔄: 执行中
- `completed` ✅: 已完成
- `cancelled` ❌: 已取消

**优先级**（自动分配）:
- `HIGH`: 前 3 个步骤
- `MEDIUM`: 4-6 个步骤
- `LOW`: 7 个及之后

---

### 执行模式

**Default 模式**（默认）:
- 需要手动确认每个操作
- 安全性高，适合重要代码

**Auto-edit 模式**:
- 自动批准所有操作
- 速度快，适合信任的任务

**如何选择？**
- 核心业务逻辑 → `default`
- 数据库操作 → `default`
- UI 组件 → `auto_edit`
- 测试代码 → `auto_edit`
- 文档 → `auto_edit`

---

### 依赖管理

**什么是依赖？**
- 某个 todo 必须等其他 todo 完成后才能执行

**示例**:
```bash
⬜ step-2 - Implement JWT
   🔗 Dependencies: step-1
```

**自动检查**:
```bash
> /todos execute step-2

❌ Cannot execute step-2. Dependencies not completed:
- step-1
```

---

## 实用场景

### 场景 1：添加新功能

**需求**: 为博客添加评论功能

```bash
# 1. 规划
> [Ctrl+P]
[PLAN] > 帮我规划如何添加评论功能，包括评论、回复、点赞

# 2. 转换
> [Ctrl+P]
> /plan to-todos

# 3. 批量执行
> /todos execute-all --mode=auto_edit
```

---

### 场景 2：代码重构

**需求**: 重构混乱的工具函数

```bash
# 1. 分析和规划
> [Ctrl+P]
[PLAN] > 分析 utils.js，规划如何重构为多个模块

# 2. 查看计划
> /plan show

# 3. 谨慎执行（default 模式）
> [Ctrl+P]
> /plan to-todos
> /todos execute step-1 --mode=default
[仔细确认每个修改...]
```

---

### 场景 3：学习代码库

**需求**: 理解新项目

```bash
# 只用 Plan 模式分析
> [Ctrl+P]
[PLAN] > 分析这个项目的架构，包括模块、数据流、依赖关系

# 查看完整分析
> /plan show

# 不需要执行，只用于学习
```

---

### 场景 4：数据库迁移

**需求**: 升级数据库 schema

```bash
# 1. 详细规划
> [Ctrl+P]
[PLAN] > 规划数据库迁移，包括备份、迁移脚本、回滚方案、风险评估

# 2. 查看风险
> /plan show

# 3. 仔细执行
> [Ctrl+P]
> /plan to-todos
> /todos execute step-1 --mode=default
[每步都仔细确认]
```

---

### 场景 5：批量任务

**需求**: 一次性执行多个相关任务

```bash
# 1. 创建计划
> [Ctrl+P]
[PLAN] > 规划实现完整的购物车功能

# 2. 转换为 todos
> [Ctrl+P]
> /plan to-todos

# 3. 批量执行
> /todos execute-all --mode=auto_edit

# 输出：
🚀 Starting Batch Execution
📊 Total todos: 8

▶️  [1/8] Create Cart model...
✓ write_file models/Cart.ts

▶️  [2/8] Add Cart API...
✓ write_file api/cart.ts

[...]

✅ Batch Execution Complete!
📊 Executed 8/8 todos in 5 minutes
```

**中断和恢复**:
```bash
# 执行到一半按 Ctrl+C
^C
⏸️  Batch Execution Interrupted
Completed: 3/8 todos

# 查看进度
> /todos list

# 继续执行剩余
> /todos execute-all --mode=auto_edit
```

---

## 最佳实践

### 1. 何时使用 Plan 模式

**✅ 推荐使用**:
- 复杂的多步骤任务（3+ 步骤）
- 跨多个文件/模块的功能
- 需要风险评估的操作
- 不熟悉的代码库
- 重要的业务逻辑

**❌ 不推荐使用**:
- 简单的单文件修改
- 明确的小任务
- 紧急 Bug 修复
- 文档/注释更新

---

### 2. 规划阶段技巧

**提供充分的上下文**:

✅ 好的示例:
```bash
[PLAN] > 这是一个 React + TypeScript + Express 项目。
当前使用 JWT 认证。
我想添加 OAuth 2.0 支持（Google 和 GitHub 登录）。
请规划实现步骤，考虑向后兼容性。
```

❌ 不好的示例:
```bash
[PLAN] > 添加 OAuth
```

**明确要求**:
```bash
[PLAN] > 规划实现用户权限系统，需要包括：
1. 角色定义（管理员、编辑、读者）
2. 权限检查中间件
3. 前端权限控制
4. 测试用例
请给出详细的实现步骤和风险分析。
```

**审查计划**:
```bash
> /plan show

检查：
- ✅ 步骤顺序是否合理？
- ✅ 依赖关系是否正确？
- ✅ 是否遗漏重要步骤？
- ✅ 风险评估是否全面？
```

---

### 3. 执行阶段技巧

**逐步执行，及时验证**:

✅ 推荐:
```bash
> /todos execute step-1 --mode=auto_edit
[验证结果...]
> /todos update step-1 completed
> /todos list
> /todos execute step-2
```

❌ 不推荐:
```bash
# 连续执行多个，不验证
> /todos execute step-1 --mode=auto_edit
> /todos execute step-2 --mode=auto_edit
> /todos execute step-3 --mode=auto_edit
```

**处理依赖关系**:
```bash
# 检查依赖
> /todos list

# 先完成依赖
> /todos execute step-1
> /todos update step-1 completed

# 再执行当前
> /todos execute step-2
```

---

### 4. 批量执行技巧

**适合批量执行的场景**:
- 信任的任务列表
- 简单的批量操作
- 测试或文档任务

**批量执行流程**:
```bash
# 1. 查看待执行 todos
> /todos list

# 2. 选择合适的模式
> /todos execute-all --mode=auto_edit  # 快速
> /todos execute-all --mode=default    # 安全

# 3. 监控进度
[观察执行过程]

# 4. 需要时中断
[Ctrl+C]

# 5. 查看结果
> /todos list
```

---

### 5. 进度管理技巧

**定期查看进度**:
```bash
> /todos list

📋 Progress:
✅ 3 completed | 🔄 0 in progress | ⬜ 2 pending
```

**导出进度报告**:
```bash
> /todos export > progress-2025-10-16.json
```

**处理问题任务**:
```bash
# 取消不需要的任务
> /todos update step-4 cancelled

# 重新执行失败的任务
> /todos update step-2 pending
> /todos execute step-2 --mode=default
```

---

### 6. 团队协作技巧

**分享计划**:
```bash
> /plan show > docs/implementation-plan.md
# git add docs/implementation-plan.md
# git commit -m "Add implementation plan"
```

**分享进度**:
```bash
> /todos export > progress/week-42.json
```

---

## 常见问题

### Q1: Plan 模式和普通模式有什么区别？

**A**: 
- Plan 模式：只读，只分析不修改，创建计划
- 普通模式：可以执行所有操作

### Q2: Todos 保存在哪里？

**A**: 内存中，关闭 CLI 后清空。
- 备份：`/todos export > backup.json`

### Q3: 为什么我的 todo 无法执行？

**A**: 最常见原因是依赖未完成。
```bash
> /todos list  # 查看依赖
> /todos execute <依赖的 todo>
```

### Q4: Default 和 Auto-edit 有什么区别？

**A**:
- Default: 每次操作需确认，安全
- Auto-edit: 自动批准，快速

### Q5: 批量执行可以中断吗？

**A**: 可以。按 `Ctrl+C` 中断，然后：
```bash
> /todos list  # 查看进度
> /todos execute-all  # 继续执行剩余
```

### Q6: 如何修改计划？

**A**: 
```bash
> /plan clear
> [Ctrl+P]
[PLAN] > 重新描述需求...
```

### Q7: 可以跳过某个步骤吗？

**A**:
```bash
> /todos update step-3 cancelled
```

### Q8: 如何查看执行历史？

**A**:
```bash
> /todos export  # 包含执行时间等信息
```

---

## 命令速查表

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+P` | 切换 Plan 模式 |
| `Ctrl+C` | 中断执行 |

### Plan 命令

| 命令 | 说明 |
|------|------|
| `/plan show` | 显示计划 |
| `/plan to-todos` | 转换为 todos |
| `/plan clear` | 清除计划 |

### Todo 命令

| 命令 | 说明 |
|------|------|
| `/todos list` | 列出 todos |
| `/todos execute <id> [--mode]` | 执行单个 |
| `/todos execute-all [--mode]` | 批量执行 |
| `/todos update <id> <status>` | 更新状态 |
| `/todos export` | 导出 JSON |
| `/todos clear` | 清除所有 |

---

## 下一步

- 📖 查看 [API 参考](./API.md) 了解详细命令语法
- 🏗️ 查看 [设计与实现](./DESIGN_AND_IMPLEMENTATION.md) 了解技术细节
- 💡 开始使用：按 `Ctrl+P` 进入 Plan 模式！

---

**最后更新**: 2025-10-16  
**版本**: 1.0.0


# Workflow 文档索引

本文档提供所有 Workflow 相关文档的快速索引和导航。

---

## 📚 文档列表

### 1. 用户文档

#### [Workflow 完整指南](./WORKFLOWS.md) ⭐ **主要文档**

**位置**: `docs/WORKFLOWS.md`

**适用对象**: 所有用户

**内容**:
- ✅ 快速开始教程
- ✅ 顺序和并行 Workflow 详解
- ✅ YAML 配置完整说明
- ✅ 模板变量系统
- ✅ CLI 命令参考
- ✅ 4个完整示例
- ✅ 最佳实践
- ✅ 故障排除指南

**何时使用**:
- 第一次使用 Workflow
- 需要查找语法和配置选项
- 遇到问题需要调试
- 学习最佳实践

---

### 2. 设计文档

#### [Workflow 系统设计文档](../design/agents/WORKFLOW_DESIGN.md)

**位置**: `design/agents/WORKFLOW_DESIGN.md`

**适用对象**: 开发者、贡献者

**内容**:
- 系统架构设计
- 类型定义说明
- 核心组件实现
- 文件结构
- 实现计划
- 更新日志

**何时使用**:
- 了解系统内部实现
- 贡献代码或修复 Bug
- 扩展 Workflow 功能

---

### 3. 项目级文档

#### [项目 Workflow 使用指南](../../python/ADK_Agents/.gemini/workflows/README.md)

**位置**: `/Users/chenjiamin/python/ADK_Agents/.gemini/workflows/README.md`

**适用对象**: ADK_Agents 项目用户

**内容**:
- 项目特定的 Workflow 列表
- 使用方法和示例
- 配置说明
- 使用技巧

**何时使用**:
- 在 ADK_Agents 项目中使用 Workflow
- 查看项目可用的 Workflow
- 了解项目特定配置

---

## 🎯 按场景查找文档

### 我想学习 Workflow 基础

👉 阅读 [Workflow 完整指南](./WORKFLOWS.md) 的"快速开始"和"Workflow 类型"章节

### 我想使用并行功能

👉 阅读 [Workflow 完整指南](./WORKFLOWS.md) 的"并行 Workflow"章节

### 我遇到了问题

👉 查看 [Workflow 完整指南](./WORKFLOWS.md) 的"故障排除"章节

### 我想自定义 Workflow

👉 参考 [Workflow 完整指南](./WORKFLOWS.md) 的"YAML 配置详解"和"示例 Workflow"

### 我想了解内部实现

👉 阅读 [Workflow 系统设计文档](../design/agents/WORKFLOW_DESIGN.md)

### 我在 ADK_Agents 项目中使用

👉 查看 [项目 Workflow 使用指南](../../python/ADK_Agents/.gemini/workflows/README.md)

---

## 📖 推荐阅读顺序

### 新用户

1. [Workflow 完整指南](./WORKFLOWS.md) - 快速开始
2. [项目 Workflow 使用指南](../../python/ADK_Agents/.gemini/workflows/README.md) - 实际使用
3. [Workflow 完整指南](./WORKFLOWS.md) - 深入学习

### 高级用户

1. [Workflow 完整指南](./WORKFLOWS.md) - 并行 Workflow
2. [Workflow 完整指南](./WORKFLOWS.md) - 最佳实践
3. [Workflow 系统设计文档](../design/agents/WORKFLOW_DESIGN.md) - 系统架构

### 开发者

1. [Workflow 系统设计文档](../design/agents/WORKFLOW_DESIGN.md) - 系统设计
2. [Workflow 完整指南](./WORKFLOWS.md) - 功能参考
3. 代码实现：
   - `packages/core/src/agents/types.ts`
   - `packages/core/src/agents/WorkflowManager.ts`
   - `packages/core/src/agents/WorkflowExecutor.ts`

---

## 🗂️ 完整文件结构

```
tiangong-cli/
├── docs/
│   ├── WORKFLOWS.md                    ⭐ 主要用户文档
│   └── WORKFLOW_DOCS_INDEX.md          📋 本文件
│
├── design/
│   └── agents/
│       └── WORKFLOW_DESIGN.md          🏗️ 设计文档
│
└── packages/core/src/agents/
    ├── types.ts                        💻 类型定义
    ├── WorkflowManager.ts              💻 管理器实现
    └── WorkflowExecutor.ts             💻 执行器实现

ADK_Agents/
└── .gemini/
    └── workflows/
        ├── README.md                   📦 项目使用指南
        ├── parallel-review.yaml        📄 并行审查示例
        └── review-and-implement.yaml   📄 顺序审查示例
```

---

## 🔍 快速链接

### 常用文档

- [快速开始](./WORKFLOWS.md#快速开始)
- [并行 Workflow](./WORKFLOWS.md#并行-workflow)
- [模板变量](./WORKFLOWS.md#模板变量系统)
- [故障排除](./WORKFLOWS.md#故障排除)
- [最佳实践](./WORKFLOWS.md#最佳实践)

### 示例 Workflow

- [并行代码审查](./WORKFLOWS.md#1-并行代码审查推荐)
- [顺序代码审查](./WORKFLOWS.md#2-顺序代码审查)
- [功能开发流程](./WORKFLOWS.md#3-功能开发流程)
- [并行测试流程](./WORKFLOWS.md#4-多维度并行测试)

### CLI 命令

- [列出 Workflow](./WORKFLOWS.md#列出所有-workflow)
- [执行 Workflow](./WORKFLOWS.md#执行-workflow)
- [验证 Workflow](./WORKFLOWS.md#验证-workflow-定义)

---

## 📝 文档更新记录

### 2025-10-13
- ✅ 整合所有文档到统一的《Workflow 完整指南》
- ✅ 删除过时的 `WORKFLOW_PROGRESS.md` 和重复的 `PARALLEL_WORKFLOWS.md`
- ✅ 更新项目级 README
- ✅ 更新设计文档状态
- ✅ 创建本索引文档

### 2025-10-07
- 创建初始文档结构

---

## 💡 贡献文档

如果你发现文档有误或需要补充，欢迎：

1. 提交 Issue 描述问题
2. 提交 Pull Request 修改文档
3. 在社区讨论改进建议

---

**索引版本**: 1.0
**创建日期**: 2025-10-13
**维护者**: tiangong-cli Team

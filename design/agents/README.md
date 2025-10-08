# Agents 系统设计文档

> 这个目录包含 Gemini CLI Agents 系统的完整设计和实现文档。

## 📚 文档导航

### 核心文档

| 文档 | 说明 | 适合读者 |
|------|------|----------|
| [DESIGN.md](./DESIGN.md) | 整体架构设计和技术方案 | 架构师、开发者 |
| [IMPLEMENTATION.md](./IMPLEMENTATION.md) | 实现细节和完成状态 | 开发者 |
| [COMMANDS.md](./COMMANDS.md) | CLI 命令参考手册 | 用户、开发者 |
| [ROADMAP.md](./ROADMAP.md) | 功能路线图和开发计划 | 产品、开发者 |

### 功能模块文档

| 文档 | 说明 | 适合读者 |
|------|------|----------|
| [CONTEXT_MODE.md](./CONTEXT_MODE.md) | 上下文模式设计和实现 | 开发者 |
| [MCP_INTEGRATION.md](./MCP_INTEGRATION.md) | MCP 工具集成指南 | 开发者、用户 |
| [INTERACTIVE_CREATION.md](./INTERACTIVE_CREATION.md) | 交互式 Agent 创建 | 开发者 |

## 🎯 快速开始

### 我是用户
👉 查看用户文档: [../../docs/AGENTS.md](../../docs/AGENTS.md)

### 我是开发者
1. 先读 [DESIGN.md](./DESIGN.md) 了解整体架构
2. 再读 [IMPLEMENTATION.md](./IMPLEMENTATION.md) 了解实现状态
3. 根据需要查看具体功能模块文档

### 我想贡献代码
1. 查看 [ROADMAP.md](./ROADMAP.md) 了解待开发功能
2. 阅读相关模块的设计文档
3. 参考 [IMPLEMENTATION.md](./IMPLEMENTATION.md) 了解代码结构

## 📊 项目状态

| 功能模块 | 完成度 | 状态 |
|---------|-------|------|
| 核心功能 | 100% | ✅ 已完成 |
| CLI 命令 | 100% | ✅ 已完成 |
| 上下文管理 | 100% | ✅ 已完成 |
| MCP 集成 | 100% | ✅ 已完成 |
| 交互式创建 | 100% | ✅ 已完成 |
| 自动路由 | 0% | 📋 计划中 |
| Agent 移交 | 0% | 📋 计划中 |
| 可观测性 | 0% | 📋 计划中 |

**总体完成度**: 82% (27/33 功能已完成)

## 🗂️ 文档历史

所有历史版本和过程文档已归档到 `archive/` 目录。

## 📝 文档维护

- **创建日期**: 2025-10-04
- **最后更新**: 2025-10-07
- **维护者**: Gemini CLI Team
- **版本**: 2.0 (整合版)

## 🔗 相关链接

- 用户文档: [../../docs/AGENTS.md](../../docs/AGENTS.md)
- 实现代码: [../../packages/core/src/agents/](../../packages/core/src/agents/)
- 测试代码: [../../packages/core/src/agents/*.test.ts](../../packages/core/src/agents/)

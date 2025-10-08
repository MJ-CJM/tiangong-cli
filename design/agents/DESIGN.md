# Agents 系统架构设计

> **版本**: 2.0 | **最后更新**: 2025-10-07

---

## 设计目标

为 Gemini CLI 添加多 Agent 系统，实现：

1. **专业化分工** - 不同 Agent 专注不同任务
2. **独立上下文** - 避免上下文混乱
3. **工具隔离** - 基于最小权限原则
4. **MCP 集成** - 支持外部工具服务器
5. **易用性** - 简单的创建和使用流程

---

## 核心架构

### 组件关系图

\`\`\`
┌─────────────────────────────────────────┐
│          CLI Layer (Ink/React)          │
│  - agentsCommand.ts                     │
│  - AgentCreationWizard.tsx              │
└────────────────┬────────────────────────┘
                 │
┌────────────────┴────────────────────────┐
│           Core Layer                    │
│  ┌────────────────────────────────┐    │
│  │     AgentExecutor              │    │
│  │  - execute()                   │    │
│  │  - buildRuntime()              │    │
│  │  - filterMCPTools()            │    │
│  └────────┬───────────────────────┘    │
│           │                             │
│  ┌────────┴───────────┬─────────────┐  │
│  │                    │             │  │
│  │ AgentManager       │ ContextMgr  │  │
│  │ - loadAgents()     │ - getCtx()  │  │
│  │ - getAgent()       │ - addMsg()  │  │
│  │                    │             │  │
│  └────────────────────┴─────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │       ToolFilter                 │  │
│  │  - filterTools()                 │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │       MCPRegistry                │  │
│  │  - getServersForAgent()          │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
                 │
┌────────────────┴────────────────────────┐
│        Tool Layer                       │
│  - ToolRegistry                         │
│  - McpClientManager                     │
│  - DiscoveredMCPTool                    │
└─────────────────────────────────────────┘
\`\`\`

---

## Agent 定义格式

### 文件结构

\`\`\`markdown
---
kind: agent
name: code-imple
title: Code Implementation
description: Specialized in code implementation
model: qwen3-coder-flash
scope: project
version: 1.0.0
contextMode: isolated

tools:
  allow: [
    "read_file",
    "write_file",
    "bash",
    "context7__get-library-docs"
  ]
  deny: []

mcp:
  servers: ["context7"]
---

# Role

You are a code implementation specialist...

## Responsibilities

- Translate requirements to code
- Follow best practices
...
\`\`\`

### 字段说明

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| kind | string | ✅ | 固定为 "agent" |
| name | string | ✅ | Agent 唯一标识 |
| title | string | ⚪ | 显示名称 |
| description | string | ⚪ | 简短描述 |
| model | string | ⚪ | AI 模型 |
| scope | enum | ⚪ | project/global |
| version | string | ⚪ | 版本号 |
| contextMode | enum | ⚪ | isolated/shared |
| tools.allow | array | ⚪ | 白名单工具 |
| tools.deny | array | ⚪ | 黑名单工具 |
| mcp.servers | array | ⚪ | MCP 服务器 |

---

## 核心流程

### Agent 执行流程

\`\`\`
1. User calls agent
   ↓
2. AgentExecutor.execute()
   ├─ buildRuntime()
   │  ├─ 获取所有工具
   │  ├─ 过滤 MCP 工具 (按 mcp.servers)
   │  ├─ 过滤工具 (按 allow/deny)
   │  └─ 返回 filtered tools
   ├─ 获取/创建上下文 (isolated/shared)
   └─ 工具调用循环
      ├─ 发送消息给模型
      ├─ 模型返回工具调用或文本
      ├─ 执行工具
      └─ 继续循环直到完成
   ↓
3. 返回最终响应
\`\`\`

### 工具过滤流程

\`\`\`
All Tools (from ToolRegistry)
  ↓
[MCP Server Filter]
  - If agent.mcp.servers: ["context7"]
  - Keep: context7__* tools
  - Remove: github__*, slack__* tools
  ↓
[Allow/Deny Filter]
  - If tools.allow specified
  - Keep only tools in allow list
  - Remove tools in deny list
  ↓
Final Tool List (passed to model)
\`\`\`

---

## 关键设计决策

### 1. 文件式定义

**决策**: 使用 Markdown + YAML 文件定义 Agent

**原因**:
- ✅ 版本控制友好
- ✅ 易于编辑和审查
- ✅ 支持富文本系统提示词
- ✅ 跨项目共享方便

### 2. 两级工具过滤

**决策**: MCP 服务器级 + 工具级双重过滤

**原因**:
- ✅ 最小权限原则
- ✅ 服务器级控制（粗粒度）
- ✅ 工具级控制（细粒度）
- ✅ Defense in depth

### 3. 默认 Isolated 上下文

**决策**: 默认使用 isolated 模式

**原因**:
- ✅ 安全性优先
- ✅ 避免意外泄露
- ✅ 清晰的任务边界
- ✅ 需要时可显式指定 shared

### 4. 信任文件夹机制

**决策**: MCP 工具仅在信任文件夹中可用

**原因**:
- ✅ 安全性（防止恶意项目）
- ✅ 用户同意（显式授权）
- ✅ 符合安全最佳实践

---

## 技术约束

### 性能要求

- Agent 切换延迟 < 100ms ✅
- 工具过滤开销 < 10ms ✅
- 上下文隔离无泄漏 ✅

### 兼容性

- 支持多种 AI 模型 ✅
- 支持 MCP 协议标准 ✅
- 与现有工具系统兼容 ✅

---

## 扩展性

### 当前支持

- ✅ 自定义 Agent 定义
- ✅ 项目级和全局级 Agent
- ✅ MCP 工具集成
- ✅ AI 内容生成
- ✅ 交互式创建

### 未来扩展

- 🔄 自动路由（基于 triggers）
- 🔄 Agent 间移交（handoffs）
- 🔄 输出校验（guardrails）
- 🔄 状态记忆（memory）
- 🔄 图编排（workflow）
- 🔄 可观测性（tracing）

详见 [ROADMAP.md](./ROADMAP.md)

---

**文档版本**: 2.0 (整合版)
**创建日期**: 2025-10-04
**最后更新**: 2025-10-07

详细实现请参考：
- [IMPLEMENTATION.md](./IMPLEMENTATION.md) - 实现细节
- [CONTEXT_MODE.md](./CONTEXT_MODE.md) - 上下文模式
- [MCP_INTEGRATION.md](./MCP_INTEGRATION.md) - MCP 集成

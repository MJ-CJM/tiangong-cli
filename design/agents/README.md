# Agents 系统文档

> **Gemini CLI - Agents 功能完整文档**

---

## 📚 文档索引

### 用户文档

1. **[用户指南](../../docs/AGENTS.md)** ⭐ - 完整的用户使用指南
2. **[快速开始](./QUICK_START.md)** - 5 分钟快速上手
3. **[命令参考](./COMMANDS.md)** - 所有 agent 命令详解
4. **[已实现功能](./FEATURES_IMPLEMENTED.md)** 📖 - 当前所有功能的详细说明

### 设计与实现文档

5. **[系统设计](./DESIGN.md)** - 架构设计和核心概念
6. **[实现细节](./IMPLEMENTATION_DETAILS.md)** - 技术实现细节
7. **[P1 完成总结](./P1_COMPLETION_SUMMARY.md)** - P1 阶段实现总结
8. **[P2 功能规划](./P2_FEATURES.md)** - 未来功能规划

### 历史文档

9. **[初始设计](./INITIAL_DESIGN.md)** - 早期系统设计（参考）
10. **[实施路线图](./ROADMAP.md)** - 实施计划（参考）

---

## 🚀 快速开始

### 1. 创建 Agent

```bash
# 交互式创建
/agents create code_review --title "Code Reviewer" --model gemini-2.5-pro

# 编辑生成的文件
vim .gemini/agents/code_review.md
```

### 2. 运行 Agent

**方式一：斜杠命令**
```bash
/agents run code_review 分析 src/index.ts 的代码质量
```

**方式二：自然语言（推荐）**
```bash
使用 code_review agent 分析 src/index.ts 的代码质量
@code_review 审查这段代码
用 code_review agent 检查代码风格
```

### 3. 连续对话

```bash
> 使用 code_review agent 分析 /path/to/file.py
Agent: [详细审查报告]

> @code_review 总结下上述的代码审查报告
Agent: 根据刚才的分析，主要问题包括...

> 用 code_review agent 给出具体修改建议
Agent: 对于第一个问题，建议...
```

### 4. 清除对话

```bash
/agents clear code_review
```

---

## 📊 功能状态

### ✅ 已实现功能

#### Agent 管理
- ✅ `/agents list` - 列出所有 agents
- ✅ `/agents create` - 创建新 agent
- ✅ `/agents info` - 查看 agent 详情
- ✅ `/agents validate` - 验证 agent 配置
- ✅ `/agents delete` - 删除 agent

#### Agent 执行
- ✅ `/agents run <name> <prompt>` - 执行 agent
- ✅ `/agents clear <name>` - 清除对话历史
- ✅ 完整工具调用循环
- ✅ 工具执行可视化
- ✅ Token 使用统计

#### 自然语言调用
- ✅ "使用 <agent> agent ..." 模式
- ✅ "用 <agent> agent ..." 模式
- ✅ "@<agent> ..." 模式
- ✅ "让 <agent> agent ..." 模式

#### 上下文管理
- ✅ 会话级上下文持久化
- ✅ 连续对话支持
- ✅ 独立的 agent 对话历史

#### 工具控制
- ✅ 工具白名单 (allow)
- ✅ 工具黑名单 (deny)
- ✅ 运行时工具过滤

### 🚧 待实现功能 (P2)

- 🔄 Agent 协作和任务移交
- 🎯 自动 agent 路由
- 🛡️ 输出校验 (Guardrails)
- 💾 跨会话上下文持久化
- 📊 执行流程可视化
- 🔌 MCP 工具实际调用

---

## 🏗️ 架构概览

```
┌─────────────────────────────────────────┐
│          CLI Commands                    │
│  /agents create, list, run, clear, ...  │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│      AgentExecutor (Singleton)          │
│  • 执行 agents                          │
│  • 工具调用循环                          │
│  • 上下文管理                            │
└─┬─────────┬─────────┬─────────┬────────┘
  │         │         │         │
  ↓         ↓         ↓         ↓
┌────────┐┌────────┐┌────────┐┌────────┐
│ Agent  ││Context ││  Tool  ││  MCP   │
│Manager ││Manager ││ Filter ││Registry│
└────────┘└────────┘└────────┘└────────┘
```

**核心组件**:
- **AgentExecutor**: 全局单例，管理所有 agent 执行
- **AgentManager**: Agent 定义加载和管理
- **ContextManager**: 独立的对话上下文管理
- **ToolFilter**: 基于 allow/deny 的工具过滤
- **MCPRegistry**: MCP 服务器配置管理

---

## 📁 文件位置

### 核心实现
```
packages/core/src/agents/
├── AgentExecutor.ts         # 执行器
├── AgentManager.ts          # Agent 管理
├── ContextManager.ts        # 上下文管理
├── ToolFilter.ts            # 工具过滤
├── MCPRegistry.ts           # MCP 注册
├── AgentValidator.ts        # 验证器
├── AgentParser.ts           # Markdown 解析
└── types.ts                 # 类型定义
```

### CLI 命令
```
packages/cli/src/ui/
├── commands/
│   └── agentsCommand.ts     # 所有 agent 命令
└── hooks/
    ├── agentCommandProcessor.ts  # 自然语言识别
    └── useGeminiStream.ts        # 输入处理集成
```

### Agent 定义
```
.gemini/agents/              # 项目级 agents
~/.gemini/agents/            # 全局级 agents
```

---

## 🧪 测试

```bash
# 运行所有测试
npm test

# 运行 agent 相关测试
npm test -- agents
```

---

## 📖 相关资源

- **主文档**: [README.md](../../README.md)
- **贡献指南**: [CONTRIBUTING.md](../../CONTRIBUTING.md)
- **架构文档**: [architecture.md](../../architecture.md)

---

**项目状态**: ✅ 核心功能完成
**版本**: v1.0 (P1 完成)
**最后更新**: 2025-10-06

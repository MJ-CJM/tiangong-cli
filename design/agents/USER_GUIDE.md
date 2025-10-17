# Agents 用户指南

> **Agents 系统**让你创建专门的 AI 智能体，每个 Agent 都有独立的上下文、工具权限和行为特征。

## 📋 目录

- [什么是 Agent?](#什么是-agent)
- [快速开始](#快速开始)
- [Agent 管理](#agent-管理)
- [Agent 定义格式](#agent-定义格式)
- [工具控制](#工具控制)
- [最佳实践](#最佳实践)
- [示例 Agent](#示例-agent)

---

## 什么是 Agent?

Agent 是一个专门化的 AI 智能体，具有：

- **独立上下文**: 每个 Agent 的对话历史与主会话完全隔离
- **工具白名单/黑名单**: 精确控制 Agent 可以使用的工具
- **自定义系统提示词**: 为特定任务定制 Agent 的行为
- **MCP 集成**: 连接外部服务（如 GitHub）

### 典型用例

- 🐛 **调试分析**: 只读访问，专注于找出 bug 根源
- 📝 **代码审查**: 审查代码质量，不修改代码
- 📚 **文档生成**: 读取代码，生成文档
- 🔧 **代码修复**: 有限的写权限，执行特定修复

---

## 快速开始

### 1. 列出可用 Agent

```bash
/agents list
```

输出示例：
```
📋 Available Agents (2 total)

**Project Agents** (.gemini/agents/):
  • debug-analyzer - Debug Analyzer
    Specialized agent for analyzing and debugging code issues
    Model: gemini-2.5-pro

**Global Agents** (~/.gemini/agents/):
  • code-reviewer - Code Review Specialist
    Provides thorough code reviews
    Model: claude-3.5-sonnet
```

### 2. 创建新 Agent

```bash
/agents create my-agent --title "My Custom Agent" --model gemini-2.0-flash
```

这会在 `.gemini/agents/my-agent.md` 创建一个新的 Agent 文件。

### 3. 查看 Agent 详情

```bash
/agents info my-agent
```

### 4. 验证 Agent 配置

```bash
/agents validate my-agent
```

### 5. 运行 Agent

```bash
/agents run my-agent "分析这个错误"
```

或使用自然语言：

```bash
使用 my-agent agent 分析这个错误
@my-agent 分析这个错误
```

---

## Agent 管理

### 可用命令

| 命令 | 说明 |
|------|------|
| `/agents list` | 列出所有可用 Agent |
| `/agents create <name>` | 创建新 Agent |
| `/agents info <name>` | 显示 Agent 详情 |
| `/agents validate <name>` | 验证 Agent 配置 |
| `/agents delete <name>` | 删除 Agent |
| `/agents run <name> <prompt>` | 运行 Agent |
| `/agents clear <name>` | 清除 Agent 对话历史 |

### 创建选项

```bash
/agents create <name> [选项]

选项:
  --title "标题"        Agent 的显示标题
  --model 模型名        使用的模型 (默认: gemini-2.0-flash)
  --scope global|project Agent 作用域 (默认: project)
```

示例:
```bash
# 创建项目级 Agent
/agents create bug-hunter --title "Bug Hunter" --model gemini-2.5-pro

# 创建全局 Agent
/agents create reviewer --title "Code Reviewer" --scope global --model claude-3.5-sonnet
```

### Agent 作用域

- **项目级** (`.gemini/agents/`): 仅在当前项目可用
- **全局级** (`~/.gemini/agents/`): 在所有项目可用
- **优先级**: 项目级 Agent 覆盖同名全局 Agent

---

## 自然语言调用

除了使用 `/agents run` 命令，你还可以用更自然的方式调用 Agent：

### 支持的模式

#### 1. "使用" 模式
```bash
使用 code_review agent 分析这个文件的代码质量
```

#### 2. "用" 模式（简化）
```bash
用 code_review agent 检查代码风格
```

#### 3. "@" 模式
```bash
@code_review 帮我审查这段代码
```

#### 4. "让" 模式
```bash
让 test_runner agent 运行测试
```

### 自动转换

这些自然语言输入会自动转换为 `/agents run` 命令：

```bash
使用 code_review agent 分析代码
    ↓ 自动转换为
/agents run code_review 分析代码
```

### 连续对话

Agent 会保持对话上下文，你可以进行连续对话：

```bash
# 第一次调用
> 使用 code_review agent 分析 /path/to/file.py

Agent: [提供详细的代码审查报告]

# 第二次调用 - Agent 记住之前的对话
> @code_review 总结下上述的代码审查报告

Agent: 根据刚才的分析，主要问题包括...

# 第三次调用 - 继续深入
> 用 code_review agent 针对第一个问题给出具体修改建议

Agent: 对于刚才提到的第一个问题...
```

### 清除对话历史

如果需要重新开始对话：

```bash
/agents clear code_review
```

---

## Agent 定义格式

Agent 文件是 Markdown 格式，包含 YAML 前置元数据：

```markdown
---
kind: agent
name: my-agent
title: My Custom Agent
description: Agent description
model: gemini-2.0-flash
color: "#4A90E2"
scope: project
version: 1.0.0
tools:
  allow:
    - read_file
    - grep
    - bash
  deny:
    - write_file
mcp:
  servers:
    - github
---

# Role

You are a specialized agent for...

## Responsibilities

1. Do X
2. Do Y

## Guidelines

- Guideline 1
- Guideline 2
```

### 必需字段

- `kind`: 必须是 `agent`
- `name`: Agent 标识符（小写字母、数字、连字符）
- `title`: 显示名称

### 可选字段

- `description`: Agent 描述
- `model`: 使用的模型（默认：系统模型）
- `color`: UI 显示颜色（十六进制）
- `scope`: `global` 或 `project`
- `version`: 版本号
- `tools`: 工具配置
- `mcp`: MCP 服务器配置

---

## 工具控制

### Allow/Deny 机制

Agent 可以通过白名单（allow）和黑名单（deny）精确控制可用工具：

```yaml
tools:
  allow:    # 白名单：只允许这些工具
    - read_file
    - grep
    - bash
  deny:     # 黑名单：禁止这些工具
    - write_file
    - delete_file
```

### 规则优先级

1. **只有 deny**: 允许所有工具，除了黑名单中的
2. **只有 allow**: 只允许白名单中的工具
3. **两者都有**: 允许白名单中的，但排除黑名单中的（deny 优先）
4. **都没有**: 允许所有工具

### 示例场景

#### 只读分析 Agent
```yaml
tools:
  allow:
    - read_file
    - read_many_files
    - grep
    - glob
    - bash
  deny:
    - write_file
    - edit_file
    - delete_file
```

#### 文档生成 Agent
```yaml
tools:
  allow:
    - read_file
    - grep
    - write_file  # 允许写入文档
  deny:
    - edit_file   # 禁止修改现有代码
    - delete_file
```

#### 安全审计 Agent
```yaml
tools:
  deny:
    - bash        # 禁止执行命令
    - write_file
    - edit_file
```

---

## MCP 集成

Agent 可以连接 MCP (Model Context Protocol) 服务器来访问外部服务：

```yaml
mcp:
  servers:
    - github
    - gitlab
```

### 可用 MCP 服务器

- `github`: GitHub API 访问（PR、Issues、代码搜索）
- 更多服务器配置见主配置文件

### MCP 工具命名

MCP 工具使用命名空间前缀：

- GitHub PR: `mcp.github.get_pull_request`
- GitHub Issues: `mcp.github.list_issues`

这些工具也受 allow/deny 控制。

---

## 最佳实践

### 1. 明确 Agent 职责

每个 Agent 应该有单一、明确的职责：

- ✅ **好**: "调试分析专家"
- ❌ **不好**: "做所有事情的通用助手"

### 2. 合理的工具权限

- 调试 Agent：只读 + bash（诊断命令）
- 审查 Agent：只读
- 修复 Agent：读 + 有限写入

### 3. 详细的系统提示词

提供清晰的指导：

```markdown
# Role
你是...专家

## Workflow
1. 步骤一
2. 步骤二

## Guidelines
### DO
- ✅ 做这个

### DON'T
- ❌ 不要做那个

## Output Format
[期望的输出格式]
```

### 4. 使用模板

基于现有模板创建新 Agent：

```bash
# 查看可用模板
ls ~/.gemini/agents/templates/

# 基于模板创建
cp ~/.gemini/agents/templates/debugging.md .gemini/agents/my-debug.md
```

### 5. 版本控制

将项目级 Agent 文件加入 Git：

```bash
git add .gemini/agents/
git commit -m "Add project agents"
```

团队成员即可共享相同的 Agent 配置。

---

## 示例 Agent

### 调试分析 Agent

```yaml
---
kind: agent
name: debug-analyzer
title: Debug Analyzer
model: gemini-2.5-pro
tools:
  allow:
    - read_file
    - grep
    - bash
    - glob
  deny:
    - write_file
---

# Role

You are a debugging expert. Analyze errors systematically:

1. Read error messages and stack traces
2. Examine relevant code with `read_file`
3. Search for related code with `grep`
4. Run diagnostic commands with `bash`
5. Provide root cause analysis and fix suggestions

## Output Format

Always include:
- **Location**: file:line
- **Root Cause**: Why the error occurs
- **Fix**: Specific code changes
- **Reasoning**: Explanation
```

### 代码审查 Agent

```yaml
---
kind: agent
name: code-reviewer
title: Code Reviewer
model: claude-3.5-sonnet
tools:
  allow:
    - read_file
    - read_many_files
    - grep
  deny:
    - bash
    - write_file
mcp:
  servers:
    - github
---

# Role

You are a code reviewer focusing on:

1. **Code Quality**: Readability, naming, structure
2. **Best Practices**: DRY, SOLID, patterns
3. **Security**: Input validation, auth, data exposure
4. **Performance**: Efficiency, memory, async

## Review Template

- 🔴 Critical Issues (must fix)
- 🟡 Important Issues (should fix)
- 🔵 Suggestions (nice to have)
- ✅ What's Good (praise)

Always be constructive and provide code examples.
```

---

## 故障排除

### Agent 未找到

```bash
# 确保 Agent 文件存在
ls .gemini/agents/
ls ~/.gemini/agents/

# 重新加载 Agent
/agents list
```

### 工具被拒绝

检查 Agent 的工具配置：

```bash
/agents info <agent-name>
```

确保需要的工具在 `allow` 列表中，且不在 `deny` 列表中。

### 验证失败

```bash
/agents validate <agent-name>
```

查看详细的错误和警告信息。

---

## 后续功能（P2）

即将推出：

- 🎯 **自动路由**: 根据问题类型自动选择合适的 Agent
- 🔄 **Agent 协作**: Agent 之间的任务移交
- 🛡️ **输出校验**: Guardrails 确保输出符合要求
- 💾 **上下文持久化**: 跨会话保存 Agent 对话历史
- 📊 **可视化**: Agent 执行流程可视化
- 🔌 **MCP 工具调用**: 实际使用 MCP 服务器工具

---

## 更多资源

- **用户文档**:
  - [命令参考](./COMMANDS.md) - 完整的命令文档
  - [快速开始](./QUICK_START.md) - 快速入门指南

- **设计文档**:
  - [系统设计](./DESIGN.md) - 架构设计
  - [实施细节](./IMPLEMENTATION.md) - 技术实现
  - [路由系统](./routing/README.md) - 智能路由设计
  - [移交系统](./handoff/README.md) - Agent 移交设计

---

**最后更新**: 2025-10-06

# Agents 命令使用指南

> **精简版 Agents 命令完整指南**

---

## 📋 命令总览

Agents 系统现在包含 **8 个核心命令**，简洁易用：

| 命令 | 用途 | 示例 |
|------|------|------|
| `create` | 创建新 agent | `/agents create debugger --ai --purpose "..."` |
| `list` | 列出所有 agents | `/agents list` |
| `info` | 查看 agent 详情 | `/agents info debugger` |
| `run` | 执行 agent | `/agents run code_review Check this file` |
| `validate` | 验证 agent 配置 | `/agents validate debugger` |
| `delete` | 删除 agent | `/agents delete debugger` |
| **`route`** | **测试智能路由** | **`/agents route "实现登录功能"`** |
| **`config`** | **管理路由配置** | **`/agents config show`** |

---

## 🎯 1. `/agents create` - 创建 Agent

### 基本语法

```bash
# 一行命令式
/agents create <name> [options]

# 交互式（逐步引导）⭐
/agents create --interactive
/agents create -i
```

### 选项参数

| 参数 | 说明 | 必填 | 示例 |
|------|------|------|------|
| `--interactive`, `-i` | 交互式逐步创建 ⭐ | 否 | `--interactive` |
| `--ai` | 使用 AI 生成内容 ⭐ | 否 | `--ai` |
| `--purpose "text"` | Agent 用途描述 | 与 `--ai` 配合时必填 | `--purpose "Debug Python errors"` |
| `--title "Title"` | 自定义显示标题 | 否 | `--title "My Debugger"` |
| `--description "text"` | 简短描述 | 否 | `--description "Helps debug code"` |
| `--model <name>` | 使用的 AI 模型 | 否 | `--model qwen3-coder-flash` |
| `--scope project\|global` | 保存位置 | 否 | `--scope global` |
| `--preview` | 预览模式（不创建） | 否 | `--preview` |

### 交互式模式特有命令

使用 `--interactive` 启动后，通过以下命令继续：

| 命令 | 用途 |
|------|------|
| `/agents create --next <session-id> <answer>` | 提供下一步的答案 |
| `/agents create --status <session-id>` | 查看当前进度 |
| `/agents create --cancel <session-id>` | 取消创建 |

### 使用示例

#### ✅ 示例 0: 交互式创建（新手推荐）⭐

```bash
# 启动交互式创建
/agents create --interactive

# 系统会提示输入 session ID，例如：agent-create-1234567890-abc123
# 然后逐步回答问题：

# Step 1: 输入名称
/agents create --next agent-create-1234567890-abc123 debugger

# Step 2: 输入标题（可选，直接回车跳过）
/agents create --next agent-create-1234567890-abc123 "Code Debugger"

# Step 3: 输入描述（可选）
/agents create --next agent-create-1234567890-abc123 "Helps debug code errors"

# Step 4: 选择范围（1=project, 2=global）
/agents create --next agent-create-1234567890-abc123 1

# Step 5: 选择模型（1, 2, 3... 或模型名称）
/agents create --next agent-create-1234567890-abc123 1

# Step 6: 选择内容创建方式（1=AI, 2=manual）
/agents create --next agent-create-1234567890-abc123 1

# Step 7: 输入用途描述（AI生成时需要）
/agents create --next agent-create-1234567890-abc123 "Debug Python and JavaScript errors with detailed explanations"

# Step 8: 工具配置（可选，回车使用默认）
/agents create --next agent-create-1234567890-abc123

# Step 9: 确认创建（yes/no）
/agents create --next agent-create-1234567890-abc123 yes
```

**效果：**
- 逐步引导，适合新手
- 每步都有提示和说明
- 可以随时查看进度：`/agents create --status <session-id>`
- 可以取消：`/agents create --cancel <session-id>`

---

#### ✅ 示例 1: AI 快速创建（熟练用户推荐）

```bash
/agents create debugger --ai --purpose "Debug Python and JavaScript errors with detailed explanations"
```

**效果：**
- 一行命令完成创建
- AI 自动生成完整的 agent 定义
- 包含角色、职责、指南和约束
- 保存到 `.gemini/agents/debugger.md`

---

#### ✅ 示例 2: 完整配置创建

```bash
/agents create reviewer --ai \
  --purpose "Review code for security vulnerabilities following OWASP top 10" \
  --title "Security Code Reviewer" \
  --description "Checks for common security issues" \
  --model qwen-coder-plus \
  --scope global
```

**效果：**
- 使用 qwen-coder-plus 模型
- 自定义标题和描述
- 保存到全局目录 `~/.gemini/agents/reviewer.md`

---

#### ✅ 示例 3: 创建全局 Agent

```bash
/agents create documenter --ai \
  --purpose "Generate comprehensive API documentation with examples" \
  --scope global
```

**效果：**
- 保存到 `~/.gemini/agents/` (全局可用)
- 所有项目都可以使用这个 agent

---

#### ✅ 示例 4: 预览模式

```bash
/agents create analyzer --ai \
  --purpose "Analyze code performance and suggest optimizations" \
  --preview
```

**效果：**
- 生成 AI 内容并显示
- **不会实际创建** agent 文件
- 可以查看内容后再决定是否创建

---

#### ✅ 示例 5: 手动模板创建

```bash
/agents create my-agent
```

**效果：**
- 创建空白模板
- 需要手动填写 Role、Responsibilities 等
- 适合高级用户自定义

---

### 创建后的工作流

```bash
# 1. 创建 agent
/agents create debugger --ai --purpose "Debug code errors"

# 2. 查看生成的内容
cat .gemini/agents/debugger.md

# 3. 验证配置
/agents validate debugger

# 4. 查看详情
/agents info debugger

# 5. 根据需要编辑
vim .gemini/agents/debugger.md
```

---

## 📋 2. `/agents list` - 列出所有 Agents

### 基本语法

```bash
/agents list
```

### 功能说明

- 列出所有可用的 agents
- 按作用域分组显示（Project / Global）
- 显示名称、标题、描述和模型信息

### 示例输出

```
📋 Available Agents (3 total)

**Project Agents** (.gemini/agents/):
  • debugger - Code Debugger
    Helps debug Python and JavaScript errors
    Model: qwen3-coder-flash

  • reviewer - Security Code Reviewer
    Checks for common security issues
    Model: qwen-coder-plus

**Global Agents** (~/.gemini/agents/):
  • documenter - Documentation Generator
    Generates comprehensive API documentation
    Model: qwen3-coder-flash
```

### 使用场景

- 查看所有可用的 agents
- 确认某个 agent 是否已创建
- 了解 agents 的作用域分布

---

## 🔍 3. `/agents info` - 查看 Agent 详情

### 基本语法

```bash
/agents info <name>
```

### 功能说明

- 显示 agent 的完整信息
- 包括配置、工具、文件路径等
- 显示创建和更新时间

### 使用示例

```bash
/agents info debugger
```

### 示例输出

```
📋 Agent: **Code Debugger** (debugger)

**Description**: Helps debug Python and JavaScript errors

**Scope**: project
**Model**: qwen3-coder-flash
**File**: /Users/name/project/.gemini/agents/debugger.md

**Tool Configuration**:
  Allow: read_file, grep, glob, bash

**Created**: 2025-10-06 14:30:25
**Updated**: 2025-10-06 14:30:25
```

### 使用场景

- 查看 agent 的详细配置
- 确认 agent 使用的模型
- 检查工具权限设置
- 找到 agent 文件位置

---

## 🚀 4. `/agents run` - 执行 Agent

### 基本语法

```bash
/agents run <name> <prompt>
```

### 功能说明

- 使用指定的 agent 执行任务
- Agent 会使用其配置的 system prompt 和模型
- 执行结果会显示在对话中
- **注意**：当前版本不支持工具调用（tool calling），仅支持纯文本对话

### 使用示例

#### ✅ 示例 1: 代码审查

```bash
/agents run code_review 帮我审查 src/utils/helper.ts 这个文件的代码质量
```

**效果**:
- Agent 使用其专门的 system prompt
- 按照代码审查的专业角度分析代码
- 只能使用 agent 配置中允许的工具（如果支持）

#### ✅ 示例 2: 测试调试

```bash
/agents run test-runner 运行单元测试并分析失败原因
```

#### ✅ 示例 3: 文档生成

```bash
/agents run documenter 为 AgentManager 类生成 API 文档
```

### 工作原理

1. **加载 Agent 定义**：从 `.gemini/agents/<name>.md` 读取配置
2. **应用 System Prompt**：使用 agent 的专门提示词
3. **选择模型**：使用 agent 指定的模型（或默认模型）
4. **执行对话**：向模型发送请求并返回结果
5. **显示统计**：显示 token 使用情况

### 注意事项

⚠️ **当前限制**：
- Agent 的工具限制（`tools.allow`/`tools.deny`）暂未生效
- 不支持工具调用（function calling）
- 每次调用是独立的，没有对话历史记忆
- 不支持流式响应

✅ **适用场景**：
- 需要特定角色/专业领域的回答
- 使用特定模型的场景
- 快速切换不同专家视角

### 与普通对话的区别

| 特性 | 普通对话 | Agent 执行 |
|------|---------|----------|
| System Prompt | 通用提示 | Agent 专用提示 |
| 模型选择 | 全局配置 | Agent 配置 |
| 工具访问 | 所有工具 | 受限工具（未来） |
| 对话历史 | 保留 | 独立（当前） |
| 专业性 | 通用 | 专业领域 |

---

## ✅ 5. `/agents validate` - 验证 Agent 配置

### 基本语法

```bash
/agents validate <name>
```

### 功能说明

- 检查 agent 配置是否有效
- 验证必填字段
- 提供警告和建议

### 使用示例

```bash
/agents validate debugger
```

### 成功输出

```
🔍 Validation Results for "debugger":

✅ All validations passed!
```

### 失败输出

```
🔍 Validation Results for "debugger":

❌ Validation failed:

  • Missing required field: systemPrompt
  • Invalid tool name: invalid_tool

⚠️  Warnings:
  • No description provided
  • Model not configured in settings
```

### 使用场景

- 创建 agent 后验证配置
- 手动编辑后检查语法
- 排查 agent 问题

---

## 🗑️ 6. `/agents delete` - 删除 Agent

### 基本语法

```bash
/agents delete <name>
```

### 功能说明

- 删除指定的 agent 文件
- 不可恢复，请谨慎操作

### 使用示例

```bash
/agents delete debugger
```

### 成功输出

```
✅ Deleted agent "debugger"
```

### 失败输出

```
Agent "debugger" not found.
```

### 使用场景

- 清理不再使用的 agents
- 删除测试 agents
- 重新创建前先删除旧版本

### ⚠️ 注意事项

- 删除操作不可撤销
- 建议先用 `/agents info` 确认要删除的 agent
- 删除后文件会永久移除

---

## 🎯 常见使用场景

### 场景 1: 新手使用交互式创建

```bash
# 启动交互式
/agents create --interactive

# 按提示逐步输入...
# 系统会引导你完成所有步骤
```

---

### 场景 2: 快速创建调试 Agent

```bash
# 一行命令创建
/agents create debugger --ai --purpose "Debug Python and JavaScript errors"

# 验证配置
/agents validate debugger

# 完成！
```

---

### 场景 3: 创建并自定义 Agent

```bash
# 1. 先预览
/agents create reviewer --ai \
  --purpose "Review code for security issues" \
  --preview

# 2. 满意后创建
/agents create reviewer --ai \
  --purpose "Review code for security issues"

# 3. 手动调整
vim .gemini/agents/reviewer.md

# 4. 验证修改
/agents validate reviewer
```

---

### 场景 4: 管理多个 Agents

```bash
# 查看所有 agents
/agents list

# 查看某个 agent 详情
/agents info debugger

# 验证所有 agents
/agents validate debugger
/agents validate reviewer
/agents validate documenter

# 删除不用的
/agents delete old-agent
```

---

### 场景 5: 全局 Agent 设置

```bash
# 创建全局可用的 agent
/agents create sql-helper --ai \
  --purpose "Help write and optimize SQL queries" \
  --scope global

# 在任何项目中列出
/agents list
# 会显示在 "Global Agents" 部分
```

---

## 📝 最佳实践

### 1. **命名规范**
- 使用小写字母、数字、连字符和下划线
- 描述性名称：`debugger`、`code-reviewer`、`code_review`、`sql-helper`
- 避免：`MyAgent`、`TEST`、`agent123`（无意义的名称）

### 2. **Purpose 描述要详细**

❌ 不好的示例：
```bash
--purpose "Debug code"
```

✅ 好的示例：
```bash
--purpose "Debug Python and JavaScript errors with detailed explanations, step-by-step solutions, and code examples"
```

### 3. **选择合适的 Scope**

- **Project** (默认)：项目特定的 agent
  - 示例：项目特定的测试工具、构建脚本助手

- **Global**：跨项目通用的 agent
  - 示例：SQL 助手、文档生成器、通用调试器

### 4. **创建后立即验证**

```bash
# 创建
/agents create my-agent --ai --purpose "..."

# 立即验证
/agents validate my-agent

# 查看详情
/agents info my-agent
```

### 5. **使用预览模式测试**

```bash
# 先预览
/agents create test-agent --ai --purpose "..." --preview

# 调整 purpose 描述后再预览
/agents create test-agent --ai --purpose "更详细的描述" --preview

# 满意后创建
/agents create test-agent --ai --purpose "最终描述"
```

---

## 🆚 命令对比（精简前后）

| 功能 | 旧命令（11个） | 新命令（5个） |
|------|---------------|--------------|
| 创建向导 | `/agents wizard` | ❌ 已删除 |
| 一键创建 | `/agents create` | ✅ `/agents create` |
| 交互式开始 | `/agents begin` | ✅ 集成到 `/agents create --interactive` |
| 交互式下一步 | `/agents next` | ✅ 集成到 `/agents create --next` |
| 查看进度 | `/agents status` | ✅ 集成到 `/agents create --status` |
| 取消创建 | `/agents cancel` | ✅ 集成到 `/agents create --cancel` |
| 运行 agent | `/agents run` | ❌ 已删除（未实现） |
| 列出 agents | `/agents list` | ✅ `/agents list` |
| 查看详情 | `/agents info` | ✅ `/agents info` |
| 验证配置 | `/agents validate` | ✅ `/agents validate` |
| 删除 agent | `/agents delete` | ✅ `/agents delete` |

### 迁移指南

#### 之前使用交互式创建：
```bash
# 旧方式（已删除）
/agents begin
/agents next <id> my-agent
/agents next <id> ...
/agents status <id>
/agents cancel <id>
```

#### 现在使用交互式创建：
```bash
# 新方式 1: 交互式（集成到 create 命令）
/agents create --interactive
/agents create --next <id> my-agent
/agents create --next <id> ...
/agents create --status <id>
/agents create --cancel <id>

# 新方式 2: 一行命令（更快）
/agents create my-agent --ai --purpose "详细描述"
```

---

## ❓ FAQ

### Q1: 如何选择模型？

**A:** 使用 `--model` 参数，模型必须在 `config.json` 中配置：

```bash
/agents create my-agent --ai \
  --purpose "..." \
  --model qwen-coder-plus
```

查看可用模型：
```bash
cat ~/.gemini/config.json | grep models -A 10
```

---

### Q2: 如何修改已创建的 Agent？

**A:** 直接编辑文件：

```bash
# 1. 找到文件位置
/agents info my-agent

# 2. 编辑
vim .gemini/agents/my-agent.md

# 3. 验证修改
/agents validate my-agent
```

---

### Q3: Agent 文件保存在哪里？

**A:** 取决于 `--scope` 参数：

- **Project** (默认): `.gemini/agents/<name>.md`
- **Global**: `~/.gemini/agents/<name>.md`

查看具体位置：
```bash
/agents info <name>
```

---

### Q4: 可以重新生成 Agent 吗？

**A:** 可以，先删除再创建：

```bash
# 删除旧的
/agents delete my-agent

# 创建新的
/agents create my-agent --ai --purpose "新的描述"
```

或者使用预览模式测试：
```bash
/agents create my-agent --ai --purpose "新描述" --preview
```

---

### Q5: 创建失败怎么办？

**A:** 检查以下几点：

1. **名称格式**：只能用小写字母、数字、连字符、下划线
   ```bash
   # ❌ 错误
   /agents create MyAgent
   /agents create My-Agent

   # ✅ 正确
   /agents create my-agent
   /agents create code_review
   /agents create my_code_agent
   ```

2. **Purpose 必填**（使用 `--ai` 时）
   ```bash
   # ❌ 错误
   /agents create my-agent --ai

   # ✅ 正确
   /agents create my-agent --ai --purpose "详细描述"
   ```

3. **模型必须已配置**
   ```bash
   # 检查配置
   cat ~/.gemini/config.json
   ```

---

## 🎓 进阶技巧

### 1. 批量创建 Agents

```bash
# 创建多个专用 agents
/agents create py-debugger --ai --purpose "Debug Python errors with stack traces"
/agents create js-debugger --ai --purpose "Debug JavaScript/TypeScript errors"
/agents create sql-optimizer --ai --purpose "Optimize SQL queries for performance"
```

### 2. 创建专用工具的 Agent

```bash
# Git 助手
/agents create git-helper --ai \
  --purpose "Help with Git commands, conflict resolution, and best practices"

# Docker 助手
/agents create docker-helper --ai \
  --purpose "Help with Dockerfile optimization and container debugging"
```

### 3. 为团队创建标准 Agents

```bash
# 创建为全局 agent，团队成员共享
/agents create code-style --ai \
  --purpose "Enforce company coding standards and style guide" \
  --scope global

/agents create security-scan --ai \
  --purpose "Scan code for security vulnerabilities per company policy" \
  --scope global
```

---

## 📊 总结

### ✅ 5 个核心命令

| 命令 | 用途 | 频率 |
|------|------|------|
| `create` | 创建 agent（支持交互式和一行命令） | 🔵🔵🔵⚪⚪ 中 |
| `list` | 列出 agents | 🔵🔵🔵🔵⚪ 高 |
| `info` | 查看详情 | 🔵🔵⚪⚪⚪ 低 |
| `validate` | 验证配置 | 🔵🔵⚪⚪⚪ 低 |
| `delete` | 删除 agent | 🔵⚪⚪⚪⚪ 极低 |

### 🎯 两种创建方式

**方式 1: 交互式（新手推荐）**
```bash
/agents create --interactive
# 系统会逐步引导你完成配置
```

**方式 2: 一行命令（熟练用户）**
```bash
/agents create my-agent --ai --purpose "详细描述"
```

### 🎯 最常用的命令组合

```bash
# 交互式创建 -> 验证 -> 使用
/agents create --interactive
/agents validate my-agent
/agents list

# 快速创建 -> 验证 -> 使用
/agents create my-agent --ai --purpose "..."
/agents validate my-agent
/agents list

# 查看 -> 修改 -> 验证
/agents info my-agent
vim .gemini/agents/my-agent.md
/agents validate my-agent
```

---

## 🧭 7. `/agents route` - 测试智能路由 ⭐

测试智能路由，查看系统会为给定的提示选择哪个 Agent。

### 基本语法

```bash
/agents route <prompt>
```

### 示例

```bash
# 测试路由：实现功能
/agents route "帮我实现登录功能"
# ✅ Selected Agent: code-imple (Confidence: 85%)

# 测试路由：代码审查
/agents route "审查这段代码有没有问题"
# ✅ Selected Agent: code-review (Confidence: 90%)

# 测试路由：修复bug
/agents route "修复登录页面的错误"
# ✅ Selected Agent: bug-fix (Confidence: 75%)
```

### 输出信息

```
✅ Routing Result

Selected Agent: code-imple
Title: Code Implementation
Score: 40
Confidence: 60%

Matched Keywords: 实现, 登录
Matched Patterns: 0 pattern(s)

💡 Use `@code-imple 帮我实现登录功能` to execute with this agent.
```

### 使用场景

1. **测试 Agent 触发规则** - 验证 triggers 配置是否正确
2. **调试路由逻辑** - 查看关键词和模式匹配情况
3. **优化触发条件** - 根据路由结果调整 agent 配置

---

## ⚙️  8. `/agents config` - 管理路由配置 ⭐

查看和修改智能路由的配置。

### 基本语法

```bash
# 查看当前配置
/agents config show

# 启用/禁用路由
/agents config enable
/agents config disable

# 修改配置
/agents config set <key> <value>
```

### 子命令

| 子命令 | 用途 | 示例 |
|--------|------|------|
| `show` | 显示当前配置 | `/agents config show` |
| `enable` | 启用路由 | `/agents config enable` |
| `disable` | 禁用路由 | `/agents config disable` |
| `set` | 更新配置项 | `/agents config set strategy hybrid` |

### 可配置项

| 配置键 | 值类型 | 说明 | 示例 |
|--------|-------|------|------|
| `strategy` | `rule`\|`llm`\|`hybrid` | 路由策略 | `rule` |
| `rule.confidence_threshold` | `0-100` | 规则路由置信度阈值 | `80` |
| `llm.model` | 模型名称 | LLM 路由使用的模型 | `gemini-2.0-flash` |
| `llm.timeout` | 毫秒数 | LLM 路由超时时间 | `5000` |
| `fallback` | `none`\|`prompt_user`\|`default_agent` | 无匹配时的回退策略 | `prompt_user` |

### 示例

```bash
# 查看当前配置
/agents config show

# 启用路由
/agents config enable

# 切换到规则路由（最快）
/agents config set strategy rule

# 切换到 LLM 路由（最智能）
/agents config set strategy llm

# 切换到混合路由（平衡）
/agents config set strategy hybrid

# 调整置信度阈值
/agents config set rule.confidence_threshold 85

# 更换 LLM 模型
/agents config set llm.model gemini-1.5-pro

# 调整超时时间
/agents config set llm.timeout 10000

# 更改回退策略
/agents config set fallback none
```

### 三种路由策略对比

| 策略 | 速度 | 准确度 | 适用场景 |
|------|------|--------|----------|
| `rule` | ⚡ 极快 (< 10ms) | 🎯 中等 | 关键词明确、规则清晰 |
| `llm` | 🐢 较慢 (1-3s) | 🎯🎯🎯 最高 | 复杂场景、语义理解 |
| `hybrid` | ⚡ 快 (通常 < 10ms) | 🎯🎯 较高 | **推荐** - 最佳平衡 |

**Hybrid 策略工作原理**:
1. 先尝试规则匹配 (< 10ms)
2. 如果置信度 >= 阈值，使用规则结果
3. 否则回退到 LLM 路由 (1-3s)

### 配置输出示例

```
⚙️  Routing Configuration

Enabled: ✅ Yes
Strategy: hybrid
Confidence Threshold: 70
LLM Model: gemini-2.0-flash
LLM Timeout: 5000ms
Fallback: prompt_user

💡 Available Commands:
- `/agents config show` - Show current config
- `/agents config enable` - Enable routing
- `/agents config disable` - Disable routing
- `/agents config set <key> <value>` - Update config

Examples:
- `/agents config set strategy hybrid`
- `/agents config set rule.confidence_threshold 80`
- `/agents config set llm.model gemini-2.0-flash`
```

### 注意事项

⚠️  **运行时修改 vs 持久化**

- 使用 `/agents config set` 的修改是**运行时生效**，重启后恢复默认
- 要持久化配置，需要在 `.gemini/settings.json` 中添加：

```json
{
  "routing": {
    "enabled": true,
    "strategy": "hybrid",
    "rule": {
      "confidence_threshold": 80
    },
    "llm": {
      "model": "gemini-2.0-flash",
      "timeout": 5000
    },
    "fallback": "prompt_user"
  }
}
```

---

## 🚀 快速上手路由与移交

### 场景 1: 启用智能路由

```bash
# 1. 启用路由
/agents config enable

# 2. 测试路由
/agents route "实现登录功能"

# 3. 根据路由结果使用 agent
@code-imple 实现登录功能
```

### 场景 2: Agent 自动移交

在 Agent 配置文件中添加 handoffs:

```yaml
---
kind: agent
name: code-review
handoffs:
  - to: code-imple
    description: "Transfer for implementation after review"
    include_context: true
---

# Agent 会自动调用 transfer_to_code_imple 工具
```

执行：
```bash
@code-review 审查并修复这段代码

# 流程:
# 1. code-review 审查代码
# 2. 发现问题，自动调用 transfer_to_code_imple
# 3. code-imple 收到移交，执行修复
# 4. 返回最终结果
```

### 场景 3: 调试路由配置

```bash
# 1. 查看当前配置
/agents config show

# 2. 测试路由
/agents route "你的提示"

# 3. 如果路由不准确，调整策略
/agents config set strategy llm

# 4. 或调整置信度阈值
/agents config set rule.confidence_threshold 85

# 5. 重新测试
/agents route "你的提示"
```

---

**更新日期**: 2025-10-07
**版本**: 完整版 (8 命令 + 路由与移交支持)
**状态**: ✅ 完成

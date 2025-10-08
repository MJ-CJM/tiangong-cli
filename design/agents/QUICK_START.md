# Agents 快速开始指南

> **目标读者**: 首次使用 Agents 功能的用户
> **预计时间**: 5 分钟

---

## 🚀 两种创建方式

### 方式 1: 逐步交互式（推荐新手）⭐

**适合**: 第一次使用，不确定如何配置

```bash
/agents begin
```

然后跟随提示逐步输入每个配置项。

**完整示例**:

```bash
# 第 1 步：启动
> /agents begin

# 显示 session ID，例如: agent-create-1234567890-abc123
# 记下这个 ID，后续步骤需要用到

# 第 2 步：输入名字
> /agents next agent-create-1234567890-abc123 my-debugger

# 第 3 步：跳过 title（使用默认）
> /agents next agent-create-1234567890-abc123

# 第 4 步：跳过 description
> /agents next agent-create-1234567890-abc123

# 第 5 步：选择作用域 (1=project, 2=global)
> /agents next agent-create-1234567890-abc123 1

# 第 6 步：选择模型 (1-6)
> /agents next agent-create-1234567890-abc123 1

# 第 7 步：选择内容方式 (1=AI, 2=Manual)
> /agents next agent-create-1234567890-abc123 1

# 第 8 步：输入详细的用途描述
> /agents next agent-create-1234567890-abc123 Debug Python and JavaScript errors with detailed explanations and step-by-step solutions

# AI 会自动生成内容并显示

# 第 9 步：使用默认工具
> /agents next agent-create-1234567890-abc123

# 第 10 步：确认创建
> /agents next agent-create-1234567890-abc123 yes

# ✅ 完成！
```

**提示**:
- 可选字段直接按 Enter 跳过
- 随时用 `/agents status <session-id>` 查看进度
- 随时用 `/agents cancel <session-id>` 取消

---

### 方式 2: 一行命令（熟练用户）⚡

**适合**: 已知所有配置，快速创建

```bash
/agents create <name> --ai --purpose "<详细描述>"
```

**完整示例**:

```bash
# 创建调试 Agent
/agents create debugger --ai --purpose "Debug Python and JavaScript errors with detailed explanations"

# 创建代码审查 Agent（带更多选项）
/agents create code-reviewer --ai \
  --purpose "Review code for security vulnerabilities and best practices" \
  --title "Security Code Reviewer" \
  --model claude-3.5-sonnet \
  --scope global

# 先预览再创建
/agents create analyzer --ai --purpose "Analyze code performance" --preview
# 满意后去掉 --preview 真正创建
/agents create analyzer --ai --purpose "Analyze code performance"
```

**可用参数**:
- `--ai` - 使用 AI 生成内容
- `--purpose "..."` - 用途描述（AI 模式必需）
- `--title "..."` - 显示标题
- `--description "..."` - 简短描述
- `--model <name>` - AI 模型
- `--scope project|global` - 作用域
- `--preview` - 预览模式（不创建文件）

---

## 📝 第一个 Agent

让我们创建一个简单的调试 Agent：

```bash
# 使用交互式（推荐）
/agents begin
# 按提示输入...

# 或使用一行命令
/agents create debugger --ai --purpose "Debug code errors"
```

---

## 🔍 查看和管理

```bash
# 列出所有 Agents
/agents list

# 查看详细信息
/agents info debugger

# 验证配置
/agents validate debugger

# 删除 Agent
/agents delete debugger
```

---

## 💡 实用技巧

### 1. 写好 Purpose 很重要！

**❌ 太简单**:
```bash
--purpose "Debug code"
```

**✅ 清晰详细**:
```bash
--purpose "Debug Python and JavaScript errors with detailed explanations, step-by-step solutions, and best practices for error prevention"
```

### 2. 使用预览模式优化

```bash
# 第一次：简单尝试
/agents create test --ai --purpose "Test code" --preview
# 看看效果...

# 第二次：改进描述
/agents create test --ai --purpose "Test Python code with comprehensive unit tests and edge cases" --preview
# 更好了！

# 第三次：真正创建
/agents create test --ai --purpose "Test Python code with comprehensive unit tests and edge cases"
```

### 3. 查看帮助

```bash
# 查看所有命令
/agents

# 查看向导
/agents wizard
```

---

## 🎯 常见场景

### 调试助手

```bash
/agents create debugger --ai \
  --purpose "Debug Python, JavaScript, and TypeScript errors. Analyze stack traces, identify root causes, and provide step-by-step solutions."
```

### 代码审查

```bash
/agents create reviewer --ai \
  --purpose "Review code for security vulnerabilities, performance issues, and best practices. Follow OWASP top 10 guidelines."
```

### 文档生成

```bash
/agents create documenter --ai \
  --purpose "Generate comprehensive API documentation with examples, parameter descriptions, and return types."
```

### 性能分析

```bash
/agents create performance --ai \
  --purpose "Analyze code for performance bottlenecks, memory leaks, and optimization opportunities. Provide benchmark data."
```

---

## ❓ 常见问题

### Q: 交互式和一行命令有什么区别？

**A**:
- **交互式** (`/agents begin`): 逐步引导，适合新手学习
- **一行命令**: 快速创建，适合熟练用户

两种方式创建的 Agent 功能完全相同！

### Q: 如何查看交互式创建的进度？

**A**: 使用 `/agents status <session-id>`

### Q: 可以取消交互式创建吗？

**A**: 可以，使用 `/agents cancel <session-id>`

### Q: AI 生成的内容不满意怎么办？

**A**:
1. 使用 `--preview` 先预览
2. 调整 `--purpose` 描述更详细
3. 重新生成直到满意

### Q: Agent 创建后可以修改吗？

**A**: 可以，直接编辑文件：
```bash
vim .gemini/agents/my-agent.md
```

---

## 📚 更多资源

- **完整文档**: `AGENTS.md`
- **创建指南**: `AGENTS_CREATE_GUIDE.md`
- **P1 功能**: `AGENTS_P1_COMPLETION_SUMMARY.md`
- **P2 功能**: `AGENTS_P2_COMPLETE.md`
- **设计文档**: `AGENTS_INTERACTIVE_DESIGN.md`

---

## ✅ 下一步

创建完 Agent 后：

1. **查看内容**
   ```bash
   cat .gemini/agents/<name>.md
   ```

2. **验证配置**
   ```bash
   /agents validate <name>
   ```

3. **查看信息**
   ```bash
   /agents info <name>
   ```

4. **开始使用**
   - Agent 会在对话中自动使用
   - 或手动调用（具体使用方式参考主文档）

---

**开始创建你的第一个 Agent 吧！** 🚀

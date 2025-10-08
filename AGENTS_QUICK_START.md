# 🚀 Agents 快速开始指南

> 5 分钟上手智能路由和 Agent 移交功能

---

## 📋 前置条件

```bash
# 确保已编译
npm run build

# 启动 CLI
npm start
```

---

## 🎯 场景 1: 测试智能路由

### 1. 创建测试 Agents

```bash
# 在 CLI 中执行
/agents create code_review --ai --purpose "审查代码质量，发现潜在问题" --model qwen3-coder-flash
/agents create code_imple --ai --purpose "实现新功能，编写高质量代码" --model qwen3-coder-flash
```

### 2. 添加触发器

编辑 `.gemini/agents/code_review.md`，在 YAML front-matter 中添加：

```yaml
triggers:
  keywords: [审查, review, 检查, 代码质量]
  priority: 80
```

编辑 `.gemini/agents/code_imple.md`，添加：

```yaml
triggers:
  keywords: [实现, implement, 开发, 写代码]
  priority: 80
```

### 3. 启用路由

```bash
/agents config enable
/agents config set strategy rule
```

### 4. 测试路由

```bash
# 仅测试（不执行）
/agents route "帮我审查这段代码"

# 预期输出
✅ **Routing Result**
Selected Agent: code_review
Confidence: 95%
Matched Keywords: 审查

💡 Use @code_review ... to execute
💡 Or use /agents route "..." --execute
```

### 5. 执行路由 ⭐ 新功能

```bash
# 方式 1: 一步完成（推荐）
/agents route "帮我审查这段代码" --execute

# 方式 2: 使用 @ 语法
@code_review 帮我审查这段代码

# 方式 3: 使用 /agents run
/agents run code_review 帮我审查这段代码
```

---

## 🔄 场景 2: Agent 移交

### 1. 配置移交关系

编辑 `.gemini/agents/code_review.md`，添加 `handoffs` 字段：

```yaml
---
kind: agent
name: code_review
title: 代码审查助手
triggers:
  keywords: [审查, review]
  priority: 80
handoffs:
  - to: code_imple
    when: manual
    description: "发现需要修复或实现功能时，移交给代码实现助手"
    include_context: true
---

你是专业的代码审查助手。

**重要规则**：
- 当用户要求你实现新功能或修复代码时
- 使用 transfer_to_code_imple 工具移交任务
- 你只负责审查，不负责实现！
```

### 2. 测试移交

```bash
# 调用 code_review，但请求实现功能
@code_review 帮我实现一个登录功能

# 预期输出
[code_review]: 我注意到你需要实现功能，让我移交给代码实现助手...

[HandoffManager] Initiating handoff: code_review -> code_imple

[code_imple]: 好的，我来帮你实现登录功能...
```

---

## 📊 场景 3: 路由配置管理

### 查看当前配置

```bash
/agents config show

# 输出
⚙️ Routing Configuration
Enabled: ✅ Yes
Strategy: rule
Confidence Threshold: 70
LLM Model: gemini-2.0-flash
```

### 切换路由策略

```bash
# 规则路由（最快，< 10ms）
/agents config set strategy rule

# LLM 路由（最准确，1-3s）
/agents config set strategy llm

# 混合路由（推荐，平衡性能和准确度）
/agents config set strategy hybrid
```

### 调整置信度阈值

```bash
# hybrid 模式下，低于阈值时使用 LLM
/agents config set rule.confidence_threshold 80
```

### 启用/禁用路由

```bash
/agents config enable   # 启用
/agents config disable  # 禁用
```

---

## 🎨 实用技巧

### 技巧 1: 使用 --execute 一步完成

```bash
# 旧方式（两步）
/agents route "实现登录"     # 步骤 1: 测试
@code_imple 实现登录         # 步骤 2: 执行

# 新方式（一步）⭐
/agents route "实现登录" --execute
```

### 技巧 2: 调试路由配置

```bash
# 测试不同输入的路由结果
/agents route "实现功能"    # 应该 -> code_imple
/agents route "审查代码"    # 应该 -> code_review
/agents route "天气如何"    # 应该 -> 无匹配

# 根据结果调整 triggers 配置
```

### 技巧 3: 环境变量配置

```bash
# 在 ~/.bashrc 或 ~/.zshrc 中添加
export GEMINI_ROUTING_ENABLED=true
export GEMINI_ROUTING_STRATEGY=hybrid
export GEMINI_ROUTING_CONFIDENCE_THRESHOLD=70

# 重启 CLI 自动生效
```

### 技巧 4: 项目级配置

创建 `.gemini/settings.json`：

```json
{
  "routing": {
    "enabled": true,
    "strategy": "hybrid",
    "rule": {
      "confidence_threshold": 75
    },
    "llm": {
      "model": "gemini-2.0-flash",
      "timeout": 5000
    }
  }
}
```

---

## 🔍 常见问题

### Q: 路由没有生效？

```bash
# 1. 检查是否启用
/agents config show

# 2. 如果显示 "Enabled: ❌ No"
/agents config enable

# 3. 检查 Agent 是否有 triggers
/agents info code_review
```

### Q: --execute 和 @ 语法有什么区别？

- `/agents route "prompt" --execute`: **先显示路由结果，再执行**
- `@agent prompt`: **直接执行，无路由提示**
- 推荐用 `--execute` 来学习和调试路由配置

### Q: 如何查看所有 Agents？

```bash
/agents list
```

### Q: 如何删除 Agent？

```bash
/agents delete agent_name
```

---

## 📚 更多文档

- [AGENTS_P2_FEATURES.md](./AGENTS_P2_FEATURES.md) - 完整功能说明
- [AGENTS_ROUTING_INTEGRATION.md](./AGENTS_ROUTING_INTEGRATION.md) - 自动路由集成方案
- [design/agents/COMMANDS.md](./design/agents/COMMANDS.md) - 完整命令文档

---

## 🎯 推荐使用方式

| 场景 | 推荐命令 | 理由 |
|------|---------|------|
| **学习/调试** | `/agents route "prompt"` | 看到路由结果，了解系统行为 |
| **日常使用** | `/agents route "prompt" --execute` | 一步完成，看到路由过程 |
| **快速执行** | `@agent prompt` | 最快，无额外输出 |
| **批量测试** | `/agents route ...` (多次) | 验证触发器配置 |

---

**文档版本**: 1.0
**创建日期**: 2025-10-07
**作者**: Claude Code

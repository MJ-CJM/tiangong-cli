# Agent 交互式创建 - 设计方案

> **问题**: 当前的 AI 生成流程缺少交互式确认步骤
> **目标**: 让用户逐步确认名字、描述、作用域、模型、工具权限等，最后才生成 Agent

---

## 🎯 理想的用户体验

```bash
> /agents create

🪄 **Agent Creation Wizard**

Step 1/7: Agent Name
  What should we call this agent? (lowercase-with-hyphens)
  → debug-helper

Step 2/7: Display Title
  Title for "debug-helper": Debug Helper
  Confirm? (yes/no) → yes

Step 3/7: Description
  Short description (optional, press Enter to skip):
  → Helps debug Python and JavaScript errors

Step 4/7: Scope
  Where to save?
    1. Project (.gemini/agents/)
    2. Global (~/.gemini/agents/)
  → 1

Step 5/7: Model
  Which model?
    1. gemini-2.0-flash (recommended)
    2. gemini-1.5-pro
    3. claude-3.5-sonnet
    4. gpt-4o
  → 1

Step 6/7: Content Creation
  How to create content?
    1. AI Generate ⭐ (recommended)
    2. Manual Template
  → 1

Step 7/7: Purpose (for AI generation)
  Describe what this agent should do:
  → Debug Python and JavaScript errors with detailed explanations

---

📋 **Review Your Configuration:**

  Name: debug-helper
  Title: Debug Helper
  Description: Helps debug Python and JavaScript errors
  Scope: project
  Model: gemini-2.0-flash
  Mode: AI Generated
  Purpose: Debug Python and JavaScript errors with detailed explanations
  Tools: read_file, grep, glob, bash (default)

Looks good? (yes/no) → yes

🤖 Generating agent content using AI...

✨ AI Generated Content:
──────────────────────────────────────
# Role

You are a debugging expert specializing in Python and JavaScript...

## Responsibilities
- Analyze error messages and stack traces
- Identify root causes of bugs
...
──────────────────────────────────────

Accept this content? (yes/no/regenerate) → yes

✅ Created agent "debug-helper"

File: .gemini/agents/debug-helper.md
```

---

## 🔧 技术实现方案

### 方案 A: 真正的交互式输入 (复杂，需要架构改动)

**需要实现:**
1. 新的输入模式 (类似 prompt/inquirer)
2. 暂停主输入流
3. 收集多步骤答案
4. 恢复主输入流

**难度**: ⭐⭐⭐⭐⭐ (需要深度集成)

**优点**:
- 真正的交互式体验
- 用户友好

**缺点**:
- 需要大量架构改动
- 可能影响现有功能
- 开发时间长

---

### 方案 B: 分步确认式 (推荐，易实现)

**实现方式:**

```bash
# 第一步：收集基本信息
/agents create debug-helper

📋 Configure your agent:
  Name: debug-helper
  Title: Debug Helper (auto-generated)
  Scope: project (default)
  Model: gemini-2.0-flash (default)

Continue with these settings? Reply with:
  - "yes" to continue
  - "customize" to see all options

> yes

# 第二步：选择创建模式
Choose content creation mode:
  1. AI Generate ⭐ - Describe purpose, AI creates content
  2. Manual - Create empty template

Reply with "1" or "2":

> 1

# 第三步：AI 生成
Describe this agent's purpose in detail:

> Debug Python and JavaScript errors with detailed explanations

🤖 Generating...

✨ Preview of generated content:
[显示前300字符...]

Reply with:
  - "accept" to create the agent
  - "show-full" to see full content
  - "regenerate" to try again
  - "cancel" to abort

> accept

✅ Agent created!
```

**优点**:
- 无需架构改动
- 逐步确认
- 可以在任何步骤取消

**缺点**:
- 需要多轮对话
- 不如真正的交互式流畅

---

### 方案 C: 预览 + 确认模式 (当前实现的改进)

**实现方式:**

```bash
/agents create debug-helper --ai --purpose "Debug Python errors"

📋 **Agent Configuration Preview:**
┌──────────────────────────────────────┐
│ Name:        debug-helper             │
│ Title:       Debug Helper             │
│ Scope:       project                  │
│ Model:       gemini-2.0-flash         │
│ Mode:        AI Generated             │
│ Purpose:     Debug Python errors      │
│ Tools:       read_file, grep, bash    │
└──────────────────────────────────────┘

🤖 Generating AI content...

✨ **Generated Content Preview:**
┌──────────────────────────────────────┐
│ # Role                                │
│ You are a debugging expert...         │
│                                       │
│ ## Responsibilities                   │
│ - Analyze error messages              │
│ - Identify root causes                │
│ ...                                   │
└──────────────────────────────────────┘

To proceed, reply with:
  • **"create"** - Create this agent
  • **"edit <field>"** - Modify a field (e.g., "edit tools")
  • **"regenerate"** - Re-generate AI content
  • **"show-full"** - View complete content
  • **"cancel"** - Cancel creation

> create

✅ Agent "debug-helper" created successfully!
```

**优点**:
- 清晰的预览
- 可以修改和确认
- 实现相对简单

**缺点**:
- 仍需对话式交互
- 不是一个命令完成

---

## 💡 推荐实现: 混合方案

### Phase 1: 改进当前命令 (立即可用)

```bash
# 方式 1: 快速创建 (当前已支持)
/agents create my-agent --ai --purpose "Debug errors"

# 方式 2: 详细预览模式 (新增)
/agents create my-agent --ai --purpose "Debug errors" --preview

# 显示详细配置和生成的内容预览
# 需要用户回复 "confirm" 才创建
```

### Phase 2: 真正的交互式向导 (未来)

```bash
/agents wizard

# 启动完整的交互式向导
# 逐步收集所有信息
```

---

## 📝 当前的问题与建议

### 当前实现的问题

1. ❌ 没有显示完整的配置信息
2. ❌ 没有给用户确认的机会
3. ❌ AI 生成后直接创建，无法预览完整内容
4. ❌ 无法修改或重新生成

### 立即可以改进的点

1. ✅ **显示配置摘要**
   ```
   📋 Configuration:
     Name: debug
     Title: Debug
     Scope: project
     Model: gemini-2.0-flash
     Purpose: Debug Python and JavaScript errors
   ```

2. ✅ **显示完整生成的内容** (不只是前300字符)
   ```
   ✨ AI Generated Content:
   ─────────────────────────────
   [完整内容]
   ─────────────────────────────
   ```

3. ✅ **添加确认提示**
   ```
   This will create:
     File: .gemini/agents/debug.md

   Reply "confirm" to create, or "cancel" to abort
   ```

4. ✅ **支持重新生成**
   ```
   Reply "regenerate" to try again with different wording
   ```

---

## 🎯 建议的实施步骤

### 第一阶段 (1-2 天)

改进当前的 `create` 命令:

1. 添加 `--preview` 标志
2. 显示完整配置信息
3. 显示完整 AI 生成内容
4. 要求用户确认再创建

```bash
/agents create debug --ai --purpose "..." --preview
# 显示所有信息，等待确认
```

### 第二阶段 (3-5 天)

添加基于对话的确认流程:

```bash
/agents create debug --ai --purpose "..."
# 显示配置
# 提示: Reply "confirm" to create

> confirm
# 创建 agent
```

### 第三阶段 (1-2 周)

实现真正的交互式向导:

```bash
/agents wizard
# 逐步询问每个字段
# 实时收集输入
# 最后确认并创建
```

---

## 📚 参考实现

类似的 CLI 交互式体验:

1. **npm init** - 逐步询问
2. **git config** - 交互式配置
3. **vue create** - 选择预设
4. **create-react-app** - 确认配置

---

## 总结

**立即可做 (方案 C 改进版)**:
- 在当前命令中添加详细预览
- 显示完整生成内容
- 添加确认步骤

**未来可做 (方案 A)**:
- 实现真正的交互式向导
- 需要输入系统集成
- 提供最佳用户体验

建议先实现方案 C 的改进版，让用户至少能看到完整信息并确认，然后再考虑方案 A 的完整交互式实现。

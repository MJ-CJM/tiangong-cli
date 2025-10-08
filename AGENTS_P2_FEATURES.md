# 🚀 Agents P2 Phase 1: 自动路由与移交功能

> **版本**: 1.0 | **日期**: 2025-10-07

---

## 📋 功能总览

本次更新为 Agents 系统添加了两大核心功能：

| 功能 | 描述 | 状态 |
|------|------|------|
| **🧭 智能路由 (Auto-Routing)** | 根据用户输入自动选择最合适的 Agent | ✅ 已完成 |
| **🔄 Agent 移交 (Handoff)** | Agent 之间智能转移任务 | ✅ 已完成 |

---

## 🧭 1. 智能路由 (Auto-Routing)

### 功能说明

智能路由可以根据用户的输入内容，自动选择最适合的 Agent 来处理任务，无需手动指定 Agent 名称。

### 三种路由策略

| 策略 | 描述 | 性能 | 准确度 | 适用场景 |
|------|------|------|--------|----------|
| **rule** | 基于关键词和正则匹配 | 极快 (< 10ms) | 中等 | 明确的关键词触发 |
| **llm** | 使用 AI 模型智能推理 | 较慢 (1-3s) | 高 | 复杂语义理解 |
| **hybrid** | 规则优先，LLM 兜底 | 快速 (10-100ms) | 高 | 推荐默认使用 ⭐ |

### 配置方式

#### Agent 定义中添加触发器

在 Agent 的 YAML front-matter 中添加 `triggers` 字段：

```yaml
---
kind: agent
name: code-imple
title: 代码实现助手
triggers:
  keywords:
    - 实现
    - 开发
    - implement
    - develop
  patterns:
    - "写.*代码"
    - "create.*function"
  priority: 80
---
```

**字段说明**:
- `keywords`: 关键词列表（中英文均可）
- `patterns`: 正则表达式列表（用于复杂匹配）
- `priority`: 优先级 (0-100)，数值越高优先级越高

### CLI 命令

#### 1. `/agents route` - 测试路由

测试给定输入会路由到哪个 Agent：

```bash
# 仅测试路由结果（不执行）
/agents route "帮我实现登录功能"

# 输出示例
✅ **Routing Result**

**Selected Agent**: code-imple
**Title**: 代码实现助手
**Score**: 85
**Confidence**: 92%

**Matched Keywords**: 实现
**Matched Patterns**: None

💡 Use @code-imple 帮我实现登录功能 to execute with this agent.
💡 Or use /agents route "帮我实现登录功能" --execute to route and execute in one step.
```

**新增：一步完成路由和执行** ⭐

```bash
# 测试路由并立即执行（--execute 参数）
/agents route "帮我实现登录功能" --execute

# 输出示例
🔍 Routing and executing: "帮我实现登录功能"

✅ **Routing Result**

**Selected Agent**: code-imple
**Title**: 代码实现助手
**Score**: 85
**Confidence**: 92%

**Matched Keywords**: 实现

🚀 Executing with agent: **代码实现助手**

[Agent 开始执行...]
```

#### 2. `/agents config` - 管理路由配置

```bash
# 查看当前配置
/agents config show

# 启用/禁用路由
/agents config enable
/agents config disable

# 设置路由策略
/agents config set strategy rule       # 仅规则
/agents config set strategy llm        # 仅 LLM
/agents config set strategy hybrid     # 混合模式（推荐）

# 设置置信度阈值（hybrid 模式）
/agents config set rule.confidence_threshold 80

# 设置 LLM 模型
/agents config set llm.model gemini-2.0-flash

# 设置 LLM 超时（毫秒）
/agents config set llm.timeout 5000
```

### 环境变量配置

```bash
# 启用路由
export GEMINI_ROUTING_ENABLED=true

# 设置策略
export GEMINI_ROUTING_STRATEGY=hybrid

# 置信度阈值
export GEMINI_ROUTING_CONFIDENCE_THRESHOLD=70

# LLM 配置
export GEMINI_ROUTING_LLM_MODEL=gemini-2.0-flash
export GEMINI_ROUTING_LLM_TIMEOUT=5000

# 降级策略
export GEMINI_ROUTING_FALLBACK=prompt_user
```

### 配置优先级

```
Runtime 参数 > 环境变量 > 项目配置 > 全局配置 > 默认值
```

---

## 🔄 2. Agent 移交 (Handoff)

### 功能说明

Agent 可以在执行过程中将任务转移给其他 Agent，实现专业化分工和协作。

### 移交方式

采用 **Handoff-as-Tool** 模式（与 OpenAI Swarm 对齐）：
- Agent 调用 `transfer_to_<agent_name>` 工具函数
- 系统自动处理上下文传递和 Agent 切换
- 支持双向移交和链式移交

### Agent 定义中配置移交

在 Agent 的 YAML front-matter 中添加 `handoffs` 字段：

```yaml
---
kind: agent
name: code-review
title: 代码审查助手
handoffs:
  - to: code-imple
    when: manual
    description: "如果需要实现新功能或修复代码，可以移交给代码实现助手"
    include_context: true
  - to: test-writer
    when: manual
    description: "如果需要编写测试用例，移交给测试编写助手"
    include_context: false
---
```

**字段说明**:
- `to`: 目标 Agent 名称
- `when`: 触发时机
  - `manual`: 由 AI 模型决定何时移交（推荐）
  - `auto`: 满足条件自动移交
  - `conditional`: 基于规则条件移交
- `description`: 移交说明（会传递给 AI 模型）
- `include_context`: 是否包含完整对话历史（默认 true）

### 移交工具调用示例

当 Agent 需要移交时，模型会生成如下工具调用：

```javascript
{
  "type": "function_call",
  "functionCall": {
    "name": "transfer_to_code_imple",
    "args": {
      "reason": "用户需要实现新功能，我的职责是代码审查，应该移交给代码实现助手"
    }
  }
}
```

### 安全机制

1. **循环检测**: 自动检测 A → B → A 循环移交并拒绝
2. **深度限制**: 最大移交深度为 5 层，防止无限链
3. **关联追踪**: 每个移交链有唯一 correlation_id 用于调试

### 移交元数据

每次移交都会携带以下元数据：

```typescript
{
  from_agent: "code-review",
  to_agent: "code-imple",
  reason: "需要实现新功能",
  timestamp: "2025-10-07T12:00:00Z",
  metadata: {
    chain_depth: 1,
    correlation_id: "abc123",
    handoff_chain: ["code-review"]
  }
}
```

---

## ✅ 验证指南

### 验证 1: 基础路由功能

#### 步骤 1: 创建测试 Agents

```bash
# 创建代码实现 Agent
cat > .gemini/agents/code-imple.md << 'EOF'
---
kind: agent
name: code-imple
title: 代码实现助手
triggers:
  keywords:
    - 实现
    - 开发
    - implement
    - 写代码
  priority: 80
---
你是一个专业的代码实现助手，擅长编写高质量的代码。
EOF

# 创建代码审查 Agent
cat > .gemini/agents/code-review.md << 'EOF'
---
kind: agent
name: code-review
title: 代码审查助手
triggers:
  keywords:
    - 审查
    - 检查
    - review
    - 代码质量
  priority: 80
---
你是一个专业的代码审查助手，擅长发现代码问题并提供改进建议。
EOF
```

#### 步骤 2: 启用路由

```bash
# 方式 1: 环境变量
export GEMINI_ROUTING_ENABLED=true
export GEMINI_ROUTING_STRATEGY=rule

# 方式 2: CLI 命令（运行时）
/agents config enable
/agents config set strategy rule
```

#### 步骤 3: 测试路由

```bash
# 测试 1: 应该路由到 code-imple（仅测试）
/agents route "帮我实现一个登录功能"

# 预期输出
✅ **Routing Result**
**Selected Agent**: code-imple
**Matched Keywords**: 实现

💡 Use @code-imple ... to execute with this agent.
💡 Or use /agents route "..." --execute to route and execute in one step.

# 测试 2: 应该路由到 code-review
/agents route "帮我审查这段代码的质量"

# 预期输出
✅ **Routing Result**
**Selected Agent**: code-review
**Matched Keywords**: 审查

# 测试 3: 没有匹配的 Agent
/agents route "今天天气怎么样"

# 预期输出
❌ No suitable agent found for this prompt.
```

#### 步骤 4: 执行路由

**方式 1: 使用 --execute 参数（推荐）** ⭐

```bash
# 测试路由并立即执行
/agents route "帮我实现一个登录功能" --execute

# 预期输出
🔍 Routing and executing: "帮我实现一个登录功能"

✅ **Routing Result**
**Selected Agent**: code-imple
**Confidence**: 92%

🚀 Executing with agent: **代码实现助手**

[code-imple 开始执行...]
```

**方式 2: 使用 @ 语法**

```bash
# 手动调用路由到的 Agent
@code-imple 帮我实现一个登录功能

# 或使用 /agents run
/agents run code-imple 帮我实现一个登录功能
```

---

### 验证 2: Agent 移交功能

#### 步骤 1: 创建支持移交的 Agents

```bash
# 创建 code-review Agent（支持移交到 code-imple）
cat > .gemini/agents/code-review.md << 'EOF'
---
kind: agent
name: code-review
title: 代码审查助手
triggers:
  keywords:
    - 审查
    - review
  priority: 80
handoffs:
  - to: code-imple
    when: manual
    description: "如果用户需要实现新功能或修复代码，移交给代码实现助手"
    include_context: true
---
你是一个专业的代码审查助手。

当用户要求你实现新功能或修复代码时，你应该：
1. 告诉用户你的职责是代码审查
2. 使用 transfer_to_code_imple 工具将任务移交给代码实现助手

重要：你只负责审查，不负责实现！
EOF

# 创建 code-imple Agent
cat > .gemini/agents/code-imple.md << 'EOF'
---
kind: agent
name: code-imple
title: 代码实现助手
triggers:
  keywords:
    - 实现
    - implement
  priority: 80
---
你是一个专业的代码实现助手，擅长编写高质量的代码。
EOF
```

#### 步骤 2: 测试移交

```bash
# 启动 CLI
npm start

# 调用 code-review 但请求实现功能
> @code-review 帮我实现一个登录功能

# 预期输出
[AgentExecutor] Agent: code-review
[AgentExecutor] Handoff tool definitions (1): [ 'transfer_to_code-imple' ]

[code-review]: 我注意到你需要实现登录功能。我的职责是代码审查，
              让我把这个任务移交给代码实现助手...

[HandoffManager] Initiating handoff: code-review -> code-imple
[HandoffManager] Handoff created: code-review -> code-imple (depth: 1)

[AgentExecutor] Agent: code-imple
[code-imple]: 好的，我来帮你实现登录功能...
```

#### 步骤 3: 验证循环检测

```bash
# 创建循环移交的 Agents
cat > .gemini/agents/agent-a.md << 'EOF'
---
kind: agent
name: agent-a
title: Agent A
handoffs:
  - to: agent-b
    when: manual
---
你总是将任务移交给 agent-b
EOF

cat > .gemini/agents/agent-b.md << 'EOF'
---
kind: agent
name: agent-b
title: Agent B
handoffs:
  - to: agent-a
    when: manual
---
你总是将任务移交给 agent-a
EOF

# 执行测试
> @agent-a 测试循环移交

# 预期输出
[HandoffManager] Initiating handoff: agent-a -> agent-b
[HandoffManager] Initiating handoff: agent-b -> agent-a
[HandoffError] Circular handoff detected: agent-a -> agent-b -> agent-a
```

---

### 验证 3: 配置管理

#### 测试配置查看

```bash
/agents config show

# 预期输出
🔧 **Routing Configuration**

**Status**: ✅ Enabled
**Strategy**: hybrid
**Confidence Threshold**: 70
**LLM Model**: gemini-2.0-flash
**LLM Timeout**: 5000ms
**Fallback**: prompt_user
```

#### 测试运行时配置

```bash
# 切换策略
/agents config set strategy llm
/agents config show
# 预期：Strategy 变为 llm

# 调整阈值
/agents config set rule.confidence_threshold 90
/agents config show
# 预期：Confidence Threshold 变为 90

# 禁用路由
/agents config disable
/agents config show
# 预期：Status 变为 ❌ Disabled
```

---

### 验证 4: 单元测试和集成测试

#### 运行测试套件

```bash
# 运行所有 Agent 相关测试
cd packages/core
npm test

# 预期输出
✓ RuleRouter.test.ts (9 tests)
✓ Router.test.ts (17 tests)
✓ HandoffManager.test.ts (19 tests)
✓ integration.test.ts (8 tests)

Total: 53 tests passed
```

#### 单独测试路由

```bash
npm test -- Router.test.ts

# 预期输出
✓ should initialize with default config
✓ should load config from environment variables
✓ should prioritize runtime config over environment
...
```

#### 单独测试移交

```bash
npm test -- HandoffManager.test.ts

# 预期输出
✓ should create handoff context successfully
✓ should detect circular handoffs
✓ should enforce maximum handoff depth
...
```

---

## 📊 测试检查清单

### 路由功能

- [ ] ✅ 创建带有 `triggers` 的 Agent
- [ ] ✅ 使用 `/agents route` 测试路由结果
- [ ] ✅ 验证关键词匹配工作正常
- [ ] ✅ 验证正则表达式匹配工作正常
- [ ] ✅ 验证优先级机制（高优先级优先）
- [ ] ✅ 验证无匹配时返回错误
- [ ] ✅ 使用 `/agents config` 切换策略
- [ ] ✅ 验证环境变量配置生效

### 移交功能

- [ ] ✅ 创建带有 `handoffs` 的 Agent
- [ ] ✅ 验证移交工具自动注入
- [ ] ✅ 验证 `transfer_to_` 工具可以被调用
- [ ] ✅ 验证移交成功执行
- [ ] ✅ 验证上下文传递（include_context: true）
- [ ] ✅ 验证循环检测（A → B → A 被拒绝）
- [ ] ✅ 验证深度限制（超过 5 层被拒绝）
- [ ] ✅ 查看日志确认 correlation_id 追踪

### 集成测试

- [ ] ✅ 运行 `npm test` 确认所有测试通过
- [ ] ✅ 检查 53 个测试全部通过
- [ ] ✅ 确认无 TypeScript 编译错误
- [ ] ✅ 确认 `npm run build` 成功

---

## 🐛 常见问题

### Q1: 路由不生效？

**排查步骤**:
1. 检查是否启用路由：`/agents config show`
2. 检查 Agent 是否有 `triggers` 字段
3. 检查日志：`[Router] Routed to agent: ...`

### Q2: 移交工具没有注入？

**排查步骤**:
1. 检查 Agent 是否有 `handoffs` 字段
2. 检查日志：`[AgentExecutor] Handoff tool definitions (N): [...]`
3. 确认目标 Agent 存在：`/agents list`

### Q3: 循环移交怎么办？

**答**: 系统会自动检测并拒绝循环移交，检查日志中的 `[HandoffError] Circular handoff detected`

### Q4: 如何调试路由问题？

**方法**:
```bash
# 1. 启用调试日志
export DEBUG=*

# 2. 测试路由
/agents route "your prompt"

# 3. 查看详细输出
[Router] Using strategy: rule
[Router] Matched agent: code-imple (score: 85)
```

---

## 📚 相关文档

- [IMPLEMENTATION.md](./design/agents/IMPLEMENTATION.md) - 实现细节
- [COMMANDS.md](./design/agents/COMMANDS.md) - 完整命令文档
- [ROADMAP.md](./design/agents/ROADMAP.md) - 功能路线图

---

**文档版本**: 1.0
**创建日期**: 2025-10-07
**作者**: Claude Code

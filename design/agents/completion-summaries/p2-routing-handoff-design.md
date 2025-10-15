# P2 功能设计：智能路由与 Agent 移交（对齐业界方案）

> **版本**: 2.0 | **更新日期**: 2025-10-07
> **状态**: 📋 设计阶段 | **预计工期**: 7-10 天

---

## 目录

1. [设计理念与业界对齐](#设计理念与业界对齐)
2. [核心架构](#核心架构)
3. [功能 1：智能路由](#功能-1智能路由)
4. [功能 2：Handoff-as-Tool（移交即工具）](#功能-2handoff-as-tool移交即工具)
5. [功能 3：Session/State/Memory（会话与记忆）](#功能-3sessionstatememory会话与记忆)
6. [功能 4：护栏与确认](#功能-4护栏与确认)
7. [功能 5：可观测性](#功能-5可观测性)
8. [实现细节](#实现细节)
9. [实施路线图](#实施路线图)

---

## 设计理念与业界对齐

### 设计目标

实现 gemini-cli 的多 Agent 智能路由与协作，同时**对齐业界主流方案的语义**：

- **OpenAI Agents SDK**: Handoff-as-Tool（移交即工具调用）
- **Claude (Agent SDK + Code)**: Subagents（主代理编排 + 独立上下文 + 工具白名单）
- **Google ADK**: Session/State/Memory（会话状态分层）+ Orchestrators（编排器）
- **AutoGen**: RoutedAgent（路由代理）+ Handoffs Pattern
- **LangGraph**: StateGraph + 条件边（可视化编排）

### 核心原则

1. **兼容多方语义**：采用业界共识的原语（如 `transfer_to_*`），便于对接外部引擎
2. **渐进式演进**：先轻量规则路由，后 LLM 智能路由；先本地实现，后可接云端
3. **安全优先**：工具白名单 + 风险确认 + 循环检测
4. **可观测**：事件流记录所有关键决策，便于调试与回放

---

## 核心架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     User Input                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Router（路由层）                             │
│  ┌──────────────┐    ┌──────────────┐                       │
│  │ Rule Router  │ →  │  LLM Router  │                       │
│  │ (快速匹配)    │    │ (智能决策)    │                       │
│  └──────────────┘    └──────────────┘                       │
│         ↓                     ↓                              │
│    Agent Selection   (transfer_to_* tool)                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│               Agent Executor（执行层）                        │
│  ┌────────────────────────────────────────────────┐         │
│  │  Agent Runtime                                 │         │
│  │  - System Prompt + Handoff Context             │         │
│  │  - Filtered Tools (白名单)                     │         │
│  │  - Auto-generated transfer_to_* tools          │         │
│  └────────────────────────────────────────────────┘         │
│                         │                                    │
│         ┌───────────────┴───────────────┐                   │
│         ▼                               ▼                   │
│   ┌──────────┐                   ┌──────────┐              │
│   │  Tool    │                   │ Handoff  │              │
│   │  Call    │                   │  Tool    │              │
│   └──────────┘                   └──────────┘              │
│         │                               │                   │
│         │                               ▼                   │
│         │                    ┌─────────────────┐           │
│         │                    │ HandoffManager  │           │
│         │                    │ - 上下文传递      │           │
│         │                    │ - 循环检测        │           │
│         │                    │ - 深度限制        │           │
│         │                    └─────────────────┘           │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           Session/State/Memory（状态层）                      │
│  ┌──────────────────────────────────────────────┐           │
│  │  Session: 完整对话历史（本地/Vertex）          │           │
│  │  State: 短期关键字段（当前任务状态）            │           │
│  │  Memory: 长期知识（向量/检索，可选）            │           │
│  └──────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Tracing（可观测层）                              │
│  事件流: llm_call / tool_call / handoff / guardrail         │
│  格式: 对齐 OpenAI Tracing 字段                              │
└─────────────────────────────────────────────────────────────┘
```

### 与业界方案的映射

| gemini-cli 组件 | OpenAI Agents | Claude | Google ADK | AutoGen | LangGraph |
|----------------|---------------|---------|-----------|---------|-----------|
| **Router** | LLM + transfer_to_* | 主代理编排 | Custom Orchestrator | RoutedAgent | 条件边 |
| **transfer_to_* 工具** | Handoff | 委派调用 | sub_agents 切换 | 工具调用移交 | 图边 |
| **Session/State/Memory** | Sessions | 独立上下文 | Session/State/Memory | 事件流状态 | 图状态 |
| **Guardrails** | Guardrails | 工具白名单 | Tool Confirmation | 自定义校验 | 人在环 |
| **Tracing** | Tracing | 日志面板 | Runner 观测 | 事件流 | 平台观测 |

---

## 功能 1：智能路由

### 1.0 路由配置（全局开关与策略选择）

#### 配置文件位置

**全局配置**：`~/.gemini/settings.json`
**项目配置**：`.gemini/settings.json`

#### 配置格式

```json
{
  "agents": {
    "routing": {
      "enabled": true,                    // 路由总开关（默认 true）
      "strategy": "hybrid",               // 路由策略："rule" | "llm" | "hybrid" (默认)
      "rule": {
        "confidence_threshold": 80        // 规则路由置信度阈值（默认 80%）
      },
      "llm": {
        "model": "gemini-2.0-flash",      // LLM 路由使用的模型（默认）
        "timeout": 5000                   // LLM 路由超时时间（毫秒，默认 5s）
      },
      "fallback": "prompt_user"           // 无匹配时的回退策略："none" | "prompt_user" | "default_agent"
    }
  }
}
```

#### 配置说明

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `routing.enabled` | boolean | `true` | 路由总开关，`false` 时禁用所有自动路由 |
| `routing.strategy` | string | `"hybrid"` | 路由策略选择 |
| `routing.rule.confidence_threshold` | number | `80` | 规则路由的置信度阈值（0-100） |
| `routing.llm.model` | string | `"gemini-2.0-flash"` | LLM 路由使用的模型 |
| `routing.llm.timeout` | number | `5000` | LLM 路由超时（毫秒） |
| `routing.fallback` | string | `"prompt_user"` | 无匹配时的回退策略 |

#### 路由策略说明

**1. `rule`（仅规则路由）**
- 仅使用关键词和正则匹配
- 最快（< 10ms）
- 适合明确的领域匹配
- 无匹配时根据 `fallback` 处理

**2. `llm`（仅 LLM 路由）**
- 使用 LLM 智能决策
- 较慢（1-3s）
- 适合复杂语义理解
- 准确率最高

**3. `hybrid`（混合策略，默认推荐）**
- 先尝试规则路由
- 置信度 >= `confidence_threshold` 时直接使用
- 否则使用 LLM 路由兜底
- 兼顾速度和准确率

#### CLI 命令动态配置

```bash
# 查看当前配置
/agents config routing

# 开启/关闭路由
/agents config routing.enabled true
/agents config routing.enabled false

# 设置路由策略
/agents config routing.strategy rule
/agents config routing.strategy llm
/agents config routing.strategy hybrid

# 设置置信度阈值
/agents config routing.rule.confidence_threshold 90

# 设置 LLM 模型
/agents config routing.llm.model gemini-2.5-pro
```

#### 环境变量覆盖

```bash
# 临时禁用路由（当前会话）
export GEMINI_ROUTING_ENABLED=false

# 临时切换策略
export GEMINI_ROUTING_STRATEGY=rule

# 临时设置阈值
export GEMINI_ROUTING_THRESHOLD=90
```

#### 运行时覆盖（命令参数）

```bash
# 强制使用规则路由（忽略配置）
@auto --strategy=rule "这个错误怎么解决？"

# 强制使用 LLM 路由
@auto --strategy=llm "这个错误怎么解决？"

# 临时禁用路由（手动指定 Agent）
@debugger "这个错误怎么解决？"
```

---

### 1.1 路由策略详解

#### 策略 1：规则路由（Rule Router）- 快速匹配

**适用场景**：明确的关键词/领域匹配

**Agent 配置格式**：

```yaml
---
name: debugger
title: Code Debugger
triggers:
  keywords:
    - debug
    - error
    - bug
    - exception
    - crash
    - stack trace
  patterns:
    - "\\berr(or)?\\b"
    - "\\bTypeError\\b"
    - "cannot read property"
  priority: 90
---
```

**匹配算法**：

```typescript
interface RuleScore {
  agent: AgentDefinition;
  score: number;
  confidence: number;
  matchedKeywords: string[];
  matchedPatterns: string[];
}

class RuleRouter {
  calculateScore(agent: AgentDefinition, input: string): RuleScore {
    let score = 0;
    const matchedKeywords: string[] = [];
    const matchedPatterns: string[] = [];

    // 1. 关键词匹配 (+10 分/个)
    for (const keyword of agent.triggers?.keywords || []) {
      if (input.toLowerCase().includes(keyword.toLowerCase())) {
        score += 10;
        matchedKeywords.push(keyword);
      }
    }

    // 2. 正则匹配 (+20 分/个，权重更高)
    for (const pattern of agent.triggers?.patterns || []) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(input)) {
        score += 20;
        matchedPatterns.push(pattern);
      }
    }

    // 3. 应用优先级权重
    const priority = agent.triggers?.priority || 50;
    score = Math.round(score * (priority / 100));

    // 4. 计算置信度
    const confidence = Math.min(100, score);

    return { agent, score, confidence, matchedKeywords, matchedPatterns };
  }
}
```

#### 第二档：LLM 路由（LLM Router）- 智能决策

**适用场景**：语义理解、上下文推理、复杂意图识别

**实现方式**：参考 **OpenAI Cookbook**，给路由代理提供所有 `transfer_to_*` 工具

**配置格式**：

```yaml
---
name: router-agent
title: Routing Coordinator
description: Routes user requests to the most appropriate specialized agent
model: gemini-2.0-flash
scope: system
systemPrompt: |
  You are a routing coordinator. Your job is to analyze user requests and
  transfer them to the most appropriate specialized agent.

  Available agents:
  - debugger: Handles error analysis and debugging
  - code-fixer: Fixes code issues
  - code-reviewer: Reviews code quality
  - documenter: Generates documentation

  Analyze the user's request carefully and use the appropriate transfer_to_*
  tool to route the request.
---
```

**自动生成工具**：

```typescript
// 为 router-agent 自动生成所有可用的 transfer_to_* 工具
class LLMRouter {
  async generateTransferTools(availableAgents: AgentDefinition[]): Promise<ToolDefinition[]> {
    return availableAgents.map((agent) => ({
      name: `transfer_to_${agent.name}`,
      description: `Transfer to ${agent.title}: ${agent.description}`,
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Why you are transferring to this agent',
          },
          context: {
            type: 'string',
            description: 'Context information to pass to the agent',
          },
        },
        required: ['reason'],
      },
    }));
  }

  async route(userInput: string, availableAgents: AgentDefinition[]): Promise<string> {
    // 1. 构建路由代理运行时
    const transferTools = await this.generateTransferTools(availableAgents);

    // 2. 让 LLM 决策（调用 transfer_to_* 工具）
    const result = await this.executeRouterAgent(userInput, transferTools);

    // 3. 解析工具调用，返回目标 Agent 名称
    const targetAgent = this.extractTargetFromToolCall(result);

    return targetAgent;
  }
}
```

#### 策略 3：混合路由（Hybrid Router）- 推荐

**适用场景**：兼顾速度与准确率

**实现**：

```typescript
class HybridRouter {
  constructor(
    private ruleRouter: RuleRouter,
    private llmRouter: LLMRouter,
    private config: RoutingConfig
  ) {}

  async route(userInput: string): Promise<string> {
    // 1. 先尝试规则路由（快速匹配）
    const ruleResult = await this.ruleRouter.route(userInput);

    // 2. 如果置信度 >= 阈值，直接使用
    const threshold = this.config.rule.confidence_threshold || 80;

    if (ruleResult && ruleResult.confidence >= threshold) {
      console.log(`🎯 Routing via rule-match to: ${ruleResult.agent.name} (${ruleResult.confidence}% confidence)`);

      return ruleResult.agent.name;
    }

    // 3. 否则使用 LLM 路由（智能决策）
    console.log(`🤖 Rule confidence too low (${ruleResult?.confidence || 0}%), using LLM routing...`);

    const llmResult = await this.llmRouter.route(userInput, this.availableAgents);

    console.log(`🎯 Routing via LLM to: ${llmResult} (95% confidence)`);

    return llmResult;
  }
}
```

---

### 1.2 路由器实现（支持配置）

#### 核心路由器类

```typescript
// packages/core/src/agents/Router.ts

export interface RoutingConfig {
  enabled: boolean;
  strategy: 'rule' | 'llm' | 'hybrid';
  rule: {
    confidence_threshold: number;
  };
  llm: {
    model: string;
    timeout: number;
  };
  fallback: 'none' | 'prompt_user' | 'default_agent';
}

export class Router {
  private ruleRouter: RuleRouter;
  private llmRouter: LLMRouter;
  private hybridRouter: HybridRouter;
  private config: RoutingConfig;

  constructor(
    private agentManager: AgentManager,
    config?: Partial<RoutingConfig>
  ) {
    // 加载配置（优先级：参数 > 项目配置 > 全局配置 > 默认值）
    this.config = this.loadConfig(config);

    // 初始化各路由器
    this.ruleRouter = new RuleRouter(agentManager);
    this.llmRouter = new LLMRouter(agentManager, this.config.llm);
    this.hybridRouter = new HybridRouter(
      this.ruleRouter,
      this.llmRouter,
      this.config
    );
  }

  /**
   * 路由入口（根据配置选择策略）
   */
  async route(
    userInput: string,
    strategyOverride?: 'rule' | 'llm' | 'hybrid'
  ): Promise<string | null> {
    // 1. 检查路由是否启用
    if (!this.config.enabled) {
      console.log('⚠️  Routing is disabled in config');
      return null;
    }

    // 2. 确定使用的策略（运行时覆盖 > 配置）
    const strategy = strategyOverride || this.config.strategy;

    // 3. 根据策略路由
    try {
      let result: string | null = null;

      switch (strategy) {
        case 'rule':
          const ruleResult = await this.ruleRouter.route(userInput);
          result = ruleResult?.agent.name || null;
          break;

        case 'llm':
          result = await this.llmRouter.route(userInput, await this.agentManager.listAgents());
          break;

        case 'hybrid':
          result = await this.hybridRouter.route(userInput);
          break;
      }

      // 4. 处理无匹配情况
      if (!result) {
        return this.handleNoMatch(userInput);
      }

      return result;
    } catch (error) {
      console.error('❌ Routing error:', error);
      return this.handleNoMatch(userInput);
    }
  }

  /**
   * 处理无匹配情况（根据 fallback 策略）
   */
  private async handleNoMatch(userInput: string): Promise<string | null> {
    switch (this.config.fallback) {
      case 'none':
        console.log('⚠️  No agent matched and fallback is disabled');
        return null;

      case 'prompt_user':
        console.log('\n⚠️  No agent matched. Available agents:');
        const agents = await this.agentManager.listAgents();
        agents.forEach((agent, i) => {
          console.log(`  ${i + 1}. ${agent.name} - ${agent.description}`);
        });
        console.log('\nPlease specify an agent manually: @<agent-name> "<prompt>"');
        return null;

      case 'default_agent':
        // TODO: 实现默认 Agent 逻辑
        console.log('⚠️  Using default agent (not implemented yet)');
        return null;

      default:
        return null;
    }
  }

  /**
   * 加载配置（多层级优先级）
   */
  private loadConfig(override?: Partial<RoutingConfig>): RoutingConfig {
    // 默认配置
    const defaultConfig: RoutingConfig = {
      enabled: true,
      strategy: 'hybrid',
      rule: {
        confidence_threshold: 80,
      },
      llm: {
        model: 'gemini-2.0-flash',
        timeout: 5000,
      },
      fallback: 'prompt_user',
    };

    // 加载全局配置
    const globalConfig = this.loadGlobalConfig();

    // 加载项目配置
    const projectConfig = this.loadProjectConfig();

    // 加载环境变量
    const envConfig = this.loadEnvConfig();

    // 合并配置（优先级：override > env > project > global > default）
    return {
      ...defaultConfig,
      ...globalConfig?.agents?.routing,
      ...projectConfig?.agents?.routing,
      ...envConfig,
      ...override,
      rule: {
        ...defaultConfig.rule,
        ...globalConfig?.agents?.routing?.rule,
        ...projectConfig?.agents?.routing?.rule,
        ...envConfig?.rule,
        ...override?.rule,
      },
      llm: {
        ...defaultConfig.llm,
        ...globalConfig?.agents?.routing?.llm,
        ...projectConfig?.agents?.routing?.llm,
        ...envConfig?.llm,
        ...override?.llm,
      },
    };
  }

  /**
   * 从环境变量加载配置
   */
  private loadEnvConfig(): Partial<RoutingConfig> {
    const config: Partial<RoutingConfig> = {};

    if (process.env.GEMINI_ROUTING_ENABLED !== undefined) {
      config.enabled = process.env.GEMINI_ROUTING_ENABLED === 'true';
    }

    if (process.env.GEMINI_ROUTING_STRATEGY) {
      config.strategy = process.env.GEMINI_ROUTING_STRATEGY as any;
    }

    if (process.env.GEMINI_ROUTING_THRESHOLD) {
      config.rule = {
        confidence_threshold: parseInt(process.env.GEMINI_ROUTING_THRESHOLD, 10),
      };
    }

    return config;
  }

  /**
   * 从全局配置文件加载
   */
  private loadGlobalConfig(): any {
    try {
      const configPath = path.join(os.homedir(), '.gemini', 'settings.json');
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * 从项目配置文件加载
   */
  private loadProjectConfig(): any {
    try {
      const configPath = path.join(process.cwd(), '.gemini', 'settings.json');
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * 更新配置（持久化）
   */
  async updateConfig(
    key: string,
    value: any,
    scope: 'global' | 'project' = 'project'
  ): Promise<void> {
    const configPath =
      scope === 'global'
        ? path.join(os.homedir(), '.gemini', 'settings.json')
        : path.join(process.cwd(), '.gemini', 'settings.json');

    // 读取现有配置
    let config: any = {};
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      config = JSON.parse(content);
    } catch {
      config = {};
    }

    // 更新配置（支持嵌套路径，如 "routing.enabled"）
    const keys = key.split('.');
    let current = config;

    // 确保嵌套对象存在
    if (!current.agents) current.agents = {};
    if (!current.agents.routing) current.agents.routing = {};

    // 导航到最后一层
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!current.agents.routing[k]) {
        current.agents.routing[k] = {};
      }
      current = current.agents.routing[k];
    }

    // 设置值
    const lastKey = keys[keys.length - 1];
    current[lastKey] = value;

    // 写回文件
    await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));

    console.log(`✅ Updated ${scope} config: agents.routing.${key} = ${value}`);
  }
}
```

### 1.3 用户体验

#### 场景 1：自动路由（启用，混合策略）

```bash
# 用户输入
User: "这个 TypeError 怎么解决？"

# 系统自动路由（规则匹配成功）
[System] 🎯 Routing via rule-match to: debugger (90% confidence)

Debugger: 这是一个 TypeError，通常是因为...
```

#### 场景 2：混合路由降级到 LLM

```bash
User: "帮我优化一下代码性能"

# 规则路由置信度低，降级到 LLM
[System] 🤖 Rule confidence too low (30%), using LLM routing...
[System] 🎯 Routing via LLM to: performance-optimizer (95% confidence)

Performance-optimizer: 我会帮你分析代码性能...
```

#### 场景 3：路由禁用

```bash
# 配置中禁用路由
# ~/.gemini/settings.json: { "agents": { "routing": { "enabled": false } } }

User: @auto "这个错误怎么解决？"

[System] ⚠️  Routing is disabled in config
[System] Please specify an agent manually: @<agent-name> "<prompt>"
```

#### 场景 4：强制使用特定策略

```bash
# 强制使用规则路由
User: @auto --strategy=rule "这个错误怎么解决？"
[System] 🎯 Routing via rule-match to: debugger (90% confidence)

# 强制使用 LLM 路由
User: @auto --strategy=llm "这个错误怎么解决？"
[System] 🎯 Routing via LLM to: debugger (95% confidence)
```

#### 场景 5：无匹配时的回退

```bash
User: @auto "今天天气怎么样？"

# 无 Agent 匹配（fallback: prompt_user）
[System] ⚠️  No agent matched. Available agents:
  1. debugger - Debug code errors
  2. code-fixer - Fix code issues
  3. reviewer - Review code quality

Please specify an agent manually: @<agent-name> "<prompt>"
```

#### 场景 6：配置管理

```bash
# 查看当前配置
/agents config routing

# 输出
📋 Current Routing Configuration:

Enabled: true
Strategy: hybrid
Rule Confidence Threshold: 80%
LLM Model: gemini-2.0-flash
LLM Timeout: 5000ms
Fallback: prompt_user

# 修改配置
/agents config routing.strategy llm
✅ Updated project config: agents.routing.strategy = llm

# 临时环境变量覆盖
export GEMINI_ROUTING_STRATEGY=rule
```

#### 场景 7：路由测试（不执行）

```bash
# 测试路由而不实际执行
/agents route "这个 TypeError 怎么解决？"

# 输出
🎯 Routing Analysis:

Current Strategy: hybrid
Current Config:
  - Enabled: true
  - Rule Threshold: 80%
  - LLM Model: gemini-2.0-flash

Routing Result:
  Method: rule-based matching
  Agent: debugger
  Confidence: 90%
  Matched Keywords: error, TypeError
  Matched Patterns: \\bTypeError\\b

Note: Rule confidence >= 80%, LLM routing not needed
```

---

## 功能 2：Handoff-as-Tool（移交即工具）

### 2.1 设计理念（对齐 OpenAI）

采用 **OpenAI Agents SDK** 的语义：把移交实现为一种特殊的**工具调用**。

**核心思想**：
- 每个 Agent 运行时，自动注入 `transfer_to_<target>` 工具
- 模型决定何时调用这些工具来完成移交
- 系统拦截工具调用，切换上下文并启动目标 Agent

### 2.2 配置格式

```yaml
---
name: debugger
title: Code Debugger
handoffs:
  - to: code-fixer
    when: manual
    description: "Transfer to code-fixer after identifying the bug"
    include_context: true

  - to: documenter
    when: manual
    description: "Request documentation for the fix"
    include_context: false
---
```

**字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `handoffs[].to` | string | 目标 Agent 名称 |
| `handoffs[].when` | string | `manual`（模型调用）/ `auto`（自动）/ `conditional`（条件，未来） |
| `handoffs[].description` | string | 移交说明（给模型看，帮助决策） |
| `handoffs[].include_context` | boolean | 是否传递完整对话历史（默认 true） |

### 2.3 自动生成 transfer_to_* 工具

```typescript
class HandoffManager {
  /**
   * 为 Agent 自动生成 transfer_to_* 工具
   */
  generateTransferTools(agent: AgentDefinition): ToolDefinition[] {
    if (!agent.handoffs || agent.handoffs.length === 0) {
      return [];
    }

    return agent.handoffs.map((handoff) => ({
      name: `transfer_to_${handoff.to}`,
      description: `${handoff.description}\n\nTarget Agent: ${handoff.to}`,
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Why you are transferring control to this agent',
          },
          context: {
            type: 'string',
            description: 'Key context information to pass along',
          },
          summary: {
            type: 'string',
            description: 'Brief summary of what has been done so far',
          },
        },
        required: ['reason'],
      },
    }));
  }
}
```

### 2.4 Handoff Context（移交上下文）

```typescript
interface HandoffContext {
  // 基本信息
  from_agent: string;
  to_agent: string;
  reason: string;

  // 传递的数据
  context?: string;           // 自由格式上下文
  summary?: string;           // 工作摘要
  payload?: Record<string, any>; // 结构化数据

  // 对话历史（可选）
  conversation_history?: UnifiedMessage[];

  // 元数据
  metadata: {
    timestamp: number;
    handoff_chain: string[];  // 移交链：["user", "debugger", "fixer"]
    chain_depth: number;      // 当前深度
    correlation_id: string;   // 追踪 ID
  };
}
```

### 2.5 上下文注入（对齐 Claude Subagents）

目标 Agent 的系统提示词中注入移交信息：

```typescript
class HandoffManager {
  buildHandoffPrompt(context: HandoffContext): string {
    return `
**HANDOFF CONTEXT**

You are receiving control from Agent: **${context.from_agent}**

**Transfer Reason**:
${context.reason}

${context.summary ? `**Work Summary**:\n${context.summary}\n` : ''}

${context.context ? `**Additional Context**:\n${context.context}\n` : ''}

**Handoff Chain**: ${context.metadata.handoff_chain.join(' → ')}

${context.conversation_history ? this.formatHistory(context.conversation_history) : ''}

**Your Role**: Continue from where the previous agent left off. Use the context
above to understand what has been done and what needs to happen next.
`;
  }
}
```

### 2.6 安全机制

#### 循环检测

```typescript
class HandoffManager {
  private readonly MAX_HANDOFF_DEPTH = 5;

  validateHandoff(context: HandoffContext): void {
    // 1. 检查深度限制
    if (context.metadata.chain_depth >= this.MAX_HANDOFF_DEPTH) {
      throw new HandoffError(
        `Maximum handoff depth (${this.MAX_HANDOFF_DEPTH}) exceeded`,
        'MAX_DEPTH_EXCEEDED'
      );
    }

    // 2. 检查循环引用
    const chain = context.metadata.handoff_chain;
    const occurrences = chain.filter((agent) => agent === context.to_agent).length;

    if (occurrences > 0) {
      throw new HandoffError(
        `Circular handoff detected: ${chain.join(' → ')} → ${context.to_agent}`,
        'CIRCULAR_HANDOFF'
      );
    }
  }
}
```

#### 权限验证

```typescript
class HandoffManager {
  validateHandoffPermission(fromAgent: AgentDefinition, toAgent: string): void {
    // 检查目标是否在 handoffs 白名单中
    const allowedTargets = fromAgent.handoffs?.map((h) => h.to) || [];

    if (!allowedTargets.includes(toAgent)) {
      throw new HandoffError(
        `Agent "${fromAgent.name}" is not allowed to transfer to "${toAgent}"`,
        'PERMISSION_DENIED'
      );
    }
  }
}
```

### 2.7 执行流程

```typescript
class AgentExecutor {
  async execute(
    agentName: string,
    prompt: string,
    handoffContext?: HandoffContext
  ): Promise<ExecutionResult> {
    // 1. 加载 Agent
    const agent = await this.agentManager.getAgent(agentName);

    // 2. 构建运行时（包括 transfer_to_* 工具）
    const transferTools = this.handoffManager.generateTransferTools(agent);
    const runtime = await this.buildRuntime(agent, transferTools, handoffContext);

    // 3. 对话循环
    while (true) {
      const response = await this.modelService.chat(runtime);

      // 4. 检查工具调用
      if (response.tool_calls) {
        for (const toolCall of response.tool_calls) {
          // 5. 拦截 transfer_to_* 工具
          if (toolCall.name.startsWith('transfer_to_')) {
            const targetAgent = toolCall.name.replace('transfer_to_', '');
            const args = JSON.parse(toolCall.arguments);

            // 6. 验证权限
            this.handoffManager.validateHandoffPermission(agent, targetAgent);

            // 7. 构建新的 handoff context
            const newContext = this.handoffManager.createHandoffContext(
              agent.name,
              targetAgent,
              args.reason,
              args.context,
              args.summary,
              handoffContext
            );

            // 8. 验证安全性
            this.handoffManager.validateHandoff(newContext);

            // 9. 记录移交事件
            this.tracer.log('handoff', newContext);

            // 10. 通知用户
            this.notifyHandoff(newContext);

            // 11. 递归执行目标 Agent
            return await this.execute(targetAgent, prompt, newContext);
          }

          // 12. 执行常规工具
          await this.executeTool(toolCall);
        }
      }

      // 13. 检查是否完成
      if (response.finish_reason === 'stop') {
        return { content: response.content, handoffContext };
      }
    }
  }
}
```

---

## 功能 3：Session/State/Memory（会话与记忆）

### 3.1 设计理念（对齐 Google ADK）

采用 **Google ADK** 的三层状态管理：

- **Session**：完整对话历史（持久化）
- **State**：短期任务状态（当前执行的关键字段）
- **Memory**：长期知识（向量检索，可选）

### 3.2 数据结构

```typescript
// Session: 会话历史
interface Session {
  session_id: string;
  user_id?: string;
  created_at: number;
  updated_at: number;

  // 完整消息历史
  messages: UnifiedMessage[];

  // 会话元数据
  metadata: {
    agent_chain: string[];  // Agent 使用历史
    handoff_count: number;  // 移交次数
    total_tokens: number;   // 总 token 消耗
  };
}

// State: 短期状态
interface State {
  // 当前任务状态
  current_task?: string;
  task_status?: 'pending' | 'in_progress' | 'completed' | 'failed';

  // 关键变量（自定义）
  variables: Record<string, any>;

  // 当前 Agent
  current_agent?: string;

  // 最近的操作
  last_action?: {
    type: 'tool_call' | 'handoff' | 'llm_response';
    timestamp: number;
    details: any;
  };
}

// Memory: 长期记忆（可选）
interface Memory {
  type: 'vector' | 'key_value';
  backend: 'local' | 'vertex' | 'pinecone';

  // 向量存储配置
  embedding_model?: string;
  dimension?: number;

  // 检索配置
  top_k?: number;
  similarity_threshold?: number;
}
```

### 3.3 实现：SessionManager

```typescript
class SessionManager {
  private sessions: Map<string, Session> = new Map();

  /**
   * 创建新会话
   */
  createSession(userId?: string): Session {
    const session: Session = {
      session_id: generateId(),
      user_id: userId,
      created_at: Date.now(),
      updated_at: Date.now(),
      messages: [],
      metadata: {
        agent_chain: [],
        handoff_count: 0,
        total_tokens: 0,
      },
    };

    this.sessions.set(session.session_id, session);
    return session;
  }

  /**
   * 添加消息
   */
  addMessage(sessionId: string, message: UnifiedMessage): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    session.messages.push(message);
    session.updated_at = Date.now();
  }

  /**
   * 记录 Agent 使用
   */
  recordAgentUsage(sessionId: string, agentName: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.metadata.agent_chain.push(agentName);
  }

  /**
   * 记录移交
   */
  recordHandoff(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.metadata.handoff_count++;
  }

  /**
   * 持久化到文件（本地实现）
   */
  async persist(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const filePath = path.join(SESSION_DIR, `${sessionId}.json`);
    await fs.writeFile(filePath, JSON.stringify(session, null, 2));
  }

  /**
   * 从文件加载（本地实现）
   */
  async load(sessionId: string): Promise<Session | null> {
    const filePath = path.join(SESSION_DIR, `${sessionId}.json`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const session = JSON.parse(content);
      this.sessions.set(sessionId, session);
      return session;
    } catch {
      return null;
    }
  }

  /**
   * 对接 Vertex AI Sessions（云端实现）
   */
  async syncToVertex(sessionId: string): Promise<void> {
    // TODO: 实现 Vertex AI Agent Engine Sessions 同步
    // 参考：https://cloud.google.com/vertex-ai/docs/agents/sessions
  }
}
```

### 3.4 实现：StateManager

```typescript
class StateManager {
  private state: State = {
    variables: {},
  };

  /**
   * 设置变量
   */
  set(key: string, value: any): void {
    this.state.variables[key] = value;
  }

  /**
   * 获取变量
   */
  get(key: string): any {
    return this.state.variables[key];
  }

  /**
   * 更新任务状态
   */
  updateTaskStatus(status: State['task_status']): void {
    this.state.task_status = status;
  }

  /**
   * 记录最后操作
   */
  recordAction(type: State['last_action']['type'], details: any): void {
    this.state.last_action = {
      type,
      timestamp: Date.now(),
      details,
    };
  }

  /**
   * 快照（用于调试）
   */
  snapshot(): State {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * 清空状态
   */
  clear(): void {
    this.state = { variables: {} };
  }
}
```

### 3.5 实现：MemoryManager（可选，长期记忆）

```typescript
class MemoryManager {
  private config: Memory;

  /**
   * 存储长期记忆
   */
  async store(key: string, content: string, metadata?: Record<string, any>): Promise<void> {
    if (this.config.type === 'vector') {
      // 向量化并存储
      const embedding = await this.generateEmbedding(content);
      await this.vectorStore.upsert(key, embedding, { content, ...metadata });
    } else {
      // Key-value 存储
      await this.kvStore.set(key, content, metadata);
    }
  }

  /**
   * 检索相关记忆
   */
  async retrieve(query: string, topK: number = 5): Promise<Array<{ content: string; score: number }>> {
    if (this.config.type === 'vector') {
      const queryEmbedding = await this.generateEmbedding(query);
      const results = await this.vectorStore.query(queryEmbedding, topK);
      return results;
    } else {
      // 简单文本匹配
      return await this.kvStore.search(query);
    }
  }

  /**
   * 生成嵌入向量
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    // 使用 Gemini Embedding API
    const response = await this.modelService.embed(text, {
      model: 'text-embedding-004',
    });
    return response.embedding;
  }
}
```

---

## 功能 4：护栏与确认

### 4.1 输出校验（Guardrails）- 对齐 OpenAI

参考 **OpenAI Guardrails**，提供 JSON Schema 校验：

```typescript
interface GuardrailConfig {
  // 输出结构校验
  output_schema?: JSONSchema;

  // 失败策略
  on_failure: 'reject' | 'repair' | 'warn';

  // 自定义验证函数
  custom_validator?: (output: any) => { valid: boolean; error?: string };
}
```

**配置示例**：

```yaml
---
name: data-extractor
guardrails:
  output_schema:
    type: object
    properties:
      name:
        type: string
      age:
        type: integer
        minimum: 0
        maximum: 150
      email:
        type: string
        format: email
    required: [name, email]
  on_failure: repair
---
```

**实现**：

```typescript
class GuardrailValidator {
  async validate(output: any, config: GuardrailConfig): Promise<ValidationResult> {
    // 1. JSON Schema 校验
    if (config.output_schema) {
      const ajv = new Ajv();
      const valid = ajv.validate(config.output_schema, output);

      if (!valid) {
        return this.handleFailure(config.on_failure, ajv.errors);
      }
    }

    // 2. 自定义校验
    if (config.custom_validator) {
      const result = config.custom_validator(output);
      if (!result.valid) {
        return this.handleFailure(config.on_failure, result.error);
      }
    }

    return { valid: true, output };
  }

  private async handleFailure(strategy: string, errors: any): Promise<ValidationResult> {
    switch (strategy) {
      case 'reject':
        throw new GuardrailError('Output validation failed', errors);

      case 'repair':
        // 尝试自动修复（调用 LLM）
        const repaired = await this.repair(output, errors);
        return { valid: true, output: repaired, repaired: true };

      case 'warn':
        console.warn('Guardrail validation failed but continuing:', errors);
        return { valid: false, output, warning: errors };
    }
  }
}
```

### 4.2 工具确认（Tool Confirmation）- 对齐 Google ADK

参考 **Google ADK Tool Confirmation**，对高风险操作加人工确认：

```typescript
interface ToolConfirmationConfig {
  // 需要确认的工具列表
  require_confirmation: string[];

  // 确认提示模板
  prompt_template?: string;

  // 超时时间（秒）
  timeout?: number;
}
```

**配置示例**：

```yaml
---
name: system-admin
tools:
  allow:
    - read_file
    - write_file
    - bash

  confirmation:
    require_confirmation:
      - write_file
      - bash
    prompt_template: |
      ⚠️  High-risk operation detected:
      Tool: {tool_name}
      Arguments: {tool_args}

      Do you want to proceed? (yes/no)
    timeout: 30
---
```

**实现**：

```typescript
class ToolConfirmationManager {
  async requestConfirmation(
    toolName: string,
    toolArgs: any,
    config: ToolConfirmationConfig
  ): Promise<boolean> {
    // 检查是否需要确认
    if (!config.require_confirmation.includes(toolName)) {
      return true; // 不需要确认，直接允许
    }

    // 构建提示
    const prompt = this.buildPrompt(toolName, toolArgs, config);

    // 请求用户确认（TTY 输入）
    const answer = await this.promptUser(prompt, config.timeout);

    // 记录决策
    this.tracer.log('tool_confirmation', {
      tool: toolName,
      args: toolArgs,
      approved: answer,
      timestamp: Date.now(),
    });

    return answer;
  }

  private async promptUser(prompt: string, timeout: number = 30): Promise<boolean> {
    console.log(prompt);

    // 设置超时
    const timeoutPromise = new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(false), timeout * 1000)
    );

    // 等待用户输入
    const inputPromise = new Promise<boolean>((resolve) => {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      readline.question('> ', (answer: string) => {
        readline.close();
        resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
      });
    });

    // 竞速
    return await Promise.race([inputPromise, timeoutPromise]);
  }
}
```

---

## 功能 5：可观测性

### 5.1 事件流记录（对齐 OpenAI Tracing）

记录所有关键事件，格式对齐 **OpenAI Tracing** 字段：

```typescript
interface TraceEvent {
  // 基本信息
  event_id: string;
  event_type: 'llm_call' | 'tool_call' | 'handoff' | 'guardrail' | 'route';
  timestamp: number;

  // 上下文
  session_id: string;
  agent_name?: string;
  correlation_id: string; // 跨 Agent 追踪

  // 详细数据
  details: {
    // LLM 调用
    model?: string;
    prompt?: string;
    response?: string;
    tokens?: { input: number; output: number };

    // 工具调用
    tool_name?: string;
    tool_args?: any;
    tool_result?: any;
    tool_error?: string;

    // 移交
    from_agent?: string;
    to_agent?: string;
    handoff_reason?: string;

    // 路由
    routing_method?: 'rule' | 'llm';
    routing_confidence?: number;

    // 护栏
    guardrail_type?: 'output_validation' | 'tool_confirmation';
    guardrail_result?: 'passed' | 'failed' | 'repaired';
  };

  // 性能指标
  duration_ms?: number;
  error?: string;
}
```

### 5.2 实现：Tracer

```typescript
class Tracer {
  private events: TraceEvent[] = [];
  private enabled: boolean = true;

  /**
   * 记录事件
   */
  log(
    eventType: TraceEvent['event_type'],
    details: TraceEvent['details'],
    metadata?: Partial<TraceEvent>
  ): void {
    if (!this.enabled) return;

    const event: TraceEvent = {
      event_id: generateId(),
      event_type: eventType,
      timestamp: Date.now(),
      session_id: this.currentSessionId,
      agent_name: this.currentAgentName,
      correlation_id: this.correlationId,
      details,
      ...metadata,
    };

    this.events.push(event);
  }

  /**
   * 导出事件流（JSON 格式）
   */
  export(): TraceEvent[] {
    return this.events;
  }

  /**
   * 保存到文件
   */
  async save(filePath: string): Promise<void> {
    await fs.writeFile(filePath, JSON.stringify(this.events, null, 2));
  }

  /**
   * 发送到外部观测平台（可选）
   */
  async sendToObservability(endpoint: string): Promise<void> {
    // TODO: 发送到 OpenAI Traces / Datadog / Honeycomb 等
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.events),
    });
  }

  /**
   * 可视化（终端输出）
   */
  visualize(): void {
    console.log('\n📊 Trace Visualization:\n');

    for (const event of this.events) {
      const icon = this.getEventIcon(event.event_type);
      const time = new Date(event.timestamp).toLocaleTimeString();

      console.log(`${icon} [${time}] ${event.event_type}`);

      if (event.agent_name) {
        console.log(`   Agent: ${event.agent_name}`);
      }

      if (event.details.from_agent && event.details.to_agent) {
        console.log(`   ${event.details.from_agent} → ${event.details.to_agent}`);
      }

      if (event.duration_ms) {
        console.log(`   Duration: ${event.duration_ms}ms`);
      }

      console.log('');
    }
  }

  private getEventIcon(type: TraceEvent['event_type']): string {
    const icons = {
      llm_call: '🤖',
      tool_call: '🔧',
      handoff: '🔀',
      guardrail: '🛡️',
      route: '🎯',
    };
    return icons[type] || '📝';
  }
}
```

### 5.3 集成到执行流程

```typescript
class AgentExecutor {
  private tracer: Tracer;

  async execute(agentName: string, prompt: string): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // 记录开始
      this.tracer.log('agent_start', {
        agent_name: agentName,
        prompt,
      });

      // ... 执行逻辑

      // 记录 LLM 调用
      this.tracer.log('llm_call', {
        model: agent.model,
        prompt: constructedPrompt,
        response: llmResponse.content,
        tokens: llmResponse.usage,
      });

      // 记录工具调用
      this.tracer.log('tool_call', {
        tool_name: toolCall.name,
        tool_args: toolCall.arguments,
        tool_result: toolResult,
      });

      // 记录移交
      this.tracer.log('handoff', {
        from_agent: agentName,
        to_agent: targetAgent,
        handoff_reason: reason,
      });

      // 记录完成
      this.tracer.log('agent_complete', {
        agent_name: agentName,
      }, {
        duration_ms: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      // 记录错误
      this.tracer.log('agent_error', {
        agent_name: agentName,
        error: error.message,
      }, {
        duration_ms: Date.now() - startTime,
      });

      throw error;
    }
  }
}
```

---

## 实现细节

### 文件结构

```
packages/core/src/agents/
├── Router.ts                    # 路由器（规则 + LLM）
├── HandoffManager.ts            # 移交管理器
├── SessionManager.ts            # 会话管理器
├── StateManager.ts              # 状态管理器
├── MemoryManager.ts             # 记忆管理器（可选）
├── GuardrailValidator.ts        # 护栏校验器
├── ToolConfirmationManager.ts   # 工具确认管理器
├── Tracer.ts                    # 追踪器
└── types.ts                     # 类型定义（扩展）

packages/cli/src/ui/commands/
├── agentsCommand.ts             # CLI 命令（扩展）
└── routingCommand.ts            # 路由测试命令（新增）
```

### 类型定义扩展

```typescript
// packages/core/src/agents/types.ts

export interface AgentDefinition {
  // ... 现有字段

  // 路由触发器
  triggers?: {
    keywords?: string[];
    patterns?: string[];
    priority?: number;
  };

  // 移交配置
  handoffs?: Array<{
    to: string;
    when: 'manual' | 'auto' | 'conditional';
    description: string;
    include_context?: boolean;
  }>;

  // 护栏配置
  guardrails?: {
    output_schema?: JSONSchema;
    on_failure?: 'reject' | 'repair' | 'warn';
    custom_validator?: string; // 函数名或模块路径
  };

  // 工具确认配置
  tool_confirmation?: {
    require_confirmation?: string[];
    prompt_template?: string;
    timeout?: number;
  };

  // 记忆配置
  memory?: {
    enabled: boolean;
    type?: 'vector' | 'key_value';
    backend?: 'local' | 'vertex' | 'pinecone';
  };
}
```

---

## 实施路线图

### 🎯 P2 Phase 1：核心路由与移交（7-8 天）⭐ 优先实现

这是 P2 的最小可用版本，聚焦在智能路由和 Agent 移交的核心能力上。

#### 阶段 1：智能路由（3-4 天）

**Day 1: 规则路由器**
- [ ] 实现 `RuleRouter.ts`（关键词 + 正则匹配）
- [ ] 计算得分与置信度
- [ ] 单元测试（10+ 用例）

**Day 2: LLM 路由器**
- [ ] 实现 `LLMRouter.ts`（自动生成 transfer_to_* 工具）
- [ ] 创建 router-agent 模板
- [ ] 模型调用与工具解析
- [ ] 单元测试（5+ 用例）

**Day 3: 混合路由 + CLI**
- [ ] 实现 `HybridRouter.ts`（规则优先，LLM 兜底）
- [ ] 添加 `/agents route` 命令（测试路由）
- [ ] 添加 `@auto` 语法糖（自动路由执行）
- [ ] CLI 显示路由结果

**Day 4: 测试与优化**
- [ ] 集成测试（完整路由流程）
- [ ] 性能优化（缓存、并行）
- [ ] 基础日志输出
- [ ] 用户文档更新

**交付物**：
- ✅ 规则路由可用（关键词 + 正则）
- ✅ LLM 智能路由可用
- ✅ 混合策略自动切换
- ✅ `/agents route` 和 `@auto` 命令

---

#### 阶段 2：Handoff-as-Tool（4-5 天）

**Day 1-2: HandoffManager 核心**
- [ ] 实现 `HandoffManager.ts`
- [ ] 自动生成 `transfer_to_*` 工具
- [ ] 实现 `HandoffContext` 数据结构
- [ ] 循环检测算法
- [ ] 深度限制机制
- [ ] 权限验证
- [ ] 单元测试（15+ 用例）

**Day 3: AgentExecutor 集成**
- [ ] 修改 `AgentExecutor.execute()`
- [ ] 工具调用拦截（检测 `transfer_to_*`）
- [ ] 递归执行目标 Agent
- [ ] 上下文传递与注入
- [ ] 简单的移交日志

**Day 4: 用户体验**
- [ ] 移交通知显示（终端输出）
- [ ] 添加 `/agents handoff-chain` 命令
- [ ] 用户中断支持（Ctrl+C）
- [ ] 错误处理与提示

**Day 5: 测试与文档**
- [ ] 完整集成测试（多 Agent 链路）
- [ ] E2E 场景测试
- [ ] 循环检测测试
- [ ] 深度限制测试
- [ ] 用户文档 + 开发者文档

**交付物**：
- ✅ `transfer_to_*` 工具自动生成
- ✅ Agent 间移交可用
- ✅ 移交上下文正确传递
- ✅ 安全机制生效（循环检测 + 深度限制）
- ✅ 移交链可视化

---

#### 阶段 3：基础集成与优化（1 天）

**Day 1: 完整流程打通**
- [ ] 路由 + 移交完整链路测试
- [ ] 性能调优
- [ ] 错误场景处理
- [ ] 文档完善

**交付物**：
- ✅ 完整的路由到移交工作流
- ✅ 生产就绪的代码质量

---

### 📊 Phase 1 验收标准

#### 智能路由
- [ ] 规则路由准确率 > 90%（关键词 + 正则）
- [ ] LLM 路由支持完整
- [ ] 混合路由延迟 < 100ms（规则）/ < 2s（LLM）
- [ ] `/agents route` 命令可用
- [ ] `@auto` 语法可用

#### Handoff-as-Tool
- [ ] `transfer_to_*` 工具自动生成
- [ ] 移交上下文完整传递
- [ ] 循环检测 100% 生效
- [ ] 深度限制 100% 生效
- [ ] 移交链可视化
- [ ] 用户可中断

---

### 🔄 P2 Phase 2：增强特性（未来迭代，延后实现）

以下功能在 Phase 1 稳定后再考虑实现：

#### Session/State/Memory（3-4 天）- 延后
- **价值**：长期对话记忆、状态持久化
- **依赖**：Phase 1 完成
- **优先级**：中
- **说明**：当前可以用 P1 的 ContextManager 临时替代

#### Guardrails（2-3 天）- 延后
- **价值**：输出结构校验、自动修复
- **依赖**：Phase 1 完成
- **优先级**：中低
- **说明**：可以先用工具白名单替代部分功能

#### Tool Confirmation（1-2 天）- 延后
- **价值**：高风险操作人工确认
- **依赖**：Phase 1 完成
- **优先级**：中低
- **说明**：P1 已有工具白名单，可以部分替代

#### Tracing（2-3 天）- 延后
- **价值**：完整的可观测性
- **依赖**：Phase 1 完成
- **优先级**：低
- **说明**：Phase 1 可以用简单的日志输出替代

---

### 总计（Phase 1）：7-8 天 ⭐

**核心交付**：
1. 智能路由（规则 + LLM + 混合）
2. Handoff-as-Tool（完整的 Agent 移交）
3. 基础的日志与错误处理

**暂不实现**（Phase 2）：
- Session/State/Memory
- Guardrails
- Tool Confirmation
- Tracing

**理由**：
- Phase 1 已经能提供完整的路由与移交能力
- Session/State/Memory 可以用 P1 的 ContextManager 临时替代
- Guardrails/Confirmation 可以用工具白名单部分替代
- Tracing 可以用简单日志替代
- 先验证核心功能的用户价值，再投入增强特性


---

## 使用示例

### 示例 1：智能路由 + LLM 决策

```yaml
# .gemini/agents/router-agent.md
---
name: router-agent
title: Routing Coordinator
model: gemini-2.0-flash
scope: system
---

You are a routing coordinator. Analyze user requests and transfer to the most
appropriate specialized agent using the transfer_to_* tools available to you.
```

```bash
# 用户输入（不指定 Agent）
User: "这个 TypeError 怎么解决？Cannot read property 'x'"

# 系统自动路由
[System] 🎯 Routing via LLM to: debugger (95% confidence)

Debugger: 这是一个 TypeError...
```

### 示例 2：完整移交链

```yaml
# debugger.md
---
name: debugger
handoffs:
  - to: code-fixer
    when: manual
    description: "Transfer to fixer after identifying the bug"
---

# code-fixer.md
---
name: code-fixer
handoffs:
  - to: reviewer
    when: manual
    description: "Transfer to reviewer after fixing"
---

# reviewer.md
---
name: reviewer
# 无 handoffs，终点
---
```

```bash
User: @debugger "分析并修复这个 bug"

Debugger: 我找到了问题：src/utils.ts:42 空指针引用

          [调用 transfer_to_code_fixer 工具]

          🔀 Transferring to: code-fixer
          Reason: Bug identified at line 42

Code-fixer: 收到移交任务。正在修复...

            [修复代码...]

            修复完成！现在转给 reviewer 审查。

            [调用 transfer_to_reviewer 工具]

            🔀 Transferring to: reviewer

Reviewer: 代码审查完成 ✅
          修复方案合理，测试通过。
```

### 示例 3：护栏与确认

```yaml
---
name: system-admin
tools:
  allow: [read_file, write_file, bash]
  confirmation:
    require_confirmation: [write_file, bash]

guardrails:
  output_schema:
    type: object
    properties:
      status:
        type: string
        enum: [success, error]
      message:
        type: string
    required: [status, message]
  on_failure: reject
---
```

```bash
User: @system-admin "删除所有日志文件"

System-admin: 我需要执行 bash 命令来删除日志文件。

[System] ⚠️  High-risk operation detected:
         Tool: bash
         Command: rm -rf /var/log/*.log

         Do you want to proceed? (yes/no)

User: no

[System] ❌ Operation cancelled by user.

System-admin: 用户取消了操作。
```

### 示例 4：追踪可视化

```bash
# 查看追踪
/agents trace

# 输出
📊 Trace Visualization:

🎯 [10:30:15] route
   Method: llm
   Agent: debugger
   Confidence: 95%

🤖 [10:30:16] llm_call
   Agent: debugger
   Model: gemini-2.0-flash
   Tokens: { input: 120, output: 250 }
   Duration: 1200ms

🔧 [10:30:18] tool_call
   Agent: debugger
   Tool: read_file
   Duration: 50ms

🔀 [10:30:20] handoff
   From: debugger
   To: code-fixer
   Reason: Bug identified

🤖 [10:30:21] llm_call
   Agent: code-fixer
   Model: gemini-2.0-flash
   Tokens: { input: 300, output: 180 }
   Duration: 1500ms

✅ [10:30:23] agent_complete
   Agent: code-fixer
   Total Duration: 8000ms
```

---

## 总结

### 核心亮点

1. **对齐业界方案**
   - **Handoff-as-Tool**（OpenAI Agents SDK 语义）
   - **Session/State/Memory**（Google ADK 三层状态）
   - **Guardrails + Tool Confirmation**（OpenAI + Google ADK）
   - **Tracing**（OpenAI 格式）

2. **渐进式演进**
   - 路由：规则 → LLM → 混合
   - 状态：本地 → Vertex Sessions
   - 记忆：Key-value → 向量检索

3. **安全可靠**
   - 循环检测 + 深度限制
   - 工具白名单 + 风险确认
   - 输出校验 + 失败修复

4. **可观测性**
   - 完整事件流记录
   - 对齐 OpenAI Tracing 格式
   - 可视化 + 导出

### 预期效果

- **路由准确率**: > 90%（规则）/ > 95%（LLM）
- **移交成功率**: > 95%
- **路由延迟**: < 100ms（规则）/ < 2s（LLM）
- **用户满意度**: 显著提升

---

**文档版本**: 2.0（对齐业界方案）
**创建日期**: 2025-10-07
**预计开始**: Week 7（P2 阶段）
**预计工期**: 12-16 天
**前置依赖**: P1 完成（✅ 已完成）

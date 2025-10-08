# P2 Phase 1 实施指南：路由与移交

> **状态**: ✅ 类型定义已完成 | 🚧 代码实现进行中
> **预计工期**: 7-8 天

---

## ✅ 已完成

### 1. 类型定义扩展（packages/core/src/agents/types.ts）

已添加以下类型：

- ✅ `RoutingConfig` - 路由配置接口
- ✅ `RoutingScore` - 路由评分结果
- ✅ `HandoffConfig` - 移交配置
- ✅ `HandoffContext` - 移交上下文
- ✅ `HandoffError` - 移交错误类
- ✅ `AgentDefinition.triggers` - Agent 路由触发器字段
- ✅ `AgentDefinition.handoffs` - Agent 移交配置字段
- ✅ `AgentFrontMatter` - 同步更新 front-matter 类型

---

## 🚧 待实施文件清单

### 阶段 1：智能路由（3-4 天）

#### Day 1: 规则路由器

**文件**: `packages/core/src/agents/RuleRouter.ts`

```typescript
/**
 * @license
 * Copyright 2025 Gemini CLI
 * SPDX-License-Identifier: MIT
 */

import type { AgentDefinition, AgentManager, RoutingScore } from './types.js';

export class RuleRouter {
  constructor(private agentManager: AgentManager) {}

  /**
   * 规则路由：基于关键词和正则匹配
   */
  async route(userInput: string): Promise<RoutingScore | null> {
    const agents = await this.agentManager.listAgents();
    const scores: RoutingScore[] = [];

    for (const agent of agents) {
      const agentDef = await this.agentManager.getAgent(agent.name);
      if (!agentDef?.triggers) continue;

      const score = this.calculateScore(agentDef, userInput);
      if (score.score > 0) {
        scores.push(score);
      }
    }

    // 按得分降序排序
    scores.sort((a, b) => b.score - a.score);

    return scores[0] || null;
  }

  /**
   * 计算匹配得分
   */
  private calculateScore(agent: AgentDefinition, input: string): RoutingScore {
    const matchedKeywords: string[] = [];
    const matchedPatterns: string[] = [];
    let score = 0;

    // 1. 关键词匹配 (+10 分/个)
    for (const keyword of agent.triggers?.keywords || []) {
      if (input.toLowerCase().includes(keyword.toLowerCase())) {
        score += 10;
        matchedKeywords.push(keyword);
      }
    }

    // 2. 正则匹配 (+20 分/个)
    for (const pattern of agent.triggers?.patterns || []) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(input)) {
          score += 20;
          matchedPatterns.push(pattern);
        }
      } catch (e) {
        // 忽略无效正则
      }
    }

    // 3. 应用优先级权重
    const priority = agent.triggers?.priority || 50;
    score = Math.round(score * (priority / 100));

    // 4. 计算置信度
    const confidence = Math.min(100, score);

    return {
      agent,
      score,
      confidence,
      matchedKeywords,
      matchedPatterns,
    };
  }
}
```

**测试文件**: `packages/core/src/agents/RuleRouter.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { RuleRouter } from './RuleRouter.js';

describe('RuleRouter', () => {
  let router: RuleRouter;

  beforeEach(() => {
    // Setup mock AgentManager
  });

  it('should match keywords case-insensitively', async () => {
    // Test implementation
  });

  it('should match regex patterns', async () => {
    // Test implementation
  });

  it('should apply priority weight', async () => {
    // Test implementation
  });

  it('should return null when no match', async () => {
    // Test implementation
  });
});
```

---

#### Day 2: LLM 路由器

**文件**: `packages/core/src/agents/LLMRouter.ts`

```typescript
/**
 * @license
 * Copyright 2025 Gemini CLI
 * SPDX-License-Identifier: MIT
 */

import type { AgentDefinition, AgentManager, RoutingConfig } from './types.js';

export class LLMRouter {
  constructor(
    private agentManager: AgentManager,
    private config: RoutingConfig['llm']
  ) {}

  /**
   * LLM 路由：使用模型智能决策
   */
  async route(userInput: string, availableAgents: AgentDefinition[]): Promise<string | null> {
    // 1. 生成所有 transfer_to_* 工具
    const transferTools = this.generateTransferTools(availableAgents);

    // 2. 构建路由器 Agent 的系统提示词
    const systemPrompt = this.buildRouterPrompt(availableAgents);

    // 3. 调用模型获取路由决策
    const result = await this.callModel(systemPrompt, userInput, transferTools);

    // 4. 解析工具调用，提取目标 Agent
    return this.extractTargetAgent(result);
  }

  private generateTransferTools(agents: AgentDefinition[]) {
    return agents.map((agent) => ({
      name: `transfer_to_${agent.name}`,
      description: `Transfer to ${agent.title}: ${agent.description}`,
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Why you are transferring to this agent',
          },
        },
        required: ['reason'],
      },
    }));
  }

  private buildRouterPrompt(agents: AgentDefinition[]): string {
    const agentList = agents
      .map((a) => `  - ${a.name}: ${a.description}`)
      .join('\n');

    return `You are a routing coordinator. Your job is to analyze user requests and transfer them to the most appropriate specialized agent.

Available agents:
${agentList}

Analyze the user's request carefully and use the appropriate transfer_to_* tool to route the request.`;
  }

  private async callModel(systemPrompt: string, userInput: string, tools: any[]): Promise<any> {
    // TODO: 实现模型调用
    // 使用 config.model 和 config.timeout
    throw new Error('Not implemented');
  }

  private extractTargetAgent(result: any): string | null {
    // TODO: 解析模型返回的工具调用
    throw new Error('Not implemented');
  }
}
```

---

#### Day 3: 混合路由器与主路由器

**文件**: `packages/core/src/agents/HybridRouter.ts`

```typescript
import type { RuleRouter } from './RuleRouter.js';
import type { LLMRouter } from './LLMRouter.js';
import type { RoutingConfig } from './types.js';

export class HybridRouter {
  constructor(
    private ruleRouter: RuleRouter,
    private llmRouter: LLMRouter,
    private config: RoutingConfig
  ) {}

  async route(userInput: string): Promise<string | null> {
    // 1. 先尝试规则路由
    const ruleResult = await this.ruleRouter.route(userInput);

    // 2. 如果置信度 >= 阈值，直接使用
    const threshold = this.config.rule.confidence_threshold;

    if (ruleResult && ruleResult.confidence >= threshold) {
      console.log(
        `🎯 Routing via rule-match to: ${ruleResult.agent.name} (${ruleResult.confidence}% confidence)`
      );
      return ruleResult.agent.name;
    }

    // 3. 否则降级到 LLM 路由
    console.log(
      `🤖 Rule confidence too low (${ruleResult?.confidence || 0}%), using LLM routing...`
    );

    const agents = await this.agentManager.listAgents();
    const llmResult = await this.llmRouter.route(userInput, agents);

    console.log(`🎯 Routing via LLM to: ${llmResult}`);

    return llmResult;
  }
}
```

**文件**: `packages/core/src/agents/Router.ts`

```typescript
/**
 * @license
 * Copyright 2025 Gemini CLI
 * SPDX-License-Identifier: MIT
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import type { AgentManager, RoutingConfig } from './types.js';
import { RuleRouter } from './RuleRouter.js';
import { LLMRouter } from './LLMRouter.js';
import { HybridRouter } from './HybridRouter.js';

export class Router {
  private ruleRouter: RuleRouter;
  private llmRouter: LLMRouter;
  private hybridRouter: HybridRouter;
  private config: RoutingConfig;

  constructor(
    private agentManager: AgentManager,
    configOverride?: Partial<RoutingConfig>
  ) {
    this.config = this.loadConfig(configOverride);

    this.ruleRouter = new RuleRouter(agentManager);
    this.llmRouter = new LLMRouter(agentManager, this.config.llm);
    this.hybridRouter = new HybridRouter(
      this.ruleRouter,
      this.llmRouter,
      this.config
    );
  }

  /**
   * 路由入口
   */
  async route(
    userInput: string,
    strategyOverride?: 'rule' | 'llm' | 'hybrid'
  ): Promise<string | null> {
    // 1. 检查路由是否启用
    if (!this.config.enabled) {
      console.log('⚠️  Routing is disabled');
      return null;
    }

    // 2. 选择策略
    const strategy = strategyOverride || this.config.strategy;

    // 3. 执行路由
    try {
      let result: string | null = null;

      switch (strategy) {
        case 'rule':
          const ruleResult = await this.ruleRouter.route(userInput);
          result = ruleResult?.agent.name || null;
          break;

        case 'llm':
          const agents = await this.agentManager.listAgents();
          result = await this.llmRouter.route(userInput, agents);
          break;

        case 'hybrid':
          result = await this.hybridRouter.route(userInput);
          break;
      }

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
   * 加载配置（多层级优先级）
   */
  private loadConfig(override?: Partial<RoutingConfig>): RoutingConfig {
    const defaultConfig: RoutingConfig = {
      enabled: true,
      strategy: 'hybrid',
      rule: { confidence_threshold: 80 },
      llm: { model: 'gemini-2.0-flash', timeout: 5000 },
      fallback: 'prompt_user',
    };

    // TODO: 加载全局配置、项目配置、环境变量
    // 优先级: override > env > project > global > default

    return { ...defaultConfig, ...override };
  }

  private handleNoMatch(userInput: string): null {
    switch (this.config.fallback) {
      case 'none':
        console.log('⚠️  No agent matched');
        return null;

      case 'prompt_user':
        console.log('\n⚠️  No agent matched. Please specify manually.');
        return null;

      default:
        return null;
    }
  }
}
```

---

### 阶段 2：Agent 移交（4-5 天）

#### Day 1-2: HandoffManager 核心

**文件**: `packages/core/src/agents/HandoffManager.ts`

```typescript
/**
 * @license
 * Copyright 2025 Gemini CLI
 * SPDX-License-Identifier: MIT
 */

import type {
  AgentDefinition,
  AgentManager,
  ContextManager,
  HandoffContext,
  HandoffError,
} from './types.js';

export class HandoffManager {
  private readonly MAX_HANDOFF_DEPTH = 5;

  constructor(
    private agentManager: AgentManager,
    private contextManager: ContextManager
  ) {}

  /**
   * 为 Agent 生成 transfer_to_* 工具
   */
  generateTransferTools(agent: AgentDefinition) {
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
            description: 'Why you are transferring control',
          },
          context: {
            type: 'string',
            description: 'Key context to pass along',
          },
          summary: {
            type: 'string',
            description: 'Brief summary of work done',
          },
        },
        required: ['reason'],
      },
    }));
  }

  /**
   * 执行移交
   */
  async executeHandoff(
    fromAgent: string,
    toAgentName: string,
    reason: string,
    contextInfo?: string,
    summary?: string,
    currentChain: string[] = []
  ): Promise<HandoffContext> {
    // 1. 验证目标 Agent 存在
    const toAgent = await this.agentManager.getAgent(toAgentName);
    if (!toAgent) {
      throw new HandoffError(
        `Target agent "${toAgentName}" not found`,
        'AGENT_NOT_FOUND'
      );
    }

    // 2. 构建移交链
    const handoffChain = [...currentChain, toAgentName];

    // 3. 验证安全性
    this.validateHandoffChain(handoffChain);

    // 4. 构建移交上下文
    const handoffContext: HandoffContext = {
      from_agent: fromAgent,
      to_agent: toAgentName,
      reason,
      context: contextInfo,
      summary,
      conversation_history: this.getRelevantHistory(fromAgent),
      metadata: {
        timestamp: Date.now(),
        handoff_chain: handoffChain,
        chain_depth: handoffChain.length,
        correlation_id: this.generateCorrelationId(),
      },
    };

    return handoffContext;
  }

  /**
   * 验证移交链
   */
  private validateHandoffChain(chain: string[]): void {
    // 检查深度
    if (chain.length > this.MAX_HANDOFF_DEPTH) {
      throw new HandoffError(
        `Maximum handoff depth (${this.MAX_HANDOFF_DEPTH}) exceeded`,
        'MAX_DEPTH_EXCEEDED'
      );
    }

    // 检查循环
    const uniqueAgents = new Set(chain);
    if (uniqueAgents.size < chain.length) {
      throw new HandoffError(
        `Circular handoff detected: ${chain.join(' → ')}`,
        'CIRCULAR_HANDOFF'
      );
    }
  }

  /**
   * 构建移交提示词（注入到目标 Agent）
   */
  buildHandoffPrompt(context: HandoffContext): string {
    return `
**HANDOFF CONTEXT**

You are receiving control from Agent: **${context.from_agent}**

**Transfer Reason**:
${context.reason}

${context.summary ? `**Work Summary**:\n${context.summary}\n` : ''}

${context.context ? `**Additional Context**:\n${context.context}\n` : ''}

**Handoff Chain**: ${context.metadata.handoff_chain.join(' → ')}

**Your Role**: Continue from where the previous agent left off.
`;
  }

  private getRelevantHistory(agentName: string) {
    const context = this.contextManager.getContext(agentName, 'isolated');
    return context.conversationHistory.slice(-10); // 最近 10 条
  }

  private generateCorrelationId(): string {
    return `handoff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

---

#### Day 3: AgentExecutor 集成

**文件**: 修改 `packages/core/src/agents/AgentExecutor.ts`

需要集成的关键点：

1. 在执行前注入 `transfer_to_*` 工具
2. 拦截工具调用，检测 `transfer_to_*`
3. 调用 HandoffManager 创建移交上下文
4. 递归执行目标 Agent
5. 注入移交提示词到系统提示

```typescript
// 伪代码示例
class AgentExecutor {
  private router: Router;
  private handoffManager: HandoffManager;

  async execute(
    agentName: string,
    prompt: string,
    handoffContext?: HandoffContext
  ) {
    // 1. 加载 Agent
    const agent = await this.agentManager.getAgent(agentName);

    // 2. 生成 transfer_to_* 工具
    const transferTools = this.handoffManager.generateTransferTools(agent);

    // 3. 构建系统提示词（注入移交上下文）
    let systemPrompt = agent.systemPrompt;
    if (handoffContext) {
      systemPrompt += '\n\n' + this.handoffManager.buildHandoffPrompt(handoffContext);
    }

    // 4. 对话循环
    while (true) {
      const response = await this.callModel(systemPrompt, prompt, transferTools);

      // 5. 检查工具调用
      if (response.tool_calls) {
        for (const toolCall of response.tool_calls) {
          // 拦截 transfer_to_*
          if (toolCall.name.startsWith('transfer_to_')) {
            const targetAgent = toolCall.name.replace('transfer_to_', '');
            const args = JSON.parse(toolCall.arguments);

            // 创建移交上下文
            const newContext = await this.handoffManager.executeHandoff(
              agent.name,
              targetAgent,
              args.reason,
              args.context,
              args.summary,
              handoffContext?.metadata.handoff_chain || [agent.name]
            );

            // 通知用户
            console.log(`\n🔀 Transferring: ${agent.name} → ${targetAgent}`);
            console.log(`   Reason: ${args.reason}\n`);

            // 递归执行目标 Agent
            return await this.execute(targetAgent, prompt, newContext);
          }

          // 执行常规工具
          await this.executeTool(toolCall);
        }
      }

      // 检查是否完成
      if (response.finish_reason === 'stop') {
        return response;
      }
    }
  }
}
```

---

### 阶段 3：CLI 命令（1-2 天）

**文件**: 修改 `packages/cli/src/ui/commands/agentsCommand.ts`

添加以下命令：

1. `/agents route <prompt>` - 测试路由（不执行）
2. `/agents config routing` - 查看配置
3. `/agents config routing.enabled true/false` - 修改配置
4. `@auto <prompt>` - 自动路由并执行

---

## 📊 实施检查清单

### Day 1-2
- [ ] RuleRouter.ts 实现
- [ ] RuleRouter.test.ts 编写
- [ ] 单元测试通过（10+ 用例）

### Day 3-4
- [ ] LLMRouter.ts 实现
- [ ] HybridRouter.ts 实现
- [ ] Router.ts 主类实现
- [ ] 配置加载逻辑完成

### Day 5-6
- [ ] HandoffManager.ts 实现
- [ ] HandoffManager.test.ts 编写
- [ ] 单元测试通过（15+ 用例）

### Day 7
- [ ] AgentExecutor 集成完成
- [ ] CLI 命令添加完成

### Day 8
- [ ] 集成测试编写与通过
- [ ] 文档更新
- [ ] 示例创建

---

## 🎯 验收标准

### 功能验收
- [ ] 规则路由准确率 > 90%
- [ ] LLM 路由可用
- [ ] 混合路由正确降级
- [ ] 移交工具自动生成
- [ ] 循环检测 100% 生效
- [ ] 深度限制 100% 生效

### 性能验收
- [ ] 规则路由延迟 < 10ms
- [ ] LLM 路由延迟 < 3s
- [ ] 移交延迟 < 100ms

### 用户体验验收
- [ ] 路由通知清晰
- [ ] 移交通知清晰
- [ ] 配置修改生效
- [ ] 错误提示友好

---

## 📝 下一步行动

1. **立即开始**：实现 RuleRouter.ts
2. **Day 2**：实现 LLMRouter.ts
3. **Day 3-4**：实现 Router 主类和混合路由
4. **Day 5-6**：实现 HandoffManager
5. **Day 7-8**：集成、测试、文档

---

**状态更新**: 类型定义已完成 ✅
**下一步**: 开始实现 RuleRouter.ts

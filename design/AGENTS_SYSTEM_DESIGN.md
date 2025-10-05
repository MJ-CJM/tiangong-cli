# Agents 系统设计文档

> **状态**: 📝 设计中 | **版本**: 1.0 | **日期**: 2025-10-04

## 目录

- [1. 概述](#1-概述)
- [2. 设计目标](#2-设计目标)
- [3. P1: 基础版设计](#3-p1-基础版设计)
- [4. P2: 扩展版设计](#4-p2-扩展版设计)
- [5. 技术架构](#5-技术架构)
- [6. 实施计划](#6-实施计划)
- [7. 风险与缓解](#7-风险与缓解)

---

## 1. 概述

### 1.1 背景

本设计旨在为 Gemini CLI 添加 **多 Agent 系统**，对齐以下业界标准：

- **Claude Code Subagents**: 专用系统提示 + 工具集 + 独立上下文
- **OpenAI Agents SDK**: Guardrails、Tracing、Sessions 管理
- **LangGraph**: Handoffs、图编排、检查点与回放
- **MCP (Model Context Protocol)**: 统一工具/数据/提示接入标准

### 1.2 核心价值

1. **专业化分工**: 不同 Agent 专注不同任务（调试、代码审查、文档生成等）
2. **独立上下文**: 避免上下文混乱，每个 Agent 维护独立对话历史
3. **工具隔离**: 基于最小权限原则，每个 Agent 只能访问必要工具
4. **可观测性**: 完整的事件追踪，便于调试和优化
5. **可编排性**: 支持多 Agent 协作、自动路由和任务移交

### 1.3 分阶段策略

- **P1 (基础版)**: 对齐 Claude Code Subagents，实现单 Agent 完整闭环
- **P2 (扩展版)**: 对齐 OpenAI/LangGraph，实现多 Agent 编排与治理

---

## 2. 设计目标

### 2.1 功能目标

#### P1 目标（必须）
- ✅ 文件式 Agent 定义（Markdown + YAML front-matter）
- ✅ CLI 管理命令（create/list/run/edit/delete/validate）
- ✅ 独立上下文管理
- ✅ 工具白名单控制
- ✅ MCP 集成

#### P2 目标（渐进）
- 🎯 自动路由（基于 triggers）
- 🎯 跨 Agent 移交（handoffs）
- 🎯 输出校验（guardrails）
- 🎯 状态记忆（memory）
- 🎯 图编排（graph）
- 🎯 可观测性（tracing）

### 2.2 非功能目标

- **安全性**: 最小权限、工具白名单、用户确认机制
- **兼容性**: 与 OpenAI Agents/LangGraph 语义对齐
- **可维护性**: 模块化设计，易于扩展
- **性能**: Agent 切换延迟 < 100ms，上下文隔离无泄漏

---

## 3. P1: 基础版设计

### 3.1 Agent 定义格式

#### 3.1.1 文件结构

```markdown
---
kind: agent
name: debug-analyzer
title: Debug Analyzer
description: Specialized in analyzing and fixing bugs
model: gemini-2.5-pro
color: "#FF5733"
scope: project
version: 1.0.0
tools:
  allow:
    - mcp.github.list_pull_requests
    - read_many_files
    - grep
    - bash
  deny:
    - write_file
    - delete_file
mcp:
  servers:
    - github
    - linear
---

# Role

You are a specialized debugging agent. Your primary responsibilities:

1. Analyze error logs and stack traces
2. Identify root causes of bugs
3. Suggest fixes with code examples
4. Verify fixes don't introduce regressions

## Guidelines

- Always read relevant files before suggesting fixes
- Use MCP GitHub integration to check related PRs
- Explain your reasoning step by step
- Test your hypotheses with grep/bash when needed

## Constraints

- Do NOT modify files directly (read-only)
- Do NOT make assumptions without evidence
- Always cite line numbers when referencing code
```

#### 3.1.2 Front-matter 字段规范

| 字段 | 类型 | 必需 | 说明 | 示例 |
|------|------|------|------|------|
| `kind` | string | ✅ | 固定为 "agent" | `agent` |
| `name` | string | ✅ | Agent 唯一标识符（kebab-case） | `debug-analyzer` |
| `title` | string | ✅ | 显示名称 | `Debug Analyzer` |
| `description` | string | ⚪ | 简短描述 | `Specialized in...` |
| `model` | string | ⚪ | 使用的模型（默认继承全局） | `gemini-2.5-pro` |
| `color` | string | ⚪ | UI 显示颜色 | `#FF5733` |
| `scope` | enum | ⚪ | `global`/`project` | `project` |
| `version` | string | ⚪ | 版本号 | `1.0.0` |
| `tools.allow` | array | ⚪ | 白名单工具列表 | `[read_file, grep]` |
| `tools.deny` | array | ⚪ | 黑名单工具列表（优先级高于 allow） | `[write_file]` |
| `mcp.servers` | array | ⚪ | 使用的 MCP 服务器名称 | `[github, linear]` |

#### 3.1.3 文件位置

```
~/.gemini/agents/           # 全局 Agent
  ├── debug-analyzer.md
  ├── code-reviewer.md
  └── doc-generator.md

.gemini/agents/             # 项目级 Agent
  ├── project-specific.md
  └── domain-expert.md
```

**加载优先级**: 项目级 > 全局级（同名时项目级覆盖）

### 3.2 CLI 命令设计

#### 3.2.1 命令概览

```bash
# 创建
gemini agents create [<name>] [--template <type>] [--global]

# 列表
gemini agents list [--scope global|project|all] [--format table|json]

# 运行
gemini agents run <agent-name> [--prompt "<prompt>"] [--interactive]

# 编辑
gemini agents edit <agent-name>

# 删除
gemini agents delete <agent-name> [--scope global|project]

# 校验
gemini agents validate [<agent-name>|--all]
```

#### 3.2.2 `agents create` 详细设计

**交互式模式**:

```bash
$ gemini agents create

✦ Create New Agent

Name (kebab-case): debug-analyzer
Title: Debug Analyzer
Description (optional): Specialized in analyzing and fixing bugs
Model (default: gemini-2.5-pro):
Scope (project/global): project

🔧 Tools Configuration

Select allowed tools (space to select, enter to confirm):
  [x] read_file
  [x] read_many_files
  [x] grep
  [x] bash
  [ ] write_file
  [ ] edit_file
  [ ] delete_file

🔌 MCP Servers

Available MCP servers:
  [x] github
  [ ] linear
  [ ] jira

✅ Agent created: .gemini/agents/debug-analyzer.md

Next steps:
  - Edit the system prompt: gemini agents edit debug-analyzer
  - Run the agent: gemini agents run debug-analyzer -p "Debug this error"
```

**参数式模式**:

```bash
gemini agents create debug-analyzer \
  --title "Debug Analyzer" \
  --model gemini-2.5-pro \
  --tools read_file,grep,bash \
  --mcp github \
  --scope project
```

**模板支持**:

```bash
gemini agents create reviewer --template code-review
gemini agents create docs --template documentation
gemini agents create test --template test-generator
```

#### 3.2.3 `agents list` 输出示例

```bash
$ gemini agents list

📋 Available Agents

Global Agents:
  • code-reviewer        Code Review Specialist          gemini-2.5-pro
  • doc-generator        Documentation Generator         gemini-2.0-flash

Project Agents:
  • debug-analyzer       Debug Analyzer                  gemini-2.5-pro
  • security-auditor     Security Auditor                claude-3.5-sonnet

Use 'gemini agents run <name>' to execute an agent
```

#### 3.2.4 `agents run` 执行流程

```bash
# 单次执行
$ gemini agents run debug-analyzer -p "Why is this test failing?"

🤖 Debug Analyzer

Analyzing the test failure...

[Agent 执行过程，工具调用等]

Summary: The test fails because...

# 交互式会话
$ gemini agents run debug-analyzer --interactive

🤖 Debug Analyzer (Interactive Mode)
Type 'exit' to quit, 'context' to view conversation history

You: Why is this test failing?
Agent: Let me investigate...

[持续对话，维护独立上下文]
```

#### 3.2.5 `agents validate` 校验规则

```bash
$ gemini agents validate debug-analyzer

✓ Front-matter valid
✓ Required fields present
✓ Model 'gemini-2.5-pro' exists
✓ Tools [read_file, grep, bash] available
✗ MCP server 'unknown-server' not configured
✓ System prompt not empty

Validation: 5/6 passed
```

**校验项**:
- ✅ YAML front-matter 格式正确
- ✅ 必需字段存在且类型正确
- ✅ `model` 在可用模型列表中
- ✅ `tools.allow/deny` 中的工具都存在
- ✅ `mcp.servers` 中的服务器已配置
- ✅ 系统提示（正文）非空

### 3.3 运行时架构

#### 3.3.1 核心类设计

```typescript
// packages/core/src/agents/types.ts

export interface AgentDefinition {
  // Front-matter
  kind: 'agent';
  name: string;
  title: string;
  description?: string;
  model?: string;
  color?: string;
  scope?: 'global' | 'project';
  version?: string;
  tools?: {
    allow?: string[];
    deny?: string[];
  };
  mcp?: {
    servers?: string[];
  };

  // System prompt (body)
  systemPrompt: string;

  // Metadata
  filePath: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentContext {
  agentName: string;
  conversationHistory: UnifiedMessage[];
  metadata: Record<string, any>;
  startedAt: Date;
  lastActiveAt: Date;
}

export interface AgentRuntime {
  definition: AgentDefinition;
  context: AgentContext;
  modelClient: BaseModelClient;
  toolRegistry: ToolRegistry;
  mcpConnections: Map<string, MCPConnection>;
}
```

```typescript
// packages/core/src/agents/AgentManager.ts

export class AgentManager {
  private agents: Map<string, AgentDefinition>;
  private contexts: Map<string, AgentContext>;
  private mcpRegistry: MCPRegistry;

  /**
   * Load all agents from file system
   */
  async loadAgents(): Promise<void> {
    // 1. Load global agents (~/.gemini/agents/)
    // 2. Load project agents (.gemini/agents/)
    // 3. Merge with project overriding global
  }

  /**
   * Create a new agent
   */
  async createAgent(definition: Partial<AgentDefinition>, options: {
    scope: 'global' | 'project';
    template?: string;
  }): Promise<AgentDefinition> {
    // 1. Validate definition
    // 2. Generate file from template
    // 3. Save to disk
    // 4. Reload agents
  }

  /**
   * Get agent by name
   */
  getAgent(name: string): AgentDefinition | null {
    return this.agents.get(name) || null;
  }

  /**
   * List all agents
   */
  listAgents(scope?: 'global' | 'project' | 'all'): AgentDefinition[] {
    // Filter by scope if specified
  }

  /**
   * Validate agent definition
   */
  async validateAgent(name: string): Promise<ValidationResult> {
    // Run all validation checks
  }

  /**
   * Delete agent
   */
  async deleteAgent(name: string, scope: 'global' | 'project'): Promise<void> {
    // 1. Remove file
    // 2. Clean up context
    // 3. Reload agents
  }
}
```

```typescript
// packages/core/src/agents/AgentExecutor.ts

export class AgentExecutor {
  private agentManager: AgentManager;
  private config: Config;

  /**
   * Execute agent with a prompt
   */
  async execute(
    agentName: string,
    prompt: string,
    options: {
      interactive?: boolean;
      stream?: boolean;
    }
  ): Promise<AgentResponse> {
    // 1. Get agent definition
    const agent = this.agentManager.getAgent(agentName);
    if (!agent) throw new Error(`Agent not found: ${agentName}`);

    // 2. Get or create context
    const context = this.getContext(agentName);

    // 3. Build filtered tool registry
    const tools = this.buildToolRegistry(agent);

    // 4. Setup MCP connections
    const mcpTools = await this.setupMCP(agent);

    // 5. Create model client with agent's model
    const modelClient = this.createModelClient(agent);

    // 6. Execute with isolated context
    return this.executeWithContext(
      agent,
      context,
      tools,
      mcpTools,
      modelClient,
      prompt,
      options
    );
  }

  /**
   * Build tool registry with allow/deny list
   */
  private buildToolRegistry(agent: AgentDefinition): ToolRegistry {
    const registry = new ToolRegistry();

    // Get all available tools
    const allTools = this.config.getAllTools();

    // Apply filters
    for (const tool of allTools) {
      // Check deny list first (higher priority)
      if (agent.tools?.deny?.includes(tool.name)) {
        continue;
      }

      // Check allow list (if specified)
      if (agent.tools?.allow && !agent.tools.allow.includes(tool.name)) {
        continue;
      }

      registry.register(tool);
    }

    return registry;
  }

  /**
   * Setup MCP connections and get tools
   */
  private async setupMCP(agent: AgentDefinition): Promise<MCPTool[]> {
    const tools: MCPTool[] = [];

    if (!agent.mcp?.servers) return tools;

    for (const serverName of agent.mcp.servers) {
      const connection = await this.mcpRegistry.getConnection(serverName);
      const serverTools = await connection.listTools();

      // Filter MCP tools through allow/deny lists
      for (const tool of serverTools) {
        const fullName = `mcp.${serverName}.${tool.name}`;

        if (agent.tools?.deny?.includes(fullName)) continue;
        if (agent.tools?.allow && !agent.tools.allow.includes(fullName)) continue;

        tools.push(tool);
      }
    }

    return tools;
  }

  /**
   * Get or create isolated context for agent
   */
  private getContext(agentName: string): AgentContext {
    let context = this.contexts.get(agentName);

    if (!context) {
      context = {
        agentName,
        conversationHistory: [],
        metadata: {},
        startedAt: new Date(),
        lastActiveAt: new Date()
      };
      this.contexts.set(agentName, context);
    }

    context.lastActiveAt = new Date();
    return context;
  }

  /**
   * Clear context for agent
   */
  clearContext(agentName: string): void {
    this.contexts.delete(agentName);
  }
}
```

#### 3.3.2 上下文隔离机制

```typescript
// packages/core/src/agents/ContextManager.ts

export class ContextManager {
  private contexts: Map<string, AgentContext>;
  private persistencePath: string;

  /**
   * Get context, creating if needed
   */
  getContext(agentName: string): AgentContext {
    // Return isolated context
  }

  /**
   * Update context with new message
   */
  updateContext(agentName: string, message: UnifiedMessage): void {
    const context = this.getContext(agentName);
    context.conversationHistory.push(message);
    context.lastActiveAt = new Date();

    // Optionally persist to disk
    if (this.persistencePath) {
      this.persist(agentName, context);
    }
  }

  /**
   * Clear context
   */
  clearContext(agentName: string): void {
    this.contexts.delete(agentName);
    // Also clear from disk if persisted
  }

  /**
   * Persist context to disk
   */
  private async persist(agentName: string, context: AgentContext): Promise<void> {
    const filePath = path.join(this.persistencePath, `${agentName}.json`);
    await fs.promises.writeFile(filePath, JSON.stringify(context, null, 2));
  }

  /**
   * Load context from disk
   */
  private async load(agentName: string): Promise<AgentContext | null> {
    const filePath = path.join(this.persistencePath, `${agentName}.json`);
    try {
      const data = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
}
```

### 3.4 工具过滤与权限控制

#### 3.4.1 工具分类

```typescript
// packages/core/src/agents/ToolClassifier.ts

export enum ToolRiskLevel {
  SAFE = 'safe',           // 只读操作，无副作用
  LOW = 'low',             // 有限的写操作
  MEDIUM = 'medium',       // 可能影响系统状态
  HIGH = 'high',           // 危险操作，需要确认
  CRITICAL = 'critical'    // 极度危险，默认禁止
}

export const TOOL_RISK_LEVELS: Record<string, ToolRiskLevel> = {
  // Safe (read-only)
  'read_file': ToolRiskLevel.SAFE,
  'read_many_files': ToolRiskLevel.SAFE,
  'grep': ToolRiskLevel.SAFE,
  'glob': ToolRiskLevel.SAFE,

  // Low (limited writes)
  'write_file': ToolRiskLevel.LOW,
  'edit_file': ToolRiskLevel.LOW,

  // Medium (system state)
  'bash': ToolRiskLevel.MEDIUM,
  'git_commit': ToolRiskLevel.MEDIUM,

  // High (dangerous)
  'delete_file': ToolRiskLevel.HIGH,
  'bash_sudo': ToolRiskLevel.HIGH,

  // Critical
  'system_shutdown': ToolRiskLevel.CRITICAL,
};
```

#### 3.4.2 用户确认机制

```typescript
// packages/core/src/agents/ToolExecutor.ts

export class AgentToolExecutor {
  async executeTool(
    tool: Tool,
    params: any,
    agent: AgentDefinition,
    options: {
      autoApprove?: ToolRiskLevel[];
    }
  ): Promise<any> {
    const riskLevel = TOOL_RISK_LEVELS[tool.name] || ToolRiskLevel.MEDIUM;

    // Check if auto-approve is allowed
    if (!options.autoApprove?.includes(riskLevel)) {
      // Require user confirmation
      const approved = await this.requestUserApproval(tool, params, riskLevel);
      if (!approved) {
        throw new Error(`Tool execution denied by user: ${tool.name}`);
      }
    }

    // Execute tool
    return tool.execute(params);
  }

  private async requestUserApproval(
    tool: Tool,
    params: any,
    riskLevel: ToolRiskLevel
  ): Promise<boolean> {
    // Show confirmation prompt in UI
    console.log(`\n⚠️  Agent wants to execute ${tool.name} (Risk: ${riskLevel})`);
    console.log(`Parameters: ${JSON.stringify(params, null, 2)}`);

    // Get user input
    const response = await this.prompt('Approve? (yes/no): ');
    return response.toLowerCase() === 'yes';
  }
}
```

### 3.5 MCP 集成

#### 3.5.1 MCP Registry

```typescript
// packages/core/src/agents/MCPRegistry.ts

export interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  autoStart?: boolean;
}

export class MCPRegistry {
  private servers: Map<string, MCPServerConfig>;
  private connections: Map<string, MCPConnection>;

  /**
   * Load MCP server configs from settings
   */
  async loadServers(): Promise<void> {
    const config = await this.config.getMCPServers();
    for (const [name, serverConfig] of Object.entries(config)) {
      this.servers.set(name, serverConfig);
    }
  }

  /**
   * Get or create connection to MCP server
   */
  async getConnection(serverName: string): Promise<MCPConnection> {
    // Check if already connected
    if (this.connections.has(serverName)) {
      return this.connections.get(serverName)!;
    }

    // Get server config
    const serverConfig = this.servers.get(serverName);
    if (!serverConfig) {
      throw new Error(`MCP server not configured: ${serverName}`);
    }

    // Create new connection
    const connection = await MCPConnection.create(serverConfig);
    this.connections.set(serverName, connection);

    return connection;
  }

  /**
   * Disconnect from server
   */
  async disconnect(serverName: string): Promise<void> {
    const connection = this.connections.get(serverName);
    if (connection) {
      await connection.close();
      this.connections.delete(serverName);
    }
  }
}
```

#### 3.5.2 MCP Tool 包装

```typescript
// packages/core/src/agents/MCPToolWrapper.ts

export class MCPToolWrapper {
  /**
   * Convert MCP tool to unified tool format
   */
  static wrapMCPTool(
    mcpTool: MCPTool,
    serverName: string,
    connection: MCPConnection
  ): Tool {
    return {
      name: `mcp.${serverName}.${mcpTool.name}`,
      description: mcpTool.description,
      parameters: mcpTool.inputSchema,

      async execute(params: any): Promise<any> {
        // Call MCP tool through connection
        const result = await connection.callTool(mcpTool.name, params);
        return result;
      }
    };
  }
}
```

### 3.6 P1 验收标准（DoD）

#### 测试场景

**场景1: Agent 创建与加载**
```bash
# 创建 Agent
$ gemini agents create debug-analyzer --template debugging

# 验证加载
$ gemini agents list | grep debug-analyzer
✓ debug-analyzer 出现在列表中

# 验证文件
$ cat .gemini/agents/debug-analyzer.md
✓ 包含完整 front-matter 和系统提示
```

**场景2: 工具白名单控制**
```bash
# Agent 配置只允许 read_file, grep
$ gemini agents run debug-analyzer -p "Read app.ts and find all TODO comments"

✓ 成功执行 read_file
✓ 成功执行 grep
✗ 尝试 write_file 被拒绝：Tool not allowed for this agent
```

**场景3: 上下文隔离**
```bash
# 主会话
$ gemini "I'm working on feature X"

# Agent 会话
$ gemini agents run debug-analyzer -p "Analyze this bug"

# 再次主会话
$ gemini "What was I working on?"
✓ 回答: "feature X"（没有被 Agent 会话污染）

# Agent 会话历史
$ gemini agents run debug-analyzer --interactive
You: What did we discuss?
Agent: We discussed analyzing a bug
✓ Agent 记得自己的对话历史
```

**场景4: MCP 集成**
```bash
# Agent 配置使用 github MCP server
$ gemini agents run reviewer -p "Review PR #123"

✓ 成功连接 github MCP server
✓ 调用 mcp.github.get_pull_request
✓ 返回 PR 详情并进行审查
```

**场景5: 校验功能**
```bash
$ gemini agents validate --all

debug-analyzer: ✓ Valid
code-reviewer: ✗ Invalid (MCP server 'unknown' not configured)
doc-generator: ✓ Valid
```

---

## 4. P2: 扩展版设计

### 4.1 新增字段规范

#### 4.1.1 Triggers（自动路由）

```yaml
triggers:
  - intent: debug
    keywords: [bug, error, crash, exception, stack trace]
    priority: 10
  - intent: review
    keywords: [review, PR, pull request, code quality]
    priority: 5
  - regex: "fix.*test"
    priority: 8
```

**字段说明**:
- `intent`: 意图标识符
- `keywords`: 关键词列表（命中任一即触发）
- `regex`: 正则表达式匹配
- `priority`: 优先级（数值越大优先级越高）

**路由逻辑**:
```typescript
async routeToAgent(userPrompt: string): Promise<string | null> {
  const candidates: Array<{agent: string, priority: number}> = [];

  for (const [agentName, agent] of this.agents) {
    if (!agent.triggers) continue;

    for (const trigger of agent.triggers) {
      // Check keywords
      if (trigger.keywords) {
        const matched = trigger.keywords.some(kw =>
          userPrompt.toLowerCase().includes(kw.toLowerCase())
        );
        if (matched) {
          candidates.push({ agent: agentName, priority: trigger.priority || 0 });
        }
      }

      // Check regex
      if (trigger.regex) {
        const matched = new RegExp(trigger.regex, 'i').test(userPrompt);
        if (matched) {
          candidates.push({ agent: agentName, priority: trigger.priority || 0 });
        }
      }
    }
  }

  // Return highest priority agent
  if (candidates.length > 0) {
    candidates.sort((a, b) => b.priority - a.priority);
    return candidates[0].agent;
  }

  return null;
}
```

#### 4.1.2 Handoffs（跨 Agent 移交）

```yaml
handoffs:
  - to: code-reviewer
    when: task.status == 'need-review'
    payload:
      schema:
        type: object
        properties:
          files: { type: array }
          changes: { type: string }
```

**实现为工具**（对齐 OpenAI Agents）:

```typescript
// 自动注册 handoff 工具
function createHandoffTool(handoff: HandoffConfig): Tool {
  return {
    name: `handoff_to_${handoff.to}`,
    description: `Transfer task to ${handoff.to} agent`,
    parameters: handoff.payload?.schema || {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Reason for handoff' },
        context: { type: 'object', description: 'Additional context' }
      }
    },

    async execute(params: any): Promise<any> {
      // Evaluate 'when' condition
      if (handoff.when && !evaluateCondition(handoff.when, currentState)) {
        throw new Error(`Handoff condition not met: ${handoff.when}`);
      }

      // Validate payload against schema
      if (handoff.payload?.schema) {
        validateAgainstSchema(params, handoff.payload.schema);
      }

      // Perform handoff
      return agentExecutor.handoff(currentAgent, handoff.to, params);
    }
  };
}
```

**映射为图边**（对齐 LangGraph）:

```typescript
// 也可以映射为 LangGraph 的条件边
function mapToLangGraphEdge(handoff: HandoffConfig): ConditionalEdge {
  return {
    source: currentAgent,
    target: handoff.to,
    condition: (state) => evaluateCondition(handoff.when, state),
    payload: handoff.payload
  };
}
```

#### 4.1.3 Guardrails（输出校验）

```yaml
guardrails:
  - name: valid-json-output
    schema:
      type: object
      properties:
        analysis: { type: string }
        confidence: { type: number, minimum: 0, maximum: 1 }
        suggestions: { type: array }
      required: [analysis, confidence]
    policy: reject  # or 'repair'

  - name: no-harmful-code
    validator: custom
    policy: reject
```

**实现**:

```typescript
class GuardrailValidator {
  async validate(
    output: any,
    guardrails: GuardrailConfig[]
  ): Promise<ValidationResult> {
    for (const rail of guardrails) {
      if (rail.schema) {
        // JSON Schema validation
        const result = validateSchema(output, rail.schema);
        if (!result.valid) {
          if (rail.policy === 'reject') {
            throw new GuardrailViolation(rail.name, result.errors);
          } else if (rail.policy === 'repair') {
            output = await this.repairOutput(output, rail.schema, result.errors);
          }
        }
      }

      if (rail.validator === 'custom') {
        // Custom validation logic
        const valid = await this.runCustomValidator(rail.name, output);
        if (!valid && rail.policy === 'reject') {
          throw new GuardrailViolation(rail.name, ['Custom validation failed']);
        }
      }
    }

    return { valid: true, output };
  }

  private async repairOutput(
    output: any,
    schema: JSONSchema,
    errors: string[]
  ): Promise<any> {
    // Use LLM to repair output
    const prompt = `
Fix the following output to match the schema.

Schema: ${JSON.stringify(schema, null, 2)}
Current output: ${JSON.stringify(output, null, 2)}
Errors: ${errors.join(', ')}

Return only the fixed JSON output.
    `;

    const fixed = await this.llm.generate(prompt);
    return JSON.parse(fixed);
  }
}
```

#### 4.1.4 Memory（状态记忆）

```yaml
memory:
  session:
    - current_task
    - analyzed_files
    - error_patterns
  long_term:
    backend: vector_store  # or 'filesystem', 'redis'
    config:
      index_name: debug_knowledge
      embedding_model: text-embedding-3-small
```

**实现**:

```typescript
class AgentMemory {
  private sessionState: Map<string, any>;
  private longTermStore?: VectorStore;

  // Session memory (in-memory, cleared on context reset)
  setSessionValue(key: string, value: any): void {
    this.sessionState.set(key, value);
  }

  getSessionValue(key: string): any {
    return this.sessionState.get(key);
  }

  // Long-term memory (persistent)
  async storeLongTerm(key: string, value: any, metadata?: any): Promise<void> {
    if (!this.longTermStore) return;

    await this.longTermStore.add({
      id: key,
      content: value,
      metadata: {
        agent: this.agentName,
        timestamp: Date.now(),
        ...metadata
      }
    });
  }

  async recallLongTerm(query: string, limit: number = 5): Promise<any[]> {
    if (!this.longTermStore) return [];

    const results = await this.longTermStore.search(query, {
      limit,
      filter: { agent: this.agentName }
    });

    return results;
  }
}
```

#### 4.1.5 Graph（图编排）

```yaml
graph:
  entry: analyzer
  nodes:
    - name: analyzer
      agent: debug-analyzer
    - name: fixer
      agent: code-fixer
    - name: reviewer
      agent: code-reviewer
  edges:
    - from: analyzer
      to: fixer
      condition: analysis.can_auto_fix
    - from: fixer
      to: reviewer
      condition: fix.applied
    - from: analyzer
      to: END
      condition: analysis.needs_human
```

**LangGraph 映射**:

```typescript
import { StateGraph } from '@langchain/langgraph';

function buildLangGraph(graphConfig: GraphConfig): StateGraph {
  const graph = new StateGraph({
    channels: {
      currentAgent: { value: '' },
      analysis: { value: null },
      fix: { value: null }
    }
  });

  // Add nodes
  for (const node of graphConfig.nodes) {
    graph.addNode(node.name, async (state) => {
      return agentExecutor.execute(node.agent, state.input);
    });
  }

  // Add edges
  for (const edge of graphConfig.edges) {
    if (edge.condition) {
      graph.addConditionalEdges(
        edge.from,
        (state) => evaluateCondition(edge.condition, state),
        { true: edge.to }
      );
    } else {
      graph.addEdge(edge.from, edge.to);
    }
  }

  graph.setEntryPoint(graphConfig.entry);

  return graph.compile();
}
```

#### 4.1.6 Tracing（可观测性）

```yaml
tracing:
  enabled: true
  events: [llm, tool, handoff, guardrail]
  backend: console  # or 'langsmith', 'opentelemetry'
  sample_rate: 1.0
```

**事件类型**:

```typescript
interface TraceEvent {
  type: 'llm' | 'tool' | 'handoff' | 'guardrail';
  timestamp: number;
  agentName: string;
  data: any;
}

interface LLMEvent extends TraceEvent {
  type: 'llm';
  data: {
    model: string;
    prompt: string;
    response: string;
    tokens: { input: number, output: number };
    latency_ms: number;
  };
}

interface ToolEvent extends TraceEvent {
  type: 'tool';
  data: {
    toolName: string;
    input: any;
    output: any;
    latency_ms: number;
    error?: string;
  };
}

interface HandoffEvent extends TraceEvent {
  type: 'handoff';
  data: {
    from: string;
    to: string;
    reason: string;
    payload: any;
  };
}

interface GuardrailEvent extends TraceEvent {
  type: 'guardrail';
  data: {
    name: string;
    passed: boolean;
    policy: 'reject' | 'repair';
    errors?: string[];
  };
}
```

**Tracer 实现**:

```typescript
class AgentTracer {
  private events: TraceEvent[] = [];
  private backend: TraceBackend;

  recordLLM(event: Omit<LLMEvent, 'type' | 'timestamp'>): void {
    this.record({ type: 'llm', ...event });
  }

  recordTool(event: Omit<ToolEvent, 'type' | 'timestamp'>): void {
    this.record({ type: 'tool', ...event });
  }

  recordHandoff(event: Omit<HandoffEvent, 'type' | 'timestamp'>): void {
    this.record({ type: 'handoff', ...event });
  }

  recordGuardrail(event: Omit<GuardrailEvent, 'type' | 'timestamp'>): void {
    this.record({ type: 'guardrail', ...event });
  }

  private record(event: Omit<TraceEvent, 'timestamp'>): void {
    const fullEvent = {
      ...event,
      timestamp: Date.now()
    };

    this.events.push(fullEvent);
    this.backend.send(fullEvent);
  }

  export(): TraceEvent[] {
    return this.events;
  }
}
```

### 4.2 CLI 增强

#### 4.2.1 `agents create --extended`

```bash
$ gemini agents create debug-flow --extended

✦ Create Extended Agent

[... basic fields ...]

🎯 Triggers (Auto-routing)
Add trigger keywords (comma-separated, enter to skip): bug,error,crash
Add regex pattern (enter to skip): fix.*test
Priority (0-10, default 5): 8

🔄 Handoffs
Add handoff target agent (enter to skip): code-reviewer
  When condition: task.status == 'need-review'
  Payload schema (JSON, enter to skip): { "files": [], "changes": "" }

🛡️ Guardrails
Add output validation (yes/no)? yes
  Schema (JSON): { "type": "object", "properties": { "analysis": { "type": "string" } } }
  Policy (reject/repair): reject

💾 Memory
Enable session memory (yes/no)? yes
  Session keys (comma-separated): current_task,analyzed_files
Enable long-term memory (yes/no)? no

📊 Graph (Multi-agent orchestration)
Define graph (yes/no)? no

🔍 Tracing
Enable tracing (yes/no)? yes
  Events to trace (llm,tool,handoff,guardrail): llm,tool,handoff
  Backend (console/langsmith): console

✅ Extended agent created!
```

#### 4.2.2 `agents graph` 命令

```bash
# Visualize agent graph
$ gemini agents graph visualize debug-flow

📊 Agent Graph: debug-flow

Entry: analyzer

Nodes:
  • analyzer (debug-analyzer)
  • fixer (code-fixer)
  • reviewer (code-reviewer)

Edges:
  analyzer → fixer [if: analysis.can_auto_fix]
  fixer → reviewer [if: fix.applied]
  analyzer → END [if: analysis.needs_human]

# Replay a conversation
$ gemini agents graph replay --session <session-id>

🔄 Replaying session abc123

[analyzer] Analyzing error...
  → Tool: read_file(app.ts)
  → LLM: Found null pointer exception

[analyzer → fixer] Handoff: can_auto_fix = true

[fixer] Applying fix...
  → Tool: edit_file(app.ts)
  → LLM: Added null check

[fixer → reviewer] Handoff: fix.applied = true

[reviewer] Reviewing changes...
  → Guardrail: valid-json-output ✓
  → LLM: Fix looks good

Total: 3 agents, 4 tools, 2 handoffs, 1 guardrail
Duration: 12.3s
```

### 4.3 P2 验收标准（DoD）

**场景1: 自动路由**
```bash
$ gemini "There's a bug in the login flow"
# 自动路由到 debug-analyzer
🤖 Auto-routing to: debug-analyzer (matched: bug)
```

**场景2: 跨 Agent 移交**
```bash
$ gemini agents run debug-analyzer -p "Fix this bug"

[debug-analyzer] Analyzing...
✓ Found issue: null pointer in auth.ts:45

[debug-analyzer] Calling handoff_to_code-fixer
🔄 Handoff: debug-analyzer → code-fixer

[code-fixer] Applying fix...
✓ Added null check

[code-fixer] Calling handoff_to_code-reviewer
🔄 Handoff: code-fixer → code-reviewer

[code-reviewer] Reviewing...
✓ Changes approved
```

**场景3: Guardrails**
```bash
$ gemini agents run analyzer -p "Analyze this"

[analyzer] Generating output...
✗ Guardrail violation: valid-json-output
  - Missing required field: confidence
  - Invalid type for suggestions: expected array, got string

Policy: repair
🔧 Repairing output with LLM...
✓ Repaired output passes validation
```

**场景4: 事件追踪**
```bash
$ gemini agents run debug-analyzer -p "Fix bug" --trace

[Trace] llm (debug-analyzer) - 1.2s
  Model: gemini-2.5-pro
  Tokens: 1234 → 567

[Trace] tool (debug-analyzer) - 0.3s
  Tool: read_file
  Input: { path: "app.ts" }
  Output: [file contents]

[Trace] handoff (debug-analyzer → code-fixer) - 0.1s
  Reason: Can auto-fix
  Payload: { file: "app.ts", line: 45 }

# Export trace
$ gemini agents trace export --session <id> --format json > trace.json
```

---

## 5. 技术架构

### 5.1 模块结构

```
packages/core/src/agents/
├── types.ts                  # 类型定义
├── AgentManager.ts           # Agent 生命周期管理
├── AgentExecutor.ts          # Agent 执行引擎
├── ContextManager.ts         # 上下文隔离
├── ToolFilter.ts             # 工具过滤
├── MCPRegistry.ts            # MCP 连接管理
├── GuardrailValidator.ts     # 输出校验
├── Memory.ts                 # 记忆管理
├── Tracer.ts                 # 事件追踪
├── Router.ts                 # 自动路由
├── HandoffManager.ts         # 移交管理
└── GraphBuilder.ts           # 图编排

packages/cli/src/commands/
└── agentsCommand.ts          # CLI 命令

packages/cli/src/ui/
└── AgentUI.ts                # Agent UI 组件
```

### 5.2 数据流

```
User Input
    ↓
Router (P2: triggers) → Auto-select Agent
    ↓
AgentExecutor
    ↓
┌─────────────────────────┐
│ 1. Load Agent Definition│
│ 2. Get/Create Context   │
│ 3. Filter Tools         │
│ 4. Setup MCP            │
│ 5. Create Model Client  │
└─────────────────────────┘
    ↓
Model Generation
    ↓
Tool Calls (filtered by allow/deny)
    ↓
Guardrails (P2: validate output)
    ↓
Handoff? (P2: transfer to another agent)
    ↓
Tracer (P2: record events)
    ↓
Response to User
```

### 5.3 文件系统布局

```
~/.gemini/
├── agents/                   # 全局 Agent
│   ├── debug-analyzer.md
│   ├── code-reviewer.md
│   └── templates/
│       ├── debugging.md
│       ├── code-review.md
│       └── documentation.md
├── contexts/                 # 持久化上下文
│   ├── debug-analyzer.json
│   └── code-reviewer.json
└── traces/                   # 事件追踪日志
    └── 2025-10-04/
        ├── session-abc123.json
        └── session-def456.json

.gemini/
└── agents/                   # 项目级 Agent
    ├── project-expert.md
    └── domain-specialist.md
```

### 5.4 配置集成

```json
// ~/.gemini/settings.json
{
  "agents": {
    "autoRoute": true,
    "defaultScope": "project",
    "contextPersistence": true,
    "tracing": {
      "enabled": true,
      "backend": "console"
    }
  },
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

---

## 6. 实施计划

### 6.1 P1 实施步骤（4-6 周）

#### 阶段 1: 基础设施（Week 1-2）

**Week 1: 类型定义与文件解析**
- [ ] 定义 `AgentDefinition` 等核心类型
- [ ] 实现 Markdown + YAML front-matter 解析器
- [ ] 实现 Agent 文件加载与验证
- [ ] 单元测试

**Week 2: Agent Manager 与 CLI**
- [ ] 实现 `AgentManager` 类
- [ ] 实现 `agents create` 命令
- [ ] 实现 `agents list/validate` 命令
- [ ] 创建 Agent 模板
- [ ] 集成测试

#### 阶段 2: 执行引擎（Week 3-4）

**Week 3: 上下文与工具管理**
- [ ] 实现 `ContextManager`（独立上下文）
- [ ] 实现工具过滤逻辑（allow/deny）
- [ ] 实现 `AgentExecutor` 核心逻辑
- [ ] 单元测试

**Week 4: MCP 集成**
- [ ] 实现 `MCPRegistry`
- [ ] 实现 MCP 工具包装
- [ ] 实现 `agents run` 命令
- [ ] 集成测试

#### 阶段 3: 完善与测试（Week 5-6）

**Week 5: UI 与用户体验**
- [ ] 实现 Agent UI 组件（Ink）
- [ ] 实现交互式模式
- [ ] 实现用户确认机制
- [ ] 优化错误提示

**Week 6: 测试与文档**
- [ ] E2E 测试（所有 P1 场景）
- [ ] 性能测试（上下文隔离、工具过滤）
- [ ] 编写用户文档
- [ ] 编写开发者文档

### 6.2 P2 实施步骤（6-8 周）

#### 阶段 4: 自动路由与移交（Week 7-9）

**Week 7: Triggers 与 Router**
- [ ] 实现 `Router` 类
- [ ] 支持 keywords 和 regex 触发
- [ ] 优先级排序
- [ ] 单元测试

**Week 8: Handoffs**
- [ ] 实现 `HandoffManager`
- [ ] Handoff-as-tool 实现
- [ ] LangGraph 映射（可选）
- [ ] 集成测试

**Week 9: CLI 与 UI**
- [ ] `agents create --extended` 命令
- [ ] 自动路由 UI 提示
- [ ] Handoff 可视化
- [ ] 测试

#### 阶段 5: Guardrails 与 Memory（Week 10-12）

**Week 10: Guardrails**
- [ ] JSON Schema 验证
- [ ] Reject/Repair 策略
- [ ] 自定义验证器接口
- [ ] 单元测试

**Week 11: Memory**
- [ ] Session memory 实现
- [ ] Long-term memory 接口
- [ ] Vector store 集成（可选）
- [ ] 测试

**Week 12: 完善**
- [ ] Memory UI 查看
- [ ] Guardrails 报告
- [ ] 集成测试

#### 阶段 6: Graph 与 Tracing（Week 13-14）

**Week 13: Graph 编排**
- [ ] `GraphBuilder` 实现
- [ ] LangGraph 集成
- [ ] `agents graph visualize` 命令
- [ ] 测试

**Week 14: Tracing**
- [ ] `Tracer` 实现
- [ ] 事件收集（llm/tool/handoff/guardrail）
- [ ] `agents graph replay` 命令
- [ ] 导出功能
- [ ] 测试

#### 阶段 7: 测试与发布（Week 15-16）

**Week 15: 完整测试**
- [ ] 所有 P2 场景 E2E 测试
- [ ] 性能测试
- [ ] 安全审计
- [ ] Bug 修复

**Week 16: 文档与发布**
- [ ] 完善用户文档
- [ ] 编写迁移指南
- [ ] 录制演示视频
- [ ] 发布 Beta 版本

---

## 7. 风险与缓解

### 7.1 技术风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| MCP 集成复杂度高 | 高 | 中 | 提前 POC，优先支持常用 MCP 服务器 |
| 上下文隔离性能开销 | 中 | 低 | 使用浅拷贝 + COW，按需持久化 |
| LangGraph 依赖版本冲突 | 中 | 中 | 做好依赖隔离，提供降级方案 |
| Guardrails 修复质量不稳定 | 高 | 中 | 先实现 reject，repair 作为高级特性 |

### 7.2 安全风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| Agent 权限过大 | 高 | 中 | 严格工具白名单，高风险操作需确认 |
| MCP 服务器供应链攻击 | 高 | 低 | 固定版本，健康检查，信任列表 |
| 跨 Agent 信息泄漏 | 中 | 低 | 严格上下文隔离，Handoff 时显式传递 |
| 恶意 Agent 定义 | 高 | 低 | 校验 schema，沙箱执行，用户审核 |

### 7.3 用户体验风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 学习曲线陡峭 | 中 | 高 | 提供丰富模板，渐进式复杂度 |
| 自动路由不准确 | 中 | 中 | 允许手动覆盖，收集反馈优化 |
| Handoff 链路过长 | 低 | 低 | 限制最大深度，提供可视化 |
| Tracing 数据过多 | 低 | 中 | 支持采样率，可配置事件类型 |

---

## 8. 未来展望

### 8.1 OpenAI Agents SDK 对齐

- [ ] Sessions 管理（持久化会话）
- [ ] Swarm 模式（轻量级多 Agent 协作）
- [ ] Response Streaming（流式 Handoff）
- [ ] Function Tools（工具定义标准化）

### 8.2 LangGraph 深度集成

- [ ] Checkpoints（状态快照与回滚）
- [ ] Human-in-the-loop（人工介入节点）
- [ ] Parallel Execution（并行 Agent 执行）
- [ ] Graph Visualization（交互式图编辑器）

### 8.3 MCP 生态扩展

- [ ] MCP Marketplace（Agent 市场）
- [ ] Custom MCP Servers（自定义服务器模板）
- [ ] MCP Security Policy（服务器安全策略）
- [ ] MCP Performance Monitor（性能监控）

---

## 9. 参考资料

### 9.1 业界标准

- [Claude Code Subagents](https://docs.anthropic.com/en/docs/build-with-claude/subagents)
- [OpenAI Agents SDK](https://platform.openai.com/docs/agents)
- [LangGraph Handoffs](https://langchain-ai.github.io/langgraph/concepts/multi_agent/)
- [MCP Specification](https://modelcontextprotocol.io/)

### 9.2 内部文档

- [通用模型支持设计](./DESIGN_UNIVERSAL_MODEL_SUPPORT.md)
- [如何添加新模型](../docs/ADD_NEW_MODEL.md)
- [MCP 集成指南](../docs/MCP_INTEGRATION.md)（待创建）

---

## 10. 附录

### 10.1 Agent 模板示例

见 [design/agent-templates/](./agent-templates/) 目录：
- `debugging.md` - 调试专家模板
- `code-review.md` - 代码审查模板
- `documentation.md` - 文档生成模板
- `testing.md` - 测试生成模板
- `security.md` - 安全审计模板

### 10.2 API 参考

见 [design/api-reference.md](./api-reference.md)（待创建）

### 10.3 FAQ

**Q: Agent 和普通对话有什么区别？**
A: Agent 有专门的系统提示、独立的上下文、受限的工具访问，更专注于特定任务。

**Q: 可以动态创建 Agent 吗？**
A: P1 仅支持文件定义的 Agent，P2 可考虑支持运行时动态创建。

**Q: 如何调试 Agent？**
A: 启用 tracing，使用 `agents graph replay` 回放会话，查看完整事件链路。

**Q: MCP 服务器挂了怎么办？**
A: Agent 会优雅降级，跳过不可用的 MCP 工具，记录错误日志。

**Q: 能否限制 Agent 的成本？**
A: 可以在 Agent 配置中设置 `maxTokens`、`maxCost`（P2 特性）。

---

**文档版本**: 1.0
**最后更新**: 2025-10-04
**维护者**: Gemini CLI Team

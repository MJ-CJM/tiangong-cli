# Agents 系统已实现功能

> 本文档记录 Agents 系统当前已完成的所有功能及其实现细节

**最后更新**: 2025-10-06

---

## 📋 目录

- [核心功能概述](#核心功能概述)
- [Agent 生命周期管理](#agent-生命周期管理)
- [Agent 执行系统](#agent-执行系统)
- [自然语言调用](#自然语言调用)
- [上下文管理](#上下文管理)
- [架构实现](#架构实现)

---

## 核心功能概述

### ✅ 已实现功能列表

#### 1. Agent 管理命令
- ✅ `/agents list` - 列出所有可用 agents
- ✅ `/agents create` - 交互式创建 agent
- ✅ `/agents info <name>` - 查看 agent 详情
- ✅ `/agents validate <name>` - 验证 agent 配置
- ✅ `/agents delete <name>` - 删除 agent
- ✅ `/agents run <name> <prompt>` - 执行 agent
- ✅ `/agents clear <name>` - 清除 agent 对话历史

#### 2. Agent 定义系统
- ✅ Markdown + YAML 前置元数据格式
- ✅ 支持全局作用域 (`~/.gemini/agents/`)
- ✅ 支持项目作用域 (`.gemini/agents/`)
- ✅ Agent 名称支持下划线和连字符
- ✅ 系统提示词 (Markdown body)
- ✅ 自定义模型配置

#### 3. 工具控制
- ✅ 工具白名单 (`tools.allow`)
- ✅ 工具黑名单 (`tools.deny`)
- ✅ 工具过滤逻辑 (ToolFilter)
- ✅ 运行时工具验证

#### 4. Agent 执行
- ✅ 完整的工具调用循环
- ✅ 工具执行回调 (UI 显示)
- ✅ 错误处理和重试
- ✅ Token 使用统计
- ✅ 执行时长跟踪

#### 5. 自然语言调用
- ✅ "使用 <agent> agent ..." 模式
- ✅ "用 <agent> agent ..." 模式
- ✅ "@<agent> ..." 模式
- ✅ "让 <agent> agent ..." 模式
- ✅ 自动转换为 `/agents run` 命令

#### 6. 上下文管理
- ✅ 独立的 agent 对话上下文
- ✅ 会话级上下文持久化
- ✅ 多次调用保持上下文连续性
- ✅ 手动清除上下文

---

## Agent 生命周期管理

### 创建 Agent

**命令**: `/agents create <name> [options]`

**支持的选项**:
```bash
--title "标题"          # Agent 显示名称
--description "描述"    # Agent 描述
--model <model-name>    # 使用的模型
--scope global|project  # Agent 作用域
```

**示例**:
```bash
/agents create code_review --title "Code Reviewer" --model gemini-2.5-pro
```

**实现位置**:
- CLI 命令: `packages/cli/src/ui/commands/agentsCommand.ts` (create 子命令)
- Agent 管理器: `packages/core/src/agents/AgentManager.ts`

**生成的文件结构**:
```markdown
---
kind: agent
name: code_review
title: Code Reviewer
model: gemini-2.5-pro
scope: project
version: 1.0.0
---

# Agent System Prompt

You are a code reviewer...
```

### 列出 Agents

**命令**: `/agents list`

**显示信息**:
- Agent 名称和标题
- 描述
- 使用的模型
- 作用域 (项目级/全局级)

**实现位置**:
- `packages/cli/src/ui/commands/agentsCommand.ts` (list 子命令)
- `packages/core/src/agents/AgentManager.ts::listAgents()`

### 查看 Agent 详情

**命令**: `/agents info <name>`

**显示内容**:
- 基本信息 (名称、标题、描述、模型)
- 工具配置 (allow/deny 列表)
- 可用工具列表 (经过过滤后)
- MCP 服务器配置
- 文件路径和更新时间

**实现位置**:
- `packages/cli/src/ui/commands/agentsCommand.ts` (info 子命令)

### 验证 Agent

**命令**: `/agents validate <name>`

**验证内容**:
- Agent 定义格式
- 工具配置有效性
- MCP 服务器配置
- 系统提示词存在性

**输出**:
- ✓ 验证通过
- ⚠️ 警告信息 (如工具被过滤)
- ✗ 错误信息

**实现位置**:
- `packages/cli/src/ui/commands/agentsCommand.ts` (validate 子命令)
- `packages/core/src/agents/AgentValidator.ts`
- `packages/core/src/agents/AgentExecutor.ts::validateAgent()`

### 删除 Agent

**命令**: `/agents delete <name>`

**行为**:
- 删除 agent 定义文件
- 确认提示
- 保留全局 agents (需明确 scope)

**实现位置**:
- `packages/cli/src/ui/commands/agentsCommand.ts` (delete 子命令)
- `packages/core/src/agents/AgentManager.ts::deleteAgent()`

---

## Agent 执行系统

### 执行 Agent

**命令**: `/agents run <name> <prompt>`

**示例**:
```bash
/agents run code_review 分析 src/index.ts 的代码质量
```

**执行流程**:

1. **获取全局 AgentExecutor**
   ```typescript
   const executor = await config.getAgentExecutor();
   ```

2. **执行 Agent**
   ```typescript
   const result = await executor.execute(agentName, prompt, {
     onToolCall: (toolName, args) => { /* 显示工具调用 */ },
     onToolResult: (toolName, result, error) => { /* 处理结果 */ }
   });
   ```

3. **工具调用循环** (最多10轮):
   - 发送请求到模型
   - 检查是否有 function_call
   - 执行工具调用
   - 将结果添加到上下文
   - 继续下一轮

4. **显示结果**:
   ```
   ℹ🤖 Running agent: Code_review
     Model: gemini-2.5-pro
     Prompt: 分析代码质量

   ℹ ╭──────────────────────────╮
     │ ✓  ReadFile src/index.ts │
     ╰──────────────────────────╯

   ✦ [Agent 响应内容]

   ℹ📊 Tokens used: 1500 | Iterations: 2 | Duration: 3500ms
   ```

**实现位置**:
- CLI 命令: `packages/cli/src/ui/commands/agentsCommand.ts` (run 子命令)
- 执行器: `packages/core/src/agents/AgentExecutor.ts::execute()`
- 工具调用: `packages/core/src/tools/tool-registry.ts`

### 工具调用显示

**UI 格式** (与主对话一致):
```
╭──────────────────────────────────────╮
│ ✓  ReadFile /path/to/file.py         │
╰──────────────────────────────────────╯
```

**回调机制**:
```typescript
{
  onToolCall: (toolName: string, args: any) => {
    // 在工具执行前调用
    // 显示工具名称和参数
  },

  onToolResult: (toolName: string, result: any, error?: Error) => {
    // 在工具执行后调用
    // 处理错误或成功结果
  }
}
```

**实现位置**:
- 回调定义: `packages/core/src/agents/types.ts::AgentExecuteOptions`
- 回调调用: `packages/core/src/agents/AgentExecutor.ts::execute()`
- UI 显示: `packages/cli/src/ui/commands/agentsCommand.ts` (run 子命令)

---

## 自然语言调用

### 支持的模式

用户可以用自然语言调用 agent，无需记住斜杠命令。

#### 1. "使用" 模式
```bash
使用 code_review agent 分析这个文件的代码质量
```

#### 2. "用" 模式
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

### 实现机制

**检测逻辑**:
```typescript
// 1. 快速检查
if (isAgentCommand(query)) {
  // 2. 提取 agent 名称和提示词
  const match = detectAgentCommand(query);
  // { agentName: 'code_review', prompt: '分析代码质量' }

  // 3. 转换为斜杠命令
  const cmd = `/agents run ${match.agentName} ${match.prompt}`;

  // 4. 执行
  await handleSlashCommand(cmd);
}
```

**正则表达式**:
```typescript
// Pattern 1: "使用|用 <agent> agent ..."
/^(?:使用|用)\s+([a-z][a-z0-9_-]*)\s+agent\s+(.+)$/i

// Pattern 2: "让 <agent> agent ..."
/^让\s+([a-z][a-z0-9_-]*)\s+agent\s+(.+)$/i

// Pattern 3: "@<agent> ..."
/^@([a-z][a-z0-9_-]*)\s+(.+)$/i

// Pattern 4: "使用|用 <agent> ..." (无 "agent" 关键字)
/^(?:使用|用)\s+([a-z][a-z0-9_-]*)\s+(.+)$/i
// 仅当名称包含 _ 或 - 时匹配
```

**实现位置**:
- 检测器: `packages/cli/src/ui/hooks/agentCommandProcessor.ts`
- 集成: `packages/cli/src/ui/hooks/useGeminiStream.ts` (line 366-386)

**处理流程**:
```
用户输入: "使用 code_review agent 分析代码"
    ↓
detectAgentCommand() 提取
    ↓
{ agentName: 'code_review', prompt: '分析代码' }
    ↓
构造命令: "/agents run code_review 分析代码"
    ↓
handleSlashCommand() 执行
    ↓
显示 agent 响应
```

---

## 上下文管理

### 会话级上下文持久化

**核心设计**:
- 每个 agent 有独立的对话上下文 (`AgentContext`)
- 上下文在 CLI 会话期间持久化
- 多次调用同一 agent 时，保持上下文连续性

### AgentExecutor 单例化

**实现方式**:
```typescript
// Config.ts
class Config {
  private agentExecutor: AgentExecutor | null = null;

  async getAgentExecutor(): Promise<AgentExecutor> {
    if (!this.agentExecutor) {
      // 创建单例
      this.agentExecutor = new AgentExecutor(...);
      await this.agentExecutor.initialize();
    }
    return this.agentExecutor;
  }
}
```

**好处**:
- 所有 `/agents run` 命令使用同一个 executor
- `ContextManager` 在整个会话中保持状态
- Agent 的对话历史得以保留

### 上下文存储

**数据结构**:
```typescript
interface AgentContext {
  agentName: string;
  conversationHistory: UnifiedMessage[];  // 对话历史
  metadata: Record<string, any>;          // 元数据
  createdAt: Date;
  lastAccessedAt: Date;
}
```

**ContextManager**:
```typescript
class ContextManager {
  private contexts: Map<string, AgentContext> = new Map();

  getContext(agentName: string): AgentContext;
  addMessage(agentName: string, message: UnifiedMessage): void;
  clearHistory(agentName: string): void;
  // ...
}
```

**实现位置**:
- `packages/core/src/agents/ContextManager.ts`
- `packages/core/src/agents/AgentExecutor.ts` (使用 ContextManager)
- `packages/core/src/config/config.ts` (提供单例)

### 对话连续性示例

```bash
# 第一次调用
> 用 code_review agent 分析 /path/to/file.py

Agent: [分析结果...]

# 第二次调用 - agent 能看到第一次的上下文
> @code_review 总结下上述的代码审查报告

Agent: 根据刚才的分析，主要问题是...

# 第三次调用 - 继续对话
> 用 code_review agent 针对第一个问题给出具体修改建议

Agent: 对于刚才提到的第一个问题...
```

### 清除上下文

**命令**: `/agents clear <name>`

**效果**:
- 清除指定 agent 的对话历史
- 保留 agent 定义不变
- 下次调用从全新上下文开始

**示例**:
```bash
/agents clear code_review
# ✓ Cleared conversation history for agent: code_review
```

**实现**:
```typescript
executor.clearContext(agentName);
// 内部调用 contextManager.clearHistory(agentName)
```

---

## 架构实现

### 核心组件

```
┌─────────────────────────────────────────────────────┐
│                   CLI Commands                       │
│  (/agents create, list, run, clear, info, ...)     │
└──────────────────┬──────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────┐
│              AgentExecutor (Singleton)               │
│  • 执行 agents                                       │
│  • 管理工具调用循环                                   │
│  • 协调各个组件                                       │
└─────┬──────────┬──────────┬──────────┬─────────────┘
      │          │          │          │
      ↓          ↓          ↓          ↓
┌──────────┐ ┌──────────┐ ┌─────────┐ ┌────────────┐
│  Agent   │ │ Context  │ │  Tool   │ │    MCP     │
│ Manager  │ │ Manager  │ │ Filter  │ │  Registry  │
└──────────┘ └──────────┘ └─────────┘ └────────────┘
      │          │          │
      ↓          ↓          ↓
  加载/验证   上下文持久化  工具过滤
   agents      对话历史    allow/deny
```

### 文件结构

```
packages/core/src/agents/
├── AgentExecutor.ts       # 核心执行器
├── AgentManager.ts        # Agent 生命周期管理
├── ContextManager.ts      # 上下文管理
├── ToolFilter.ts          # 工具过滤
├── MCPRegistry.ts         # MCP 服务器注册
├── AgentValidator.ts      # Agent 验证
├── AgentParser.ts         # Markdown 解析
├── AgentContentGenerator.ts  # Agent 内容生成
└── types.ts               # 类型定义

packages/cli/src/ui/commands/
└── agentsCommand.ts       # 所有 agent 命令

packages/cli/src/ui/hooks/
└── agentCommandProcessor.ts  # 自然语言识别

packages/core/src/config/
└── config.ts              # AgentExecutor 单例管理
```

### 关键流程

#### 1. Agent 执行流程

```typescript
// 1. 获取全局 executor
const executor = await config.getAgentExecutor();

// 2. 执行 agent
const result = await executor.execute(agentName, prompt, options);

// 内部流程:
// a. 获取 agent 定义
const agent = agentManager.getAgent(agentName);

// b. 构建运行时 (过滤工具)
const runtime = await buildRuntime(agent);

// c. 获取或创建上下文
const context = contextManager.getContext(agentName);

// d. 添加用户消息
contextManager.addMessage(agentName, userMessage);

// e. 工具调用循环 (最多10次)
while (iteration < maxIterations) {
  // 构造请求 (包含工具定义)
  const request = {
    model: agent.model,
    messages: context.conversationHistory,
    systemMessage: agent.systemPrompt,
    tools: toolDefinitions,
  };

  // 调用模型
  const response = await modelService.generateContent(request);

  // 检查 function calls
  const functionCalls = response.content.filter(
    part => part.type === 'function_call'
  );

  if (functionCalls.length === 0) {
    // 无工具调用，结束循环
    break;
  }

  // 执行工具
  for (const call of functionCalls) {
    const tool = toolRegistry.getTool(call.name);
    const invocation = tool.build(call.args);
    const result = await invocation.execute(signal);

    // 添加工具响应到上下文
    contextManager.addMessage(agentName, functionResponse);
  }
}

// f. 返回最终响应
return {
  agentName,
  text: finalText,
  context,
  metadata: { tokensUsed, iterations, durationMs }
};
```

#### 2. 自然语言调用流程

```typescript
// useGeminiStream.ts 中的输入处理管道

// 1. Shell 命令检查
if (shellModeActive && handleShellCommand(query)) {
  return;
}

// 2. Agent 命令检查 ← 新增
if (isAgentCommand(query)) {
  const match = detectAgentCommand(query);
  if (match) {
    // 显示用户原始查询
    addItem({ type: 'USER', text: query });

    // 转换为斜杠命令
    const cmd = `/agents run ${match.agentName} ${match.prompt}`;

    // 执行
    await handleSlashCommand(cmd);
    return;
  }
}

// 3. @-命令检查
if (isAtCommand(query)) {
  // ...
}

// 4. 斜杠命令检查
if (isSlashCommand(query)) {
  // ...
}

// 5. 正常对话
// ...
```

---

## 技术细节

### Agent 定义解析

**AgentParser**:
```typescript
class AgentParser {
  async parseAgentFile(filePath: string): Promise<AgentDefinition> {
    // 1. 读取文件
    const content = await fs.readFile(filePath, 'utf-8');

    // 2. 分离前置元数据和 body
    const { data, content: body } = matter(content);

    // 3. 验证前置元数据
    const frontMatter = data as AgentFrontMatter;

    // 4. 构建 AgentDefinition
    return {
      ...frontMatter,
      systemPrompt: body.trim(),
      filePath,
      createdAt: stats.birthtime,
      updatedAt: stats.mtime,
    };
  }
}
```

### 工具过滤逻辑

**ToolFilter**:
```typescript
class ToolFilter {
  filterTools(
    allTools: string[],
    agent: AgentDefinition
  ): string[] {
    const { allow, deny } = agent.tools || {};

    // 规则1: 无配置 → 全部允许
    if (!allow && !deny) {
      return allTools;
    }

    // 规则2: 只有 allow → 仅白名单
    if (allow && !deny) {
      return allTools.filter(tool => allow.includes(tool));
    }

    // 规则3: 只有 deny → 全部允许，排除黑名单
    if (!allow && deny) {
      return allTools.filter(tool => !deny.includes(tool));
    }

    // 规则4: 两者都有 → 白名单中的，排除黑名单 (deny 优先)
    if (allow && deny) {
      return allTools.filter(
        tool => allow.includes(tool) && !deny.includes(tool)
      );
    }
  }
}
```

### 工具调用循环

**核心逻辑**:
```typescript
let iteration = 0;
const maxIterations = 10;

while (iteration < maxIterations) {
  iteration++;

  // 发送请求
  const response = await modelService.generateContent({
    messages: context.conversationHistory,
    tools: toolDefinitions,
    systemMessage: agent.systemPrompt,
  });

  // 添加 assistant 消息
  contextManager.addMessage(agentName, assistantMessage);

  // 检查 function calls
  const functionCalls = response.content.filter(
    part => part.type === 'function_call'
  );

  if (functionCalls.length === 0) {
    // 无工具调用，返回文本响应
    finalText = extractText(response.content);
    break;
  }

  // 执行所有 function calls
  for (const call of functionCalls) {
    try {
      // 通知开始
      onToolCall?.(call.name, call.args);

      // 执行工具
      const tool = toolRegistry.getTool(call.name);
      const invocation = tool.build(call.args);
      const result = await invocation.execute(signal);

      // 通知结果
      onToolResult?.(call.name, result);

      // 添加 function response
      contextManager.addMessage(agentName, functionResponse);
    } catch (error) {
      // 错误处理
      onToolResult?.(call.name, null, error);
      contextManager.addMessage(agentName, errorResponse);
    }
  }

  // 继续下一轮，让模型处理工具结果
}

return {
  text: finalText,
  metadata: { iterations, tokensUsed, durationMs }
};
```

---

## 后续改进点

### 已知限制

1. **上下文生命周期**: 上下文仅在当前 CLI 会话中保持，退出后清空
2. **MCP 集成**: MCP 服务器配置已完成，但实际工具调用待 P2 实现
3. **工具分类**: Tool categories (READ/WRITE/EXECUTE) 设计已完成但未使用
4. **Agent 协作**: Agent 之间的任务移交尚未实现

### 潜在优化

1. **上下文持久化**: 将 agent 上下文保存到磁盘，跨会话保持
2. **Token 限制**: 实现上下文窗口管理，自动压缩历史
3. **执行超时**: 添加工具调用超时控制
4. **并发控制**: 支持多个 agent 并发执行

---

**相关文档**:
- [用户指南](../../docs/AGENTS.md)
- [命令参考](./COMMANDS.md)
- [设计文档](./DESIGN.md)
- [P2 功能规划](./P2_FEATURES.md)

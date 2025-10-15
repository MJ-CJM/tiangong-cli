# `/agents route` 命令完整执行流程分析

## 📚 概览

当您在 CLI 终端输入 `/agents route 帮我检查下代码` 时，代码执行路径：

```
用户按下回车
    ↓
InputPrompt 捕获输入
    ↓
useGeminiStream.prepareQueryForGemini()
    ↓
检测到 slash 命令
    ↓
slashCommandProcessor.handleSlashCommand()
    ↓
parseSlashCommand() 解析命令
    ↓
找到 agents 命令和 route 子命令
    ↓
执行 route 子命令的 action
    ↓
获取 Router 实例
    ↓
调用 router.route(prompt)
    ↓
Router 根据策略调用对应路由器
    ├─ RuleRouter（规则路由）
    ├─ LLMRouter（AI 路由）
    └─ HybridRouter（混合路由）
    ↓
返回匹配结果
    ↓
显示结果 / 执行 agent（如果有 --execute）
```

---

## 🔍 第一步：用户输入捕获

### 文件：`packages/cli/src/ui/components/InputPrompt.tsx`

**入口点**：用户按回车键提交

```typescript
// 行 607-631
if (keyMatchers[Command.SUBMIT](key)) {
  if (buffer.text.trim()) {
    // 检查反斜杠转义等
    const charBefore = col > 0 ? cpSlice(line, col - 1, col) : '';
    if (charBefore === '\\') {
      buffer.backspace();
      buffer.newline();
    } else {
      // 🔑 关键：提交输入
      handleSubmitAndClear(buffer.text);
      //                    ^^^^^^^^^^^
      //                    "/agents route 帮我检查下代码"
    }
  }
  return;
}
```

**输入**：`/agents route 帮我检查下代码`

**输出**：触发 `handleSubmitAndClear` 回调

---

## 🔍 第二步：请求预处理

### 文件：`packages/cli/src/ui/hooks/useGeminiStream.ts`

#### 2.1 进入预处理函数

```typescript
// 行 306-315
const prepareQueryForGemini = useCallback(
  async (
    query: PartListUnion,              // "/agents route 帮我检查下代码"
    userMessageTimestamp: number,
    abortSignal: AbortSignal,
    prompt_id: string,
  ): Promise<{
    queryToSend: PartListUnion | null;
    shouldProceed: boolean;
  }> => {
```

#### 2.2 检测 Slash 命令

```typescript
// 行 325-333
if (typeof query === 'string') {
  const trimmedQuery = query.trim();
  // "/agents route 帮我检查下代码"
  
  onDebugMessage(`User query: '${trimmedQuery}'`);
  await logger?.logMessage(MessageSenderType.USER, trimmedQuery);

  // 🔑 关键：检测是否为 slash 命令
  const slashCommandResult = isSlashCommand(trimmedQuery)
    ? await handleSlashCommand(trimmedQuery)
    //    ^^^^^^^^^^^^^^^^^^^
    //    触发 slash 命令处理器
    : false;
```

**检查函数**：
```typescript
function isSlashCommand(query: string): boolean {
  const trimmed = query.trim();
  return trimmed.startsWith('/') || trimmed.startsWith('?');
  //     ✅ "/agents route..." 以 '/' 开头，返回 true
}
```

**结果**：检测到 slash 命令，调用 `handleSlashCommand()`

---

## 🔍 第三步：Slash 命令处理

### 文件：`packages/cli/src/ui/hooks/slashCommandProcessor.ts`

#### 3.1 进入命令处理器

```typescript
// 行 280-305
const handleSlashCommand = useCallback(
  async (
    rawQuery: PartListUnion,           // "/agents route 帮我检查下代码"
    oneTimeShellAllowlist?: Set<string>,
    overwriteConfirmed?: boolean,
  ): Promise<SlashCommandProcessorResult | false> => {
    if (typeof rawQuery !== 'string') {
      return false;
    }

    const trimmed = rawQuery.trim();
    if (!trimmed.startsWith('/') && !trimmed.startsWith('?')) {
      return false;  // ✅ 通过检查
    }

    setIsProcessing(true);

    const userMessageTimestamp = Date.now();
    // 显示用户输入
    addItem({ type: MessageType.USER, text: trimmed }, userMessageTimestamp);

    let hasError = false;
    
    // 🔑 关键：解析 slash 命令
    const {
      commandToExecute,
      args,
      canonicalPath: resolvedCommandPath,
    } = parseSlashCommand(trimmed, commands);
    //  ^^^^^^^^^^^^^^^^^
    //  核心解析函数
```

---

## 🔍 第四步：命令解析（最核心）

### 文件：`packages/cli/src/utils/commands.ts`

```typescript
// 行 23-71
export const parseSlashCommand = (
  query: string,                      // "/agents route 帮我检查下代码"
  commands: readonly SlashCommand[],  // 所有可用命令列表
): ParsedSlashCommand => {
  const trimmed = query.trim();

  // 🔑 Step 1: 移除开头的 '/' 并分割
  const parts = trimmed.substring(1).trim().split(/\s+/);
  // parts = ["agents", "route", "帮我检查下代码"]
  
  const commandPath = parts.filter((p) => p);

  let currentCommands = commands;      // 从顶层命令开始
  let commandToExecute: SlashCommand | undefined;
  let pathIndex = 0;
  const canonicalPath: string[] = [];

  // 🔑 Step 2: 遍历命令路径，逐层查找
  for (const part of commandPath) {
    // part = "agents" (第一轮)
    // part = "route" (第二轮)
    
    // First pass: 精确匹配命令名称
    let foundCommand = currentCommands.find((cmd) => cmd.name === part);
    //                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    //                 查找 name === "agents" 的命令

    // Second pass: 检查别名
    if (!foundCommand) {
      foundCommand = currentCommands.find((cmd) =>
        cmd.altNames?.includes(part),
      );
    }

    if (foundCommand) {
      commandToExecute = foundCommand;
      canonicalPath.push(foundCommand.name);
      pathIndex++;
      
      // 🔑 关键：如果有子命令，进入下一层
      if (foundCommand.subCommands) {
        currentCommands = foundCommand.subCommands;
        //                ^^^^^^^^^^^^^^^^^^^^^^^^
        //                更新当前命令列表为子命令列表
        // 继续下一轮循环查找 "route"
      } else {
        break;
      }
    } else {
      break;  // 未找到命令，停止
    }
  }

  // 🔑 Step 3: 提取剩余参数
  const args = parts.slice(pathIndex).join(' ');
  // pathIndex = 2（"agents" 和 "route"）
  // args = "帮我检查下代码"

  return { 
    commandToExecute,      // route 子命令对象
    args,                  // "帮我检查下代码"
    canonicalPath          // ["agents", "route"]
  };
};
```

### 解析过程示意

```
输入："/agents route 帮我检查下代码"

Step 1: 分割
parts = ["agents", "route", "帮我检查下代码"]

Step 2: 第一轮循环
part = "agents"
currentCommands = [所有顶层命令]
foundCommand = agentsCommand (name === "agents")
canonicalPath = ["agents"]
pathIndex = 1
currentCommands = agentsCommand.subCommands  ← 进入子命令

Step 3: 第二轮循环
part = "route"
currentCommands = [list, run, clear, context, route, config, ...]
foundCommand = route 子命令 (name === "route")
canonicalPath = ["agents", "route"]
pathIndex = 2
foundCommand.subCommands = undefined  ← 没有更深层子命令，结束

Step 4: 提取参数
args = parts.slice(2).join(' ') = "帮我检查下代码"

返回：
{
  commandToExecute: <route 子命令对象>,
  args: "帮我检查下代码",
  canonicalPath: ["agents", "route"]
}
```

---

## 🔍 第五步：执行命令 Action

### 文件：`packages/cli/src/ui/hooks/slashCommandProcessor.ts`

```typescript
// 行 312-340
try {
  if (commandToExecute) {
    if (commandToExecute.action) {
      // 🔑 构建完整的命令上下文
      const fullCommandContext: CommandContext = {
        ...commandContext,
        invocation: {
          raw: trimmed,                   // "/agents route 帮我检查下代码"
          name: commandToExecute.name,    // "route"
          args,                           // "帮我检查下代码"
        },
        overwriteConfirmed,
      };

      // ... 处理 shell allowlist ...

      // 🔑 关键：执行命令的 action 函数
      const result = await commandToExecute.action(
        //                   ^^^^^^^^^^^^^^^^^^^^^
        //                   调用 route 子命令的 action
        fullCommandContext,
        args,  // "帮我检查下代码"
      );
```

---

## 🔍 第六步：Route 子命令执行

### 文件：`packages/cli/src/ui/commands/agentsCommand.ts`

```typescript
// 行 1537-1687（route 子命令定义）
{
  name: 'route',
  description: 'Test routing for a given prompt...',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext, args?: string) => {
    // args = "帮我检查下代码"
    
    try {
      // 🔑 Step 1: 验证参数
      if (!args || args.trim() === '') {
        context.ui.addItem({
          type: MessageType.ERROR,
          text: 'Usage: /agents route <prompt> [--execute]...',
        }, Date.now());
        return;
      }

      // 🔑 Step 2: 验证配置服务
      if (!context.services.config) {
        context.ui.addItem({
          type: MessageType.ERROR,
          text: 'Configuration service not available.',
        }, Date.now());
        return;
      }

      // 🔑 Step 3: 获取 AgentExecutor 和 Router
      const executor = await context.services.config.getAgentExecutor();
      //                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
      //                     从配置服务获取 AgentExecutor 实例
      
      const router = executor.getRouter();
      //             ^^^^^^^^^^^^^^^^^^^^^
      //             从 Executor 获取 Router 实例

      // 🔑 Step 4: 验证 Router
      if (!router) {
        context.ui.addItem({
          type: MessageType.ERROR,
          text: 'Router not initialized. Please restart the application.',
        }, Date.now());
        return;
      }

      // 🔑 Step 5: 检查路由是否启用
      if (!router.isEnabled()) {
        context.ui.addItem({
          type: MessageType.INFO,
          text: '⚠️  Routing is currently disabled.\n\nEnable it with: /agents config enable',
        }, Date.now());
        return;
      }

      // 🔑 Step 6: 解析参数（--execute 标志）
      const trimmedArgs = args.trim();
      const executeFlag = trimmedArgs.includes('--execute');
      const prompt = trimmedArgs
        .replace(/\s*--execute\s*$/, '')
        .replace(/\s*--execute\s+/, ' ')
        .trim();
      // prompt = "帮我检查下代码"

      if (!prompt) {
        context.ui.addItem({
          type: MessageType.ERROR,
          text: 'Prompt cannot be empty...',
        }, Date.now());
        return;
      }

      // 🔑 Step 7: 显示路由开始信息
      context.ui.addItem({
        type: MessageType.INFO,
        text: `🔍 ${executeFlag ? 'Routing and executing' : 'Testing routing for'}: "${prompt}"\n\nPlease wait...`,
      }, Date.now());

      // 🔑 Step 8: 调用路由器进行路由 ⭐⭐⭐
      const result = await router.route(prompt);
      //                   ^^^^^^^^^^^^^^^^^^^^
      //                   核心路由逻辑
      //                   prompt = "帮我检查下代码"
```

---

## 🔍 第七步：Router 路由选择（核心）

### 文件：`packages/core/src/agents/Router.ts`

```typescript
// 行 85-128
async route(
  userInput: string,                   // "帮我检查下代码"
  strategyOverride?: 'rule' | 'llm' | 'hybrid'
): Promise<RoutingScore | null> {
  
  // 🔑 Step 1: 检查路由是否启用
  if (!this.config.enabled) {
    console.log('[Router] Routing is disabled');
    return null;
  }

  // 🔑 Step 2: 确定使用的策略
  const strategy = strategyOverride || this.config.strategy;
  // strategy = "hybrid" (默认) 或配置的策略
  console.log(`[Router] Using strategy: ${strategy}`);

  try {
    let result: RoutingScore | null = null;

    // 🔑 Step 3: 根据策略调用对应的路由器
    switch (strategy) {
      case 'rule':
        result = await this.ruleRouter.route(userInput);
        //             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        //             调用规则路由器
        break;
        
      case 'llm':
        result = await this.llmRouter.route(userInput);
        //             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        //             调用 LLM 路由器
        break;
        
      case 'hybrid':
        result = await this.hybridRouter.route(userInput);
        //             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        //             调用混合路由器（推荐）
        break;
        
      default:
        console.warn(`[Router] Unknown strategy: ${strategy}, falling back to hybrid`);
        result = await this.hybridRouter.route(userInput);
    }

    // 🔑 Step 4: 返回结果
    if (result) {
      console.log(
        `[Router] Routed to agent: ${result.agent.name} (confidence: ${result.confidence})`
      );
    } else {
      console.log('[Router] No matching agent found');
    }

    return result;
  } catch (error) {
    console.error('[Router] Error during routing:', error);
    return null;
  }
}
```

---

## 🔍 第八步：路由器执行（以 HybridRouter 为例）

### 文件：`packages/core/src/agents/HybridRouter.ts`

```typescript
// 行 31-71
async route(userInput: string): Promise<RoutingScore | null> {
  console.log('[HybridRouter] Starting hybrid routing...');
  // userInput = "帮我检查下代码"

  // 🔑 Step 1: 先尝试规则路由（快速路径）
  console.log('[HybridRouter] Attempting rule-based routing...');
  const ruleResult = await this.ruleRouter.route(userInput);
  //                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //                       调用 RuleRouter

  if (ruleResult) {
    console.log(
      `[HybridRouter] Rule-based result: agent=${ruleResult.agent.name}, confidence=${ruleResult.confidence}`
    );

    // 🔑 Step 2: 检查置信度是否达到阈值
    if (ruleResult.confidence >= this.confidenceThreshold) {
      //                          ^^^^^^^^^^^^^^^^^^^^^^^^
      //                          默认 70
      console.log(
        `[HybridRouter] Confidence ${ruleResult.confidence} >= threshold ${this.confidenceThreshold}, using rule result`
      );
      return ruleResult;  // ✅ 置信度够高，直接返回
    }

    console.log(
      `[HybridRouter] Confidence ${ruleResult.confidence} < threshold ${this.confidenceThreshold}, falling back to LLM`
    );
  } else {
    console.log('[HybridRouter] No rule-based match found, falling back to LLM');
  }

  // 🔑 Step 3: 规则路由不够好，降级到 LLM 路由
  console.log('[HybridRouter] Attempting LLM-based routing...');
  const llmResult = await this.llmRouter.route(userInput);
  //                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //                     调用 LLMRouter

  if (llmResult) {
    console.log(
      `[HybridRouter] LLM-based result: agent=${llmResult.agent.name}, confidence=${llmResult.confidence}`
    );
    return llmResult;
  }

  console.log('[HybridRouter] No LLM-based match found');
  return null;
}
```

---

## 🔍 第九步：RuleRouter 规则路由

### 文件：`packages/core/src/agents/RuleRouter.ts`

```typescript
// 行 21-39
async route(userInput: string): Promise<RoutingScore | null> {
  // userInput = "帮我检查下代码"
  
  const agents = await this.agentManager.listAgents();
  const scores: RoutingScore[] = [];

  // 🔑 遍历所有 agent，计算匹配分数
  for (const agent of agents) {
    const agentDef = await this.agentManager.getAgent(agent.name);
    if (!agentDef?.triggers) continue;

    const score = this.calculateScore(agentDef, userInput);
    //            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    //            计算该 agent 的匹配分数
    
    if (score.score > 0) {
      scores.push(score);
    }
  }

  // 🔑 按分数降序排序
  scores.sort((a, b) => b.score - a.score);

  return scores[0] || null;  // 返回最高分的 agent
}

// 行 47-96
private calculateScore(agent: AgentDefinition, input: string): RoutingScore {
  // agent: code_review
  // input: "帮我检查下代码"
  
  const matchedKeywords: string[] = [];
  const matchedPatterns: string[] = [];
  let score = 0;

  const lowerInput = input.toLowerCase();
  // "帮我检查下代码"

  // 🔑 Step 1: 关键词匹配 (+10 分/个)
  for (const keyword of agent.triggers?.keywords || []) {
    // code_review keywords: ["审查", "检查", "代码质量", "bug", ...]
    if (lowerInput.includes(keyword.toLowerCase())) {
      score += 10;
      matchedKeywords.push(keyword);
      // "检查" 匹配！score += 10
    }
  }

  // 🔑 Step 2: 正则模式匹配 (+20 分/个)
  for (const pattern of agent.triggers?.patterns || []) {
    // code_review patterns: [".*审查.*代码.*", ".*检查.*质量.*", ...]
    try {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(input)) {
        score += 20;
        matchedPatterns.push(pattern);
        // 如果匹配，score += 20
      }
    } catch (e) {
      console.warn(`Invalid regex pattern in agent ${agent.name}: ${pattern}`);
    }
  }

  // 🔑 Step 3: 应用优先级权重
  const priority = agent.triggers?.priority ?? 50;
  // code_review priority: 60
  score = Math.round(score * (priority / 100));
  // score = score * 0.6

  // 🔑 Step 4: 计算置信度 (0-100)
  const matchCount = matchedKeywords.length + matchedPatterns.length;
  const baseConfidence = Math.min(100, score);
  
  // 如果有多个匹配，增加置信度加成
  const confidenceBoost = matchCount > 1 ? 10 : 0;
  const confidence = Math.min(100, baseConfidence + confidenceBoost);

  return {
    agent,
    score,
    confidence,
    matchedKeywords,
    matchedPatterns,
  };
}
```

### 示例计算

假设 `code_review` agent 配置：
```yaml
triggers:
  keywords: ["审查", "检查", "代码质量"]
  patterns: [".*检查.*代码.*"]
  priority: 60
```

输入：`"帮我检查下代码"`

```
1. 关键词匹配：
   - "检查" 匹配 ✅  score += 10

2. 正则匹配：
   - ".*检查.*代码.*" 匹配 ✅  score += 20

3. 当前 score = 30

4. 应用优先级：
   score = 30 * (60 / 100) = 18

5. 计算置信度：
   matchCount = 1 (keyword) + 1 (pattern) = 2
   baseConfidence = min(100, 18) = 18
   confidenceBoost = 2 > 1 ? 10 : 0 = 10
   confidence = min(100, 18 + 10) = 28

返回：
{
  agent: code_review,
  score: 18,
  confidence: 28,
  matchedKeywords: ["检查"],
  matchedPatterns: [".*检查.*代码.*"]
}
```

---

## 🔍 第十步：LLMRouter AI 路由（备选）

### 文件：`packages/core/src/agents/LLMRouter.ts`

```typescript
// 行 28-135
async route(userInput: string): Promise<RoutingScore | null> {
  // userInput = "帮我检查下代码"
  
  const agents = await this.agentManager.listAgents();

  if (agents.length === 0) {
    return null;
  }

  // 🔑 Step 1: 构建 agent 描述列表
  const agentDescriptions = agents
    .map((agent, idx) => {
      return `${idx + 1}. **${agent.name}**
   - Title: ${agent.title}
   - Description: ${agent.description || 'No description'}`;
    })
    .join('\n\n');

  // 🔑 Step 2: 构建路由提示词
  const routingPrompt = `You are an intelligent agent router. Given a user's input, select the most appropriate agent to handle the request.

Available agents:
${agentDescriptions}

User input: "${userInput}"

Analyze the user's request and determine which agent is best suited to handle it. Consider:
1. The agent's title and description
2. The specific task or domain of the user's request
3. Which agent's expertise best matches the request

Respond with a JSON object in this exact format:
{
  "agent_name": "selected-agent-name",
  "confidence": 85,
  "reasoning": "Brief explanation of why this agent was selected"
}

The confidence should be a number from 0-100 indicating how confident you are in this selection.
If no agent is suitable, use confidence 0.`;

  try {
    // 🔑 Step 3: 调用 LLM
    const request: UnifiedRequest = {
      model: this.config.model,           // qwen3-coder-flash
      messages: [
        {
          role: MessageRole.USER,
          content: [{ type: 'text', text: routingPrompt }],
        },
      ],
      temperature: 0.1,  // 低温度，确保一致性
      maxTokens: 500,
    };

    // 设置超时
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('LLM routing timeout')), this.config.timeout);
    });

    const responsePromise = this.modelService.generateContent(request);
    const response = await Promise.race([responsePromise, timeoutPromise]);

    // 🔑 Step 4: 提取文本响应
    const textParts = response.content.filter(part => part.type === 'text');
    if (textParts.length === 0) {
      console.warn('[LLMRouter] No text response from model');
      return null;
    }

    const responseText = textParts.map(part => part.text).join('');

    // 🔑 Step 5: 解析 JSON 响应
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[LLMRouter] No JSON found in response:', responseText);
      return null;
    }

    const decision = JSON.parse(jsonMatch[0]);
    // decision = {
    //   agent_name: "code_review",
    //   confidence: 85,
    //   reasoning: "用户需要检查代码..."
    // }

    // 🔑 Step 6: 验证响应格式
    if (!decision.agent_name || typeof decision.confidence !== 'number') {
      console.warn('[LLMRouter] Invalid response format:', decision);
      return null;
    }

    // 🔑 Step 7: 获取选定的 agent
    const selectedAgent = await this.agentManager.getAgent(decision.agent_name);
    if (!selectedAgent) {
      console.warn(`[LLMRouter] Agent not found: ${decision.agent_name}`);
      return null;
    }

    // 🔑 Step 8: 返回路由结果
    return {
      agent: selectedAgent,
      score: decision.confidence,
      confidence: decision.confidence,
      matchedKeywords: [],    // LLM 路由不使用关键词
      matchedPatterns: [],    // LLM 路由不使用模式
    };
  } catch (error) {
    console.error('[LLMRouter] Error during routing:', error);
    return null;
  }
}
```

---

## 🔍 第十一步：显示路由结果

### 文件：`packages/cli/src/ui/commands/agentsCommand.ts`

```typescript
// 行 1614-1677（继续 route 子命令）

// router.route() 返回后...
const result = await router.route(prompt);

// 🔑 Step 1: 检查是否找到匹配的 agent
if (!result) {
  context.ui.addItem({
    type: MessageType.INFO,
    text: '❌ No suitable agent found for this prompt.\n\nTry adjusting your routing configuration or creating more agents.',
  }, Date.now());
  return;
}

// 🔑 Step 2: 构建结果消息
let message = `✅ **Routing Result**\n\n`;
message += `**Selected Agent**: ${result.agent.name}\n`;
message += `**Title**: ${result.agent.title}\n`;
message += `**Score**: ${result.score}\n`;
message += `**Confidence**: ${result.confidence}%\n\n`;

if (result.matchedKeywords.length > 0) {
  message += `**Matched Keywords**: ${result.matchedKeywords.join(', ')}\n`;
}
if (result.matchedPatterns.length > 0) {
  message += `**Matched Patterns**: ${result.matchedPatterns.length} pattern(s)\n`;
}

if (!executeFlag) {
  message += `\n💡 Use \`@${result.agent.name} ${prompt}\` to execute with this agent.`;
  message += `\n💡 Or use \`/agents route "${prompt}" --execute\` to route and execute in one step.`;
}

// 🔑 Step 3: 显示结果
context.ui.addItem({
  type: MessageType.INFO,
  text: message,
}, Date.now());

// 🔑 Step 4: 如果有 --execute 标志，执行 agent
if (executeFlag) {
  context.ui.addItem({
    type: MessageType.INFO,
    text: `\n🚀 Executing with agent: **${result.agent.title || result.agent.name}**\n`,
  }, Date.now());

  // 找到 'run' 子命令并执行
  const runSubCommand = agentsCommand.subCommands?.find((cmd) => cmd.name === 'run');
  if (runSubCommand && runSubCommand.action) {
    await runSubCommand.action(context, `${result.agent.name} ${prompt}`);
    //    ^^^^^^^^^^^^^^^^^^^^^^^^^^
    //    调用 /agents run code_review 帮我检查下代码
  } else {
    context.ui.addItem({
      type: MessageType.ERROR,
      text: 'Failed to execute agent: run command not found.',
    }, Date.now());
  }
}
```

---

## 📊 完整调用栈总结

```
1. InputPrompt.tsx:628
   └─ handleSubmitAndClear("/agents route 帮我检查下代码")

2. useGeminiStream.ts:306
   └─ prepareQueryForGemini(query, ...)

3. useGeminiStream.ts:331
   └─ isSlashCommand(trimmedQuery) → true

4. useGeminiStream.ts:332
   └─ await handleSlashCommand(trimmedQuery)

5. slashCommandProcessor.ts:280
   └─ handleSlashCommand(rawQuery)

6. slashCommandProcessor.ts:305
   └─ parseSlashCommand(trimmed, commands)

7. commands.ts:23
   └─ parseSlashCommand() 返回：
      {
        commandToExecute: <route 子命令>,
        args: "帮我检查下代码",
        canonicalPath: ["agents", "route"]
      }

8. slashCommandProcessor.ts:336
   └─ await commandToExecute.action(fullCommandContext, args)

9. agentsCommand.ts:1541
   └─ route 子命令 action 执行

10. agentsCommand.ts:1565
    └─ const executor = await context.services.config.getAgentExecutor()

11. agentsCommand.ts:1566
    └─ const router = executor.getRouter()

12. agentsCommand.ts:1614
    └─ const result = await router.route(prompt)

13. Router.ts:85
    └─ async route(userInput, strategyOverride)

14. Router.ts:108 (假设 strategy = 'hybrid')
    └─ result = await this.hybridRouter.route(userInput)

15. HybridRouter.ts:31
    └─ async route(userInput)

16. HybridRouter.ts:36
    └─ const ruleResult = await this.ruleRouter.route(userInput)

17. RuleRouter.ts:21
    └─ async route(userInput)
    └─ calculateScore() 计算每个 agent 的分数

18. HybridRouter.ts:44 (如果置信度不够)
    └─ const llmResult = await this.llmRouter.route(userInput)

19. LLMRouter.ts:28
    └─ async route(userInput)
    └─ 调用 AI 模型进行智能选择

20. HybridRouter.ts:66
    └─ return llmResult (或 ruleResult)

21. Router.ts:115
    └─ return result

22. agentsCommand.ts:1627
    └─ 显示路由结果

23. agentsCommand.ts:1654 (如果有 --execute)
    └─ 调用 run 子命令执行 agent
```

---

## 🎯 关键数据流

### 输入数据流

```
"/agents route 帮我检查下代码"
    ↓ (parseSlashCommand)
{
  commandToExecute: route子命令,
  args: "帮我检查下代码",
  canonicalPath: ["agents", "route"]
}
    ↓ (router.route)
"帮我检查下代码"
    ↓ (HybridRouter)
先 RuleRouter → 后 LLMRouter (如果需要)
    ↓ (RuleRouter.calculateScore)
对每个 agent:
  - 匹配关键词 → +10分/个
  - 匹配模式 → +20分/个
  - 应用优先级权重
  - 计算置信度
    ↓
返回最高分的 agent
```

### 输出数据流

```
RoutingScore {
  agent: AgentDefinition,
  score: number,
  confidence: number,
  matchedKeywords: string[],
  matchedPatterns: string[]
}
    ↓ (显示到 UI)
"✅ Routing Result
Selected Agent: code_review
Confidence: 85%
Matched Keywords: 检查
..."
    ↓ (如果 --execute)
调用 /agents run code_review 帮我检查下代码
```

---

## 🔧 Router 初始化时机

### 文件：`packages/core/src/agents/AgentExecutor.ts`

```typescript
// 行 59-81
async initialize(routingConfig?: Partial<RoutingConfig>): Promise<void> {
  // 🔑 Step 1: 加载 agents
  await this.agentManager.loadAgents();

  // 🔑 Step 2: 注册 MCP servers
  const mcpServers = this.config.getMcpServers();
  if (mcpServers) {
    this.mcpRegistry.registerServers(mcpServers);
  }

  // 🔑 Step 3: 初始化 Router
  this.router = new Router(
    this.config,
    this.agentManager,
    this.modelService,
    routingConfig
  );

  // 🔑 Step 4: 初始化 HandoffManager
  this.handoffManager = new HandoffManager(this.agentManager);

  console.log('[AgentExecutor] Initialized with routing and handoff support');
}
```

**时机**：在应用启动时，`AgentExecutor` 被创建并初始化，Router 也随之初始化。

---

## 💡 总结

### `/agents route` 执行流程精简版

```
用户输入 → InputPrompt 
    ↓
检测 slash 命令 → useGeminiStream
    ↓
解析命令 → parseSlashCommand
    ├─ 第一层：agents 命令
    └─ 第二层：route 子命令
    ↓
执行 route action → agentsCommand.ts
    ├─ 获取 Router 实例
    ├─ 解析参数（--execute）
    └─ 调用 router.route(prompt)
    ↓
Router 选择策略 → Router.ts
    ├─ rule: 仅规则路由
    ├─ llm: 仅 AI 路由
    └─ hybrid: 先规则后 AI（推荐）
    ↓
执行路由 → RuleRouter/LLMRouter/HybridRouter
    ├─ RuleRouter: 关键词+模式匹配
    └─ LLMRouter: AI 智能理解
    ↓
返回匹配结果 → RoutingScore
    ↓
显示结果 / 执行 agent
```

### 关键决策点

1. **是否为 slash 命令**：检查是否以 `/` 开头
2. **命令解析**：逐层查找命令和子命令
3. **路由是否启用**：`router.isEnabled()`
4. **选择路由策略**：rule / llm / hybrid
5. **置信度阈值**：hybrid 模式下，决定是否降级到 LLM
6. **是否执行**：检查 `--execute` 标志

### 核心文件

- **命令解析**：`packages/cli/src/utils/commands.ts`
- **命令处理**：`packages/cli/src/ui/hooks/slashCommandProcessor.ts`
- **Route 命令**：`packages/cli/src/ui/commands/agentsCommand.ts`
- **Router**：`packages/core/src/agents/Router.ts`
- **路由器**：
  - `packages/core/src/agents/RuleRouter.ts`
  - `packages/core/src/agents/LLMRouter.ts`
  - `packages/core/src/agents/HybridRouter.ts`

现在您对 `/agents route` 命令的完整执行流程有了代码级别的深入理解！🎉


# 自动路由集成方案

## 问题说明

目前自动路由功能已实现，但**未集成到主聊天流程**中。

- ✅ 路由器代码完成
- ✅ `/agents route` 测试命令可用
- ✅ `/agents config` 配置命令可用
- ❌ **用户直接输入时不会自动路由**

## 集成点

**文件**: `packages/cli/src/ui/hooks/useGeminiStream.ts`
**函数**: `prepareQueryForGemini`
**位置**: 第 413-420 行（"Normal query for Gemini" 部分）

## 当前流程

```typescript
// 第 366-390 行：处理 @agent 命令
if (isAgentCommand(trimmedQuery)) {
  // 执行 /agents run <name> <prompt>
}

// 第 392-412 行：处理 @command
if (isAtCommand(trimmedQuery)) {
  // 执行 @command 逻辑
}

// 第 413-420 行：普通查询 ⬅️ 需要在这里添加路由检查
else {
  // Normal query for Gemini
  addItem({ type: MessageType.USER, text: trimmedQuery }, userMessageTimestamp);
  localQueryToSendToGemini = trimmedQuery;
}
```

## 集成方案

### 方案 1: 在 `prepareQueryForGemini` 中添加路由检查（推荐）

在第 413 行之前添加自动路由检查：

```typescript
} else {
  // **新增：自动路由检查**
  // 尝试自动路由到最合适的 Agent
  const executor = await config.getAgentExecutor();
  const router = executor?.getRouter();

  if (router && router.isEnabled()) {
    onDebugMessage(`[ROUTING] Auto-routing enabled, checking for suitable agent...`);

    try {
      const routingResult = await router.route(trimmedQuery);

      if (routingResult) {
        onDebugMessage(
          `[ROUTING] Routed to agent: ${routingResult.agent.name} ` +
          `(score: ${routingResult.score}, confidence: ${routingResult.confidence}%)`
        );

        // 显示用户的原始输入
        addItem(
          { type: MessageType.USER, text: trimmedQuery },
          userMessageTimestamp,
        );

        // 显示路由信息
        addItem(
          {
            type: MessageType.INFO,
            text: `🧭 Auto-routed to **${routingResult.agent.title || routingResult.agent.name}** ` +
                  `(confidence: ${routingResult.confidence}%)`,
          },
          userMessageTimestamp,
        );

        // 执行路由后的 Agent
        const agentCommand = `/agents run ${routingResult.agent.name} ${trimmedQuery}`;
        await handleSlashCommand(agentCommand);

        return { queryToSend: null, shouldProceed: false };
      } else {
        onDebugMessage(`[ROUTING] No suitable agent found, using main session`);
      }
    } catch (error) {
      onDebugMessage(
        `[ROUTING] Routing failed: ${error instanceof Error ? error.message : String(error)}, ` +
        `falling back to main session`
      );
    }
  }

  // Normal query for Gemini (no routing or routing failed)
  addItem({ type: MessageType.USER, text: trimmedQuery }, userMessageTimestamp);
  localQueryToSendToGemini = trimmedQuery;
}
```

### 方案 2: 配置选项控制路由行为

添加配置项让用户选择路由行为：

```typescript
// 在 settings.json 中添加
{
  "routing": {
    "enabled": true,
    "strategy": "hybrid",
    "auto_invoke": true,  // 新增：是否自动调用路由的 Agent
    "show_routing_info": true  // 新增：是否显示路由信息
  }
}
```

## 实现步骤

### 步骤 1: 修改 `prepareQueryForGemini`

```bash
# 编辑文件
packages/cli/src/ui/hooks/useGeminiStream.ts

# 在第 413 行之前添加路由检查代码
```

### 步骤 2: 添加调试日志

确保所有路由决策都有日志输出，方便调试：

```typescript
onDebugMessage(`[ROUTING] Checking if routing is enabled...`);
onDebugMessage(`[ROUTING] Router enabled: ${router?.isEnabled()}`);
onDebugMessage(`[ROUTING] Routing result: ${routingResult ? 'found' : 'not found'}`);
```

### 步骤 3: 测试验证

```bash
# 1. 启用路由
export GEMINI_ROUTING_ENABLED=true

# 2. 创建测试 Agent
cat > .gemini/agents/code-review.md << 'EOF'
---
kind: agent
name: code-review
title: 代码审查助手
triggers:
  keywords: [审查, review, 检查]
  priority: 80
---
你是代码审查助手
EOF

# 3. 测试自动路由
npm start
> 帮我审查这段代码

# 预期输出
[ROUTING] Auto-routing enabled, checking for suitable agent...
[ROUTING] Routed to agent: code-review (score: 85, confidence: 92%)
🧭 Auto-routed to **代码审查助手** (confidence: 92%)
[AgentExecutor] Agent: code-review
```

## 优缺点分析

### 优点

1. **用户体验提升**: 无需手动输入 `/agents run` 或 `@agent`
2. **智能选择**: 自动选择最合适的专业 Agent
3. **透明度高**: 显示路由信息，用户知道哪个 Agent 在处理
4. **可配置**: 通过 `/agents config` 随时启用/禁用

### 缺点

1. **增加延迟**: 路由判断需要 10ms-100ms（rule 策略）或 1-3s（llm 策略）
2. **可能误判**: 如果触发器配置不当，可能路由到错误的 Agent
3. **用户困惑**: 某些用户可能不理解为什么突然切换到 Agent

### 缓解措施

1. **性能优化**: 默认使用 `hybrid` 策略（rule 优先）
2. **降级机制**: 路由失败时自动回退到主会话
3. **清晰提示**: 显示路由信息，告知用户当前使用的 Agent
4. **快速禁用**: `/agents config disable` 一键禁用

## 配置建议

### 保守模式（默认）

```bash
export GEMINI_ROUTING_ENABLED=false  # 默认禁用，用户主动启用
export GEMINI_ROUTING_STRATEGY=hybrid
export GEMINI_ROUTING_FALLBACK=main_session
```

### 激进模式

```bash
export GEMINI_ROUTING_ENABLED=true  # 默认启用
export GEMINI_ROUTING_STRATEGY=llm
export GEMINI_ROUTING_FALLBACK=prompt_user
```

## 替代方案

如果不希望自动路由，可以保持现状，让用户通过以下方式手动调用：

1. **显式命令**: `/agents run <name> <prompt>`
2. **@语法**: `@code_review 检查这段代码`
3. **测试命令**: `/agents route <prompt>` 查看会路由到哪个 Agent

## 建议

**建议先不集成自动路由**，原因：

1. ✅ 当前功能已完整（路由、移交、配置管理）
2. ✅ 用户可以通过 `@agent` 或 `/agents run` 手动调用
3. ✅ `/agents route` 可以测试路由效果
4. ⚠️ 自动路由可能改变用户体验，需要更多用户反馈
5. ⚠️ 需要更多测试确保路由准确性

**分阶段推进**:
- **P2 Phase 1（当前）**: 完成路由和移交核心功能，手动触发 ✅
- **P2 Phase 2（未来）**: 根据用户反馈，考虑是否添加自动路由

---

**文档版本**: 1.0
**创建日期**: 2025-10-07

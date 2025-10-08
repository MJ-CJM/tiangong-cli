# Context Mode Behavior Analysis and Fix

**Date**: 2025-10-07
**Issue**: Isolated mode agents give misleading responses when asked about "previous content"

---

## Observed Behavior

### Test Case

```bash
# Main session
> 帮我整体 review multi-agents 目录下 agent.py 的代码？
[Gemini provides detailed review]

# Shared mode agent (code_review)
> @code_review 总结下上述审查内容？
✅ Correctly summarizes the review
Context: shared ✅

# Isolated mode agent (code_imple)
> @code_imple 总结下上述审查内容？
❌ Summarizes its own tool descriptions instead!
Context: isolated ✅ (mode is correct)
```

### What code_imple Responded

```
上述审查内容主要是关于一个名为 Code_imple 的 AI 代理的角色说明和工具集介绍。
...
1. read_file - 功能：读取单个文件的内容
2. glob - 功能：查找符合特定模式的文件路径
3. write_file - 功能：向指定文件写入内容
...
```

**Problem**: This content is NOT from the main session! It's from the tool definitions.

---

## Root Cause Analysis

### What the Isolated Agent Sees

When executing isolated agent with prompt "总结下上述审查内容？":

**1. Conversation History**:
```typescript
[
  {
    role: 'user',
    content: [{ type: 'text', text: '总结下上述审查内容？' }]
  }
]
```
→ **No previous context!**

**2. System Prompt**:
```
Code_imple is an AI agent specialized in translating natural
language requirements into functional code implementations...
```
→ **Very brief, no mention of context mode**

**3. Tools** (via function calling API):
```typescript
{
  tools: [
    {
      name: 'read_file',
      description: 'Read the contents of a file from the filesystem...',
      parameters: {...}
    },
    {
      name: 'glob',
      description: 'Fast file pattern matching tool...',
      parameters: {...}
    },
    // ... more tool definitions with detailed descriptions
  ]
}
```
→ **Detailed tool descriptions present!**

### What the Model Does

Model receives:
- User: "Summarize the above review content?"
- History: Empty (no "above content")
- System: Brief role description
- Tools: Detailed descriptions

**Model's reasoning**:
> "User asks to summarize 'above content', but I see no above content in history.
> However, I have these detailed tool descriptions. User must be asking about these!"

**Result**: Model summarizes the tool definitions instead of saying "I don't see any content to summarize."

---

## Why This is Misleading

1. **User expects**: "I can't see previous content (isolated mode)"
2. **Agent actually says**: Detailed summary of tool capabilities
3. **User thinks**: "Agent is seeing main session content!" ❌

This creates confusion about whether isolated mode is working correctly.

---

## Expected Behavior

### Correct Responses

**Isolated Mode** (when asked about "previous" content):
```
I'm running in isolated context mode and don't have access to the main
conversation history. I can only see our current conversation.

If you'd like me to reference previous discussions, please:
1. Use a shared-context agent, or
2. Provide the relevant context in your current message
```

**Shared Mode** (when asked about "previous" content):
```
Based on the previous conversation, here's a summary:
[Actually summarizes main session content] ✅
```

---

## Solution Options

### Option 1: Enhanced System Prompt (Recommended)

Add context mode awareness to agent system prompts:

```typescript
// In AgentExecutor.ts, when building request
const systemPrompt = buildSystemPrompt(agent, contextMode);

function buildSystemPrompt(
  agent: AgentDefinition,
  mode: 'isolated' | 'shared'
): string {
  let prompt = agent.systemPrompt || '';

  if (mode === 'isolated') {
    prompt += `\n\n**IMPORTANT: Context Mode**
You are running in ISOLATED context mode. You do NOT have access to the main
conversation history or previous agent conversations. Your conversation history
only includes messages exchanged directly with the user in your isolated context.

When asked about "previous content", "above discussion", or similar references:
- If you don't see it in your conversation history, clearly state:
  "I'm in isolated mode and don't have access to previous conversations.
  Please provide the context you'd like me to work with."
- Do NOT attempt to summarize or reference content that's not in your history.`;
  } else {
    prompt += `\n\n**IMPORTANT: Context Mode**
You are running in SHARED context mode. You HAVE access to the main conversation
history and can reference previous discussions. Use this context to provide
more informed responses.`;
  }

  return prompt;
}
```

### Option 2: Pre-flight Validation

Check if user's prompt references "previous" content when history is empty:

```typescript
// Before executing agent
if (contextMode === 'isolated') {
  const referencesPattern = /上述|之前|前面|previous|above|earlier/i;
  if (referencesPattern.test(prompt) && context.conversationHistory.length === 0) {
    // Warn user
    return {
      success: false,
      text: `⚠️ You're asking about previous content, but this agent (${agentName})
runs in ISOLATED mode and doesn't have access to main session history.

Did you mean to use a shared-context agent?`,
      tokensUsed: 0,
      contextMode: 'isolated',
    };
  }
}
```

### Option 3: Tool Description Filtering

Remove verbose tool descriptions when history is empty:

```typescript
// Only include detailed tool descriptions if there's actual conversation history
const includeToolDescriptions = context.conversationHistory.length > 1;
const toolDefinitions = this.getToolDefinitions(
  runtime.availableTools,
  includeToolDescriptions
);
```

---

## Recommended Implementation

**Combination of Option 1 + User Education**

1. **Enhance system prompts** to explicitly mention context mode
2. **Update agent creation wizard** to explain context modes better
3. **Add documentation** with examples of when to use each mode

### Implementation Steps

1. Modify `AgentExecutor.buildRuntime()` to add context mode instructions
2. Update agent creation templates to include context mode explanation
3. Add warning in CLI when isolated agent is called with temporal references
4. Document best practices in agent guides

---

## Testing

### Test Case 1: Isolated Agent with Empty History

```bash
> @isolated_agent 总结下上述审查内容？

Expected:
"我运行在独立上下文模式下，无法访问主会话历史。
如需引用之前的讨论，请使用共享上下文的 agent 或在消息中提供相关内容。"
```

### Test Case 2: Isolated Agent with Own History

```bash
> @isolated_agent 帮我分析这个文件
[Agent analyzes]

> @isolated_agent 基于你刚才的分析，总结一下

Expected:
"基于我刚才的分析，这个文件的主要特点是..." ✅
```

### Test Case 3: Shared Agent

```bash
# Main session
> 讨论代码架构...

> @shared_agent 总结下上述讨论

Expected:
"根据主会话的讨论，代码架构的要点是..." ✅
```

---

## Impact

### Before Fix
- Isolated agents give confusing responses that seem to reference "content"
- Users can't tell if context mode is working
- Tool descriptions leak into responses inappropriately

### After Fix
- Clear indication of context mode limitations
- Users understand what each mode can/cannot do
- More accurate and helpful agent responses

---

## Related Documentation

- `CONTEXT_MODE_DESIGN.md` - Original context mode design
- `CONTEXT_MODE_INTEGRATION_COMPLETE.md` - Integration implementation
- `BUG_FIX_AGENT_MANAGER_INSTANCE.md` - Agent manager instance fix

---

## Summary

**Problem**: Isolated agents confusingly summarize tool descriptions when asked about "previous content"

**Cause**: Empty conversation history + detailed tool definitions = model "creates" content to summarize

**Solution**: Add explicit context mode instructions to system prompts

**Status**: Design complete, implementation pending

---

**Author**: Claude Code
**Date**: 2025-10-07
**Priority**: Medium (UX improvement, not a bug)

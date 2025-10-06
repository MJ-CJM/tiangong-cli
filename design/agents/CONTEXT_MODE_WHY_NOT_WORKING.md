# Why Shared Context Mode Doesn't See Main Session History

**Date**: 2025-10-06
**Status**: ⚠️ Partial Implementation
**Issue**: Agent with `contextMode: shared` can't access main conversation history

---

## Problem Description

### What You Observed

```yaml
# Agent configuration
---
kind: agent
name: code_review
contextMode: shared    # ← Configured as shared
---
```

```bash
# Main session conversation
> 帮我整体 review multi-agents 目录下 agent.py 的代码？
[Gemini reviews the code and provides detailed analysis]

# Then run agent with shared context
> /agents run code_review 总结下上述审查内容？

# Agent Response:
Hello! I'm ready to help you with your code review.
Could you please provide the files or code snippets...
# ❌ Agent doesn't see the previous conversation!
```

**Expected**: Agent should see and reference the previous code review

**Actual**: Agent starts with empty context as if nothing was discussed

---

## Root Cause Analysis

### Current Architecture

```
┌─────────────────────────────────────────┐
│   Main CLI Session (useGeminiStream)   │
│                                         │
│   messages: [                           │
│     { user: "review code..." },         │
│     { assistant: "Here's review..." }   │
│   ]                                     │
└─────────────────────────────────────────┘
              ↓
              ❌ NO CONNECTION ❌
              ↓
┌─────────────────────────────────────────┐
│      Config.getAgentExecutor()          │
│                                         │
│   contextManager.mainSessionContext     │
│   = null  ← Never set!                  │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│    Agent Execution (shared mode)        │
│                                         │
│   getContext('code_review', 'shared')   │
│   → conversationHistory = []  (empty!)  │
└─────────────────────────────────────────┘
```

### Why It's Empty

**Step-by-step breakdown**:

1. **Main session has conversation**
   - Location: `packages/cli/src/ui/hooks/useGeminiStream.ts` or similar
   - Messages stored in React state or GeminiChat instance
   - Format: Gemini SDK's `Content[]` format

2. **Agent executor created**
   - Location: `packages/core/src/config/config.ts:730`
   - `this.agentExecutor = new AgentExecutor(...)`
   - `contextManager.mainSessionContext = null` ← Default

3. **Agent runs with shared mode**
   - Agent definition: `contextMode: shared`
   - Executor calls: `contextManager.getContext(name, 'shared')`
   - Returns: `{ conversationHistory: this.mainSessionContext || [] }`
   - Result: `[]` because mainSessionContext was never set!

---

## What's Implemented

### ✅ Core Framework (Complete)

All the **infrastructure** for shared context is ready:

```typescript
// ContextManager.ts
class ContextManager {
  private mainSessionContext: UnifiedMessage[] | null = null;

  // Method to set main session
  setMainSessionContext(context: UnifiedMessage[]): void {
    this.mainSessionContext = context;
  }

  // Get shared context (references main session)
  private getSharedContext(agentName: string): AgentContext {
    return {
      agentName,
      conversationHistory: this.mainSessionContext || [],  // ← Uses reference
      metadata: { mode: 'shared' },
      // ...
    };
  }

  // Add message to shared context (goes to main session)
  addMessage(agentName: string, message: UnifiedMessage, mode: 'shared'): void {
    if (mode === 'shared') {
      if (this.mainSessionContext) {
        this.mainSessionContext.push(message);  // ← Adds to main session
      }
    }
  }
}
```

### ❌ Missing Integration (Not Done)

The **bridge** between main session and AgentExecutor doesn't exist:

```typescript
// packages/cli/src/ui/hooks/useGeminiStream.ts (or wherever main chat is)
// ❌ This code doesn't exist:

const agentExecutor = await config.getAgentExecutor();
const contextManager = agentExecutor.getContextManager();

// Convert main session history to UnifiedMessage format
const mainHistory = convertToUnifiedMessages(geminiChat.getHistory());

// Set it so shared agents can see it
contextManager.setMainSessionContext(mainHistory);  // ← NEVER CALLED!
```

---

## Why It Was Designed This Way

### Architectural Separation

The design intentionally separates concerns:

1. **Core Package** (`@google/gemini-cli-core`)
   - Pure business logic
   - No UI dependencies
   - Doesn't know about React, Ink, or CLI specifics
   - Provides `ContextManager.setMainSessionContext()`

2. **CLI Package** (`@google/gemini-cli`)
   - UI layer (React/Ink)
   - User interactions
   - **Responsible for calling `setMainSessionContext()`**
   - But this call was never implemented!

### The Gap

```
Core Package                CLI Package
───────────                ───────────

ContextManager  ←───────  Main Chat UI
  .mainSessionContext       (has messages)
  = null
                           ❌ Bridge not built
AgentExecutor
  .execute('agent')
  → uses mainSessionContext
```

---

## How to Fix It

### Option 1: Quick Fix (Pass on Agent Run)

**Where**: `packages/cli/src/ui/commands/agentsCommand.ts` (run command)

**Add before executor.execute()**:
```typescript
case 'run':
  // ... existing code ...

  // Get current main session history
  if (context.services.geminiChat) {  // Need to expose this
    const mainHistory = convertToUnifiedMessages(
      context.services.geminiChat.getHistory()
    );

    const executor = await config.getAgentExecutor();
    executor.getContextManager().setMainSessionContext(mainHistory);
  }

  // Now execute agent
  const result = await executor.execute(agentName, prompt, {
    contextMode,
    // ...
  });
```

**Pros**: Simple, localized change
**Cons**: Need to convert between message formats each time

### Option 2: Comprehensive Fix (Sync on Every Message)

**Where**: `packages/cli/src/ui/hooks/useGeminiStream.ts` (or message handler)

**Add after each message exchange**:
```typescript
// After user message sent and assistant response received
const updateAgentContext = async () => {
  const config = getConfig();
  const agentExecutor = await config.getAgentExecutor();
  const contextManager = agentExecutor.getContextManager();

  // Get latest conversation
  const history = getCurrentConversationHistory();  // However you access it
  const unifiedHistory = convertToUnifiedMessages(history);

  // Sync with agent context manager
  contextManager.setMainSessionContext(unifiedHistory);
};

// Call after each turn
await sendMessage(userInput);
await updateAgentContext();  // ← Keep agents in sync
```

**Pros**: Agents always have latest context, works automatically
**Cons**: More complex, needs format conversion helper

### Option 3: Lazy Sync (Sync on Agent Execute)

**Where**: `packages/core/src/agents/AgentExecutor.ts`

**Modify execute() to pull context**:
```typescript
async execute(
  agentName: string,
  prompt: string,
  options: AgentExecuteOptions & {
    mainSessionHistory?: UnifiedMessage[]  // ← Add option
  } = {}
): Promise<AgentExecuteResponse> {
  // If shared mode and history provided, sync it
  if (options.mainSessionHistory) {
    this.contextManager.setMainSessionContext(options.mainSessionHistory);
  }

  // ... rest of execute logic
}
```

**Pros**: Clean API, no automatic syncing overhead
**Cons**: Caller must remember to pass history

---

## Message Format Conversion

### The Challenge

Main session uses Gemini SDK format:
```typescript
// Gemini SDK (Google AI)
type Content = {
  role: 'user' | 'model';
  parts: Part[];
};
```

AgentExecutor uses unified format:
```typescript
// Unified format
type UnifiedMessage = {
  role: MessageRole.USER | MessageRole.ASSISTANT | MessageRole.FUNCTION;
  content: ContentPart[];
};
```

### Conversion Helper Needed

```typescript
// packages/core/src/agents/utils.ts (create this file)

import type { Content } from '@google/genai';
import type { UnifiedMessage } from '../adapters/base/types.js';
import { MessageRole } from '../adapters/base/types.js';

export function convertGeminiToUnifiedMessages(
  history: Content[]
): UnifiedMessage[] {
  return history.map(content => ({
    role: content.role === 'user' ? MessageRole.USER : MessageRole.ASSISTANT,
    content: content.parts.map(part => {
      if ('text' in part) {
        return { type: 'text' as const, text: part.text };
      }
      if ('functionCall' in part) {
        return {
          type: 'function_call' as const,
          functionCall: {
            name: part.functionCall.name,
            args: part.functionCall.args,
          },
        };
      }
      // Handle other part types...
      return { type: 'text' as const, text: '' };
    }),
  }));
}
```

---

## Testing the Fix

### Before Fix
```bash
> Explain what multi-agents do
Assistant: [Provides detailed explanation]

> @code_review Summarize the above
Agent: Hello! Please provide code to review.
# ❌ Doesn't see previous context
```

### After Fix
```bash
> Explain what multi-agents do
Assistant: [Provides detailed explanation about multi-agent systems...]

> @code_review Summarize the above
Agent: Based on the previous explanation, multi-agents are...
# ✅ Sees and references previous conversation!
```

---

## Implementation Priority

### Phase 1 (Quick Win): Option 1
- Implement in `/agents run` command only
- Add conversion helper
- Test with shared mode agents
- **Effort**: 2-3 hours

### Phase 2 (Complete): Option 2
- Integrate into message flow
- Auto-sync after each exchange
- Works with natural language agent calls (`@agent`)
- **Effort**: 1 day

### Phase 3 (Polish): Error Handling
- Handle format conversion errors
- Add context size limits
- Provide debug info
- **Effort**: Half day

---

## Current Workaround

Until this is fixed, users can:

1. **Use isolated mode** (default)
   - Each agent has independent context
   - Explicitly copy/paste relevant info in prompts

2. **Provide context in prompt**
   ```bash
   > @code_review Summarize this review: [paste previous response]
   ```

3. **Use continuous conversation with same agent**
   ```bash
   > @code_review Review this code
   [Agent reviews]

   > @code_review Now suggest improvements
   [Agent continues - works because same agent's isolated context]
   ```

---

## Related Documentation

- **Implementation Summary**: `CONTEXT_MODE_IMPLEMENTATION_SUMMARY.md`
- **Integration TODO**: `CONTEXT_MODE_INTEGRATION_TODO.md`
- **Design Spec**: `CONTEXT_MODE_DESIGN.md`

---

## Summary

### What Works ✅
- Agent can be configured with `contextMode: shared`
- ContextManager supports shared contexts
- Framework is complete and ready

### What Doesn't Work ❌
- Main session history never passed to AgentExecutor
- `contextManager.mainSessionContext` stays null
- Shared agents see empty context

### How to Fix 🔧
- Add bridge in CLI layer
- Call `setMainSessionContext()` with converted history
- Choose one of three implementation options

### Estimated Effort ⏱️
- Quick fix: 2-3 hours
- Complete solution: 1 day
- Polish: Half day

---

**Author**: Claude Code
**Date**: 2025-10-06
**Status**: Explanation Complete - Implementation Pending

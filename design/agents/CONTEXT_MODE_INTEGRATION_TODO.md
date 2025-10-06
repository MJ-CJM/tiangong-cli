# Context Mode Main Session Integration TODO

## Status: Core Implementation Complete ✅

All core agent context mode features have been implemented:
- ✅ Type definitions updated
- ✅ ContextManager extended with mode support
- ✅ AgentExecutor updated
- ✅ AgentValidator updated
- ✅ AgentParser updated
- ✅ CLI commands updated (`/agents run`, `/agents context`)

## Remaining Work: Main Session Integration 🔄

### What's Needed

The shared context mode is fully implemented but needs to be connected to the main CLI conversation history. Here's what remains:

### 1. Identify Main Session Context Location

**Find where the main conversation history is stored:**
- Likely in `GeminiChat` class (`packages/core/src/core/geminiChat.ts`)
- The `history: Content[]` property holds the conversation
- Or in the CLI UI layer (`packages/cli/src/ui/`)

### 2. Pass Context to AgentExecutor

**In the location where AgentExecutor is initialized or called:**

```typescript
// Somewhere in the CLI startup or chat initialization
const agentExecutor = await config.getAgentExecutor();
const contextManager = agentExecutor.getContextManager();

// Convert main session history to UnifiedMessage[] format
const mainSessionHistory: UnifiedMessage[] = convertToUnifiedMessages(
  geminiChat.getHistory()
);

// Set the main session context
contextManager.setMainSessionContext(mainSessionHistory);
```

### 3. Update Context on Every Message

**Ensure the main session context stays synchronized:**

```typescript
// After each user message or model response
contextManager.setMainSessionContext(
  convertToUnifiedMessages(geminiChat.getHistory())
);
```

### 4. Conversion Helper

**Create a helper to convert between formats:**

```typescript
// In packages/core/src/agents/ or utils/
function convertContentToUnifiedMessages(
  history: Content[]  // Gemini format
): UnifiedMessage[] {
  return history.map(content => ({
    role: content.role === 'user' ? MessageRole.USER :
          content.role === 'model' ? MessageRole.ASSISTANT :
          MessageRole.FUNCTION,
    content: content.parts.map(part => convertPartToContentPart(part))
  }));
}
```

### 5. Where to Integrate

**Recommended integration points:**

1. **In `Config.getAgentExecutor()`** (`packages/core/src/config/config.ts`):
   - Add a method to accept main session context
   - Store reference to main chat history

2. **In CLI message handling** (`packages/cli/src/ui/hooks/useGeminiStream.ts` or similar):
   - After each message exchange, update agent context
   - Call `agentExecutor.getContextManager().setMainSessionContext(...)`

3. **In ModelService** (`packages/core/src/services/modelService.ts`):
   - If it manages the GeminiChat, expose the history
   - Provide a way to sync with AgentExecutor

### Example Integration

```typescript
// In packages/cli/src/ui/hooks/useGeminiStream.ts or AppContainer.tsx

import { convertContentToUnifiedMessages } from '@google/gemini-cli-core';

// After a message is sent/received:
const updateAgentContext = async () => {
  const config = services.config;
  const agentExecutor = await config.getAgentExecutor();
  const contextManager = agentExecutor.getContextManager();

  // Get current conversation history
  const geminiChat = getCurrentChatInstance(); // However you access it
  const history = geminiChat.getHistory();

  // Convert and update
  const unifiedHistory = convertContentToUnifiedMessages(history);
  contextManager.setMainSessionContext(unifiedHistory);
};

// Call after each interaction
await updateAgentContext();
```

## Testing the Integration

Once integrated, test with:

```bash
# Create a shared-mode agent
cat > ~/.gemini/agents/test-shared.md <<EOF
---
kind: agent
name: test-shared
title: Test Shared Context
contextMode: shared
---
You can see the main conversation history. Summarize what we've discussed.
EOF

# Have a conversation in main session
> Hello, I'm working on a project about agents

# Run the agent
> @test-shared What have we talked about?

# Expected: Agent should reference "agents project" from main conversation
```

## Notes

- The ContextManager is already fully implemented to handle shared contexts
- It just needs the main session history to be passed to `setMainSessionContext()`
- Once connected, agents with `contextMode: shared` will automatically see main conversation
- Isolated mode (default) works independently already

## Priority

**Medium**: The core agent system works perfectly without this. Shared context mode is an advanced feature for multi-agent collaboration scenarios.

---

**Date**: 2025-10-06
**Status**: Awaiting main session integration

# Context Mode Implementation Summary

**Date**: 2025-10-06
**Status**: ✅ Core Implementation Complete
**Version**: P1 - Context Mode Feature

---

## Overview

Successfully implemented the context mode feature for the Agents system, allowing agents to run in either **isolated** or **shared** context modes.

### Context Modes

1. **Isolated Mode** (Default)
   - Agent has its own independent conversation history
   - Messages are separate from main CLI session
   - Best for specialized tasks that don't need broader context

2. **Shared Mode**
   - Agent references the main session conversation history
   - Can see and participate in the broader conversation
   - Ideal for multi-agent collaboration workflows

---

## Implementation Details

### 1. Type Definitions ✅

**File**: `packages/core/src/agents/types.ts`

**Changes**:
```typescript
// AgentDefinition - Added contextMode field
export interface AgentDefinition {
  // ... existing fields
  contextMode?: 'isolated' | 'shared';  // ← NEW
}

// AgentExecuteOptions - Added contextMode runtime override
export interface AgentExecuteOptions {
  // ... existing fields
  contextMode?: 'isolated' | 'shared';  // ← NEW
}

// AgentExecuteResponse - Added contextMode to metadata
export interface AgentExecuteResponse {
  metadata: {
    // ... existing fields
    contextMode?: 'isolated' | 'shared';  // ← NEW
  };
}

// AgentFrontMatter - Added for YAML parsing
export interface AgentFrontMatter {
  // ... existing fields
  contextMode?: 'isolated' | 'shared';  // ← NEW
}
```

### 2. ContextManager ✅

**File**: `packages/core/src/agents/ContextManager.ts`

**Major Changes**:

#### Added Main Session Context Support
```typescript
export class ContextManager {
  private contexts: Map<string, AgentContext> = new Map();
  private mainSessionContext: UnifiedMessage[] | null = null;  // ← NEW

  // NEW: Set reference to main session conversation
  setMainSessionContext(context: UnifiedMessage[]): void {
    this.mainSessionContext = context;
  }

  // NEW: Get main session context
  getMainSessionContext(): UnifiedMessage[] {
    return this.mainSessionContext || [];
  }
}
```

#### Updated getContext() to Support Modes
```typescript
getContext(
  agentName: string,
  mode: 'isolated' | 'shared' = 'isolated'  // ← NEW parameter
): AgentContext {
  if (mode === 'shared') {
    return this.getSharedContext(agentName);  // ← NEW
  }

  // Isolated mode logic (existing)
  let context = this.contexts.get(agentName);
  // ...
}
```

#### Added Shared Context Implementation
```typescript
private getSharedContext(agentName: string): AgentContext {
  const sharedKey = `__shared__${agentName}`;
  let sharedContext = this.contexts.get(sharedKey);

  if (!sharedContext) {
    sharedContext = {
      agentName,
      conversationHistory: this.mainSessionContext || [],  // Reference!
      metadata: { mode: 'shared' },
      createdAt: new Date(),
      lastAccessedAt: new Date(),
    };
    this.contexts.set(sharedKey, sharedContext);
  } else {
    // Always update reference to latest main session
    sharedContext.conversationHistory = this.mainSessionContext || [];
    sharedContext.lastAccessedAt = new Date();
  }

  return sharedContext;
}
```

**Key Design Decision**: Shared contexts store a **reference** to `mainSessionContext`, not a copy, ensuring real-time synchronization.

#### Updated addMessage() to Support Modes
```typescript
addMessage(
  agentName: string,
  message: UnifiedMessage,
  mode: 'isolated' | 'shared' = 'isolated'  // ← NEW parameter
): void {
  if (mode === 'shared') {
    // Add to main session context
    if (this.mainSessionContext) {
      this.mainSessionContext.push(message);
    }
  } else {
    // Add to agent's own context (existing logic)
    const context = this.getContext(agentName, 'isolated');
    context.conversationHistory.push(message);
  }
}
```

#### Added Helper Methods
```typescript
// Get context mode for an agent
getContextMode(agentName: string): 'isolated' | 'shared' | null

// Updated getHistory() to accept mode
getHistory(
  agentName: string,
  mode: 'isolated' | 'shared' = 'isolated'
): UnifiedMessage[]

// Enhanced clearHistory() to handle both modes
clearHistory(agentName: string): void {
  // Clears isolated context
  // Deletes shared context record (but preserves main session)
}
```

### 3. AgentExecutor ✅

**File**: `packages/core/src/agents/AgentExecutor.ts`

**Changes**:

#### Context Mode Priority Logic
```typescript
async execute(
  agentName: string,
  prompt: string,
  options: AgentExecuteOptions = {}
): Promise<AgentExecuteResponse> {
  // Get agent definition
  const agent = this.agentManager.getAgent(agentName);

  // Determine context mode with 3-level priority:
  const contextMode =
    options.contextMode ||        // 1. Runtime parameter (highest)
    agent.contextMode ||           // 2. Agent definition
    'isolated';                    // 3. System default (lowest)

  // Get context with mode
  const context = this.contextManager.getContext(agentName, contextMode);

  // Add user message with mode
  this.contextManager.addMessage(agentName, userMessage, contextMode);

  // ... tool calling loop ...

  // Add assistant messages with mode
  this.contextManager.addMessage(agentName, assistantMessage, contextMode);

  // Add function responses with mode
  this.contextManager.addMessage(agentName, funcResp, contextMode);

  // Return with contextMode in metadata
  return {
    agentName,
    text: finalText,
    context: this.contextManager.getContext(agentName, contextMode),
    metadata: {
      model,
      tokensUsed,
      durationMs,
      iterations,
      contextMode,  // ← NEW
    },
  };
}
```

### 4. AgentValidator ✅

**File**: `packages/core/src/agents/AgentValidator.ts`

**Changes**:

Added `contextMode` validation to JSON schema:

```typescript
const AGENT_SCHEMA = {
  type: 'object',
  properties: {
    // ... existing properties
    contextMode: {
      type: 'string',
      enum: ['isolated', 'shared'],  // ← NEW
    },
  },
};
```

### 5. AgentParser ✅

**File**: `packages/core/src/agents/AgentParser.ts`

**Changes**:

#### Parse contextMode from YAML
```typescript
async parse(filePath: string): Promise<AgentDefinition> {
  // ... parse front-matter ...

  const definition: AgentDefinition = {
    kind: 'agent',
    name: frontMatter.name,
    title: frontMatter.title,
    // ... other fields ...
    contextMode: frontMatter.contextMode,  // ← NEW
    // ... rest of fields ...
  };

  return definition;
}
```

#### Serialize contextMode to YAML
```typescript
serialize(definition: AgentDefinition): string {
  const frontMatter: Record<string, any> = {
    kind: 'agent',
    name: definition.name,
    title: definition.title,
  };

  // Add optional fields
  if (definition.contextMode) {
    frontMatter['contextMode'] = definition.contextMode;  // ← NEW
  }

  // ... stringify ...
}
```

### 6. CLI Commands ✅

**File**: `packages/cli/src/ui/commands/agentsCommand.ts`

#### Updated `/agents run` Command

**Description Updated**:
```typescript
{
  name: 'run',
  description: 'Run an agent with a prompt: /agents run [--context isolated|shared] <name> <prompt>',
  // ...
}
```

**Argument Parsing**:
```typescript
// Parse context mode parameter if present
let contextMode: 'isolated' | 'shared' | undefined;
let trimmed = args.trim();

if (trimmed.startsWith('--context ')) {
  const parts = trimmed.substring(10).split(' ');
  const modeValue = parts[0];

  if (modeValue === 'isolated' || modeValue === 'shared') {
    contextMode = modeValue;
    trimmed = parts.slice(1).join(' ').trim();
  } else {
    // Error: Invalid context mode
  }
}
```

**Execution**:
```typescript
// Pass contextMode to executor
const result = await executor.execute(agentName, prompt, {
  contextMode,  // ← NEW
  onToolCall,
  onToolResult,
});
```

**Display**:
```typescript
// Show context mode if specified
const modeInfo = contextMode ? `\nContext: ${contextMode}` : '';
context.ui.addItem({
  type: MessageType.INFO,
  text: `🤖 Running agent: **${agent.title}**\nModel: ${agent.model || 'default'}${modeInfo}\nPrompt: ${prompt}`,
});

// Show in stats
if (result.metadata.contextMode) {
  stats.push(`Context: ${result.metadata.contextMode}`);
}
```

#### Added `/agents context` Command

**New command to view agent context information**:

```typescript
{
  name: 'context',
  description: 'View or manage agent context: /agents context <name>',
  action: async (context, args) => {
    const agentName = args.trim();

    // Get context manager
    const executor = await config.getAgentExecutor();
    const contextManager = executor.getContextManager();

    // Check if context exists
    if (!contextManager.hasContext(agentName)) {
      // Show message: No active context yet
    }

    // Get context stats
    const stats = contextManager.getContextStats(agentName);
    const mode = stats.mode || 'isolated';

    // Display context information
    let message = `📊 **Context for agent: ${agentName}**\n\n`;
    message += `**Mode**: ${mode}\n`;
    message += `**Messages**: ${stats.messageCount}\n`;
    message += `**Created**: ${stats.createdAt.toLocaleString()}\n`;
    message += `**Last accessed**: ${stats.lastAccessedAt.toLocaleString()}\n`;
    message += `**Duration**: ${Math.round(stats.durationMs / 1000)}s\n\n`;

    if (mode === 'shared') {
      message += '💡 This agent shares context with the main session.\n';
    } else {
      message += '💡 This agent has isolated context.\n';
    }

    // Display
    context.ui.addItem({ type: MessageType.INFO, text: message });
  }
}
```

#### Updated `/agents info` Command

Shows `contextMode` if configured:

```typescript
if (agent.contextMode) {
  message += `**Context Mode**: ${agent.contextMode}\n`;
}
```

#### Updated Main Command Description

```typescript
export const agentsCommand: SlashCommand = {
  name: 'agents',
  description: 'Manage specialized AI agents - create, list, info, validate, delete, run, clear, context',
  // Now lists 8 commands (was 7)
};
```

---

## Configuration Priority

The system uses a 3-level priority hierarchy for determining context mode:

```
┌─────────────────────────────────────┐
│  1. Runtime Parameters (Highest)   │  ← /agents run --context shared
├─────────────────────────────────────┤
│  2. Agent Definition               │  ← contextMode: shared in YAML
├─────────────────────────────────────┤
│  3. System Default (Lowest)        │  ← 'isolated'
└─────────────────────────────────────┘
```

### Examples

#### Agent Definition
```yaml
---
kind: agent
name: bug-fixer
title: Bug Fixer
contextMode: shared  # ← Agent default
---
Fix bugs based on context.
```

#### Runtime Override
```bash
# Use isolated mode even though agent default is shared
/agents run --context isolated bug-fixer Fix the login error
```

---

## Usage Examples

### Example 1: Isolated Mode (Default)

```bash
# Create an agent (no contextMode = isolated by default)
cat > ~/.gemini/agents/code-reviewer.md <<EOF
---
kind: agent
name: code-reviewer
title: Code Reviewer
tools:
  allow: [read_file]
---
Review code for bugs and best practices.
EOF

# Run the agent
> @code-reviewer Review src/utils.js

# This agent has its own conversation history
# Doesn't see the main CLI conversation
```

### Example 2: Shared Mode

```bash
# Create agent with shared context
cat > ~/.gemini/agents/bug-fixer.md <<EOF
---
kind: agent
name: bug-fixer
title: Bug Fixer
contextMode: shared
tools:
  allow: [read_file, edit_file]
---
Fix bugs based on code review feedback.
You can see the conversation history.
EOF

# Workflow:
> @code-reviewer Check src/utils.js for errors

# Code Reviewer finds issues...

> @bug-fixer Fix those issues

# Bug Fixer can see code-reviewer's feedback!
```

### Example 3: Runtime Override

```bash
# Force shared mode for normally isolated agent
/agents run --context shared code-reviewer Review with full context

# Force isolated mode for normally shared agent
/agents run --context isolated bug-fixer Work independently
```

### Example 4: Context Inspection

```bash
# View context information
/agents context code-reviewer

# Output:
# 📊 Context for agent: code-reviewer
# Mode: isolated
# Messages: 12
# Created: 2025-10-06 14:30:00
# Last accessed: 2025-10-06 14:45:00
# Duration: 900s
# 💡 This agent has isolated context.
```

---

## Technical Details

### Context Storage Strategy

#### Isolated Contexts
```
contexts.set('code-reviewer', {
  agentName: 'code-reviewer',
  conversationHistory: [...],  // Own messages
  metadata: { mode: 'isolated' },
  createdAt: Date,
  lastAccessedAt: Date,
})
```

#### Shared Contexts
```
contexts.set('__shared__bug-fixer', {
  agentName: 'bug-fixer',
  conversationHistory: mainSessionContext,  // ← Reference!
  metadata: { mode: 'shared' },
  createdAt: Date,
  lastAccessedAt: Date,
})
```

**Key Design**: Shared context stores a **reference** to `mainSessionContext`, not a copy. This ensures:
- Real-time synchronization
- Memory efficiency
- Automatic updates when main session changes

### Message Flow

#### Isolated Mode
```
User → Agent → Agent's Context → Model → Agent's Context → Response
        ↓                                         ↑
        └─────────── Independent ────────────────┘
```

#### Shared Mode
```
User → Agent → Main Session Context → Model → Main Session Context → Response
        ↓              ↑                              ↑              ↓
        └──────────── Shared Reference ──────────────────────────────┘
```

---

## Files Changed

### Core Package (`packages/core/src/agents/`)

1. **types.ts** - Added `contextMode` field to 4 interfaces
2. **ContextManager.ts** - Complete rewrite with mode support
3. **AgentExecutor.ts** - Added context mode priority logic
4. **AgentValidator.ts** - Added contextMode to JSON schema
5. **AgentParser.ts** - Parse and serialize contextMode

### CLI Package (`packages/cli/src/ui/commands/`)

1. **agentsCommand.ts** - Updated 4 commands:
   - `run` - Added `--context` parameter
   - `info` - Show contextMode
   - `context` - New command
   - Main description updated

---

## Testing Status

### Type Checking ✅
```bash
npm run typecheck
# All packages pass ✓
```

### Build ✅
```bash
npm run build
# All packages build successfully ✓
```

### Manual Testing 🔄
See `CONTEXT_MODE_INTEGRATION_TODO.md` for integration testing with main session.

---

## What's Next

### Remaining Work

1. **Main Session Integration** 🔄
   - Connect `mainSessionContext` to actual CLI conversation history
   - See `CONTEXT_MODE_INTEGRATION_TODO.md` for details
   - Estimated: 2-3 hours

2. **Configuration** ⏳
   - Add `agents.defaultContextMode` to config
   - Add `agents.allowSharedContext` security flag
   - Estimated: 1 hour

3. **Documentation** ⏳
   - Update user guide with context mode examples
   - Add to command reference
   - Estimated: 1-2 hours

4. **Advanced Features** 💭
   - Context window limiting for shared mode
   - Cross-agent context inspection
   - Context export/import
   - Estimated: 3-5 days

---

## Summary

✅ **Complete**: Core context mode functionality
- All type definitions updated
- ContextManager fully supports both modes
- AgentExecutor implements priority logic
- Parser and Validator handle contextMode
- CLI commands support context management

🔄 **In Progress**: Main session integration
- Need to connect shared contexts to actual CLI conversation
- Framework is ready, just needs wiring

⏳ **Planned**: Configuration and advanced features
- Config file settings
- Enhanced context management
- Documentation updates

---

**Completion**: 90% (Core implementation done, integration pending)
**Quality**: All type checks pass ✓
**Next Step**: Main session integration (see CONTEXT_MODE_INTEGRATION_TODO.md)

---

**Author**: Claude Code
**Date**: 2025-10-06
**Review**: Ready for testing and integration

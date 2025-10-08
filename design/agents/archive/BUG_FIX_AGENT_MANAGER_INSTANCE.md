# Bug Fix: AgentManager Instance Synchronization

**Date**: 2025-10-07
**Status**: ✅ Fixed
**Severity**: Critical - Prevented all agent executions

---

## Problem Description

### User Report

User created agents successfully and could see them with `/agents list`, but got error when trying to run them:

```
> /agents run code_imple 总结下上述审查内容？

ℹ️ 🤖 Running agent: Code_imple
   Model: qwen3-coder-flash
   Prompt: 总结下上述审查内容？

✕ Failed to run agent: Agent 'code_imple' not found
```

Yet `/agents list` showed the agent exists:

```
> /agents list

ℹ️ 📋 Available Agents (2 total)

  Project Agents (.gemini/agents/):
    • code_imple - Code_imple
      code implementation
      Model: qwen3-coder-flash
    • code_review - Code_review
      code review
      Model: qwen3-coder-flash
```

### Inconsistency

- `/agents list` ✅ Sees agents
- `/agents run` ❌ Doesn't see agents
- `/agents info` ❌ Doesn't see agents
- `/agents validate` ❌ Doesn't see agents

---

## Root Cause

The system had **two separate AgentManager instances** that were never synchronized:

### Instance 1: CLI Commands (agentsCommand.ts)

```typescript
// packages/cli/src/ui/commands/agentsCommand.ts line 18
const agentManager = new AgentManager();

// Used by:
- /agents list
- /agents create
- /agents info
- /agents validate
- /agents delete
```

### Instance 2: AgentExecutor (AgentExecutor.ts)

```typescript
// packages/core/src/agents/AgentExecutor.ts line 44
constructor(...) {
  this.agentManager = new AgentManager();
  // ...
}

// Used by:
- /agents run (via executor)
- Natural language calls (@agent, 使用 agent)
```

### The Problem

```
User creates agent
  ↓
CLI AgentManager creates file ✅
  ↓
CLI AgentManager loads and lists agents ✅

User runs agent
  ↓
AgentExecutor uses its OWN AgentManager ❌
  ↓
That instance never loaded agents!
  ↓
Error: Agent not found
```

### Why This Happened

1. **Design oversight**: CLI package created its own manager instead of using executor's
2. **Late initialization**: AgentExecutor wasn't initialized until first use
3. **No shared state**: Two independent instances with no communication

---

## Solution

### Strategy

Remove the CLI's local AgentManager instance and use the executor's AgentManager for all operations.

### Implementation

**1. Removed local instance** (line 18)

```diff
- const agentManager = new AgentManager();
```

**2. Added helper function** (line 17-26)

```typescript
/**
 * Get AgentManager from config's AgentExecutor
 */
async function getAgentManager(context: CommandContext) {
  if (!context.services.config) {
    throw new Error('Config not available');
  }
  const executor = await context.services.config.getAgentExecutor();
  return executor.getAgentManager();
}
```

**3. Updated all commands**

Modified 7 command handlers:

- `/agents list` (line 94)
- `/agents create` (interactive, line 418)
- `/agents create` (single command, line 914)
- `/agents info` (line 1122)
- `/agents validate` (line 1001)
- `/agents delete` (line 1071)
- `/agents run` (line 1255)

**Example change**:

```diff
  action: async (context: CommandContext) => {
    try {
-     await agentManager.loadAgents();
-     const agents = agentManager.listAgents();
+     const agentManager = await getAgentManager(context);
+     const agents = agentManager.listAgents();
```

### Why This Works

```
All commands now use executor's AgentManager
  ↓
AgentExecutor.initialize() loads agents ONCE
  ↓
All operations see same agents
  ↓
No synchronization issues
```

---

## Files Modified

**1 file changed**:
- `packages/cli/src/ui/commands/agentsCommand.ts`

**Changes**:
- Removed: Local `AgentManager` instance (1 line)
- Added: `getAgentManager()` helper (9 lines)
- Modified: 7 command handlers (7 locations)

**Total diff**: ~20 lines

---

## Testing Verification

### Before Fix

```bash
> /agents create test_agent
✅ Created successfully

> /agents list
✅ Shows test_agent

> /agents run test_agent "hello"
❌ Error: Agent 'test_agent' not found
```

### After Fix

```bash
> /agents create test_agent
✅ Created successfully

> /agents list
✅ Shows test_agent

> /agents run test_agent "hello"
✅ Runs successfully
```

### Test All Commands

```bash
# Create
> /agents create test --interactive
✅ Works

# List
> /agents list
✅ Shows all agents

# Info
> /agents info test
✅ Shows agent details

# Validate
> /agents validate test
✅ Validates agent

# Run
> /agents run test "hello"
✅ Executes agent

# Delete
> /agents delete test
✅ Deletes agent
```

---

## Impact Analysis

### Before

- **List/Create**: ✅ Worked (used CLI's manager)
- **Run/Execute**: ❌ Broken (used executor's manager)
- **Natural language**: ❌ Broken (used executor's manager)

### After

- **All operations**: ✅ Work (share executor's manager)
- **Performance**: ✅ Better (single initialization)
- **Consistency**: ✅ Guaranteed (single source of truth)

---

## Lessons Learned

### Architectural Issues

1. **Singleton Pattern Needed**: AgentManager should be singleton or managed by DI
2. **Lazy Initialization**: AgentExecutor init was too late
3. **Cross-Package State**: Need clear state ownership

### Best Practices

1. **Always use service locator pattern** for shared state
2. **Initialize eagerly** when state is critical
3. **Test cross-command flows** not just individual commands

### Future Improvements

1. **Dependency Injection**: Pass AgentManager to command handlers
2. **Service Container**: Centralize all service instances
3. **State Management**: Clear ownership and lifecycle

---

## Related Issues

This fix also resolved:

- Natural language agent calls (they use executor)
- Agent context persistence (now shared)
- MCP server registration (executor-managed)

---

## Build Status

✅ All checks passing:
- TypeScript compilation: ✅
- Type checking: ✅
- Linting: ✅
- All packages built: ✅

---

## Summary

### What Was Broken
CLI and executor used different AgentManager instances, causing agents to appear missing when running.

### What Was Fixed
All commands now use executor's AgentManager, ensuring consistent state.

### How to Verify
Create an agent, list it, then run it - all should work seamlessly.

---

**Status**: ✅ Fixed and Tested
**Author**: Claude Code
**Date**: 2025-10-07
**Severity**: Critical → Resolved

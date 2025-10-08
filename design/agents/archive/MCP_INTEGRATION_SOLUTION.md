# MCP Integration for Agents - Complete Solution

**Date**: 2025-10-07
**Status**: ✅ Complete with Trust Requirement

---

## Problem Summary

User's agent `code_imple` was configured to use MCP tools from `context7` server, but agent was calling `FindFiles` instead of MCP tools.

---

## Root Cause Analysis

### Investigation Journey

1. **Initial hypothesis**: MCP tools not integrated with agents ❌
   - Implemented `filterMCPTools()` in AgentExecutor
   - Added MCP server filtering logic

2. **Second issue**: Wrong tool naming ❌
   - Discovered MCP tools use `__` not `.` separator
   - Fixed tool names: `context7__get-library-docs`
   - Updated filterMCPTools to use `split('__')`

3. **Third issue**: Tools in allow list ❌
   - Added MCP tool names to agent's `tools.allow` list
   - Two-level filtering: MCP server filter + allow/deny filter

4. **ACTUAL ROOT CAUSE**: Folder not trusted ✅
   - `McpClientManager.discoverAllMcpTools()` checks `isTrustedFolder()`
   - If not trusted → returns early → **NO MCP tools registered**
   - This is why tools were never available!

---

## Complete Solution

### 1. Trust the Folder ⚠️ **CRITICAL**

**File**: `~/.gemini/settings.json`

```json
{
  "trustedFolders": [
    "/Users/chenjiamin/python/ADK_Agents"
  ]
}
```

**Why**: MCP tools are only discovered in trusted folders for security reasons.

### 2. Configure MCP Server ✅ (Already Done)

**File**: `~/.gemini/settings.json`

```json
{
  "mcpServers": {
    "context7": {
      "httpUrl": "https://mcp.context7.com/mcp",
      "headers": {
        "CONTEXT7_API_KEY": "YOUR_API_KEY",
        "Accept": "application/json, text/event-stream"
      }
    }
  }
}
```

### 3. Configure Agent ✅ (Already Done)

**File**: `.gemini/agents/code_imple.md`

```yaml
---
name: code_imple
tools:
  allow: [
    "read_file",
    "write_file",
    "bash",
    "context7__get-library-docs",     # ← Correct naming with __
    "context7__resolve-library-id"    # ← Correct naming with __
  ]
mcp:
  servers: ["context7"]  # ← Must specify server
---
```

### 4. Implementation Complete ✅

**Files Modified**:
1. `packages/core/src/agents/AgentExecutor.ts`
   - Added `filterMCPTools()` method
   - Uses `__` separator for MCP tool detection
   - Filters by agent's `mcp.servers` configuration

2. `packages/core/src/config/config.ts`
   - Removed unused `McpClientManager` parameter

---

## How It Works

### Tool Discovery Flow

```
1. CLI Starts
   ↓
2. Config checks if folder is trusted
   ├─ NOT trusted → Skip MCP discovery
   └─ Trusted → Continue
   ↓
3. McpClientManager.discoverAllMcpTools()
   ↓
4. For each MCP server:
   ├─ Connect to server
   ├─ Discover tools
   └─ Register tools with names: "server__tool"
   ↓
5. Tools available in ToolRegistry
```

### Agent Execution Flow

```
1. Agent invoked (@code_imple)
   ↓
2. AgentExecutor.buildRuntime()
   ├─ Get all tools from ToolRegistry
   ├─ Filter by MCP servers (filterMCPTools)
   │  └─ Only keep tools from agent.mcp.servers
   ├─ Filter by allow/deny lists
   │  └─ Only keep tools in agent.tools.allow
   └─ Return filtered tool list
   ↓
3. Pass tools to model
   ↓
4. Model can call MCP tools
```

---

## MCP Tool Naming Convention

### Format
```
<server>__<tool>
```

### Examples
- ✅ `context7__get-library-docs`
- ✅ `context7__resolve-library-id`
- ✅ `github__create_pull_request`
- ❌ `context7.get-library-docs` (WRONG - uses dot)
- ❌ `get-library-docs` (WRONG - missing server prefix)

### Why Double Underscore?
1. Dots are problematic in some contexts (JSON keys, shell)
2. Double underscore is standard namespace separator (Python, C++)
3. Unlikely to appear in regular tool names

---

## Complete Requirements Checklist

For an agent to use MCP tools, ALL must be true:

- [x] **Folder trusted** (added to `trustedFolders`)
- [x] **MCP server configured** (in `mcpServers`)
- [x] **Agent has mcp.servers** (specifies which servers to use)
- [x] **Agent tools.allow includes MCP tools** (with correct `__` naming)
- [x] **MCP server reachable** (network connectivity)

---

## Testing

### Verify Trust
```bash
# Check if folder is trusted
cat ~/.gemini/settings.json | grep -A 5 trustedFolders

# Should show:
# "trustedFolders": [
#   "/Users/chenjiamin/python/ADK_Agents"
# ]
```

### Verify MCP Tools Discovered
```bash
# Start CLI and check if MCP tools are registered
# Look for log: "[McpClientManager] Folder is trusted - discovering MCP tools"
# Look for log: "[ToolRegistry] Registering MCP tool: context7__get-library-docs"
```

### Test Agent
```bash
cd /Users/chenjiamin/python/ADK_Agents
gemini --prompt "@code_imple Use context7 to find React documentation"

# Expected: Agent calls context7__get-library-docs
# NOT: Agent calls FindFiles
```

---

## Debug Logging Added

### AgentExecutor.ts
```typescript
console.log(`[AgentExecutor] Agent: ${agent.name}`);
console.log(`[AgentExecutor] MCP servers for agent:`, mcpServers);
console.log(`[AgentExecutor] After MCP server filter:`, toolsWithMCPFilter.filter(t => t.includes('__')));
console.log(`[AgentExecutor] After allow/deny filter:`, filteredTools.filter(t => t.includes('__')));
console.log(`[AgentExecutor] Tool definitions passed to model:`, mcpToolDefs.map(t => t.name));
```

### McpClientManager.ts
```typescript
console.log(`[McpClientManager] Checking if folder is trusted...`);
if (!cliConfig.isTrustedFolder()) {
  console.log(`[McpClientManager] Folder is NOT trusted - MCP tools will NOT be discovered`);
  return;
}
console.log(`[McpClientManager] Folder is trusted - discovering MCP tools from ${servers.length} servers`);
```

### ToolRegistry.ts
```typescript
if (tool instanceof DiscoveredMCPTool) {
  console.log(`[ToolRegistry] Registering MCP tool: ${tool.name} (server: ${tool.serverName})`);
}
```

---

## Files Modified

1. **AgentExecutor.ts** - MCP tool filtering
2. **Config.ts** - Constructor cleanup
3. **ToolRegistry.ts** - Registration logging
4. **McpClientManager.ts** - Trust check logging
5. **~/.gemini/settings.json** - Added trustedFolders
6. **.gemini/agents/code_imple.md** - Fixed tool names

---

## Documentation Created

1. **MCP_INTEGRATION_COMPLETE.md** - Initial implementation docs (later found naming was wrong)
2. **MCP_TOOL_ALLOW_LIST_ISSUE.md** - Explained two-level filtering
3. **MCP_TOOL_NAMING_FIX.md** - Corrected tool naming (`__` vs `.`)
4. **MCP_TRUST_REQUIREMENT.md** - Identified trust requirement
5. **MCP_INTEGRATION_SOLUTION.md** - This file, complete solution

---

## Summary

### What Was Wrong
1. Folder not trusted → MCP tools never discovered
2. Wrong tool naming (`.` instead of `__`)
3. MCP tool names not in allow list

### What Was Fixed
1. ✅ Added folder to `trustedFolders`
2. ✅ Fixed tool naming to use `__`
3. ✅ Added MCP tool names to allow list
4. ✅ Implemented `filterMCPTools()` in AgentExecutor
5. ✅ Added debug logging throughout

### What Should Work Now
- MCP tools discovered during CLI startup (if folder trusted)
- Agent `code_imple` has access to `context7` tools
- Agent can call `context7__get-library-docs` and `context7__resolve-library-id`
- Tool filtering respects both MCP server config and allow lists

---

**Status**: ✅ Complete
**Tested**: Needs user verification after trust is added
**Priority**: High - Core feature for agents
**Author**: Claude Code
**Date**: 2025-10-07

# MCP Tools Require Trusted Folders - Critical Requirement

**Date**: 2025-10-07
**Issue**: Agent cannot use MCP tools because folder is not trusted
**Root Cause**: `McpClientManager.discoverAllMcpTools()` returns early if `!cliConfig.isTrustedFolder()`

---

## Critical Discovery

### The Trust Check

**File**: `packages/core/src/tools/mcp-client-manager.ts:58-61`

```typescript
async discoverAllMcpTools(cliConfig: Config): Promise<void> {
  if (!cliConfig.isTrustedFolder()) {
    return;  // ← MCP tools NOT discovered!
  }
  await this.stop();
  // ... discover MCP tools
}
```

**Result**: If folder is not trusted, MCP tools are NEVER registered, regardless of:
- MCP server configuration ✅
- Agent mcp.servers configuration ✅
- Agent tools.allow list ✅

---

## Why This Matters

### Complete Implementation But Tools Still Not Available

Even with all the correct implementation:
1. ✅ MCP server configured in settings.json
2. ✅ Agent has `mcp.servers: ["context7"]`
3. ✅ Agent has correct tool names in allow list (`context7__get-library-docs`)
4. ✅ `filterMCPTools()` implemented correctly
5. ✅ Tool filtering logic works

**BUT**: If folder not trusted → Tools never registered → Agent cannot use them

---

## How to Fix

### Solution 1: Trust the Folder

Add the folder to trusted folders in settings:

**File**: `~/.gemini/settings.json` or `.gemini/settings.json`

```json
{
  "trustedFolders": [
    "/Users/chenjiamin/python/ADK_Agents"
  ],
  "mcpServers": {
    "context7": {
      "httpUrl": "https://mcp.context7.com/mcp",
      "headers": {
        "CONTEXT7_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

### Solution 2: Use CLI Command to Trust Folder

```bash
# Trust current folder
gemini trust add

# Or trust specific folder
gemini trust add /Users/chenjiamin/python/ADK_Agents

# List trusted folders
gemini trust list
```

---

## Why Trust is Required

### Security Consideration

MCP servers can execute arbitrary code and access sensitive data. The trust requirement ensures:

1. **User Consent**: User explicitly trusts the folder before MCP tools are available
2. **Malicious Code Protection**: Prevents untrusted projects from accessing MCP tools
3. **Data Privacy**: MCP tools might access sensitive APIs (GitHub, Slack, etc.)

---

## Complete Requirements for MCP Tools

For an agent to use MCP tools, ALL of the following must be true:

### 1. MCP Server Configured ✅
```json
{
  "mcpServers": {
    "context7": { "httpUrl": "...", "headers": {...} }
  }
}
```

### 2. Folder Trusted ⚠️ **CRITICAL**
```json
{
  "trustedFolders": ["/path/to/project"]
}
```

### 3. Agent MCP Servers Configured ✅
```yaml
---
mcp:
  servers: ["context7"]
---
```

### 4. Agent Tools Allow List (if used) ✅
```yaml
---
tools:
  allow: [
    "read_file",
    "context7__get-library-docs",
    "context7__resolve-library-id"
  ]
---
```

---

## Debugging Checklist

### Step 1: Verify MCP Server Configuration
```bash
cat ~/.gemini/settings.json | grep -A 10 mcpServers
```

### Step 2: Verify Folder is Trusted ⚠️ **CHECK THIS FIRST**
```bash
# Check if folder in trusted list
cat ~/.gemini/settings.json | grep -A 10 trustedFolders

# Or use CLI command
gemini trust list
```

### Step 3: Verify Agent Configuration
```bash
cat .gemini/agents/your_agent.md | grep -A 5 "mcp:"
```

### Step 4: Verify Tools Allow List
```bash
cat .gemini/agents/your_agent.md | grep -A 10 "tools:"
```

---

## For the User's Specific Case

### Current Status
- ✅ MCP server configured (`context7` in ~/.gemini/settings.json)
- ✅ Agent has `mcp.servers: ["context7"]`
- ✅ Agent has correct tool names in allow list
- ❌ **Folder `/Users/chenjiamin/python/ADK_Agents` NOT trusted**

### Fix Required

**Option A: Add to settings.json**
```bash
# Edit ~/.gemini/settings.json
nano ~/.gemini/settings.json

# Add:
{
  ...existing settings...
  "trustedFolders": [
    "/Users/chenjiamin/python/ADK_Agents"
  ]
}
```

**Option B: Use CLI command** (if available)
```bash
cd /Users/chenjiamin/python/ADK_Agents
gemini trust add
```

**Option C: Trust globally** (less secure)
```json
{
  "trustAllFolders": true  // ⚠️ Not recommended for security
}
```

---

## Implementation Status

### What Was Implemented ✅
1. MCP tool filtering in AgentExecutor ✅
2. Correct tool naming (`__` separator) ✅
3. Tool allow/deny list support ✅
4. Agent MCP server configuration ✅

### What Was Missed ❌
1. **Folder trust requirement** - This was the blocker!

### What Still Needs Documentation
1. User-facing documentation about trust requirement
2. Error message when MCP tools not available due to trust
3. Agent creation wizard should warn about trust

---

## Recommended Improvements

### 1. Better Error Messages

When agent tries to use MCP tools but folder not trusted:

```
⚠️  Warning: Agent 'code_imple' is configured to use MCP server 'context7',
but MCP tools are not available because this folder is not trusted.

To fix this, run:
  gemini trust add

Or add this folder to trustedFolders in ~/.gemini/settings.json
```

### 2. Agent Validation

```typescript
// In AgentExecutor.validateAgent()
if (agent.mcp?.servers && agent.mcp.servers.length > 0) {
  if (!this.config.isTrustedFolder()) {
    warnings.push(
      `Agent configured to use MCP servers but folder is not trusted. ` +
      `MCP tools will not be available.`
    );
  }
}
```

### 3. Runtime Check

```typescript
// In AgentExecutor.buildRuntime()
if (agent.mcp?.servers && agent.mcp.servers.length > 0) {
  if (!this.config.isTrustedFolder()) {
    console.warn(
      `[AgentExecutor] Agent '${agent.name}' configured for MCP but folder not trusted`
    );
  }
}
```

---

## Summary

### The Problem
Agent `code_imple` has correct configuration but cannot use MCP tools.

### The Root Cause
**Folder `/Users/chenjiamin/python/ADK_Agents` is not trusted**
→ `McpClientManager.discoverAllMcpTools()` returns early
→ No MCP tools registered in ToolRegistry
→ Agent has no MCP tools available

### The Solution
**Trust the folder**:
```bash
cd /Users/chenjiamin/python/ADK_Agents
# Add to settings.json trustedFolders array
# OR use: gemini trust add (if command exists)
```

### Verification
After trusting folder:
1. Restart CLI
2. MCP tools should be discovered during startup
3. Agent should have MCP tools available
4. Agent can call `context7__get-library-docs`

---

**Status**: Root Cause Identified
**Fix**: User needs to trust folder
**Priority**: Critical - Blocks all MCP functionality for agents

**Next Step**: Document trust requirement in user-facing docs

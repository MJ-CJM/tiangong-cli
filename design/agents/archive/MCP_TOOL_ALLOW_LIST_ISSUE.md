# MCP Tools and Allow Lists - Important Configuration

**Date**: 2025-10-07
**Issue**: MCP tools not available even with mcp.servers configured
**Root Cause**: MCP tool names must be in tools.allow list

---

## Problem Description

### User Experience

Agent configured with MCP server but cannot use MCP tools:

```yaml
---
name: code_imple
mcp:
  servers: ["context7"]  # ✓ Server configured
tools:
  allow: ["read_file", "write_file", ...]  # ✗ MCP tools NOT in list
---
```

**Result**: Agent calls `FindFiles` instead of `context7.get-library-docs`

---

## Root Cause

The Agents system applies **two levels of filtering**:

### Level 1: MCP Server Filter
```typescript
// In AgentExecutor.filterMCPTools()
// Only allows MCP tools from servers in mcp.servers list
servers: ["context7"] → allows context7.* tools
servers: [] → blocks ALL MCP tools
```

### Level 2: Tool Allow/Deny Filter
```typescript
// In ToolFilter.filterTools()
// If tools.allow is specified, ONLY those tools are available
allow: ["read_file"] → ONLY read_file allowed
allow: undefined → ALL tools allowed (after MCP filter)
```

### The Problem

Both filters are applied **in sequence**:

```
All Tools
  ↓
[MCP Filter] → Keep tools from allowed MCP servers
  ↓
[Allow/Deny Filter] → Keep only tools in allow list
  ↓
Final Tool List
```

**If MCP tool names are not in `allow` list, they are filtered out!**

---

## Solution

When using `tools.allow`, you must include MCP tool names:

### Before (Broken) ❌

```yaml
---
tools:
  allow: ["read_file", "write_file", "bash"]  # Missing MCP tools
mcp:
  servers: ["context7"]
---
```

**Available tools**: Only `read_file`, `write_file`, `bash`
**MCP tools**: ❌ Blocked by allow list

### After (Fixed) ✅

```yaml
---
tools:
  allow: [
    "read_file",
    "write_file",
    "bash",
    "context7.get-library-docs",    # ← Add MCP tool
    "context7.resolve-library-id"   # ← Add MCP tool
  ]
mcp:
  servers: ["context7"]
---
```

**Available tools**: All listed tools including MCP
**MCP tools**: ✅ Available

---

## Recommended Configurations

### Option 1: Allow All Tools (Simplest)

```yaml
---
# No tools.allow/deny specified
# Implicitly allows all tools (after MCP server filter)
mcp:
  servers: ["context7"]
---
```

**Result**: All regular tools + context7 MCP tools available

### Option 2: Explicit Allow List (Most Control)

```yaml
---
tools:
  allow: [
    # Regular tools
    "read_file",
    "write_file",
    "bash",
    # MCP tools from context7
    "context7.get-library-docs",
    "context7.resolve-library-id"
  ]
mcp:
  servers: ["context7"]
---
```

**Result**: Only specified tools available

### Option 3: Deny List (Flexible)

```yaml
---
tools:
  deny: ["dangerous_tool"]  # Block specific tools
mcp:
  servers: ["context7"]
---
```

**Result**: All tools except denied ones (including MCP tools)

---

## How to Find MCP Tool Names

### Method 1: Use /mcp list Command

```bash
> /mcp list

Configured MCP servers:
  🟢 context7 - Ready (2 tools)
    Tools:
    - get-library-docs       # ← Tool name: context7.get-library-docs
    - resolve-library-id     # ← Tool name: context7.resolve-library-id
```

**MCP tool naming**: `<server-name>.<tool-name>`

### Method 2: Check Agent Validation

```bash
> /agents validate my_agent

# Will show available vs requested tools
```

### Method 3: Trial and Error

Run the agent and see what tools it tries to use, then add them to allow list.

---

## Common Mistakes

### Mistake 1: Forget to Add MCP Server

```yaml
---
tools:
  allow: ["context7.get-library-docs"]  # ✓ Tool in allow list
mcp:
  servers: []  # ✗ Server NOT configured
---
```

**Result**: Tool filtered out by MCP server filter

### Mistake 2: Forget to Add Tool to Allow List

```yaml
---
tools:
  allow: ["read_file"]  # ✗ MCP tool NOT in list
mcp:
  servers: ["context7"]  # ✓ Server configured
---
```

**Result**: Tool filtered out by allow list filter

### Mistake 3: Wrong Tool Name

```yaml
---
tools:
  allow: ["get-library-docs"]  # ✗ Missing server prefix
mcp:
  servers: ["context7"]
---
```

**Correct**: `"context7.get-library-docs"` (with server prefix)

---

## Best Practices

### 1. Start Without Allow Lists

When creating a new agent, don't specify `tools.allow` initially:

```yaml
---
# No tools configuration
# Agent can use all available tools
mcp:
  servers: ["context7"]
---
```

Test the agent, see what tools it uses, then create an allow list if needed.

### 2. Use Deny Lists for Security

Instead of allow lists, use deny lists to block dangerous tools:

```yaml
---
tools:
  deny: ["shell", "bash"]  # Block dangerous tools
mcp:
  servers: ["context7"]  # Allow MCP tools
---
```

### 3. Document Tool Names

Add comments in agent YAML:

```yaml
---
tools:
  allow: [
    "read_file",
    "context7.get-library-docs",  # Context7: Get library documentation
    "context7.resolve-library-id" # Context7: Resolve library identifier
  ]
mcp:
  servers: ["context7"]
---
```

### 4. Group MCP Tools

```yaml
---
tools:
  allow: [
    # File operations
    "read_file",
    "write_file",

    # Context7 MCP tools
    "context7.get-library-docs",
    "context7.resolve-library-id",

    # GitHub MCP tools
    "github.create_pull_request",
    "github.get_issue"
  ]
mcp:
  servers: ["context7", "github"]
---
```

---

## Debugging Tips

### Check 1: Verify MCP Server is Running

```bash
> /mcp list

🟢 context7 - Ready  # ← Should be green "Ready"
```

### Check 2: Verify Tools are Discovered

```bash
> /mcp desc context7

Server: context7
Status: Ready
Tools:
  - get-library-docs
  - resolve-library-id
```

### Check 3: Validate Agent Configuration

```bash
> /agents validate code_imple

# Check warnings about tools
```

### Check 4: Check Agent Runtime

Add debug output to see available tools:

```bash
> /agents info code_imple

Available tools: [list of tools]
```

---

## Technical Details

### Filter Order

1. **Get all tools** from ToolRegistry
   ```typescript
   const allTools = toolRegistry.getAllToolNames();
   // ["read_file", "write_file", "context7.get-library-docs", ...]
   ```

2. **Apply MCP server filter**
   ```typescript
   const mcpFiltered = filterMCPTools(allTools, ["context7"]);
   // ["read_file", "write_file", "context7.get-library-docs"]
   // ✓ context7.* tools kept
   // ✗ github.* tools removed
   ```

3. **Apply allow/deny filter**
   ```typescript
   const finalTools = toolFilter.filterTools(mcpFiltered, agent);
   // If allow: ["read_file", "context7.get-library-docs"]
   // Result: ["read_file", "context7.get-library-docs"]
   // ✗ "write_file" removed (not in allow list)
   ```

### Why This Design?

**Principle of Least Privilege**:
- MCP servers provide capabilities (server filter)
- Agent specifies needs (allow/deny filter)
- Both must agree for tool to be available

**Security**:
- MCP server filter prevents accessing unauthorized servers
- Allow/deny filter prevents using unauthorized tools
- Defense in depth

---

## Future Improvements

### Auto-discovery of MCP Tools

```yaml
---
tools:
  allow: [
    "read_file",
    "mcp.*"  # Allow all MCP tools (future feature)
  ]
mcp:
  servers: ["context7"]
---
```

### MCP-specific Allow Lists

```yaml
---
tools:
  allow: ["read_file"]
mcp:
  servers: ["context7"]
  allow: ["get-library-docs"]  # Separate MCP tool control
---
```

### Interactive Tool Selection

```bash
> /agents create my_agent --interactive

Step 8/10: MCP Tools

Available MCP tools from context7:
  [ ] get-library-docs
  [ ] resolve-library-id

Select tools to allow (space to toggle):
```

---

## Summary

### The Fix

For agent to use MCP tools, you need **BOTH**:

1. ✅ Add MCP server to `mcp.servers`
   ```yaml
   mcp:
     servers: ["context7"]
   ```

2. ✅ Add MCP tool names to `tools.allow` (if using allow lists)
   ```yaml
   tools:
     allow: ["context7.get-library-docs", ...]
   ```

### Quick Reference

**MCP tool naming**: `<server>.<tool>`
**Examples**:
- `context7.get-library-docs`
- `github.create_pull_request`
- `slack.send_message`

**Recommended**: Don't use `tools.allow` unless you need strict control. Let agents use all tools.

---

**Status**: Documented
**Author**: Claude Code
**Date**: 2025-10-07

# MCP Tool Naming - Critical Fix

**Date**: 2025-10-07
**Issue**: MCP tools use `__` separator, not `.`
**Impact**: All previous documentation about MCP tool naming was incorrect

---

## Critical Discovery

### Wrong Assumption ❌

**Documentation said**:
```
MCP tool naming: <server>.<tool>
Example: context7.get-library-docs
```

### Actual Implementation ✅

**Source code shows** (`packages/core/src/tools/mcp-tool.ts:207`):
```typescript
`${this.serverName}__${this.serverToolName}`
```

**Real naming**: `<server>__<tool>` (double underscore)

**Example**: `context7__get-library-docs`

---

## Why This Matters

### Tool Name Mismatch

**Agent configuration with wrong names**:
```yaml
tools:
  allow: ["context7.get-library-docs"]  # ✗ Wrong! Uses dot
```

**Result**: Tool not found, filtered out

**Corrected configuration**:
```yaml
tools:
  allow: ["context7__get-library-docs"]  # ✓ Correct! Uses __
```

**Result**: Tool available

---

## Root Cause

### Design Decision

MCP tools use `__` instead of `.` because:

1. **Dots are problematic** in some contexts (JSON keys, shell, etc.)
2. **Double underscore** is a common namespace separator (Python, C++, etc.)
3. **Unambiguous** - unlikely to appear in regular tool names

### Where Defined

**File**: `packages/core/src/tools/mcp-tool.ts`

```typescript
export class DiscoveredMCPTool extends BaseDeclarativeTool<...> {
  constructor(
    private readonly mcpTool: CallableTool,
    private readonly serverName: string,
    private readonly serverToolName: string,
    // ...
  ) {
    super(
      // Tool name uses double underscore
      `${serverName}__${serverToolName}`,  // ← HERE
      description,
      parameterSchema,
      Kind.DISCOVERED_MCP,
      priority
    );
  }
}
```

---

## Correct MCP Tool Names

### Format

```
<server-name>__<tool-name>
```

### Examples

**context7 server**:
- ✅ `context7__get-library-docs`
- ✅ `context7__resolve-library-id`
- ❌ `context7.get-library-docs` (WRONG)

**github server**:
- ✅ `github__create_pull_request`
- ✅ `github__get_issue`
- ❌ `github.create_pull_request` (WRONG)

---

## How to Find Actual Tool Names

### Method 1: Use /mcp desc

```bash
> /mcp desc context7

Server: context7
Status: Ready
Tools:
  - get-library-docs       # Display name
  - resolve-library-id     # Display name

# Actual tool names:
# - context7__get-library-docs
# - context7__resolve-library-id
```

### Method 2: Check Available Tools

```bash
> /agents info my_agent

Available tools:
  - read_file
  - write_file
  - context7__get-library-docs    # ← Note the __
  - context7__resolve-library-id  # ← Note the __
```

### Method 3: Debug Log

Enable debug mode and watch tool calls:
```bash
# In debug console, you'll see:
Tool call: context7__get-library-docs
```

---

## Fixed Implementation

### Updated filterMCPTools()

**File**: `packages/core/src/agents/AgentExecutor.ts`

**Before** (WRONG):
```typescript
const parts = tool.split('.');  // ✗ Looking for dot separator
```

**After** (CORRECT):
```typescript
const parts = tool.split('__');  // ✓ Looking for __ separator
```

### Updated Agent Configuration

**File**: `.gemini/agents/code_imple.md`

**Before** (WRONG):
```yaml
tools:
  allow: [
    "context7.get-library-docs",  # ✗
    "context7.resolve-library-id" # ✗
  ]
mcp:
  servers: ["context7"]
```

**After** (CORRECT):
```yaml
tools:
  allow: [
    "context7__get-library-docs",  # ✓
    "context7__resolve-library-id" # ✓
  ]
mcp:
  servers: ["context7"]
```

---

## Testing

### Verify Tool Names

Create a test agent without allow lists:

```yaml
---
name: test_mcp
mcp:
  servers: ["context7"]
# No tools.allow → all tools available
---
```

Run and check debug log:
```bash
> @test_mcp Use context7 to search

# In debug console, watch for tool calls:
✓ Tool call: context7__get-library-docs
```

### Verify Filtering

Test with allow list:

```yaml
---
name: test_mcp
tools:
  allow: ["context7__get-library-docs"]  # Only one tool
mcp:
  servers: ["context7"]
---
```

Agent should:
- ✅ Call `context7__get-library-docs`
- ❌ Not call `context7__resolve-library-id` (not in allow list)

---

## Migration Guide

### For Existing Agents

1. **Find all agent files**:
   ```bash
   find ~/.gemini/agents .gemini/agents -name "*.md" 2>/dev/null
   ```

2. **Search for incorrect patterns**:
   ```bash
   grep -r "context7\." ~/.gemini/agents .gemini/agents
   grep -r "github\." ~/.gemini/agents .gemini/agents
   ```

3. **Replace dot with double underscore**:
   ```bash
   # For each file
   sed -i '' 's/context7\./context7__/g' agent_file.md
   sed -i '' 's/github\./github__/g' agent_file.md
   ```

### For Documentation

All previous documentation mentioning MCP tool names needs update:
- `MCP_INTEGRATION_COMPLETE.md` ✗
- `MCP_TOOL_ALLOW_LIST_ISSUE.md` ✗
- Agent creation templates ✗

---

## Pattern Matching Rules

### MCP Tool Detection

**Old pattern** (WRONG):
```typescript
// Looking for "server.tool"
if (tool.includes('.')) {
  const [server, ...rest] = tool.split('.');
  // ...
}
```

**New pattern** (CORRECT):
```typescript
// Looking for "server__tool"
if (tool.includes('__')) {
  const [server, ...rest] = tool.split('__');
  // ...
}
```

### Regular Expression

**MCP tool pattern**:
```regex
^[a-z][a-z0-9_-]+__[a-z0-9_-]+$
```

**Examples**:
- ✅ `context7__get-library-docs` (matches)
- ✅ `github__create_pr` (matches)
- ❌ `read_file` (no __, not MCP)
- ❌ `context7.get-docs` (uses ., not MCP format)

---

## API Consistency

### Display vs Internal Names

**Display name** (user-facing):
```
get-library-docs
resolve-library-id
```

**Internal name** (tool registry):
```
context7__get-library-docs
context7__resolve-library-id
```

**Why different?**
- Display: Short, readable
- Internal: Namespaced, unique

### Where Each Is Used

**Display names**:
- `/mcp list` output
- `/mcp desc` output
- Error messages
- UI display

**Internal names**:
- Tool registry lookup
- Agent configuration
- Tool invocation
- Allow/deny lists

---

## Breaking Changes

### Affected Areas

1. **Agent configurations** ✗
   - All `tools.allow` lists with MCP tools
   - Need manual update

2. **Documentation** ✗
   - All MCP tool examples
   - Need rewrite

3. **Code** ✅
   - Already uses correct naming
   - `filterMCPTools()` updated

### No Breaking Changes For

- Regular tools (no change)
- MCP server configuration (no change)
- Tool execution (automatic)
- Tool discovery (automatic)

---

## Summary

### Key Points

1. **MCP tool naming**: `<server>__<tool>` (double underscore)
2. **NOT**: `<server>.<tool>` (dot)
3. **Reason**: Dots problematic, `__` is standard namespace separator
4. **Impact**: Agent configurations need update
5. **Fix**: Replace `.` with `__` in tool names

### Quick Fix

**For your code_imple agent**:

```bash
# Current working directory
cd /Users/chenjiamin/python/ADK_Agents

# Fix agent config
sed -i '' 's/context7\./context7__/g' .gemini/agents/code_imple.md

# Verify
grep "context7__" .gemini/agents/code_imple.md
```

### Correct Configuration

```yaml
---
name: code_imple
tools:
  allow: [
    "read_file",
    "write_file",
    "bash",
    "context7__get-library-docs",     # ✓ Uses __
    "context7__resolve-library-id"    # ✓ Uses __
  ]
mcp:
  servers: ["context7"]
---
```

---

**Status**: Critical Fix Applied
**Author**: Claude Code
**Date**: 2025-10-07
**Priority**: High - Affects all MCP tool usage

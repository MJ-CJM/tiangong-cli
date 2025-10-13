# MCP Tool Naming - Final Fix

**Date**: 2025-10-07
**Issue**: MCP tools registered with short name but filtered by full name
**Root Cause**: `nameOverride` parameter was `undefined` in mcp-client.ts

---

## Problem

### What We Observed

从调试日志可以看到：

```
ℹ [ToolRegistry] Registering MCP tool: get-library-docs (server: context7)
```

工具注册的名称是 `get-library-docs`（短名称）

但是在过滤时：

```
ℹ [AgentExecutor] All tools from registry (13): []
ℹ [AgentExecutor] After MCP server filter (13): []
```

过滤器在查找 `context7__get-library-docs`（完整名称），找不到工具！

### Root Cause

**File**: `packages/core/src/tools/mcp-client.ts:678`

```typescript
new DiscoveredMCPTool(
  mcpCallableTool,
  mcpServerName,
  funcDecl.name!,
  funcDecl.description ?? '',
  funcDecl.parametersJsonSchema ?? { type: 'object', properties: {} },
  mcpServerConfig.trust,
  undefined,  // ← nameOverride = undefined!
  cliConfig,
)
```

When `nameOverride` is `undefined`, DiscoveredMCPTool uses default naming:

```typescript
// In DiscoveredMCPTool constructor
super(
  nameOverride ?? generateValidName(serverToolName),  // ← Uses short name!
  ...
);
```

结果：
- 工具注册名：`get-library-docs`
- 过滤器查找：`context7__get-library-docs`
- **不匹配！**

---

## Solution

### Change Made

**File**: `packages/core/src/tools/mcp-client.ts:678`

```typescript
// Before ❌
new DiscoveredMCPTool(
  mcpCallableTool,
  mcpServerName,
  funcDecl.name!,
  funcDecl.description ?? '',
  funcDecl.parametersJsonSchema ?? { type: 'object', properties: {} },
  mcpServerConfig.trust,
  undefined,  // ← Wrong! No namespace
  cliConfig,
)

// After ✅
new DiscoveredMCPTool(
  mcpCallableTool,
  mcpServerName,
  funcDecl.name!,
  funcDecl.description ?? '',
  funcDecl.parametersJsonSchema ?? { type: 'object', properties: {} },
  mcpServerConfig.trust,
  `${mcpServerName}__${funcDecl.name}`,  // ← Correct! Full namespace
  cliConfig,
)
```

### Why This Works

现在工具将使用完整的命名空间名称注册：

```
ℹ [ToolRegistry] Registering MCP tool: context7__get-library-docs (server: context7)
```

过滤器查找 `context7__get-library-docs` → **找到了！**

---

## Complete Fix Journey

### Issue #1: No MCP Integration ✅ Fixed
- **Problem**: Agents had no way to use MCP tools
- **Solution**: Implemented `filterMCPTools()` in AgentExecutor
- **Status**: ✅ Complete

### Issue #2: Wrong Separator ✅ Fixed
- **Problem**: Used `.` instead of `__` in tool names
- **Solution**: Changed to `split('__')` in filterMCPTools
- **Status**: ✅ Complete

### Issue #3: Folder Not Trusted ✅ Fixed
- **Problem**: MCP tools not discovered because folder untrusted
- **Solution**: Added folder to `trustedFolders` in settings.json
- **Status**: ✅ Complete

### Issue #4: Tool Name Mismatch ✅ Fixed (This Issue)
- **Problem**: Tools registered with short name, filtered by full name
- **Solution**: Use full namespace name in `nameOverride` parameter
- **Status**: ✅ Complete

---

## Expected Behavior After Fix

### Tool Discovery
```
[McpClientManager] Folder is trusted - discovering MCP tools from 1 servers
[ToolRegistry] Registering MCP tool: context7__get-library-docs (server: context7)
[ToolRegistry] Registering MCP tool: context7__resolve-library-id (server: context7)
```

### Tool Filtering
```
[AgentExecutor] Agent: code_imple
[AgentExecutor] All tools from registry (13): [context7__get-library-docs, context7__resolve-library-id, ...]
[AgentExecutor] MCP servers for agent: ['context7']
[AgentExecutor] After MCP server filter (13): [context7__get-library-docs, context7__resolve-library-id, ...]
[AgentExecutor] After allow/deny filter (4): [read_file, write_file, context7__get-library-docs, context7__resolve-library-id]
[AgentExecutor] Final available tools: [read_file, write_file, context7__get-library-docs, context7__resolve-library-id]
[AgentExecutor] Tool definitions passed to model (4):
[AgentExecutor] MCP tool definitions (2): [context7__get-library-docs, context7__resolve-library-id]
```

### Agent Execution
```
User: @code_imple 使用 context7 查找 Google ADK 文档

Expected:
✓ context7__get-library-docs {"library": "google-adk"}

NOT:
✗ FindFiles **/google*
```

---

## Testing

### Verify Tool Names

重启 CLI 并查看调试日志：

```bash
cd /Users/chenjiamin/python/ADK_Agents
/Users/chenjiamin/ai-tools/gemini-cli/bundle/gemini.js
```

打开 Debug Console (Ctrl+O)，应该看到：

```
[ToolRegistry] Registering MCP tool: context7__get-library-docs (server: context7)
```

**不应该看到**：
```
[ToolRegistry] Registering MCP tool: get-library-docs (server: context7)
```

### Test Agent

```
@code_imple 使用 context7 查找 React 文档
```

应该调用：
```
✓ context7__get-library-docs {"library": "react"}
```

---

## Files Modified

1. **mcp-client.ts** - Fixed tool registration to use full namespace
2. **AgentExecutor.ts** - Implemented MCP filtering (previous fix)
3. **settings.json** - Added trusted folder (previous fix)
4. **code_imple.md** - Fixed tool names in allow list (previous fix)

---

## Summary

### The Bug
MCP tools were registered with short names (`get-library-docs`) but the filtering system expected fully namespaced names (`context7__get-library-docs`).

### The Root Cause
In `mcp-client.ts`, the `nameOverride` parameter was `undefined`, causing DiscoveredMCPTool to use the default short name.

### The Fix
Changed line 678 in mcp-client.ts:
```typescript
undefined → `${mcpServerName}__${funcDecl.name}`
```

### Impact
- ✅ MCP tools now registered with correct namespace
- ✅ Agent filtering will find MCP tools
- ✅ Model will receive MCP tools in tool list
- ✅ Agent can call MCP tools

---

**Status**: ✅ Fixed
**Priority**: Critical - Blocked all MCP functionality
**Test Required**: User verification after rebuild
**Author**: Claude Code
**Date**: 2025-10-07

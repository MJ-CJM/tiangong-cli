# MCP Integration - MCP 工具集成

> **最后更新**: 2025-10-07
> **状态**: ✅ 已完成并测试

---

## 概述

Agents 系统完整支持 MCP (Model Context Protocol) 工具，允许 Agent 使用来自外部服务器的工具（如 context7、GitHub、Slack 等）。

### 核心特性

- ✅ MCP 服务器配置
- ✅ 工具自动发现和注册
- ✅ Agent 级别的服务器过滤
- ✅ 工具级别的 allow/deny 控制
- ✅ 安全的信任文件夹机制
- ✅ 正确的工具命名约定 (`server__tool`)

---

## MCP 工具命名规范

### ⚠️ 重要: 使用双下划线 `__`

MCP 工具使用 **双下划线** 作为分隔符，**不是点号**！

```
格式: <server>__<tool>

✅ 正确:
  - context7__get-library-docs
  - context7__resolve-library-id
  - github__create_pull_request

❌ 错误:
  - context7.get-library-docs  (使用了点号)
  - get-library-docs           (缺少服务器前缀)
```

### 为什么使用 `__`？

1. **点号有歧义** - 在 JSON 键、shell 命令中可能引起问题
2. **标准分隔符** - Python、C++ 等语言的命名空间惯例
3. **明确性** - 不会与普通工具名冲突

### 工具注册

MCP 工具在注册时自动添加命名空间前缀：

```typescript
// packages/core/src/tools/mcp-client.ts:678
new DiscoveredMCPTool(
  mcpCallableTool,
  mcpServerName,                          // "context7"
  funcDecl.name!,                         // "get-library-docs"
  funcDecl.description ?? '',
  funcDecl.parametersJsonSchema ?? {},
  mcpServerConfig.trust,
  `${mcpServerName}__${funcDecl.name}`,  // ← "context7__get-library-docs"
  cliConfig,
)
```

---

## 配置步骤

### 1. 配置 MCP 服务器

在 `~/.gemini/settings.json` 或 `.gemini/settings.json` 中配置：

```json
{
  "mcpServers": {
    "context7": {
      "httpUrl": "https://mcp.context7.com/mcp",
      "headers": {
        "CONTEXT7_API_KEY": "your-api-key",
        "Accept": "application/json, text/event-stream"
      }
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "your-github-token"
      }
    }
  }
}
```

支持的传输方式：
- **HTTP/HTTPS** - `httpUrl` + `headers`
- **SSE** - `url`
- **stdio** - `command` + `args`
- **WebSocket** - `tcp`

### 2. 信任项目文件夹 ⚠️ 必需

**关键步骤**: MCP 工具仅在信任的文件夹中被发现。

```json
{
  "trustedFolders": [
    "/Users/yourname/projects/my-project",
    "/path/to/another/project"
  ]
}
```

**为什么需要信任？**
- **安全性** - MCP 工具可以执行任意代码、访问敏感 API
- **用户同意** - 显式确认允许 MCP 工具访问
- **防护机制** - 避免恶意项目自动使用 MCP 工具

**检查代码**:
```typescript
// packages/core/src/tools/mcp-client-manager.ts:59-62
async discoverAllMcpTools(cliConfig: Config): Promise<void> {
  if (!cliConfig.isTrustedFolder()) {
    console.log(`[McpClientManager] Folder is NOT trusted - MCP tools will NOT be discovered`);
    return;  // ← 如果不信任，直接返回，不发现工具
  }
  // ...
}
```

### 3. 配置 Agent

在 Agent 定义中指定允许使用的 MCP 服务器和工具：

```yaml
---
name: code_imple
title: Code Implementation
model: qwen3-coder-flash
scope: project

# 指定允许使用的 MCP 服务器
mcp:
  servers: ["context7", "github"]

# 指定允许使用的工具（包括 MCP 工具）
tools:
  allow: [
    # 常规工具
    "read_file",
    "write_file",
    "bash",

    # Context7 MCP 工具
    "context7__get-library-docs",     # ← 必须使用完整名称
    "context7__resolve-library-id",

    # GitHub MCP 工具
    "github__create_pull_request",
    "github__get_issue"
  ]
---

# Agent 系统提示词
You are a code implementation specialist...
```

---

## 工作流程

### 完整流程图

```
1. CLI 启动
   ↓
2. 加载 settings.json
   ├─ 读取 mcpServers 配置
   └─ 读取 trustedFolders 配置
   ↓
3. 检查当前文件夹是否被信任
   ├─ ❌ 不信任 → 跳过 MCP 工具发现
   └─ ✅ 信任 → 继续
   ↓
4. McpClientManager.discoverAllMcpTools()
   ├─ 连接每个 MCP 服务器
   ├─ 发现可用工具
   ├─ 注册工具到 ToolRegistry
   └─ 工具名格式: "server__tool"
   ↓
5. Agent 执行时
   ├─ AgentExecutor.buildRuntime()
   ├─ 获取所有工具
   ├─ 按 mcp.servers 过滤 MCP 工具
   ├─ 按 tools.allow/deny 过滤
   └─ 传递过滤后的工具给模型
   ↓
6. 模型调用工具
   ├─ 调用 MCP 工具 (如 context7__get-library-docs)
   ├─ 执行并获取结果
   └─ 将结果返回给模型
```

### 工具过滤逻辑

```typescript
// packages/core/src/agents/AgentExecutor.ts:286-305
private async buildRuntime(agent: AgentDefinition): Promise<AgentRuntime> {
  // 1. 获取所有已注册的工具
  const allToolNames = this.toolRegistry.getAllToolNames();
  // ["read_file", "write_file", "context7__get-library-docs", "github__create_pr", ...]

  // 2. 获取 Agent 允许的 MCP 服务器
  const mcpServers = this.mcpRegistry.getServersForAgent(agent);
  // ["context7"]

  // 3. 过滤 MCP 工具 (只保留允许的服务器)
  const toolsWithMCPFilter = this.filterMCPTools(allToolNames, mcpServers);
  // ["read_file", "write_file", "context7__get-library-docs"]
  // ✓ context7__* 保留
  // ✗ github__* 被过滤

  // 4. 应用 allow/deny 列表
  const filteredTools = this.toolFilter.filterTools(toolsWithMCPFilter, agent);
  // ["read_file", "context7__get-library-docs"]
  // ✓ 在 allow 列表中
  // ✗ write_file 不在 allow 列表中被过滤

  return {
    definition: agent,
    context: this.contextManager.getContext(agent.name),
    availableTools: filteredTools,
    mcpServers,
  };
}
```

### MCP 工具过滤详解

```typescript
// packages/core/src/agents/AgentExecutor.ts:317-349
private filterMCPTools(allTools: string[], allowedServers: string[]): string[] {
  // 如果 Agent 没有配置 MCP 服务器
  if (allowedServers.length === 0) {
    return allTools.filter(tool => {
      const parts = tool.split('__');
      // 过滤掉所有看起来像 MCP 工具的工具
      if (parts.length >= 2 && /^[a-z][a-z0-9_-]*$/.test(parts[0])) {
        return false;  // 排除 MCP 工具
      }
      return true;  // 保留常规工具
    });
  }

  // 如果 Agent 配置了 MCP 服务器
  return allTools.filter(tool => {
    const parts = tool.split('__');
    if (parts.length >= 2) {
      const serverName = parts[0];
      // 检查服务器名是否在允许列表中
      if (serverName && /^[a-z][a-z0-9_-]*$/.test(serverName)) {
        return allowedServers.includes(serverName);
      }
    }
    return true;  // 保留常规工具
  });
}
```

---

## 使用示例

### 示例 1: 使用 Context7 查询文档

**设置**:
```yaml
# Agent 配置
mcp:
  servers: ["context7"]
tools:
  allow: ["context7__get-library-docs", "context7__resolve-library-id"]
```

**使用**:
```bash
@code_imple 使用 context7 查询 React 文档

# Agent 调用:
✓ context7__get-library-docs {"library": "react"}

# 返回:
React is a JavaScript library for building user interfaces...
```

### 示例 2: 使用 GitHub MCP 创建 PR

**设置**:
```yaml
# Agent 配置
mcp:
  servers: ["github"]
tools:
  allow: [
    "read_file",
    "github__create_pull_request",
    "github__list_issues"
  ]
```

**使用**:
```bash
@github-agent 创建一个 PR，标题是 "Fix bug in login"

# Agent 调用:
✓ github__create_pull_request {
    "title": "Fix bug in login",
    "body": "...",
    "base": "main",
    "head": "fix-login-bug"
  }
```

### 示例 3: 多 MCP 服务器

**设置**:
```yaml
# Agent 配置
mcp:
  servers: ["context7", "github", "slack"]
tools:
  allow: [
    "read_file",
    "context7__get-library-docs",
    "github__create_issue",
    "slack__send_message"
  ]
```

**使用**:
```bash
@full-stack-agent 查询 Express 文档，创建 GitHub issue，并通知 Slack

# Agent 依次调用:
1. ✓ context7__get-library-docs {"library": "express"}
2. ✓ github__create_issue {"title": "...", "body": "..."}
3. ✓ slack__send_message {"channel": "dev", "text": "..."}
```

---

## 故障排查

### 问题 1: MCP 工具未被发现

**症状**: `/agents info` 显示没有 MCP 工具

**可能原因和解决方案**:

1. **文件夹未信任** ⚠️ 最常见
   ```bash
   # 检查
   cat ~/.gemini/settings.json | grep -A 5 trustedFolders

   # 修复：添加项目路径到 trustedFolders
   {
     "trustedFolders": ["/path/to/your/project"]
   }
   ```

2. **MCP 服务器配置错误**
   ```bash
   # 检查配置
   cat ~/.gemini/settings.json | grep -A 10 mcpServers

   # 确保配置正确
   ```

3. **MCP 服务器未运行**
   ```bash
   # 查看 MCP 状态 (如果有 /mcp 命令)
   /mcp list
   ```

### 问题 2: Agent 调用常规工具而非 MCP 工具

**症状**: Agent 调用 `FindFiles` 而不是 `context7__get-library-docs`

**可能原因**:

1. **MCP 工具不在 allow 列表**
   ```yaml
   # 错误 ❌
   tools:
     allow: ["read_file", "write_file"]
     # ← 缺少 MCP 工具!

   # 正确 ✅
   tools:
     allow: [
       "read_file",
       "context7__get-library-docs"  # ← 添加 MCP 工具
     ]
   ```

2. **工具名称错误**
   ```yaml
   # 错误 ❌
   tools:
     allow: ["context7.get-library-docs"]  # ← 使用了点号!

   # 正确 ✅
   tools:
     allow: ["context7__get-library-docs"]  # ← 使用双下划线
   ```

3. **MCP 服务器未添加**
   ```yaml
   # 错误 ❌
   mcp:
     servers: []  # ← 空列表!

   # 正确 ✅
   mcp:
     servers: ["context7"]
   ```

### 问题 3: MCP 工具调用失败

**症状**: 工具被调用但返回错误

**可能原因**:

1. **API 密钥无效**
   ```json
   {
     "mcpServers": {
       "context7": {
         "headers": {
           "CONTEXT7_API_KEY": "YOUR_API_KEY"  // ← 需要替换为真实密钥
         }
       }
     }
   }
   ```

2. **网络问题**
   - 检查是否能访问 MCP 服务器 URL
   - 检查防火墙设置

3. **MCP 服务器错误**
   - 查看 MCP 服务器日志
   - 确认服务器正常运行

---

## 调试技巧

### 1. 查看可用工具

```bash
/agents info my-agent

# 输出包含:
# Available Tools (6):
#   - read_file
#   - context7__get-library-docs  ← 检查是否存在
#   - context7__resolve-library-id
```

### 2. 启用调试日志

当前实现已添加调试日志：

```typescript
// 启动时
console.log(`[McpClientManager] Folder is trusted - discovering MCP tools`);
console.log(`[ToolRegistry] Registering MCP tool: context7__get-library-docs`);

// Agent 执行时
console.log(`[AgentExecutor] MCP servers for agent:`, ['context7']);
console.log(`[AgentExecutor] After MCP server filter:`, [
  'context7__get-library-docs',
  'context7__resolve-library-id'
]);
```

在 CLI 的 Debug Console (Ctrl+O) 中查看这些日志。

### 3. 验证 Agent 配置

```bash
/agents validate my-agent

# 输出会显示警告:
# Warnings:
#   - Tool "context7__get-library-docs" requires MCP server "context7"
#   - Make sure folder is in trustedFolders
```

---

## 完整需求检查清单

要让 Agent 成功使用 MCP 工具，必须满足**所有**以下条件：

- [ ] 1. MCP 服务器已在 settings.json 中配置
  ```json
  {"mcpServers": {"context7": {...}}}
  ```

- [ ] 2. 项目文件夹已添加到 trustedFolders ⚠️
  ```json
  {"trustedFolders": ["/path/to/project"]}
  ```

- [ ] 3. Agent 配置中指定了 MCP 服务器
  ```yaml
  mcp:
    servers: ["context7"]
  ```

- [ ] 4. MCP 工具已添加到 allow 列表（如果使用 allow 列表）
  ```yaml
  tools:
    allow: ["context7__get-library-docs"]
  ```

- [ ] 5. 工具名称使用正确格式 (双下划线 `__`)
  ```
  ✅ context7__get-library-docs
  ❌ context7.get-library-docs
  ```

- [ ] 6. MCP 服务器可访问（网络、API 密钥等）

---

## 实现历程

### Phase 1: 初始实现 (2025-10-06)
- ✅ 实现 MCPRegistry 类
- ✅ 实现 filterMCPTools() 方法
- ❌ 使用了错误的分隔符 `.`

### Phase 2: 命名规范修复 (2025-10-07)
- ✅ 发现工具命名使用 `__` 而非 `.`
- ✅ 更新 filterMCPTools() 使用 `split('__')`
- ✅ 更新 Agent 配置示例

### Phase 3: 工具注册修复 (2025-10-07)
- ✅ 发现工具注册时 nameOverride 是 undefined
- ✅ 修复 mcp-client.ts 使用完整命名空间名称
- ✅ 现在工具始终以 `server__tool` 格式注册

### Phase 4: 信任文件夹发现 (2025-10-07)
- ✅ 发现 MCP 工具需要信任文件夹
- ✅ 添加调试日志
- ✅ 文档化信任要求

### Phase 5: 完整测试 (2025-10-07)
- ✅ 添加 trustedFolders 配置
- ✅ 验证工具可以被发现和调用
- ✅ 创建完整的故障排查指南

---

## 未来增强

### 1. MCP 工具通配符 allow

```yaml
tools:
  allow: [
    "read_file",
    "context7__*"  # 允许所有 context7 工具
  ]
```

### 2. MCP 服务器级别的 allow/deny

```yaml
mcp:
  servers: ["context7"]
  allow: ["get-library-docs"]  # 只允许特定工具
  deny: ["dangerous-tool"]
```

### 3. 自动信任提示

```bash
# 当检测到 MCP 配置但文件夹未信任时
⚠️  Warning: MCP servers configured but folder not trusted.
    Run: /trust add
    Or add to settings.json: "trustedFolders": ["/current/path"]
```

### 4. MCP 工具发现缓存

- 缓存已发现的工具，避免每次重新连接
- 提供 `/mcp refresh` 命令手动刷新

---

## 总结

MCP Integration 让 Agents 系统能够无缝使用外部工具服务器：

- ✅ **完整实现** - 发现、注册、过滤、执行
- ✅ **安全机制** - 信任文件夹要求
- ✅ **灵活控制** - 服务器级 + 工具级过滤
- ✅ **正确命名** - `server__tool` 格式
- ✅ **生产就绪** - 已测试并验证

**关键要点**:
1. 工具命名使用 `__` (双下划线)
2. 必须信任项目文件夹
3. Agent 需要同时配置 mcp.servers 和 tools.allow
4. 两级过滤: 服务器级 → 工具级

---

**文档版本**: 2.0 (整合版)
**创建日期**: 2025-10-06
**最后更新**: 2025-10-07

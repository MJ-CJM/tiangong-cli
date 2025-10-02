# 05 - 扩展性设计

**适用版本**: `0.6.0-nightly`
**Commit Hash**: `b347fa25e9133d410c4210e3825ace0cae5b4ecb`
**文档日期**: 2025-10-01

---

## 🎯 扩展点清单

| 扩展点 | 接口/机制 | 难度 | 优先级 |
|-------|----------|------|--------|
| **新增 Slash 命令** | `ICommandLoader` | ⭐ | 高 |
| **新增工具** | `DeclarativeTool` | ⭐⭐ | 高 |
| **新增模型 Provider** | `ModelAdapter` | ⭐⭐⭐ | 中 |
| **MCP 服务器集成** | MCP SDK | ⭐⭐ | 中 |
| **自定义主题** | Theme 配置 | ⭐ | 低 |
| **中间件/Hook** | 事件系统 | ⭐⭐⭐ | 低 |

---

## 1️⃣ 新增 Slash 命令

详见 [02-commands.md](./02-commands.md)

**最小示例**:
```typescript
export const myCommand: SlashCommand = {
  name: 'example',
  description: 'Example command',
  async execute(args, signal) {
    console.log('Hello from custom command!');
  },
};
```

---

## 2️⃣ 新增工具（Tool）

### 实现步骤

#### 步骤 1: 定义参数接口
```typescript
export interface MyToolParams {
  input: string;
  options?: {
    flag1?: boolean;
    flag2?: string;
  };
}
```

#### 步骤 2: 创建工具类
```typescript
// packages/core/src/tools/my-tool.ts

import { BaseDeclarativeTool, Kind, type ToolInvocation, type ToolResult } from './tools.js';

class MyToolInvocation extends BaseToolInvocation<MyToolParams, ToolResult> {
  getDescription(): string {
    return `Processing: ${this.params.input}`;
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    // 实现工具逻辑
    const result = await processInput(this.params.input);

    return {
      llmContent: `Processed result: ${result}`,
      returnDisplay: result,
    };
  }
}

export class MyTool extends BaseDeclarativeTool<MyToolParams, ToolResult> {
  constructor() {
    super(
      'my_tool', // 工具名称
      'MyTool', // 显示名称
      'Processes input data', // 描述
      Kind.Other, // 工具类型
      {
        // JSON Schema
        type: 'object',
        properties: {
          input: { type: 'string', description: 'Input data' },
          options: {
            type: 'object',
            properties: {
              flag1: { type: 'boolean' },
              flag2: { type: 'string' },
            },
          },
        },
        required: ['input'],
      }
    );
  }

  protected createInvocation(params: MyToolParams): ToolInvocation<MyToolParams, ToolResult> {
    return new MyToolInvocation(params);
  }
}
```

#### 步骤 3: 注册工具
```typescript
// packages/core/src/config/config.ts

async createToolRegistry(): Promise<ToolRegistry> {
  // ...
  registerCoreTool(MyTool);
  // ...
}
```

---

## 3️⃣ 新增模型 Provider

详见 [04-model-and-providers.md](./04-model-and-providers.md)

**接口**:
```typescript
interface ModelAdapter {
  readonly name: string;
  generateContent(...): Promise<Response>;
  generateContentStream(...): AsyncGenerator<Response>;
  healthCheck(): Promise<boolean>;
  getMetadata(): ModelMetadata;
}
```

---

## 4️⃣ MCP 服务器集成

### 什么是 MCP？

**Model Context Protocol** 是一个开放标准，允许外部服务为 AI 提供工具和上下文。

### 配置示例

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"],
      "autoApprove": ["read_file", "list_directory"]
    },
    "database": {
      "command": "node",
      "args": ["./mcp-servers/database-server.js"],
      "env": {
        "DB_URL": "postgresql://localhost/mydb"
      }
    }
  }
}
```

### 创建自定义 MCP 服务器

```javascript
// mcp-servers/my-server.js

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({
  name: 'my-custom-server',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

// 定义工具
server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'my_custom_tool',
        description: 'Does something useful',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string' },
          },
          required: ['input'],
        },
      },
    ],
  };
});

// 实现工具调用
server.setRequestHandler('tools/call', async (request) => {
  if (request.params.name === 'my_custom_tool') {
    const result = processInput(request.params.arguments.input);
    return {
      content: [
        { type: 'text', text: `Result: ${result}` },
      ],
    };
  }
});

// 启动服务器
const transport = new StdioServerTransport();
await server.connect(transport);
```

---

## 5️⃣ 自定义主题

### 主题文件位置

- 系统主题: `packages/cli/src/ui/themes/`
- 用户主题: `~/.gemini/themes/my-theme.json`

### 主题结构

```json
{
  "name": "my-theme",
  "colors": {
    "primary": "#00ff00",
    "secondary": "#0000ff",
    "background": "#000000",
    "foreground": "#ffffff",
    "error": "#ff0000",
    "warning": "#ffff00",
    "success": "#00ff00"
  },
  "syntax": {
    "keyword": "#ff79c6",
    "string": "#f1fa8c",
    "comment": "#6272a4",
    "function": "#50fa7b"
  }
}
```

---

## 6️⃣ 事件系统与 Hook

### 当前事件

```typescript
// packages/cli/src/utils/events.ts

export enum AppEvent {
  USER_PROMPT_SUBMIT = 'user_prompt_submit',
  MODEL_RESPONSE_COMPLETE = 'model_response_complete',
  TOOL_EXECUTION_START = 'tool_execution_start',
  TOOL_EXECUTION_END = 'tool_execution_end',
  ERROR = 'error',
}
```

### 订阅事件

```typescript
import { appEvents } from './utils/events.js';

appEvents.on(AppEvent.TOOL_EXECUTION_START, (data) => {
  console.log(`Tool ${data.toolName} started`);
});
```

### 自定义 Hook 示例

```typescript
// .gemini/hooks/pre-prompt.js

export async function onUserPromptSubmit(prompt, context) {
  // 在提示发送前修改
  if (prompt.includes('secret')) {
    return prompt.replace(/secret/g, '[REDACTED]');
  }
  return prompt;
}
```

---

## 🔧 配置扩展路径

### settings.json

```json
{
  "extensionPaths": [
    ".gemini/commands",
    ".gemini/tools",
    ".gemini/hooks"
  ],
  "mcpServers": { /* ... */ },
  "customThemes": [
    "~/.gemini/themes/my-theme.json"
  ]
}
```

---

## 📦 打包与分发扩展

### 扩展包结构

```
my-gemini-extension/
├── package.json
├── commands/
│   └── my-command.js
├── tools/
│   └── my-tool.js
├── mcp-servers/
│   └── my-server.js
└── README.md
```

### package.json

```json
{
  "name": "my-gemini-extension",
  "version": "1.0.0",
  "gemini": {
    "type": "extension",
    "commands": ["commands/*.js"],
    "tools": ["tools/*.js"],
    "mcpServers": ["mcp-servers/*.js"]
  }
}
```

---

**下一步**: 阅读 [06-dev-setup.md](./06-dev-setup.md) 配置开发环境。

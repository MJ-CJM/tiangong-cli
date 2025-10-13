# Gemini CLI 自定义模型 API 实现方案

## 架构分析

当前 gemini-cli 的核心架构：

1. **ContentGenerator 接口** - 抽象了模型交互的核心功能
2. **@google/genai SDK** - Google Gemini API 的官方客户端
3. **GeminiClient** - 高层客户端，负责对话管理和流程控制
4. **Config 系统** - 统一的配置管理

## 实现方案

### 1. 创建自定义 API 生成器

**新建文件：** `packages/core/src/core/customApiGenerator.ts`

核心功能：
- 实现 `ContentGenerator` 接口
- 支持多种 API 格式（OpenAI、Anthropic、自定义）
- 提供流式和非流式响应
- 格式转换器（Gemini ↔ 目标API）
- 工具调用支持

主要类：
```typescript
export class CustomApiGenerator implements ContentGenerator {
  // 实现所有必需方法：
  // - generateContent()
  // - generateContentStream()
  // - countTokens()
  // - embedContent()
}
```

### 2. 扩展配置系统

**修改文件：** `packages/core/src/core/contentGenerator.ts`

变更点：
```typescript
// 新增认证类型
export enum AuthType {
  // ... 现有类型
  USE_CUSTOM_API = 'custom-api',
}

// 扩展配置类型
export type ContentGeneratorConfig = {
  // ... 现有字段
  customApiBaseUrl?: string;
  customApiHeaders?: Record<string, string>;
  customApiFormat?: 'openai' | 'anthropic' | 'custom';
};

// 修改工厂函数
export async function createContentGenerator() {
  // 添加自定义 API 分支
  if (config.authType === AuthType.USE_CUSTOM_API) {
    return new CustomApiGenerator(customConfig);
  }
  // ... 现有逻辑
}
```

### 3. 更新命令行参数

**修改文件：** `packages/cli/src/config/config.ts`

新增参数：
```typescript
export interface CliArgs {
  // ... 现有参数
  authType: string | undefined;
  customApiBaseUrl: string | undefined;
  customApiKey: string | undefined;
  customApiFormat: string | undefined;
}

// 在 yargs 配置中添加：
.option('auth-type', {
  choices: ['gemini-api-key', 'vertex-ai', 'custom-api'],
  description: 'Authentication method'
})
.option('custom-api-base-url', {
  type: 'string',
  description: 'Base URL for custom API'
})
.option('custom-api-key', {
  type: 'string', 
  description: 'API key for custom model'
})
.option('custom-api-format', {
  choices: ['openai', 'anthropic', 'custom'],
  description: 'Custom API format'
})
```

### 4. 扩展设置模式

**修改文件：** `packages/cli/src/config/settingsSchema.ts`

新增配置项：
```typescript
export const SETTINGS_SCHEMA = {
  // ... 现有配置
  
  authType: {
    type: 'string',
    label: 'Authentication Type',
    category: 'General',
    default: 'gemini-api-key',
    choices: ['gemini-api-key', 'vertex-ai', 'custom-api']
  },
  
  customApiBaseUrl: {
    type: 'string',
    label: 'Custom API Base URL',
    category: 'Custom API',
    description: 'Base URL for custom model API'
  },
  
  customApiKey: {
    type: 'string',
    label: 'Custom API Key', 
    category: 'Custom API',
    description: 'API key for custom model'
  },
  
  customApiFormat: {
    type: 'string',
    label: 'API Format',
    category: 'Custom API',
    choices: ['openai', 'anthropic', 'custom']
  },
  
  customApiHeaders: {
    type: 'object',
    label: 'Custom Headers',
    category: 'Custom API',
    description: 'Additional HTTP headers'
  }
};
```

### 5. 更新核心配置类

**修改文件：** `packages/core/src/config/config.ts`

新增方法：
```typescript
export class Config {
  // ... 现有方法
  
  getAuthType(): AuthType {
    return this.settings?.authType || AuthType.USE_GEMINI;
  }
  
  getCustomApiBaseUrl(): string | undefined {
    return this.settings?.customApiBaseUrl || 
           process.env['CUSTOM_API_BASE_URL'];
  }
  
  getCustomApiKey(): string | undefined {
    return this.settings?.customApiKey || 
           process.env['CUSTOM_API_KEY'];
  }
  
  getCustomApiFormat(): string {
    return this.settings?.customApiFormat || 'openai';
  }
  
  getCustomApiHeaders(): Record<string, string> {
    return this.settings?.customApiHeaders || {};
  }
}
```

## 关键技术实现点

### 1. 格式转换器

**OpenAI 格式转换：**
- Gemini `Content[]` → OpenAI `messages[]`
- Gemini `Tool[]` → OpenAI `tools[]`
- 系统指令处理
- 流式响应处理

**Anthropic 格式转换：**
- 不同的消息格式（`system` 独立字段）
- 工具调用格式差异
- 流式响应格式差异

### 2. 流式响应处理

支持 Server-Sent Events (SSE) 格式：
```typescript
async *generateContentStream() {
  // 处理 "data: {...}" 格式
  // 解析 JSON 片段
  // 转换为 Gemini 格式
  // 逐步yield结果
}
```

### 3. 错误处理

- HTTP 错误映射
- 速率限制处理  
- 网络重试机制
- API 格式验证

### 4. Token 计算

提供两种方案：
1. **简化估算**：字符数 ÷ 4
2. **API 调用**：使用目标 API 的 token 计算接口

## 文件修改清单

### 新增文件
- `packages/core/src/core/customApiGenerator.ts` - 自定义 API 生成器

### 修改文件
1. `packages/core/src/core/contentGenerator.ts`
   - 添加 `USE_CUSTOM_API` 认证类型
   - 扩展 `ContentGeneratorConfig` 类型
   - 修改 `createContentGenerator()` 工厂函数

2. `packages/cli/src/config/config.ts`
   - 扩展 `CliArgs` 接口
   - 添加新的命令行选项

3. `packages/cli/src/config/settingsSchema.ts`  
   - 添加自定义 API 相关配置项

4. `packages/core/src/config/config.ts`
   - 添加自定义 API 配置的 getter 方法
   - 修改 `createContentGeneratorConfig()` 函数

## 使用示例

### 命令行方式
```bash
# OpenAI 兼容 API
gemini --auth-type custom-api \
       --custom-api-base-url http://localhost:11434/v1 \
       --custom-api-key ollama \
       --custom-api-format openai \
       --model llama3

# Anthropic Claude API  
gemini --auth-type custom-api \
       --custom-api-base-url https://api.anthropic.com \
       --custom-api-key your-key \
       --custom-api-format anthropic \
       --model claude-3-sonnet-20240229
```

### 环境变量方式
```bash
export CUSTOM_API_BASE_URL=http://localhost:11434/v1
export CUSTOM_API_KEY=ollama
export CUSTOM_API_FORMAT=openai
gemini --auth-type custom-api --model llama3
```

### 配置文件方式
```json
{
  "authType": "custom-api",
  "customApiBaseUrl": "http://localhost:11434/v1", 
  "customApiKey": "ollama",
  "customApiFormat": "openai",
  "model": "llama3"
}
```

## 兼容性保证

1. **向后兼容**：现有 Gemini API 功能完全保留
2. **配置隔离**：自定义 API 配置不影响原有配置
3. **渐进式采用**：可按需启用自定义 API 功能
4. **错误隔离**：自定义 API 错误不影响核心功能

## 支持的功能

✅ **已支持：**
- 基本对话
- 流式响应
- 工具调用（Function Calling）
- 系统指令
- 温度、Top-P 等参数
- Token 计算（估算）
- 错误处理

🔄 **部分支持：**
- 嵌入向量（需目标 API 支持）
- 高级生成参数（取决于目标 API）

❌ **不支持：**
- Gemini 特有功能（Thinking mode 等）
- Code Assist 特定功能
- Vertex AI 集成功能

## 测试策略

1. **单元测试**：格式转换器功能
2. **集成测试**：与真实 API 的交互
3. **兼容性测试**：确保原有功能不受影响
4. **性能测试**：流式响应和大量数据处理

这个方案提供了完整的自定义模型 API 支持，同时保持了与现有系统的完全兼容。
# Provider 简化方案

## 问题分析

### 当前设计

```typescript
// OpenAIAdapter 中硬编码的 provider 列表
private static readonly COMPATIBLE_PROVIDERS = [
  'openai', 'qwen', 'deepseek', 'moonshot', 'zhipu', 'minimax', 'openai-compatible'
];
```

**问题**：
1. ❌ 每新增一个 OpenAI 兼容的 provider，都需要修改代码
2. ❌ 不同 provider 的实现**完全相同**，只有环境变量名和身份标识不同
3. ❌ 扩展性差 - 用户无法自定义新的 OpenAI 兼容服务

### Provider 实现对比

| Provider | API 格式 | 请求处理 | 响应解析 | 流式处理 | **唯一区别** |
|----------|---------|---------|---------|---------|------------|
| qwen | OpenAI | 相同 | 相同 | 相同 | 环境变量 `QWEN_API_KEY` + 身份标识 |
| deepseek | OpenAI | 相同 | 相同 | 相同 | 环境变量 `DEEPSEEK_API_KEY` + 身份标识 |
| moonshot | OpenAI | 相同 | 相同 | 相同 | 环境变量 `MOONSHOT_API_KEY` + 身份标识 |
| zhipu | OpenAI | 相同 | 相同 | 相同 | 环境变量 `ZHIPU_API_KEY` + 身份标识 |
| minimax | OpenAI | 相同 | 相同 | 相同 | 环境变量 `MINIMAX_API_KEY` + 身份标识 |

**结论**: 所有差异都可以通过**配置**而非**代码**来实现。

## 🎯 优化方案

### 方案 A: 使用 `openai-compatible` + 元数据配置（推荐）

#### 1. 配置文件新增 `metadata` 字段

```json
{
  "models": {
    "qwen3-coder-flash": {
      "provider": "openai-compatible",
      "model": "qwen3-coder-flash",
      "apiKey": "sk-xxx",
      "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
      "metadata": {
        "providerName": "qwen",           // 用于身份识别
        "displayName": "通义千问",         // 用于展示
        "envKeyNames": ["QWEN_API_KEY", "QWEN_CODER_API_KEY"]  // 可选
      },
      "capabilities": {
        "supportsFunctionCalling": true,
        "supportsMultimodal": true
      }
    },
    "deepseek-coder": {
      "provider": "openai-compatible",
      "model": "deepseek-coder",
      "apiKey": "sk-xxx",
      "baseUrl": "https://api.deepseek.com",
      "metadata": {
        "providerName": "deepseek",
        "displayName": "DeepSeek"
      },
      "capabilities": {
        "supportsFunctionCalling": false  // 根据实际情况配置
      }
    },
    "custom-local-model": {
      "provider": "openai-compatible",
      "model": "Qwen2.5-Coder-32B-Instruct",
      "apiKey": "not-required",
      "baseUrl": "http://localhost:11434/v1",
      "metadata": {
        "providerName": "custom",
        "displayName": "本地模型"
      },
      "capabilities": {
        "supportsFunctionCalling": false
      }
    }
  }
}
```

#### 2. 修改 OpenAIAdapter 移除硬编码 Provider 列表

```typescript
export class OpenAIAdapter extends AbstractModelClient {
  private readonly defaultBaseUrl = 'https://api.openai.com/v1';

  constructor(config: ModelConfig) {
    super(config);

    // 不再验证 provider 是否在预定义列表中
    // 任何配置了 baseUrl 的模型都可以使用
  }

  protected override getApiKey(): string {
    if (this.config.apiKey) {
      return this.config.apiKey;
    }

    // 1. 优先使用 metadata 中定义的环境变量
    const envKeyNames = this.config.metadata?.envKeyNames;
    if (envKeyNames && Array.isArray(envKeyNames)) {
      for (const keyName of envKeyNames) {
        const value = process.env[keyName];
        if (value) return value;
      }
    }

    // 2. 后备方案：根据 providerName 查找
    const providerName = this.config.metadata?.providerName || this.config.provider;
    const defaultEnvKeyMap: Record<string, string[]> = {
      'openai': ['OPENAI_API_KEY'],
      'qwen': ['QWEN_API_KEY', 'QWEN_CODER_API_KEY', 'DASHSCOPE_API_KEY'],
      'deepseek': ['DEEPSEEK_API_KEY'],
      'moonshot': ['MOONSHOT_API_KEY', 'KIMI_API_KEY'],
      'zhipu': ['ZHIPU_API_KEY', 'GLM_API_KEY'],
      'minimax': ['MINIMAX_API_KEY'],
    };

    const possibleKeys = defaultEnvKeyMap[providerName as string] || ['OPENAI_API_KEY'];
    for (const keyName of possibleKeys) {
      const value = process.env[keyName];
      if (value) return value;
    }

    throw new AuthenticationError(
      this.config.provider,
      `No API key found. Set apiKey in config or environment variable.`
    );
  }
}
```

#### 3. 修改 System Prompt 使用 `metadata.providerName`

```typescript
// prompts.ts
export function getCoreSystemPrompt(
  userMemory?: string,
  modelName?: string,
  providerName?: string  // 从 metadata.providerName 获取
): string {
  const basePrompt = `
# CRITICAL IDENTITY INSTRUCTION

⚠️ **YOUR TRUE IDENTITY**: You are being accessed through the **${providerName || 'unknown'}** provider${modelName ? ` (model: ${modelName})` : ''}

**Identity Rules - Based on Provider:**
- If provider is **qwen** → You ARE 通义千问/Qwen, say "我是通义千问"
- If provider is **deepseek** → You ARE DeepSeek, say "我是 DeepSeek"
- If provider is **openai** → You ARE ChatGPT, say "I am ChatGPT"
- If provider is **custom** → Identify based on your training, or say "I am a custom model"
...
`;
}

// client.ts
const providerName = modelConfig?.metadata?.providerName || modelConfig?.provider;
const systemInstruction = getCoreSystemPrompt(userMemory, actualModelName, providerName);
```

### 方案 B: 完全移除 Provider 概念，只用 `baseUrl`（更激进）

```json
{
  "models": {
    "qwen3-coder-flash": {
      "model": "qwen3-coder-flash",
      "apiKey": "sk-xxx",
      "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
      "identity": "qwen",  // 仅用于 system prompt
      "capabilities": { ... }
    }
  }
}
```

**优点**:
- 更简洁
- 完全基于配置，无需修改代码

**缺点**:
- 失去了 provider 的语义化
- 环境变量发现机制需要完全依赖配置

## 💡 推荐方案

**方案 A（`openai-compatible` + metadata）**，原因：

### 优点

1. **向后兼容**:
   - 现有配置仍然有效（`provider: "qwen"` 等）
   - 新配置使用 `provider: "openai-compatible"` + `metadata`

2. **灵活扩展**:
   ```json
   // 用户可以轻松添加任何 OpenAI 兼容服务
   {
     "my-custom-service": {
       "provider": "openai-compatible",
       "baseUrl": "https://my-api.com/v1",
       "metadata": {
         "providerName": "my-service",
         "displayName": "My Custom AI"
       }
     }
   }
   ```

3. **清晰的语义**:
   - `provider`: 技术层面的适配器选择
   - `metadata.providerName`: 业务层面的身份标识
   - `baseUrl`: 实际的 API 端点

4. **保留环境变量发现**:
   - 仍然支持 `QWEN_API_KEY` 等常见环境变量
   - 也支持自定义环境变量名

### 实现步骤

1. ✅ 在 `ModelConfig` 类型中添加 `metadata` 字段
2. ✅ 修改 `OpenAIAdapter.getApiKey()` 优先使用 metadata
3. ✅ 移除 `COMPATIBLE_PROVIDERS` 硬编码列表的验证
4. ✅ 修改 `getCoreSystemPrompt()` 使用 `metadata.providerName`
5. ✅ 更新文档和配置示例

## 🔄 迁移路径

### 当前配置（仍然支持）
```json
{
  "provider": "qwen",
  "model": "qwen3-coder-flash",
  ...
}
```

### 新推荐配置
```json
{
  "provider": "openai-compatible",
  "model": "qwen3-coder-flash",
  "metadata": {
    "providerName": "qwen"
  },
  ...
}
```

### 完全自定义配置
```json
{
  "provider": "openai-compatible",
  "model": "my-model",
  "baseUrl": "https://custom-api.com/v1",
  "apiKey": "xxx",
  "metadata": {
    "providerName": "my-provider",
    "displayName": "我的AI",
    "envKeyNames": ["MY_CUSTOM_API_KEY"]
  },
  "capabilities": {
    "supportsFunctionCalling": true
  }
}
```

## 🎯 总结

**核心观点**:
> 所有 OpenAI 兼容的 Provider（qwen, deepseek, moonshot 等）在技术实现上**完全相同**，区别仅在于：
> 1. API Key 的环境变量名
> 2. Base URL
> 3. 身份标识（用于 system prompt）

**优化目标**:
- ✅ 将硬编码的 provider 列表改为配置化
- ✅ 支持任意 OpenAI 兼容服务，无需修改代码
- ✅ 保持向后兼容
- ✅ 提供清晰的迁移路径

**下一步**:
1. 实现 `metadata` 字段支持
2. 重构 `OpenAIAdapter` 移除硬编码限制
3. 更新配置示例和文档

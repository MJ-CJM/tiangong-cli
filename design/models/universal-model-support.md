# 通用模型支持方案设计文档

## 状态：✅ 已实现并验证

本文档描述了 Gemini CLI 的通用模型支持架构，已在生产环境中成功运行。

## 1. 设计目标

- ✅ **零代码添加新模型**：通过配置文件即可支持新模型，无需修改代码
- ✅ **适配器复用**：OpenAI 兼容的模型（Qwen、DeepSeek 等）共用适配器
- ✅ **灵活配置**：支持模型特定的参数限制和特性（包括 `supportsMultimodal`）
- ✅ **向后兼容**：不影响现有 Gemini、OpenAI、Claude 等模型

## 2. 架构设计

### 2.1 配置驱动的模型注册

```json
{
  "useModelRouter": true,
  "models": {
    "qwen-coder-plus": {
      "provider": "openai-compatible",  // 使用通用适配器
      "adapterType": "openai",          // 指定适配器实现
      "model": "qwen-coder-plus",
      "apiKey": "sk-xxx",
      "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
      "capabilities": {
        "maxInputTokens": 32768,
        "maxOutputTokens": 8192,
        "supportsStreaming": true,
        "supportsFunctionCalling": true,
        "supportsVision": false,
        "supportsMultimodal": true
      },
      "options": {
        "temperature": 0.1,
        "completionEndpoint": "/chat/completions"
      }
    },
    "deepseek-coder": {
      "provider": "deepseek",
      "adapterType": "openai",
      "model": "deepseek-coder",
      "apiKey": "sk-xxx",
      "baseUrl": "https://api.deepseek.com",
      "capabilities": {
        "maxInputTokens": 16384,
        "maxOutputTokens": 4096,
        "supportsStreaming": true,
        "supportsFunctionCalling": true,
        "supportsMultimodal": false  // DeepSeek 不支持数组格式的消息
      }
    }
  }
}
```

### 2.2 Provider 映射机制

创建 `ProviderAdapterRegistry` 来管理 provider 到适配器的映射：

```typescript
// packages/core/src/adapters/registry.ts
export const PROVIDER_ADAPTER_MAP = {
  'gemini': GeminiAdapter,
  'openai': OpenAIAdapter,
  'claude': ClaudeAdapter,
  'qwen': OpenAIAdapter,           // Qwen 使用 OpenAI 适配器
  'deepseek': OpenAIAdapter,       // DeepSeek 使用 OpenAI 适配器
  'openai-compatible': OpenAIAdapter, // 通用 OpenAI 兼容
  'custom': CustomAdapter
};
```

### 2.3 扩展 ModelConfig 类型

```typescript
// packages/core/src/adapters/base/types.ts
export interface ModelCapabilities {
  /** 最大输入 tokens */
  maxInputTokens?: number;
  /** 最大输出 tokens */
  maxOutputTokens?: number;
  /** 是否支持流式输出 */
  supportsStreaming?: boolean;
  /** 是否支持函数调用 */
  supportsFunctionCalling?: boolean;
  /** 是否支持视觉输入 */
  supportsVision?: boolean;
  /** 是否支持工具调用 */
  supportsTools?: boolean;
  /** 是否支持 OpenAI multimodal 消息格式（content 为数组）*/
  supportsMultimodal?: boolean;
}

export interface ModelConfig {
  provider: ModelProvider | string; // 允许自定义 provider 名称
  model: string;
  apiKey?: string;
  baseUrl?: string;
  authType?: ModelAuthType;
  customHeaders?: Record<string, string>;

  /** 适配器类型：决定使用哪个适配器实现 */
  adapterType?: 'openai' | 'claude' | 'custom';

  /** 模型能力描述 */
  capabilities?: ModelCapabilities;

  /** 其他选项 */
  options?: Record<string, any>;
}
```

## 3. 实现步骤

### Step 1: 创建适配器注册表

```typescript
// packages/core/src/adapters/registry.ts
import { AbstractModelClient } from './base/baseModelClient.js';
import { OpenAIAdapter } from './openai/openaiAdapter.js';
import { ClaudeAdapter } from './claude/claudeAdapter.js';
import { CustomAdapter } from './custom/customAdapter.js';
import type { ModelConfig } from './base/types.js';

export class AdapterRegistry {
  private static adapters = new Map<string, typeof AbstractModelClient>();

  static {
    // 注册内置适配器
    this.register('openai', OpenAIAdapter);
    this.register('claude', ClaudeAdapter);
    this.register('custom', CustomAdapter);
  }

  static register(type: string, adapter: typeof AbstractModelClient): void {
    this.adapters.set(type, adapter);
  }

  static getAdapter(config: ModelConfig): AbstractModelClient {
    // 1. 优先使用 adapterType
    const adapterType = config.adapterType || this.inferAdapterType(config);

    const AdapterClass = this.adapters.get(adapterType);
    if (!AdapterClass) {
      throw new Error(`No adapter found for type: ${adapterType}`);
    }

    return new AdapterClass(config);
  }

  private static inferAdapterType(config: ModelConfig): string {
    // 根据 provider 推断适配器类型
    const providerMap: Record<string, string> = {
      'gemini': 'gemini',
      'openai': 'openai',
      'claude': 'claude',
      'qwen': 'openai',
      'deepseek': 'openai',
      'openai-compatible': 'openai'
    };

    return providerMap[config.provider] || 'custom';
  }
}
```

### Step 2: 更新 ModelRouter 使用注册表

```typescript
// packages/core/src/adapters/modelRouter.ts
import { AdapterRegistry } from './registry.js';

export class ModelRouter {
  private async createAdapter(config: ModelConfig): Promise<AbstractModelClient> {
    return AdapterRegistry.getAdapter(config);
  }
}
```

### Step 3: 更新 getMaxOutputTokens 函数

```typescript
// packages/core/src/config/models.ts
export function getMaxOutputTokens(modelConfig: ModelConfig): number {
  // 1. 优先使用 capabilities 中的配置
  if (modelConfig.capabilities?.maxOutputTokens !== undefined) {
    return modelConfig.capabilities.maxOutputTokens;
  }

  // 2. 其次使用旧的 maxOutputTokens
  if (modelConfig.maxOutputTokens !== undefined) {
    return modelConfig.maxOutputTokens;
  }

  // 3. 根据 adapterType 返回默认值
  const adapterType = modelConfig.adapterType || inferAdapterType(modelConfig.provider);

  const defaults: Record<string, number> = {
    'openai': 16384,
    'claude': 8192,
    'gemini': 65536,
    'custom': 4096
  };

  return defaults[adapterType] || 4096;
}

function inferAdapterType(provider: string): string {
  const map: Record<string, string> = {
    'gemini': 'gemini',
    'openai': 'openai',
    'claude': 'claude',
    'qwen': 'openai',
    'deepseek': 'openai'
  };
  return map[provider] || 'custom';
}
```

### Step 4: 删除 QwenAdapter（可选）

由于 Qwen 可以使用 OpenAIAdapter，QwenAdapter 变成冗余代码：

```bash
# 可以删除 packages/core/src/adapters/qwen/qwenAdapter.ts
# 或者保留作为向后兼容
```

## 4. 配置示例

### 4.1 添加新的 OpenAI 兼容模型（如通义千问、DeepSeek）

```json
{
  "models": {
    "qwen-turbo": {
      "provider": "qwen",
      "adapterType": "openai",
      "model": "qwen-turbo",
      "apiKey": "sk-xxx",
      "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
      "capabilities": {
        "maxOutputTokens": 8192
      }
    }
  }
}
```

### 4.2 添加自定义本地模型

```json
{
  "models": {
    "local-llama": {
      "provider": "custom",
      "adapterType": "openai",
      "model": "llama-3-70b",
      "baseUrl": "http://localhost:8080/v1",
      "capabilities": {
        "maxOutputTokens": 4096,
        "supportsFunctionCalling": false
      }
    }
  }
}
```

### 4.3 添加 Claude 兼容模型

```json
{
  "models": {
    "custom-claude": {
      "provider": "custom",
      "adapterType": "claude",
      "model": "claude-compatible",
      "apiKey": "sk-xxx",
      "baseUrl": "https://api.custom.com/v1",
      "capabilities": {
        "maxOutputTokens": 8192
      }
    }
  }
}
```

## 5. 优势

### 5.1 对于用户
- ✅ 通过配置文件即可添加新模型，无需等待代码更新
- ✅ 灵活配置每个模型的能力和限制
- ✅ 支持本地部署和自定义端点

### 5.2 对于开发者
- ✅ 不需要为每个新模型创建适配器
- ✅ 适配器代码复用，减少维护成本
- ✅ 配置驱动，易于扩展

### 5.3 对于生态
- ✅ 任何 OpenAI 兼容的模型都可以快速接入
- ✅ 社区可以贡献模型配置预设
- ✅ 支持企业内部自定义模型

## 6. 迁移计划

### Phase 1: 添加注册表机制（不影响现有功能）
- 创建 `AdapterRegistry`
- 保留所有现有适配器

### Phase 2: 更新配置格式（向后兼容）
- 支持新的 `capabilities` 字段
- 支持 `adapterType` 字段
- 旧配置继续工作

### Phase 3: 优化现有实现（可选）
- 将 Qwen、DeepSeek 等迁移到使用 OpenAIAdapter
- 清理冗余代码

## 7. 测试结果

- ✅ Qwen 使用 OpenAI 适配器正常工作
- ✅ DeepSeek 使用 OpenAI 适配器正常工作（需要 `supportsMultimodal: false`）
- ✅ 自定义模型配置支持完整字段
- ✅ maxOutputTokens 限制正确应用
- ✅ 向后兼容性保持完好
- ✅ `supportsMultimodal` 标志正确控制消息格式转换

## 8. 关键实现细节

### 8.1 配置加载优化

**问题**：初始实现中 `Config.loadCustomModelConfigs()` 只复制了部分字段，导致 `capabilities` 丢失。

**解决方案**（`packages/core/src/config/config.ts:626-644`）：
```typescript
// 使用展开运算符复制所有字段
const modelConfig: any = {
  ...def, // 复制所有字段，包括 capabilities
  provider: def.provider || 'custom',
  model: def.model || modelName,
  authType: 'api-key',
  apiKey: def.apiKey || '',
  baseUrl: def.baseUrl || '',
  options: def.options || {}
};
```

### 8.2 配置查找优化

**问题**：`Config.getModelConfig()` 重新构建配置对象，丢失了完整的配置信息。

**解决方案**（`packages/core/src/config/config.ts:1056-1104`）：
```typescript
// 优先从 customModels 获取完整配置
if (this.customModels[model]) {
  return this.customModels[model];
}

// 回退到基本配置构建
const providerSettings = this.modelProviders?.[provider];
return {
  provider,
  model,
  apiKey: providerSettings?.apiKey,
  baseUrl: providerSettings?.baseUrl,
  // ...
};
```

### 8.3 消息格式转换

**关键逻辑**（`packages/core/src/adapters/utils/apiTranslator.ts:234-271`）：

```typescript
// 当模型不支持 multimodal 格式时，将数组转为字符串
if (!supportsMultimodal) {
  const combinedText = textParts.map(part => part.text || '').join('\n').trim();

  return {
    role,
    content: combinedText || '',
    tool_calls: /* ... */
  };
}
```

这确保了像 DeepSeek 这样不支持 `content: [{ type: 'text', text: '...' }]` 格式的模型，能够接收 `content: "..."` 字符串格式。

## 9. 已知限制和注意事项

1. **supportsMultimodal**:
   - 默认为 `true`（OpenAI 标准）
   - DeepSeek 等部分模型必须设置为 `false`
   - 影响消息 content 的格式（数组 vs 字符串）

2. **配置键名匹配**:
   - `customModels` 使用配置文件中的键名存储
   - `getModelConfig()` 按 `model` 名称查找
   - 确保配置键名与 `model` 字段一致

3. **Provider 规范化**:
   - `AdapterRegistry.normalizeConfig()` 会修改 `provider` 字段
   - 例如 `provider: "deepseek"` → `provider: "openai"`（内部使用）
   - 但完整配置通过浅拷贝保留所有字段

## 10. 文档

- ✅ [用户指南：如何添加新模型](./docs/ADD_NEW_MODEL.md)
- ✅ 配置参考：所有配置选项说明（本文档）
- ✅ 示例配置：常见模型配置模板（见用户指南）
- 📝 开发者指南：如何创建新适配器（待完善）

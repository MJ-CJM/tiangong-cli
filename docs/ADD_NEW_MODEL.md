# 如何添加新模型

本文档介绍如何通过配置文件快速添加新的 AI 模型，无需修改代码。

## 快速开始

### 1. 添加 OpenAI 兼容模型（推荐）

大多数现代 AI 模型都提供 OpenAI 兼容的 API。对于这些模型，只需要在 `~/.gemini/config.json` 中添加配置即可。

#### 示例：添加通义千问 (Qwen)

```json
{
  "useModelRouter": true,
  "models": {
    "qwen-coder-plus": {
      "provider": "qwen",
      "adapterType": "openai",
      "model": "qwen-coder-plus",
      "apiKey": "sk-your-api-key",
      "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
      "capabilities": {
        "maxOutputTokens": 8192
      }
    }
  }
}
```

#### 示例：添加 DeepSeek

```json
{
  "models": {
    "deepseek-coder": {
      "provider": "deepseek",
      "adapterType": "openai",
      "model": "deepseek-coder",
      "apiKey": "sk-your-api-key",
      "baseUrl": "https://api.deepseek.com",
      "capabilities": {
        "maxOutputTokens": 4096,
        "supportsMultimodal": false
      }
    }
  }
}
```

#### 示例：添加其他 OpenAI 兼容模型

```json
{
  "models": {
    "custom-model": {
      "provider": "openai-compatible",
      "adapterType": "openai",
      "model": "your-model-name",
      "apiKey": "your-api-key",
      "baseUrl": "https://api.your-provider.com/v1",
      "capabilities": {
        "maxInputTokens": 32768,
        "maxOutputTokens": 8192,
        "supportsStreaming": true,
        "supportsFunctionCalling": true
      }
    }
  }
}
```

### 2. 添加本地部署模型

对于本地部署的模型（如 Ollama、LM Studio 等），通常也是 OpenAI 兼容的：

```json
{
  "models": {
    "local-llama": {
      "provider": "custom",
      "adapterType": "openai",
      "model": "llama3-70b",
      "baseUrl": "http://localhost:11434/v1",
      "capabilities": {
        "maxOutputTokens": 4096,
        "supportsFunctionCalling": false
      }
    }
  }
}
```

### 3. 使用新模型

添加配置后，使用 `/model use` 命令切换：

```bash
/model use qwen-coder-plus
```

或在启动时指定：

```bash
gemini --model qwen-coder-plus
```

## 配置选项详解

### 必填字段

| 字段 | 说明 | 示例 |
|-----|------|------|
| `provider` | 模型提供商标识 | `"qwen"`, `"deepseek"`, `"custom"` |
| `model` | 模型名称 | `"qwen-coder-plus"` |
| `baseUrl` | API 端点 URL | `"https://api.example.com/v1"` |

### 可选字段

| 字段 | 说明 | 默认值 |
|-----|------|--------|
| `apiKey` | API 密钥 | 从环境变量读取 |
| `adapterType` | 适配器类型 | 自动推断 |
| `capabilities` | 模型能力描述 | 见下文 |
| `options` | 其他选项 | `{}` |
| `customHeaders` | 自定义 HTTP 头 | `{}` |

### 适配器类型 (adapterType)

指定使用哪种适配器来与模型通信：

- `"openai"` - OpenAI 兼容 API（推荐，适用于大多数模型）
- `"claude"` - Claude API 格式
- `"custom"` - 自定义适配器（高度灵活）
- `"gemini"` - Google Gemini（内置支持）

**自动推断规则**：
- `provider: "qwen"` → `adapterType: "openai"`
- `provider: "deepseek"` → `adapterType: "openai"`
- `provider: "openai"` → `adapterType: "openai"`
- `provider: "claude"` → `adapterType: "claude"`
- 其他 → `adapterType: "custom"`

### 模型能力 (capabilities)

描述模型的限制和特性：

```json
{
  "capabilities": {
    "maxInputTokens": 32768,      // 最大输入 tokens
    "maxOutputTokens": 8192,      // 最大输出 tokens（重要！）
    "supportsStreaming": true,    // 是否支持流式输出
    "supportsFunctionCalling": true,  // 是否支持函数调用
    "supportsVision": false,      // 是否支持图片输入
    "supportsTools": true,        // 是否支持工具调用
    "supportsMultimodal": false   // 是否支持 multimodal 消息格式（数组格式）
  }
}
```

**重要提示**：
- `maxOutputTokens` 必须正确设置，否则可能导致 API 错误
- `supportsMultimodal`: 如果模型不支持 OpenAI 的 multimodal 消息格式（content 为数组），设置为 `false`。这会将消息内容转换为简单字符串格式（适用于 DeepSeek 等模型）

### 其他选项 (options)

```json
{
  "options": {
    "temperature": 0.1,           // 温度参数
    "completionEndpoint": "/chat/completions",  // API 端点路径
    "responseFormat": "openai"    // 响应格式
  }
}
```

## 常见场景

### 场景1: 国内大模型

#### 阿里云通义千问

```json
{
  "qwen-max": {
    "provider": "qwen",
    "adapterType": "openai",
    "model": "qwen-max",
    "apiKey": "sk-xxx",
    "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "capabilities": {
      "maxOutputTokens": 8000
    }
  }
}
```

#### 百度文心一言

```json
{
  "ernie-4": {
    "provider": "custom",
    "adapterType": "openai",
    "model": "ernie-4.0",
    "apiKey": "your-api-key",
    "baseUrl": "https://aip.baidubce.com/rpc/2.0/ai_custom/v1",
    "capabilities": {
      "maxOutputTokens": 4096
    }
  }
}
```

#### 智谱 GLM

```json
{
  "glm-4": {
    "provider": "zhipu",
    "adapterType": "openai",
    "model": "glm-4",
    "apiKey": "your-api-key",
    "baseUrl": "https://open.bigmodel.cn/api/paas/v4",
    "capabilities": {
      "maxOutputTokens": 4096
    }
  }
}
```

### 场景2: 本地模型

#### Ollama

```json
{
  "ollama-llama3": {
    "provider": "custom",
    "adapterType": "openai",
    "model": "llama3",
    "baseUrl": "http://localhost:11434/v1",
    "capabilities": {
      "maxOutputTokens": 2048,
      "supportsFunctionCalling": false
    }
  }
}
```

#### LM Studio

```json
{
  "lm-studio": {
    "provider": "custom",
    "adapterType": "openai",
    "model": "local-model",
    "baseUrl": "http://localhost:1234/v1",
    "capabilities": {
      "maxOutputTokens": 4096
    }
  }
}
```

### 场景3: 企业自部署模型

```json
{
  "company-llm": {
    "provider": "custom",
    "adapterType": "openai",
    "model": "company-gpt",
    "apiKey": "internal-key",
    "baseUrl": "https://ai.company.internal/v1",
    "customHeaders": {
      "X-Company-Auth": "additional-auth"
    },
    "capabilities": {
      "maxOutputTokens": 8192,
      "supportsFunctionCalling": true
    }
  }
}
```

## API Key 管理

### 方式1: 配置文件中指定（不推荐）

```json
{
  "model-name": {
    "apiKey": "sk-your-api-key"
  }
}
```

### 方式2: 环境变量（推荐）

```bash
# 在 ~/.bashrc 或 ~/.zshrc 中
export QWEN_API_KEY="sk-your-qwen-key"
export DEEPSEEK_API_KEY="sk-your-deepseek-key"
```

配置文件中省略 `apiKey`：

```json
{
  "qwen-coder-plus": {
    "provider": "qwen",
    "model": "qwen-coder-plus",
    "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1"
  }
}
```

系统会自动查找以下环境变量：
- Qwen: `QWEN_API_KEY`, `QWEN_CODER_API_KEY`, `DASHSCOPE_API_KEY`
- DeepSeek: `DEEPSEEK_API_KEY`
- 通用: `CUSTOM_API_KEY`, `API_KEY`

### 方式3: .env 文件

在项目根目录创建 `.env` 文件：

```bash
QWEN_API_KEY=sk-your-qwen-key
DEEPSEEK_API_KEY=sk-your-deepseek-key
```

## 故障排查

### 错误: "Range of max_tokens should be [1, 8192]"

**原因**: `maxOutputTokens` 超出模型限制

**解决方法**: 在配置中设置正确的 `maxOutputTokens`：

```json
{
  "capabilities": {
    "maxOutputTokens": 8192  // 根据模型文档设置
  }
}
```

### 错误: "No adapter registered for provider"

**原因**: 未指定 `adapterType` 且无法自动推断

**解决方法**: 明确指定 `adapterType`：

```json
{
  "provider": "my-custom-provider",
  "adapterType": "openai"  // 显式指定
}
```

### 错误: "Authentication failed"

**原因**: API key 无效或未设置

**解决方法**:
1. 检查 `apiKey` 配置是否正确
2. 检查环境变量是否设置
3. 验证 API key 在提供商网站上是否有效

### 错误: "invalid type: sequence, expected a string"

**原因**: 模型不支持 OpenAI 的 multimodal 消息格式（content 为数组）

**解决方法**: 在配置中设置 `supportsMultimodal: false`：

```json
{
  "capabilities": {
    "supportsMultimodal": false
  }
}
```

这适用于 DeepSeek、部分国产大模型等不支持数组格式消息的模型。

### 模型响应格式错误

**原因**: 模型返回的格式与适配器不兼容

**解决方法**: 尝试不同的适配器类型或使用 `custom` 适配器：

```json
{
  "adapterType": "custom",
  "options": {
    "responseFormat": "openai"  // 或 "claude" 或 "raw"
  }
}
```

## 完整配置示例

这是一个包含多个模型的完整配置示例：

```json
{
  "useModelRouter": true,
  "defaultModel": "qwen-coder-plus",
  "models": {
    "qwen-coder-plus": {
      "provider": "qwen",
      "adapterType": "openai",
      "model": "qwen-coder-plus",
      "apiKey": "sk-qwen-key",
      "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
      "capabilities": {
        "maxOutputTokens": 8192,
        "supportsFunctionCalling": true
      }
    },
    "deepseek-coder": {
      "provider": "deepseek",
      "adapterType": "openai",
      "model": "deepseek-coder",
      "apiKey": "sk-deepseek-key",
      "baseUrl": "https://api.deepseek.com",
      "capabilities": {
        "maxOutputTokens": 4096
      }
    },
    "local-llama": {
      "provider": "custom",
      "adapterType": "openai",
      "model": "llama3-70b",
      "baseUrl": "http://localhost:11434/v1",
      "capabilities": {
        "maxOutputTokens": 4096,
        "supportsFunctionCalling": false
      }
    }
  }
}
```

## 贡献模型配置

如果你成功配置了新模型，欢迎贡献配置模板到项目的 `examples/model-configs/` 目录。

创建一个新文件，如 `your-model.json`：

```json
{
  "description": "配置说明",
  "provider": "provider-name",
  "homepage": "https://provider-website.com",
  "config": {
    "your-model": {
      "provider": "provider-name",
      "adapterType": "openai",
      "model": "model-name",
      "baseUrl": "https://api.provider.com/v1",
      "capabilities": {
        "maxOutputTokens": 8192
      }
    }
  }
}
```

## 相关文档

- [配置参考](./CONFIGURATION.md) - 完整配置选项说明
- [适配器开发](../packages/core/src/adapters/README.md) - 如何开发自定义适配器
- [架构设计](../DESIGN_UNIVERSAL_MODEL_SUPPORT.md) - 通用模型支持的架构设计

## 获取帮助

如果遇到问题：

1. 查看 [FAQ](./FAQ.md)
2. 搜索 [Issues](https://github.com/your-repo/issues)
3. 提交新的 [Issue](https://github.com/your-repo/issues/new)
4. 加入社区讨论

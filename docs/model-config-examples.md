# 模型配置示例

> 优化后的简化配置方案（方案 A）

## 基本原则

1. **只使用 `provider` 字段**，不需要 `adapterType`
2. **`provider` 用于标识品牌**，系统自动推断使用哪个适配器
3. **通过 `capabilities` 控制功能**，特别是 `supportsFunctionCalling`

## 配置示例

### 通义千问 (Qwen)

```json
{
  "defaultModel": "qwen3-coder-flash",
  "useModelRouter": true,
  "models": {
    "qwen3-coder-flash": {
      "provider": "qwen",
      "model": "qwen3-coder-flash",
      "apiKey": "sk-your-qwen-api-key",
      "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
      "capabilities": {
        "maxOutputTokens": 8192,
        "supportsFunctionCalling": true,
        "supportsMultimodal": true,
        "supportsStreaming": true
      }
    },
    "qwen-coder-plus": {
      "provider": "qwen",
      "model": "qwen-coder-plus",
      "apiKey": "sk-your-qwen-api-key",
      "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
      "capabilities": {
        "maxOutputTokens": 8192,
        "supportsFunctionCalling": true,
        "supportsMultimodal": true
      }
    }
  }
}
```

### DeepSeek

```json
{
  "models": {
    "deepseek-coder": {
      "provider": "deepseek",
      "model": "deepseek-coder",
      "apiKey": "sk-your-deepseek-key",
      "baseUrl": "https://api.deepseek.com",
      "capabilities": {
        "maxOutputTokens": 4096,
        "supportsFunctionCalling": false,
        "supportsMultimodal": false
      }
    }
  }
}
```

**重要**：DeepSeek 的 `supportsFunctionCalling: false` 会防止系统发送 `tools` 和 `tool_choice` 参数。

### 本地模型 (Ollama)

```json
{
  "models": {
    "qwen-local": {
      "provider": "qwen",
      "model": "Qwen2.5-Coder-32B-Instruct",
      "apiKey": "not-required",
      "baseUrl": "http://localhost:11434/v1",
      "capabilities": {
        "maxOutputTokens": 4096,
        "supportsFunctionCalling": false,
        "supportsMultimodal": false
      }
    }
  }
}
```

### 华为内部模型

```json
{
  "models": {
    "qwen-mlops": {
      "provider": "qwen",
      "model": "Qwen2.5-Coder-32B-Instruct-20250626105438",
      "apiKey": "your-mlops-key",
      "baseUrl": "http://mlops.huawei.com/mlops-service/api/v2/agentService/v1",
      "capabilities": {
        "maxOutputTokens": 4096,
        "supportsFunctionCalling": false,
        "supportsMultimodal": true
      }
    }
  }
}
```

**关键点**：设置 `supportsFunctionCalling: false` 避免 tool_choice 错误。

### OpenAI

```json
{
  "models": {
    "gpt-4o": {
      "provider": "openai",
      "model": "gpt-4o",
      "apiKey": "sk-your-openai-key",
      "capabilities": {
        "maxOutputTokens": 16384,
        "supportsFunctionCalling": true,
        "supportsMultimodal": true
      }
    },
    "gpt-4o-mini": {
      "provider": "openai",
      "model": "gpt-4o-mini",
      "apiKey": "sk-your-openai-key",
      "capabilities": {
        "maxOutputTokens": 16384,
        "supportsFunctionCalling": true
      }
    }
  }
}
```

### 月之暗面 (Moonshot/Kimi)

```json
{
  "models": {
    "moonshot-v1": {
      "provider": "moonshot",
      "model": "moonshot-v1-8k",
      "apiKey": "sk-your-moonshot-key",
      "baseUrl": "https://api.moonshot.cn/v1",
      "capabilities": {
        "maxOutputTokens": 8192,
        "supportsFunctionCalling": true
      }
    }
  }
}
```

### 智谱 AI (GLM)

```json
{
  "models": {
    "glm-4": {
      "provider": "zhipu",
      "model": "glm-4",
      "apiKey": "your-zhipu-key",
      "baseUrl": "https://open.bigmodel.cn/api/paas/v4",
      "capabilities": {
        "maxOutputTokens": 8192,
        "supportsFunctionCalling": true
      }
    }
  }
}
```

## 多模型配置与备用

```json
{
  "defaultModel": "qwen3-coder-flash",
  "useModelRouter": true,
  "models": {
    "qwen3-coder-flash": {
      "provider": "qwen",
      "model": "qwen3-coder-flash",
      "apiKey": "sk-qwen-key",
      "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
      "capabilities": {
        "supportsFunctionCalling": true
      }
    },
    "deepseek-coder": {
      "provider": "deepseek",
      "model": "deepseek-coder",
      "apiKey": "sk-deepseek-key",
      "baseUrl": "https://api.deepseek.com",
      "capabilities": {
        "supportsFunctionCalling": false
      }
    },
    "gpt-4o-mini": {
      "provider": "openai",
      "model": "gpt-4o-mini",
      "apiKey": "sk-openai-key",
      "capabilities": {
        "supportsFunctionCalling": true
      }
    }
  },
  "fallbackModels": ["gpt-4o-mini"]
}
```

## 环境变量

系统会根据 `provider` 自动查找对应的环境变量：

| Provider | 环境变量（优先级从高到低） |
|----------|------------------------|
| `openai` | `OPENAI_API_KEY` |
| `qwen` | `QWEN_API_KEY`, `QWEN_CODER_API_KEY`, `DASHSCOPE_API_KEY` |
| `deepseek` | `DEEPSEEK_API_KEY` |
| `moonshot` | `MOONSHOT_API_KEY`, `KIMI_API_KEY` |
| `zhipu` | `ZHIPU_API_KEY`, `GLM_API_KEY` |
| `minimax` | `MINIMAX_API_KEY` |

## 关键配置说明

### capabilities.supportsFunctionCalling

**最重要的配置**！控制是否发送 `tools` 和 `tool_choice` 参数。

- `true`：支持函数调用，系统会发送工具定义
- `false`：不支持函数调用，系统会**自动过滤掉** tools（即使 CLI 内部有工具定义）
- 默认值：`true`

**何时设置为 `false`**：
- 本地部署的模型（Ollama）
- 不支持函数调用的模型（如某些 DeepSeek 版本）
- OpenAI 兼容但不支持 tool_choice 的 API（如华为内部 API）

### capabilities.supportsMultimodal

控制消息格式：
- `true`：使用数组格式 `content: [{ type: 'text', text: '...' }]`
- `false`：使用字符串格式 `content: "..."`
- 默认值：`true`

## 废弃字段

以下字段在方案 A 中**不再需要**：

- ❌ `adapterType` - 系统自动推断
- ❌ `options.responseFormat` - 由 provider 决定

## 迁移指南

### 从旧配置迁移

**旧配置**：
```json
{
  "provider": "qwen",
  "adapterType": "openai",  // ❌ 删除
  "options": {
    "responseFormat": "openai"  // ❌ 删除
  }
}
```

**新配置**：
```json
{
  "provider": "qwen",
  "capabilities": {
    "supportsFunctionCalling": true  // ✅ 添加
  }
}
```

## 故障排查

### 错误：`"auto" tool choice requires ...`

**原因**：模型不支持 tool_choice 参数

**解决**：设置 `supportsFunctionCalling: false`

```json
{
  "capabilities": {
    "supportsFunctionCalling": false
  }
}
```

### 错误：`No API key found`

**原因**：未设置 API Key

**解决**：
1. 在配置文件中添加 `apiKey`
2. 或设置对应的环境变量（见上表）

### 错误：`OpenAIAdapter requires OpenAI-compatible provider`

**原因**：provider 不在支持列表中

**解决**：
- 使用支持的 provider：`openai`, `qwen`, `deepseek`, `moonshot`, `zhipu`, `minimax`
- 或使用 `provider: "openai-compatible"` 作为通用选项

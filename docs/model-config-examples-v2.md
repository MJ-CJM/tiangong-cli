# 模型配置示例（方案 A - 统一使用 provider: "openai"）

> 优化后的统一配置方案：所有 OpenAI 兼容的模型使用 `provider: "openai"` + `metadata`

## 核心原则

1. **统一 provider** - 所有 OpenAI 兼容服务使用 `provider: "openai"`
2. **metadata.providerName** - 用于身份识别（System Prompt 中显示）
3. **baseUrl** - 指定实际的 API 端点
4. **capabilities** - 控制功能支持（特别是 `supportsFunctionCalling`）

## 配置示例

### 通义千问 (Qwen)

```json
{
  "defaultModel": "qwen3-coder-flash",
  "useModelRouter": true,
  "models": {
    "qwen3-coder-flash": {
      "provider": "openai",
      "model": "qwen3-coder-flash",
      "apiKey": "sk-your-qwen-api-key",
      "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
      "metadata": {
        "providerName": "qwen",
        "displayName": "通义千问"
      },
      "capabilities": {
        "maxOutputTokens": 8192,
        "supportsFunctionCalling": true,
        "supportsMultimodal": true,
        "supportsStreaming": true
      }
    },
    "qwen-coder-plus": {
      "provider": "openai",
      "model": "qwen-coder-plus",
      "apiKey": "sk-your-qwen-api-key",
      "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
      "metadata": {
        "providerName": "qwen",
        "displayName": "通义千问"
      },
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
      "provider": "openai",
      "model": "deepseek-coder",
      "apiKey": "sk-your-deepseek-key",
      "baseUrl": "https://api.deepseek.com",
      "metadata": {
        "providerName": "deepseek",
        "displayName": "DeepSeek"
      },
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
      "provider": "openai",
      "model": "Qwen2.5-Coder-32B-Instruct",
      "apiKey": "not-required",
      "baseUrl": "http://localhost:11434/v1",
      "metadata": {
        "providerName": "qwen",
        "displayName": "本地千问模型"
      },
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
      "provider": "openai",
      "model": "Qwen2.5-Coder-32B-Instruct-20250626105438",
      "apiKey": "your-mlops-key",
      "baseUrl": "http://mlops.huawei.com/mlops-service/api/v2/agentService/v1",
      "metadata": {
        "providerName": "qwen",
        "displayName": "华为通义千问"
      },
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
      "metadata": {
        "providerName": "openai",
        "displayName": "ChatGPT"
      },
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
      "metadata": {
        "providerName": "openai"
      },
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
      "provider": "openai",
      "model": "moonshot-v1-8k",
      "apiKey": "sk-your-moonshot-key",
      "baseUrl": "https://api.moonshot.cn/v1",
      "metadata": {
        "providerName": "moonshot",
        "displayName": "Kimi"
      },
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
      "provider": "openai",
      "model": "glm-4",
      "apiKey": "your-zhipu-key",
      "baseUrl": "https://open.bigmodel.cn/api/paas/v4",
      "metadata": {
        "providerName": "zhipu",
        "displayName": "智谱AI"
      },
      "capabilities": {
        "maxOutputTokens": 8192,
        "supportsFunctionCalling": true
      }
    }
  }
}
```

### 自定义 OpenAI 兼容服务

```json
{
  "models": {
    "my-custom-model": {
      "provider": "openai",
      "model": "custom-model-name",
      "apiKey": "your-api-key",
      "baseUrl": "https://your-api.com/v1",
      "metadata": {
        "providerName": "custom",
        "displayName": "我的自定义模型",
        "envKeyNames": ["MY_CUSTOM_API_KEY", "CUSTOM_KEY"]
      },
      "capabilities": {
        "maxOutputTokens": 4096,
        "supportsFunctionCalling": true,
        "supportsMultimodal": false
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
      "provider": "openai",
      "model": "qwen3-coder-flash",
      "apiKey": "sk-qwen-key",
      "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
      "metadata": {
        "providerName": "qwen"
      },
      "capabilities": {
        "supportsFunctionCalling": true
      }
    },
    "deepseek-coder": {
      "provider": "openai",
      "model": "deepseek-coder",
      "apiKey": "sk-deepseek-key",
      "baseUrl": "https://api.deepseek.com",
      "metadata": {
        "providerName": "deepseek"
      },
      "capabilities": {
        "supportsFunctionCalling": false
      }
    },
    "gpt-4o-mini": {
      "provider": "openai",
      "model": "gpt-4o-mini",
      "apiKey": "sk-openai-key",
      "metadata": {
        "providerName": "openai"
      },
      "capabilities": {
        "supportsFunctionCalling": true
      }
    }
  },
  "fallbackModels": ["gpt-4o-mini"]
}
```

## 环境变量自动发现

系统会根据 `metadata.providerName` 自动查找对应的环境变量：

| ProviderName | 环境变量（优先级从高到低） |
|--------------|--------------------------|
| `openai` | `OPENAI_API_KEY` |
| `qwen` | `QWEN_API_KEY`, `QWEN_CODER_API_KEY`, `DASHSCOPE_API_KEY` |
| `deepseek` | `DEEPSEEK_API_KEY` |
| `moonshot` | `MOONSHOT_API_KEY`, `KIMI_API_KEY` |
| `zhipu` | `ZHIPU_API_KEY`, `GLM_API_KEY` |
| `minimax` | `MINIMAX_API_KEY` |

**自定义环境变量**：

```json
{
  "metadata": {
    "providerName": "my-provider",
    "envKeyNames": ["MY_CUSTOM_KEY", "FALLBACK_KEY"]
  }
}
```

## 关键配置说明

### provider (必需)

所有 OpenAI 兼容服务统一使用 `"openai"`：

```json
{
  "provider": "openai"
}
```

### metadata.providerName (推荐)

用于身份识别和环境变量发现：

```json
{
  "metadata": {
    "providerName": "qwen"  // 模型会根据这个识别自己是"通义千问"
  }
}
```

### capabilities.supportsFunctionCalling (重要)

控制是否发送 `tools` 和 `tool_choice` 参数：

- `true`：支持函数调用，系统会发送工具定义
- `false`：不支持函数调用，系统会自动过滤掉 tools
- 默认值：`true`

**何时设置为 `false`**：
- 本地部署的模型（Ollama）
- 不支持函数调用的模型
- OpenAI 兼容但不支持 tool_choice 的 API

### capabilities.supportsMultimodal

控制消息格式：
- `true`：使用数组格式 `content: [{ type: 'text', text: '...' }]`
- `false`：使用字符串格式 `content: "..."`
- 默认值：`true`

## 向后兼容

### 旧配置（仍然支持）

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
  "provider": "openai",
  "model": "qwen3-coder-flash",
  "metadata": {
    "providerName": "qwen"
  },
  ...
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
3. 或在 `metadata.envKeyNames` 中指定自定义环境变量名

### 模型身份识别错误

**问题**：模型说自己是错误的身份

**解决**：检查 `metadata.providerName` 配置

```json
{
  "metadata": {
    "providerName": "qwen"  // 确保这个值正确
  }
}
```

## 优势总结

1. **✅ 统一配置** - 所有 OpenAI 兼容服务使用相同的 `provider: "openai"`
2. **✅ 灵活扩展** - 通过 `metadata` 和 `baseUrl` 支持任意兼容服务
3. **✅ 无需修改代码** - 新增服务只需配置即可
4. **✅ 清晰的身份** - `metadata.providerName` 明确模型身份
5. **✅ 自动环境变量发现** - 支持常见服务的环境变量自动查找
6. **✅ 向后兼容** - 旧配置仍然有效

## 完整配置示例

```json
{
  "defaultModel": "qwen3-coder-flash",
  "useModelRouter": true,
  "models": {
    "qwen3-coder-flash": {
      "provider": "openai",
      "model": "qwen3-coder-flash",
      "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
      "metadata": {
        "providerName": "qwen",
        "displayName": "通义千问"
      },
      "capabilities": {
        "maxOutputTokens": 8192,
        "supportsFunctionCalling": true,
        "supportsMultimodal": true
      }
    },
    "deepseek-coder": {
      "provider": "openai",
      "model": "deepseek-coder",
      "baseUrl": "https://api.deepseek.com",
      "metadata": {
        "providerName": "deepseek",
        "displayName": "DeepSeek"
      },
      "capabilities": {
        "supportsFunctionCalling": false
      }
    },
    "local-qwen": {
      "provider": "openai",
      "model": "Qwen2.5-Coder-32B-Instruct",
      "apiKey": "not-required",
      "baseUrl": "http://localhost:11434/v1",
      "metadata": {
        "providerName": "qwen",
        "displayName": "本地千问"
      },
      "capabilities": {
        "supportsFunctionCalling": false
      }
    }
  }
}
```

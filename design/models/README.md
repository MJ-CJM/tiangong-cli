# 模型支持系统

> **状态**: ✅ 已完成 | **版本**: 1.0

---

## 📋 概述

TianGong CLI 提供了灵活的模型支持系统,通过配置驱动的方式支持接入任意 OpenAI 兼容的 AI 模型,无需修改代码。

## ✨ 核心特性

- ✅ **零代码配置**: 通过 JSON 配置即可添加新模型
- ✅ **适配器复用**: OpenAI 兼容模型共用适配器
- ✅ **灵活配置**: 支持模型特定的参数和能力配置
- ✅ **向后兼容**: 完全兼容原有 Gemini、OpenAI、Claude 模型

## 📚 文档导航

| 文档 | 说明 | 适合读者 |
|------|------|----------|
| [通用模型支持设计](./universal-model-support.md) | 架构设计和实现细节 | 开发者 |
| [添加新模型指南](./add-new-model-guide.md) | 用户配置指南 | 用户、开发者 |

## 🎯 支持的模型类型

### 国内大模型
- ✅ 通义千问（Qwen）
- ✅ DeepSeek
- ✅ 智谱 GLM
- ✅ 文心一言
- ✅ 其他 OpenAI 兼容模型

### 本地模型
- ✅ Ollama
- ✅ LM Studio
- ✅ 其他本地部署模型

### 企业自部署
- ✅ 企业内部模型
- ✅ 自定义端点

## 🚀 快速开始

### 1. 配置模型

编辑 `~/.gemini/config.json`:

```json
{
  "useModelRouter": true,
  "defaultModel": "qwen-coder-plus",
  "models": {
    "qwen-coder-plus": {
      "provider": "qwen",
      "adapterType": "openai",
      "model": "qwen-coder-plus",
      "apiKey": "sk-your-api-key",
      "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
      "capabilities": {
        "maxOutputTokens": 8192,
        "supportsMultimodal": true
      }
    }
  }
}
```

### 2. 使用模型

```bash
# 切换模型
/model use qwen-coder-plus

# 查看当前模型
/model info

# 列出所有可用模型
/model list
```

## 🏗️ 架构设计

### 配置驱动

```
配置文件 (config.json)
    ↓
AdapterRegistry (注册表)
    ↓
ModelRouter (路由器)
    ↓
具体 Adapter (OpenAI/Claude/Gemini)
    ↓
API 调用
```

### 适配器映射

| Provider | Adapter Type | 说明 |
|----------|--------------|------|
| `gemini` | gemini | Google Gemini 模型 |
| `openai` | openai | OpenAI 模型 |
| `claude` | claude | Anthropic Claude 模型 |
| `qwen` | openai | 通义千问（复用 OpenAI 适配器） |
| `deepseek` | openai | DeepSeek（复用 OpenAI 适配器） |
| `openai-compatible` | openai | 通用 OpenAI 兼容 |
| `custom` | custom | 自定义适配器 |

## 🔧 关键配置字段

### ModelConfig 接口

```typescript
interface ModelConfig {
  provider: string;           // 供应商标识
  adapterType?: string;       // 适配器类型
  model: string;              // 模型名称
  apiKey?: string;            // API 密钥
  baseUrl?: string;           // API 端点
  capabilities?: {            // 模型能力
    maxInputTokens?: number;
    maxOutputTokens?: number;
    supportsStreaming?: boolean;
    supportsFunctionCalling?: boolean;
    supportsVision?: boolean;
    supportsMultimodal?: boolean;
  };
  options?: Record<string, any>;  // 其他选项
}
```

### 重要字段说明

- **`adapterType`**: 决定使用哪个适配器实现（openai/claude/gemini/custom）
- **`capabilities.supportsMultimodal`**: 是否支持 OpenAI multimodal 消息格式
  - `true`: 使用 `content: [{type: 'text', text: '...'}]` 格式
  - `false`: 使用 `content: "..."` 字符串格式
  - DeepSeek 等模型需要设置为 `false`

## 📊 配置优先级

```
Runtime 参数 > 环境变量 > 项目配置 > 全局配置 > 默认值
```

## 🔗 相关资源

### 代码实现
- 适配器注册表: `packages/core/src/adapters/registry.ts`
- 模型路由器: `packages/core/src/adapters/modelRouter.ts`
- 配置管理: `packages/core/src/config/config.ts`
- API 转换器: `packages/core/src/adapters/utils/apiTranslator.ts`

### 测试
- 单元测试: `packages/core/src/config/models.test.ts`
- 集成测试: `packages/core/src/adapters/*.test.ts`

---

**最后更新**: 2025-10-14

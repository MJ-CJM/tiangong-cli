# Agents 智能路由系统

> **状态**: ✅ 已完成 | **版本**: 1.0 | **完成日期**: 2025-10-07

---

## 📋 概述

智能路由功能可以根据用户的输入内容,自动选择最适合的 Agent 来处理任务,无需手动指定 Agent 名称。

## ✨ 核心特性

- ✅ **三种路由策略**: rule（规则）、llm（AI推理）、hybrid（混合）
- ✅ **自动匹配**: 基于关键词、正则表达式或 AI 语义理解
- ✅ **优先级机制**: 支持配置 Agent 优先级
- ✅ **一键执行**: `--execute` 参数一步完成路由和执行
- ✅ **配置管理**: 完整的配置系统,支持运行时调整

## 📚 文档导航

| 文档 | 说明 |
|------|------|
| [integration.md](./integration.md) | 自动路由集成方案 |

## 🎯 三种路由策略

| 策略 | 性能 | 准确度 | 适用场景 |
|------|------|--------|----------|
| **rule** | 极快 (< 10ms) | 中等 | 明确的关键词触发 |
| **llm** | 较慢 (1-3s) | 高 | 复杂语义理解 |
| **hybrid** | 快速 (10-100ms) | 高 | 推荐默认使用 ⭐ |

### 1. Rule-based Router

基于关键词和正则表达式匹配。

**优点**:
- 性能极快（< 10ms）
- 确定性强,可预测
- 无需 API 调用

**缺点**:
- 准确度依赖触发器配置质量
- 难以处理复杂语义

**实现**: `packages/core/src/agents/RuleRouter.ts`

### 2. LLM-based Router

使用 AI 模型进行语义理解和推理。

**优点**:
- 准确度高,理解复杂语义
- 无需手动配置触发器

**缺点**:
- 性能较慢（1-3s）
- 需要 API 调用,有成本
- 不够可预测

**实现**: `packages/core/src/agents/LLMRouter.ts`

### 3. Hybrid Router（推荐）

规则优先,LLM 兜底的混合策略。

**执行流程**:
```
1. 先尝试规则路由
2. 如果置信度 < 阈值,使用 LLM 路由
3. 返回最高分的结果
```

**优点**:
- 兼具速度和准确度
- 大部分场景下性能优秀（10-100ms）
- 复杂场景自动降级到 LLM

**实现**: `packages/core/src/agents/HybridRouter.ts`

## 🚀 快速开始

### 1. 配置触发器

编辑 Agent 文件,添加 `triggers`:

```yaml
---
kind: agent
name: code-review
title: 代码审查助手
triggers:
  keywords:
    - 审查
    - review
    - 检查
    - 代码质量
  patterns:
    - "检查.*代码"
    - "review.*code"
  priority: 80
---
```

**字段说明**:
- `keywords`: 关键词列表（中英文均可）
- `patterns`: 正则表达式列表
- `priority`: 优先级 (0-100),数值越高优先级越高

### 2. 启用路由

```bash
# 启用智能路由
/agents config enable

# 设置路由策略
/agents config set strategy hybrid
```

### 3. 测试路由

```bash
# 仅测试路由结果（不执行）
/agents route "帮我审查代码"

# 输出示例
✅ **Routing Result**
**Selected Agent**: code-review
**Confidence**: 92%
**Matched Keywords**: 审查
```

### 4. 路由并执行 ⭐

```bash
# 一步完成路由和执行（推荐）
/agents route "帮我审查代码" --execute

# 输出示例
🔍 Routing and executing: "帮我审查代码"
✅ **Routing Result**: code-review
🚀 Executing with agent: **代码审查助手**
[Agent 开始执行...]
```

## ⚙️ 配置管理

### CLI 命令

```bash
# 查看当前配置
/agents config show

# 启用/禁用路由
/agents config enable
/agents config disable

# 设置路由策略
/agents config set strategy rule       # 仅规则
/agents config set strategy llm        # 仅 LLM
/agents config set strategy hybrid     # 混合模式（推荐）

# 设置置信度阈值（hybrid 模式）
/agents config set rule.confidence_threshold 80

# 设置 LLM 模型
/agents config set llm.model gemini-2.0-flash

# 设置 LLM 超时（毫秒）
/agents config set llm.timeout 5000
```

### 环境变量

```bash
# 启用路由
export GEMINI_ROUTING_ENABLED=true

# 设置策略
export GEMINI_ROUTING_STRATEGY=hybrid

# 置信度阈值
export GEMINI_ROUTING_CONFIDENCE_THRESHOLD=70

# LLM 配置
export GEMINI_ROUTING_LLM_MODEL=gemini-2.0-flash
export GEMINI_ROUTING_LLM_TIMEOUT=5000

# 降级策略
export GEMINI_ROUTING_FALLBACK=prompt_user
```

### 配置优先级

```
Runtime 参数 > 环境变量 > 项目配置 > 全局配置 > 默认值
```

## 🏗️ 架构设计

### 核心接口

```typescript
interface RoutingResult {
  agent: AgentDefinition;
  score: number;
  confidence: number;
  matchedKeywords: string[];
  matchedPatterns: string[];
}

interface RoutingConfig {
  enabled: boolean;
  strategy: 'rule' | 'llm' | 'hybrid';
  rule?: {
    confidence_threshold: number;
  };
  llm?: {
    model: string;
    timeout: number;
  };
  fallback: 'main_session' | 'prompt_user';
}
```

### 类层次结构

```
BaseRouter (抽象类)
    ↓
├── RuleRouter (规则路由器)
├── LLMRouter (LLM 路由器)
└── HybridRouter (混合路由器)
```

### 路由流程

```
用户输入
    ↓
Router.route(input)
    ↓
[根据策略选择路由器]
    ↓
计算匹配分数和置信度
    ↓
返回 RoutingResult
    ↓
AgentExecutor.execute()
```

## 📊 性能指标

| 指标 | 目标 | 实际 | 状态 |
|------|------|------|------|
| Rule 路由延迟 | < 10ms | ~3ms | ✅ |
| LLM 路由延迟 | < 5s | 1-3s | ✅ |
| Hybrid 路由延迟 | < 100ms | 10-50ms | ✅ |

## 🧪 测试

### 单元测试

```bash
# 运行路由测试
npm test -- RuleRouter.test.ts
npm test -- Router.test.ts
```

### 测试覆盖

- ✅ 关键词匹配测试（9 tests）
- ✅ 正则表达式匹配测试（9 tests）
- ✅ 优先级排序测试（9 tests）
- ✅ 配置管理测试（17 tests）
- ✅ 集成测试（8 tests）

**总计**: 52 tests passed

## 💡 最佳实践

### 1. 触发器配置

✅ **好的配置**:
```yaml
triggers:
  keywords: [审查, review, 检查, 代码质量]
  patterns: ["审查.*代码", "review.*code"]
  priority: 80
```

❌ **不好的配置**:
```yaml
triggers:
  keywords: [审查]  # 太少,容易漏匹配
  priority: 50      # 优先级太低
```

### 2. 策略选择

- **开发阶段**: 使用 `rule` 策略,快速测试
- **生产环境**: 使用 `hybrid` 策略,兼顾性能和准确度
- **高要求场景**: 使用 `llm` 策略,追求最高准确度

### 3. 置信度阈值

```bash
# 保守配置（更准确,但可能无匹配）
/agents config set rule.confidence_threshold 90

# 推荐配置（平衡）
/agents config set rule.confidence_threshold 75

# 激进配置（更多匹配,但可能误判）
/agents config set rule.confidence_threshold 60
```

## 🔗 相关资源

### 代码实现
- RuleRouter: `packages/core/src/agents/RuleRouter.ts`
- LLMRouter: `packages/core/src/agents/LLMRouter.ts`
- HybridRouter: `packages/core/src/agents/HybridRouter.ts`
- Router: `packages/core/src/agents/Router.ts`

### 测试
- `packages/core/src/agents/RuleRouter.test.ts`
- `packages/core/src/agents/Router.test.ts`
- `packages/core/src/agents/integration.test.ts`

### 文档
- [集成方案](./integration.md)
- [P2 完成总结](../completion-summaries/p2-completion.md)

---

**最后更新**: 2025-10-14

# Gemini CLI 二次开发文档

**版本**: `0.6.0-nightly`
**Commit**: `b347fa25e9133d410c4210e3825ace0cae5b4ecb`
**更新时间**: 2025-10-01

---

## 📚 文档导航

本目录包含 Gemini CLI 项目的完整架构分析与二次开发指南。

### 核心文档

| 文档 | 内容概要 | 阅读时长 |
|------|---------|---------|
| [00-overview.md](./00-overview.md) | 项目背景、能力边界、交互流程 | 10分钟 |
| [01-architecture.md](./01-architecture.md) | 详细架构、模块分层、调用链路 | 20分钟 |
| [02-commands.md](./02-commands.md) | 命令系统、新增命令模板 | 15分钟 |
| [03-config-and-secrets.md](./03-config-and-secrets.md) | 配置管理、密钥安全 | 15分钟 |
| [04-model-and-providers.md](./04-model-and-providers.md) | 模型层、多Provider设计 | 20分钟 |
| [05-extensibility.md](./05-extensibility.md) | 扩展点、插件开发 | 15分钟 |
| [06-dev-setup.md](./06-dev-setup.md) | 开发环境搭建、常见问题 | 10分钟 |
| [07-testing-and-ci.md](./07-testing-and-ci.md) | 测试策略、CI配置 | 15分钟 |
| [08-roadmap.md](./08-roadmap.md) | 演进路线图、风险管理 | 10分钟 |

**总计阅读时间**: 约 2-3 小时

---

## 🚀 快速开始

### 新手路径（了解项目）

```bash
# 1. 阅读核心文档
cat study/00-overview.md
cat study/01-architecture.md

# 2. 安装依赖并构建
npm install
npm run build

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 并填入 API Key

# 4. 运行 CLI
npm start

# 5. 尝试新增的诊断命令
npm start -- /diagnose
```

### 开发者路径（贡献代码）

```bash
# 1. 克隆并设置分支
git checkout -b feature/my-feature

# 2. 阅读开发文档
cat study/02-commands.md  # 如果要添加命令
cat study/05-extensibility.md  # 如果要添加工具

# 3. 开发
npm run build -- --watch  # 监听模式
# 在另一个终端编辑代码

# 4. 测试
npm test -- path/to/your-test.ts

# 5. 代码质量检查
npm run preflight

# 6. 提交
git commit -m "feat: add new feature"
```

---

## 🎯 二次开发重点

### 已完成的扩展示例

#### 1. 新增 Slash 命令: `/diagnose`

**位置**: `packages/cli/src/ui/commands/diagnoseCommand.ts`

**功能**:
- ✅ 检测系统环境（Node版本、内存）
- ✅ 检测配置文件（用户/项目配置）
- ✅ 检测环境变量（API Key、代理）
- ✅ 检测依赖工具（Git、Docker、ripgrep）
- ✅ 网络连通性测试（Internet、Gemini API）
- ✅ 双输出格式（表格/JSON）

**使用方式**:
```bash
# 表格输出
npm start -- /diagnose

# JSON输出（用于CI/CD）
npm start -- /diagnose --json
```

**测试**:
```bash
npm test -- packages/cli/src/ui/commands/diagnoseCommand.test.ts
```

---

#### 2. 多模型 Provider 框架（部分实现）

**位置**: `packages/core/src/routing/`

**已实现**:
- ✅ `ModelAdapter` 接口定义
- ✅ `QwenAdapter` 基础实现（通义千问）
- ⚠️ `ModelRouterService` 未激活

**待完成**:
- [ ] 激活 `ModelRouterService` 到主流程
- [ ] 实现 `OpenAIAdapter`
- [ ] 完善配置支持
- [ ] 添加集成测试

**配置示例**:
```json
{
  "model": "qwen-coder-turbo",
  "providers": {
    "qwen": {
      "apiKey": "${QWEN_CODER_API_KEY}",
      "baseURL": "https://dashscope.aliyuncs.com/compatible-mode/v1"
    }
  }
}
```

---

## 📦 新增文件清单

### 文档文件
- `study/00-overview.md`
- `study/01-architecture.md`
- `study/02-commands.md`
- `study/03-config-and-secrets.md`
- `study/04-model-and-providers.md`
- `study/05-extensibility.md`
- `study/06-dev-setup.md`
- `study/07-testing-and-ci.md`
- `study/08-roadmap.md`
- `study/README.md` （本文件）

### 代码文件
- `packages/cli/src/ui/commands/diagnoseCommand.ts`
- `packages/cli/src/ui/commands/diagnoseCommand.test.ts`

### 配置文件
- `.env.example`

### 示例文件
- `examples/diagnose-demo.sh`

---

## 🔧 开发工具链

### 必需工具
- **Node.js**: >= 20.0.0
- **npm**: >= 9.x
- **Git**: 任意版本

### 可选工具
- **Docker**: 用于沙箱执行
- **ripgrep**: 高性能搜索
- **gh**: GitHub CLI（用于PR）

### IDE 推荐
- **VS Code** + ESLint + Prettier
- 配置文件位于 `.vscode/`（如果存在）

---

## 🧪 测试命令速查

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- packages/cli/src/ui/commands/diagnoseCommand.test.ts

# 监听模式
npm test -- --watch

# 覆盖率
npm run test:ci

# 集成测试
npm run test:e2e
```

---

## 🐛 常见问题

### Q1: 如何注册新命令到 CLI？

A: 查看 `02-commands.md` 的"新增命令模板"章节。关键步骤：
1. 创建命令文件（如 `diagnoseCommand.ts`）
2. 实现 `SlashCommand` 接口
3. 注册到 `BuiltInCommandLoader`（或自定义 Loader）
4. 编写测试

### Q2: 如何添加新的模型 Provider？

A: 查看 `04-model-and-providers.md`。关键步骤：
1. 实现 `ModelAdapter` 接口
2. 格式转换（Provider格式 ↔ Gemini格式）
3. 注册到 `ModelRouterService`
4. 配置支持

### Q3: 如何调试 CLI？

A:
```bash
# 方式1: 使用调试标志
npm run debug

# 方式2: 添加日志
DEBUG=1 npm start

# 方式3: Chrome DevTools
# 运行 npm run debug 后在 chrome://inspect 连接
```

### Q4: 测试失败怎么办？

A: 查看 `07-testing-and-ci.md` 的"调试测试"章节。

---

## 📝 贡献指南

### 提交规范

使用约定式提交（Conventional Commits）:

```bash
feat: 新功能
fix: Bug修复
docs: 文档更新
style: 代码格式（不影响功能）
refactor: 重构
test: 测试相关
chore: 构建/工具链
```

### PR 检查清单

- [ ] 代码通过 `npm run preflight`
- [ ] 添加了单元测试
- [ ] 更新了相关文档
- [ ] 填写了 PR 模板
- [ ] 通过 Code Review

---

## 🔗 外部资源

- [Gemini API 文档](https://ai.google.dev/docs)
- [MCP 协议规范](https://github.com/anthropics/model-context-protocol)
- [Ink 文档](https://github.com/vadimdemedes/ink)
- [Vitest 文档](https://vitest.dev/)

---

## 📧 获取帮助

- **GitHub Issues**: [报告Bug](https://github.com/google-gemini/gemini-cli/issues)
- **Discussions**: [提问](https://github.com/google-gemini/gemini-cli/discussions)
- **邮件列表**: （如果有）

---

**祝您开发愉快！** 🎉

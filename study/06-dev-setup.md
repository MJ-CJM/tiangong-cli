# 06 - 开发环境搭建

**适用版本**: `0.6.0-nightly`
**Commit Hash**: `b347fa25e9133d410c4210e3825ace0cae5b4ecb`
**文档日期**: 2025-10-01

---

## 📋 系统要求

| 依赖 | 最低版本 | 推荐版本 | 检查命令 |
|------|---------|---------|---------|
| **Node.js** | 20.0.0 | 20.x LTS | `node --version` |
| **npm** | 9.x | 10.x | `npm --version` |
| **Git** | 2.x | 最新 | `git --version` |

### 可选依赖

| 工具 | 用途 | 检查命令 |
|------|------|---------|
| **Docker** | 沙箱执行 | `docker --version` |
| **ripgrep** | 高性能搜索 | `rg --version` |
| **gh** | GitHub CLI | `gh --version` |

---

## 🚀 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/your-fork/gemini-cli.git
cd gemini-cli
```

### 2. 安装依赖

```bash
npm install
```

**注意**: 使用 `npm ci` 而不是 `npm install` 以确保使用锁定的依赖版本。

### 3. 构建项目

```bash
npm run build
```

### 4. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，填入你的 API Key
```

### 5. 启动 CLI

```bash
npm start
```

---

## 🛠️ 开发工作流

### 开发模式

```bash
# 监听模式（文件变化自动重新构建）
npm run build -- --watch

# 在另一个终端启动
npm start
```

### 调试模式

```bash
npm run debug
```

在 Chrome 中打开 `chrome://inspect` 连接调试器。

### 测试

```bash
# 运行所有测试
npm test

# 运行特定包的测试
npm test --workspace packages/cli

# 监听模式
npm test -- --watch

# 覆盖率
npm run test:ci
```

### 代码质量

```bash
# Lint
npm run lint

# 自动修复
npm run lint:fix

# 格式化
npm run format

# 类型检查
npm run typecheck

# 完整预检
npm run preflight
```

---

## 📁 项目结构导航

```
gemini-cli/
├── packages/
│   ├── cli/          👉 从这里开始阅读
│   │   ├── src/
│   │   │   ├── gemini.tsx          # 入口文件
│   │   │   ├── ui/
│   │   │   │   ├── AppContainer.tsx
│   │   │   │   └── commands/       # Slash 命令
│   │   │   ├── services/
│   │   │   │   └── CommandService.ts
│   │   │   └── config/
│   │   │       └── settings.ts
│   │   └── package.json
│   │
│   ├── core/         👉 核心逻辑
│   │   ├── src/
│   │   │   ├── core/
│   │   │   │   └── geminiChat.ts   # 对话引擎
│   │   │   ├── tools/              # 工具实现
│   │   │   │   ├── tool-registry.ts
│   │   │   │   ├── read-file.ts
│   │   │   │   └── ...
│   │   │   ├── config/
│   │   │   │   └── config.ts       # 配置管理
│   │   │   └── routing/            # 模型路由
│   │   │       └── modelRouterService.ts
│   │   └── package.json
│   │
│   └── test-utils/
│
├── integration-tests/
├── scripts/          # 构建脚本
├── bundle/           # 打包产物
└── study/            # 📚 本文档目录
```

---

## 🔍 常见问题排查

### 问题 1: 安装依赖失败

**症状**: `npm install` 报错

**原因**: Node 版本过低或网络问题

**解决**:
```bash
# 检查 Node 版本
node --version  # 应该 >= 20.0.0

# 使用 nvm 切换版本
nvm install 20
nvm use 20

# 清理缓存重试
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### 问题 2: 构建失败

**症状**: `npm run build` 报错

**常见原因**:
- TypeScript 错误
- 缺少依赖
- 配置文件错误

**解决**:
```bash
# 查看详细错误
npm run build 2>&1 | tee build.log

# 类型检查
npm run typecheck

# 清理重新构建
npm run clean
npm run build
```

### 问题 3: 启动时找不到 API Key

**症状**: `Error: API key not configured`

**解决**:
```bash
# 1. 检查环境变量
echo $GEMINI_API_KEY

# 2. 设置环境变量
export GEMINI_API_KEY="your_api_key"

# 3. 或在 .env 文件中配置
echo "GEMINI_API_KEY=your_api_key" > .env
```

### 问题 4: 测试失败

**症状**: 某些测试用例失败

**排查步骤**:
```bash
# 1. 运行失败的测试（verbose 模式）
npm test -- --reporter=verbose path/to/failing-test.ts

# 2. 查看测试覆盖率
npm run test:ci

# 3. 更新快照（如果是快照测试）
npm test -- -u
```

---

## 🐳 Docker 开发环境

### Dockerfile（开发用）

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV GEMINI_API_KEY=""
CMD ["npm", "start"]
```

### 构建与运行

```bash
# 构建镜像
docker build -t gemini-cli-dev .

# 运行容器
docker run -it --rm \
  -e GEMINI_API_KEY="your_key" \
  -v $(pwd):/app \
  gemini-cli-dev
```

---

## 🔧 IDE 配置

### VS Code 推荐设置

**.vscode/settings.json**:
```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "eslint.validate": ["typescript", "typescriptreact"],
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true
  }
}
```

### VS Code 推荐扩展

- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- GitLens
- Error Lens

---

## 📚 学习路径

### 新手入门（1-2 天）

1. 阅读 [00-overview.md](./00-overview.md)
2. 运行 `npm start` 体验功能
3. 阅读 [01-architecture.md](./01-architecture.md)
4. 查看 `packages/cli/src/gemini.tsx` 入口文件

### 进阶开发（3-5 天）

1. 阅读 [02-commands.md](./02-commands.md) 并实现一个简单命令
2. 阅读 [03-config-and-secrets.md](./03-config-and-secrets.md) 理解配置系统
3. 调试一个工具的执行流程（从 `geminiChat.ts` 到工具）
4. 修改一个现有工具并添加测试

### 高级扩展（1-2 周）

1. 实现完整的新工具（参考 [05-extensibility.md](./05-extensibility.md)）
2. 实现新的模型 Provider
3. 创建 MCP 服务器
4. 贡献代码到上游仓库

---

## 🎯 开发最佳实践

### 1. 分支管理

```bash
# 主分支保护
main (稳定版本)
  ├── dev (开发分支)
  │   ├── feature/new-command
  │   ├── fix/bug-123
  │   └── refactor/tool-system

# 创建新分支
git checkout -b feature/my-feature
```

### 2. 提交规范

```bash
# 使用约定式提交
git commit -m "feat(cli): add diagnose command"
git commit -m "fix(core): resolve tool timeout issue"
git commit -m "docs(study): update architecture diagram"

# 类型: feat, fix, docs, style, refactor, test, chore
```

### 3. PR 检查清单

- [ ] 代码通过 `npm run preflight`
- [ ] 添加了测试用例
- [ ] 更新了相关文档
- [ ] 通过 Code Review
- [ ] 无冲突，可合并

---

## 🚨 故障排除命令

```bash
# 完全清理并重新开始
npm run clean
rm -rf node_modules
rm package-lock.json
npm install
npm run build
npm test

# 检查依赖版本
npm list --depth=0

# 查看构建产物
ls -lh bundle/
ls -lh packages/*/dist/

# 检查环境
node --version
npm --version
git --version
docker --version  # 可选
```

---

**下一步**: 阅读 [07-testing-and-ci.md](./07-testing-and-ci.md) 了解测试策略。

# 部署与发布指南

**适用版本**: `0.6.0-nightly`
**文档日期**: 2025-10-01

---

## 📋 部署前检查清单

### 代码质量检查

```bash
# 1. 完整预检（必须通过）
npm run preflight

# 2. 单独检查项
npm run lint         # ESLint 检查
npm run typecheck    # TypeScript 类型检查
npm run test:ci      # 完整测试 + 覆盖率
npm run build        # 构建检查
```

### 文档检查

- [ ] CHANGELOG.md 已更新
- [ ] README.md 已更新（如有新功能）
- [ ] API 文档已更新
- [ ] study/ 文档与代码同步

### 版本检查

```bash
# 检查版本号一致性
grep version package.json
grep version packages/*/package.json
```

---

## 🚀 本地测试部署

### 步骤 1: 完整构建

```bash
# 清理旧构建产物
npm run clean

# 安装依赖（使用锁定版本）
npm ci

# 完整构建（包括 bundle）
npm run build
npm run bundle
```

### 步骤 2: 本地测试

```bash
# 方式1: 使用 npm start
npm start -- /diagnose

# 方式2: 直接运行 bundle
node bundle/gemini.js /diagnose

# 方式3: 全局安装测试
npm link
gemini /diagnose
```

### 步骤 3: 集成测试

```bash
# 运行集成测试
npm run test:e2e

# 如果有 Docker 沙箱测试
npm run test:integration:sandbox:docker
```

---

## 📦 构建产物

### 构建输出

```
bundle/
├── gemini.js           # 主可执行文件
├── assets/             # 静态资源
└── node_modules/       # 打包的依赖（如有）

packages/*/dist/        # 各包的编译输出
```

### 验证构建产物

```bash
# 检查 bundle 大小
ls -lh bundle/gemini.js

# 检查可执行性
file bundle/gemini.js
chmod +x bundle/gemini.js

# 运行冒烟测试
./bundle/gemini.js --version
./bundle/gemini.js /help
```

---

## 🏷️ 版本管理

### 语义化版本规范

- **MAJOR** (X.0.0): 破坏性变更
- **MINOR** (0.X.0): 新功能（向后兼容）
- **PATCH** (0.0.X): Bug 修复

### 版本号更新

```bash
# 使用 npm version 自动更新
npm version patch  # 0.6.0 → 0.6.1
npm version minor  # 0.6.0 → 0.7.0
npm version major  # 0.6.0 → 1.0.0

# 或手动更新脚本
npm run release:version -- --type minor
```

---

## 🌐 部署环境

### Development (dev)

**目的**: 开发者日常测试

```bash
# 分支: dev
# 触发: 每次 push 到 dev
# 构建: npm run build
# 部署: 无（仅 CI 验证）
```

### Staging

**目的**: 预发布测试

```bash
# 分支: staging
# 触发: 手动或定时
# 构建: npm run build:all
# 部署: 内部测试环境
# 数据: 测试数据
```

### Production

**目的**: 正式发布

```bash
# 分支: main
# 触发: Git Tag (v*)
# 构建: npm run bundle
# 部署: npm registry / GitHub Releases
# 数据: 真实生产数据
```

---

## 📤 发布流程

### npm 包发布

```bash
# 1. 确保在 main 分支
git checkout main
git pull origin main

# 2. 更新版本号
npm version minor  # 或 patch/major

# 3. 构建与测试
npm run preflight

# 4. 发布到 npm（需要权限）
npm publish --access public

# 5. 推送标签
git push origin main --tags
```

### GitHub Release

```bash
# 1. 创建标签
git tag -a v0.7.0 -m "Release v0.7.0: Add /diagnose command"

# 2. 推送标签（触发 CI/CD）
git push origin v0.7.0

# 3. 使用 gh CLI 创建 Release
gh release create v0.7.0 \
  --title "v0.7.0: System Diagnostics" \
  --notes-file RELEASE_NOTES.md \
  bundle/gemini.js#gemini-cli-linux-x64 \
  bundle/gemini.js#gemini-cli-macos-arm64
```

---

## 🔄 CI/CD 流程

### GitHub Actions 工作流

```yaml
# .github/workflows/release.yml

name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install & Build
        run: |
          npm ci
          npm run bundle

      - name: Test
        run: npm run test:ci

      - name: Publish to npm
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          files: bundle/gemini.js
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 🔐 密钥管理（CI/CD）

### GitHub Secrets 配置

在仓库的 Settings > Secrets 中添加：

| 密钥名 | 用途 | 获取方式 |
|-------|------|---------|
| `NPM_TOKEN` | npm 发布权限 | npmjs.com > Access Tokens |
| `GEMINI_API_KEY` | 集成测试 | Google AI Studio |
| `DOCKER_USERNAME` | Docker 镜像推送 | Docker Hub |
| `DOCKER_PASSWORD` | Docker 镜像推送 | Docker Hub |

### 安全最佳实践

- ✅ 使用 GitHub Secrets 存储敏感信息
- ✅ 启用 2FA（双因素认证）
- ✅ 限制 Token 权限范围
- ✅ 定期轮换密钥
- ❌ 不在日志中打印密钥

---

## 📊 监控与告警

### 发布后监控

```bash
# 1. 检查 npm 下载量
npm info @google/gemini-cli

# 2. 监控 GitHub Release 下载
gh release view v0.7.0

# 3. 检查 Issue 是否有新问题
gh issue list --label "bug" --limit 10
```

### 回滚计划

#### npm 包回滚

```bash
# 1. 发布旧版本（带 deprecate 标记）
npm deprecate @google/gemini-cli@0.7.0 "Critical bug, please use 0.6.0"

# 2. 或完全撤回（24小时内）
npm unpublish @google/gemini-cli@0.7.0
```

#### 代码回滚

```bash
# 1. 创建 revert commit
git revert <commit-hash>

# 2. 或回退到旧标签
git checkout v0.6.0
git checkout -b hotfix/rollback-v0.7.0
```

---

## 📝 发布清单模板

### 发布前

- [ ] 所有测试通过（`npm run preflight`）
- [ ] CHANGELOG.md 已更新
- [ ] 版本号已更新
- [ ] 文档与代码同步
- [ ] 无未解决的 P0 Bug

### 发布中

- [ ] 构建成功
- [ ] npm 发布成功
- [ ] GitHub Release 创建成功
- [ ] Docker 镜像推送成功（如适用）

### 发布后

- [ ] 验证 npm 包可下载
- [ ] 验证 GitHub Release 链接
- [ ] 发布公告（Twitter/Blog）
- [ ] 监控 Issue/讨论
- [ ] 更新文档站点（如有）

---

## 🎯 发布示例：v0.7.0

### 发布说明

```markdown
# v0.7.0: System Diagnostics & Architecture Docs

## 🎉 新功能

### 新增 /diagnose 命令
- 检测系统环境（Node版本、内存）
- 检测配置文件与环境变量
- 检测依赖工具（Git、Docker、ripgrep）
- 网络连通性测试
- 支持 JSON 输出格式

### 完善项目文档
- 新增 `study/` 目录：8 篇架构与开发文档
- 涵盖架构、命令、配置、扩展、测试等主题
- 总计约 2-3 小时阅读量

## 📦 安装/更新

```bash
npm install -g @google/gemini-cli@latest
# 或
npm update -g @google/gemini-cli
```

## 🔧 使用示例

```bash
# 检测系统环境
gemini /diagnose

# JSON 输出（用于 CI/CD）
gemini /diagnose --json
```

## 📚 文档

- [完整文档](./study/README.md)
- [快速开始](./study/00-overview.md)
- [架构设计](./study/01-architecture.md)

## 🐛 Bug 修复

- 无

## ⚠️ 破坏性变更

- 无

## 🙏 贡献者

感谢所有贡献者！

---

**完整变更日志**: [v0.6.0...v0.7.0](https://github.com/google-gemini/gemini-cli/compare/v0.6.0...v0.7.0)
```

---

## 🆘 紧急回滚流程

### 发现严重 Bug

```bash
# 1. 立即 deprecate 问题版本
npm deprecate @google/gemini-cli@0.7.0 "Critical security vulnerability, please downgrade to 0.6.0"

# 2. 发布 hotfix
git checkout -b hotfix/v0.7.1
# 修复 Bug
npm version patch  # 0.7.0 → 0.7.1
npm publish

# 3. 通知用户
# 发送邮件/公告/Issue
```

---

**部署愉快！** 🚀

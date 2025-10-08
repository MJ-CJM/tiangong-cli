# Gemini CLI 项目架构文档

本文档详细描述了 Gemini CLI 项目的整体架构、组件设计和技术实现。

## 项目概述

Gemini CLI 是一个基于 Node.js 的终端工具，允许用户通过命令行界面与 Google Gemini AI 模型进行交互。该项目采用模块化架构，支持工具扩展、插件系统和多种集成方式。

## 技术栈

- **运行时**: Node.js 20+
- **语言**: TypeScript (ES2022)
- **UI框架**: React + Ink (Terminal UI)
- **构建工具**: ESBuild + TypeScript
- **测试框架**: Vitest + React Testing Library
- **包管理**: npm workspaces
- **代码质量**: ESLint + Prettier

## 项目结构

这是一个 monorepo 项目，采用 npm workspaces 管理多个包：

```
gemini-cli/
├── packages/
│   ├── cli/           # 前端终端界面包
│   ├── core/          # 后端逻辑和API通信包
│   ├── test-utils/    # 共享测试工具包
│   └── vscode-ide-companion/  # VSCode扩展伴侣
├── integration-tests/ # 集成测试
├── scripts/          # 构建和开发脚本
├── docs/            # 项目文档
└── bundle/          # 构建输出
```

## 核心架构

### 1. CLI 包 (`packages/cli/`)

**职责**: 终端用户界面、用户输入处理、视觉渲染

**核心组件**:
- **主入口** (`gemini.tsx`): 应用启动和配置加载
- **UI 组件** (`ui/`): React/Ink 终端界面组件
- **配置管理** (`config/`): 设置、认证、扩展管理
- **服务** (`services/`): 命令处理、提示加载服务

**关键特性**:
- 基于 React/Ink 的终端 UI
- 支持多主题系统
- 键盘快捷键和输入补全
- 实时流式响应显示
- 命令历史管理

**架构模式**:
- Context-based 状态管理
- 自定义 Hooks 处理终端特定功能
- 组件化 UI 设计

### 2. Core 包 (`packages/core/`)

**职责**: 业务逻辑、API 通信、工具执行

**核心模块**:

#### 2.1 核心聊天引擎 (`core/`)
- `geminiChat.ts`: 主要聊天协调器
- `contentGenerator.ts`: 内容生成配置
- `client.ts`: Gemini API 客户端
- `turn.ts`: 对话轮次管理

#### 2.2 工具系统 (`tools/`)
- `tool-registry.ts`: 工具注册和管理
- `tools.ts`: 工具接口定义
- 内置工具: 文件操作、Shell 执行、Web 搜索等
- MCP (Model Context Protocol) 集成

#### 2.3 服务层 (`services/`)
- `fileSystemService.ts`: 文件系统操作
- `shellExecutionService.ts`: Shell 命令执行
- `gitService.ts`: Git 操作服务

#### 2.4 配置系统 (`config/`)
- 分层配置管理 (系统 → 用户 → 项目 → 环境变量)
- 模型配置和选择
- 存储和缓存管理

### 3. 数据流架构

```
用户输入 → CLI UI → 命令处理 → Core 逻辑 → Gemini API
    ↓                    ↓              ↓
CLI 显示 ← UI 更新 ← 结果处理 ← 工具执行 ← API 响应
```

**具体流程**:
1. CLI 包捕获用户输入
2. 命令处理器解析输入类型（聊天、命令、工具调用）
3. Core 包构建提示并调用 Gemini API
4. 如果需要工具调用，Core 包执行工具（需用户确认不安全操作）
5. 结果通过 Core 包流回 CLI 包进行显示

## 工具系统架构

### 工具接口设计

```typescript
interface ToolInvocation<TParams, TResult> {
  params: TParams;
  getDescription(): string;
  toolLocations(): ToolLocation[];
  shouldConfirmExecute(): Promise<ToolCallConfirmationDetails | false>;
  execute(signal: AbortSignal): Promise<TResult>;
}
```

### 内置工具

- **文件操作**: `ls`, `read-file`, `write-file`, `edit`, `glob`
- **搜索工具**: `grep`, `ripgrep`
- **Shell 工具**: `shell` (命令执行)
- **Web 工具**: `web-fetch`, `web-search`
- **内存工具**: `memoryTool` (上下文管理)

### MCP (Model Context Protocol) 集成

- 支持外部 MCP 服务器连接
- 动态工具发现和注册
- OAuth 认证支持
- 多种传输协议 (stdio, HTTP, SSE)

## 配置管理系统

### 配置层次结构

```
优先级: CLI 参数 > 环境变量 > 项目配置 > 用户配置 > 系统配置 > 默认值
```

### 配置文件位置

- **系统默认**: `/Library/Application Support/GeminiCli/system-defaults.json` (macOS)
- **系统配置**: `/Library/Application Support/GeminiCli/settings.json` (macOS)
- **用户配置**: `~/.gemini/settings.json`
- **项目配置**: `.gemini/settings.json`

### 上下文文件 (GEMINI.md)

- 项目特定的 AI 指令
- 分层加载 (项目根目录到子目录)
- 支持内存刷新和显示命令

## 构建系统

### 构建工具链

- **TypeScript 编译**: 增量编译，复合项目配置
- **ESBuild 打包**: 高性能 JavaScript 打包
- **资源处理**: 自动资源复制和版本管理

### 构建脚本

- `npm run build`: 构建所有包
- `npm run bundle`: 创建分发版本
- `npm run build:all`: 包含 Docker 沙箱构建
- `npm run preflight`: 完整质量检查流程

### 开发模式

- `npm start`: 从源码启动 CLI
- `npm run debug`: 调试模式启动
- `DEV=true npm start`: 开发环境启动

## 沙箱和安全

### 沙箱选项

- **macOS**: 使用 Seatbelt (sandbox-exec) 配置文件
- **跨平台**: Docker/Podman 容器化
- **自定义沙箱配置**: `.gemini/sandbox-macos-*.sb` 文件

### 工具安全

- 只读工具默认自动批准
- 写入/执行工具需要用户确认
- 可配置的 `autoAccept` 和审批模式
- 受信任的 MCP 服务器可绕过确认

## 扩展性设计

### 命令系统

- 内置命令处理器
- 文件命令加载器 (用户自定义命令)
- MCP 提示加载器

### 插件架构

- MCP 服务器支持
- 扩展配置管理
- OAuth 集成支持

### IDE 集成

- VSCode 扩展伴侣
- 实时文件差异管理
- IDE 上下文感知

## 测试架构

### 测试层次

- **单元测试**: Vitest + React Testing Library
- **集成测试**: 实际 CLI 执行测试
- **端到端测试**: 完整工作流测试

### 测试工具

- **API 模拟**: MSW (Mock Service Worker)
- **文件系统模拟**: mock-fs
- **测试实用工具**: 共享测试辅助函数

### 测试配置

- 每个包独立的测试配置
- 覆盖率报告
- CI/CD 集成测试

## 性能优化

### 构建优化

- 增量编译
- Tree-shaking
- 代码分割
- 外部依赖管理

### 运行时优化

- 流式响应处理
- 工具执行并发
- 内存管理 (LRU 缓存)
- 文件搜索优化 (BFS, 缓存)

## 部署和分发

### 分发格式

- npm 包发布
- 预构建二进制文件
- Docker 镜像

### 版本管理

- 自动版本生成
- Git 提交信息集成
- 发布脚本自动化

## 监控和遥测

### 遥测系统

- OpenTelemetry 集成
- 自定义指标收集
- 错误报告和诊断

### 日志系统

- 结构化日志
- 多级别日志记录
- 文件导出支持

## 未来发展方向

### 计划功能

- 更多内置工具
- 增强的 AI 模型支持
- 更好的 IDE 集成
- 插件市场

### 架构改进

- 微服务架构演进
- 更灵活的配置系统
- 增强的安全模型
- 性能优化

---

**注意**: 本文档会随着项目发展持续更新。如需了解最新变化，请查看项目的 Git 历史和 ROADMAP.md 文件。
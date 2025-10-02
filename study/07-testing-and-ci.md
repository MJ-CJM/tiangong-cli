# 07 - 测试与 CI 策略

**适用版本**: `0.6.0-nightly`
**Commit Hash**: `b347fa25e9133d410c4210e3825ace0cae5b4ecb`
**文档日期**: 2025-10-01

---

## 🧪 测试金字塔

```
        ┌─────────┐
        │  E2E    │ ← 5%  (integration-tests/)
        ├─────────┤
        │ 集成测试 │ ← 15% (*.test.ts with dependencies)
        ├─────────┤
        │ 单元测试 │ ← 80% (*.test.ts)
        └─────────┘
```

---

## 🔨 测试框架

### Vitest

- **选择原因**: ESM 原生支持、快速、与 Jest 兼容
- **配置**: `vitest.config.ts`

### React Testing Library

- **用于**: Ink 组件测试
- **库**: `ink-testing-library`

### MSW (Mock Service Worker)

- **用于**: 模拟 API 请求
- **位置**: `packages/*/src/__mocks__/`

---

## 📝 单元测试

### 示例：测试 Slash 命令

```typescript
// packages/cli/src/ui/commands/diagnoseCommand.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { diagnoseCommand } from './diagnoseCommand.js';

describe('diagnoseCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct metadata', () => {
    expect(diagnoseCommand.name).toBe('diagnose');
    expect(diagnoseCommand.description).toBeTruthy();
    expect(typeof diagnoseCommand.execute).toBe('function');
  });

  it('should check for API key', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const consoleSpy = vi.spyOn(console, 'log');
    await diagnoseCommand.execute([], new AbortController().signal);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('API Key: ❌ Not found')
    );

    // 恢复环境
    if (originalKey) process.env.GEMINI_API_KEY = originalKey;
  });

  it('should output JSON when --json flag is provided', async () => {
    const consoleSpy = vi.spyOn(console, 'log');

    await diagnoseCommand.execute(['--json'], new AbortController().signal);

    const output = consoleSpy.mock.calls[0][0];
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('should respect abort signal', async () => {
    const controller = new AbortController();

    // 模拟长时间操作
    const promise = diagnoseCommand.execute(['--slow'], controller.signal);

    // 立即取消
    controller.abort();

    await expect(promise).rejects.toThrow();
  });
});
```

### 示例：测试工具

```typescript
// packages/core/src/tools/my-tool.test.ts

import { describe, it, expect } from 'vitest';
import { MyTool } from './my-tool.js';

describe('MyTool', () => {
  const tool = new MyTool();

  it('should validate params', () => {
    const validParams = { input: 'test' };
    expect(() => tool.build(validParams)).not.toThrow();

    const invalidParams = {};
    expect(() => tool.build(invalidParams as any)).toThrow('Missing required parameter');
  });

  it('should execute successfully', async () => {
    const invocation = tool.build({ input: 'test' });
    const result = await invocation.execute(new AbortController().signal);

    expect(result.llmContent).toBeTruthy();
    expect(result.error).toBeUndefined();
  });
});
```

---

## 🔗 集成测试

### 示例：CommandService 集成测试

```typescript
// packages/cli/src/services/CommandService.test.ts

import { describe, it, expect } from 'vitest';
import { CommandService } from './CommandService.js';
import { BuiltInCommandLoader } from './BuiltInCommandLoader.js';

describe('CommandService Integration', () => {
  it('should load all built-in commands', async () => {
    const service = await CommandService.create(
      [new BuiltInCommandLoader()],
      new AbortController().signal
    );

    const commands = service.getCommands();
    expect(commands.length).toBeGreaterThan(0);
    expect(commands.some(cmd => cmd.name === 'help')).toBe(true);
  });

  it('should resolve command conflicts', async () => {
    const customLoader = {
      async loadCommands() {
        return [
          {
            name: 'help', // 与内置命令冲突
            description: 'Custom help',
            extensionName: 'my-extension',
            async execute() {},
          },
        ];
      },
    };

    const service = await CommandService.create(
      [new BuiltInCommandLoader(), customLoader],
      new AbortController().signal
    );

    const commands = service.getCommands();
    expect(commands.some(cmd => cmd.name === 'my-extension.help')).toBe(true);
  });
});
```

---

## 🚀 E2E 测试

### 位置
`integration-tests/`

### 示例

```typescript
// integration-tests/basic-flow.test.ts

import { describe, it, expect } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

describe('E2E: Basic Flow', () => {
  it('should start and show help', async () => {
    const { stdout } = await execAsync('npm start -- /help', {
      env: {
        ...process.env,
        GEMINI_API_KEY: 'test_key',
      },
      timeout: 10000,
    });

    expect(stdout).toContain('Available commands');
  }, 15000);

  it('should handle missing API key gracefully', async () => {
    try {
      await execAsync('npm start -- /settings', {
        env: {
          ...process.env,
          GEMINI_API_KEY: undefined,
        },
      });
    } catch (error: any) {
      expect(error.stderr).toContain('API key not configured');
    }
  });
});
```

---

## 🎭 Mock 策略

### Mock API 请求

```typescript
// packages/core/src/__mocks__/gemini-api.ts

import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export const mockGeminiApi = setupServer(
  http.post('https://generativelanguage.googleapis.com/v1/models/*', () => {
    return HttpResponse.json({
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ text: 'Mocked response' }],
          },
          finishReason: 'STOP',
        },
      ],
    });
  })
);

// 在测试中使用
beforeAll(() => mockGeminiApi.listen());
afterEach(() => mockGeminiApi.resetHandlers());
afterAll(() => mockGeminiApi.close());
```

### Mock 文件系统

```typescript
import mockFs from 'mock-fs';

beforeEach(() => {
  mockFs({
    '/test-dir': {
      'file1.txt': 'content1',
      'file2.txt': 'content2',
    },
  });
});

afterEach(() => {
  mockFs.restore();
});
```

---

## 🔄 CI/CD 配置

### GitHub Actions 工作流

```yaml
# .github/workflows/ci.yml

name: CI

on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest]
        node: [20, 22]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint:ci

      - name: Type check
        run: npm run typecheck

      - name: Build
        run: npm run build

      - name: Test
        run: npm run test:ci
        env:
          GEMINI_API_KEY: ${{ secrets.TEST_API_KEY }}

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/coverage-final.json

  integration:
    runs-on: ubuntu-latest
    needs: test

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Integration tests (no sandbox)
        run: npm run test:integration:sandbox:none
        env:
          GEMINI_API_KEY: ${{ secrets.TEST_API_KEY }}

      - name: Setup Docker
        uses: docker/setup-buildx-action@v3

      - name: Build sandbox
        run: npm run build:sandbox

      - name: Integration tests (Docker sandbox)
        run: npm run test:integration:sandbox:docker
        env:
          GEMINI_API_KEY: ${{ secrets.TEST_API_KEY }}
```

---

## 📊 覆盖率目标

| 类型 | 目标 | 当前 |
|------|------|------|
| 语句覆盖率 | ≥80% | - |
| 分支覆盖率 | ≥75% | - |
| 函数覆盖率 | ≥80% | - |
| 行覆盖率 | ≥80% | - |

### 查看覆盖率

```bash
npm run test:ci
open coverage/index.html
```

---

## 🎯 测试最佳实践

### 1. 遵循 AAA 模式

```typescript
it('should do something', () => {
  // Arrange（准备）
  const input = 'test';
  const expected = 'result';

  // Act（执行）
  const actual = myFunction(input);

  // Assert（断言）
  expect(actual).toBe(expected);
});
```

### 2. 测试行为而非实现

```typescript
// ❌ 测试实现细节
it('should call helper function', () => {
  const spy = vi.spyOn(module, 'helperFunction');
  myFunction();
  expect(spy).toHaveBeenCalled();
});

// ✅ 测试行为
it('should return correct result', () => {
  const result = myFunction();
  expect(result).toBe(expected);
});
```

### 3. 隔离测试

```typescript
// 每个测试应独立运行
beforeEach(() => {
  // 重置状态
  resetState();
  vi.clearAllMocks();
});
```

### 4. 有意义的测试名称

```typescript
// ❌
it('test1', () => { });

// ✅
it('should throw error when API key is missing', () => { });
```

---

## 🐛 调试测试

### 运行单个测试

```bash
npm test -- packages/cli/src/ui/commands/diagnoseCommand.test.ts
```

### Verbose 模式

```bash
npm test -- --reporter=verbose
```

### 调试模式

```bash
node --inspect-brk ./node_modules/vitest/vitest.js run path/to/test.ts
```

---

## 📚 测试检查清单

### 新增功能

- [ ] 单元测试覆盖核心逻辑
- [ ] 边界条件测试（空输入、超大输入等）
- [ ] 错误处理测试
- [ ] 异步操作测试
- [ ] 取消操作测试（AbortSignal）

### Bug 修复

- [ ] 添加回归测试
- [ ] 验证修复前测试失败
- [ ] 验证修复后测试通过

### 重构

- [ ] 所有现有测试仍然通过
- [ ] 覆盖率未下降

---

**下一步**: 阅读 [08-roadmap.md](./08-roadmap.md) 了解演进路线。

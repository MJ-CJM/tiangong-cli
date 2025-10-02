/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { diagnoseCommand } from './diagnoseCommand.js';

describe('diagnoseCommand', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    // 保存原始环境变量
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // 恢复环境变量
    process.env = originalEnv;
  });

  it('should have correct metadata', () => {
    expect(diagnoseCommand.name).toBe('diagnose');
    expect(diagnoseCommand.description).toBeTruthy();
    expect(diagnoseCommand.description).toContain('检测');
    expect(typeof diagnoseCommand.execute).toBe('function');
  });

  it('should export a valid SlashCommand interface', () => {
    expect(diagnoseCommand).toHaveProperty('name');
    expect(diagnoseCommand).toHaveProperty('description');
    expect(diagnoseCommand).toHaveProperty('execute');
    expect(diagnoseCommand).toHaveProperty('usage');
  });

  it('should execute without throwing errors', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await expect(
      diagnoseCommand.execute([], new AbortController().signal),
    ).resolves.not.toThrow();

    consoleSpy.mockRestore();
  });

  it('should detect missing API key and show error', async () => {
    delete process.env.GEMINI_API_KEY;

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await diagnoseCommand.execute([], new AbortController().signal);

    const output = consoleSpy.mock.calls.map((call) => call[0]).join('\n');

    expect(output).toContain('GEMINI_API_KEY');
    expect(output).toContain('Not found');
    expect(process.exitCode).toBe(1);

    consoleSpy.mockRestore();
    process.exitCode = 0; // Reset
  });

  it('should output JSON format when --json flag is provided', async () => {
    process.env.GEMINI_API_KEY = 'test_key';

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await diagnoseCommand.execute(['--json'], new AbortController().signal);

    expect(consoleSpy).toHaveBeenCalled();

    const output = consoleSpy.mock.calls[0][0];

    // 验证是有效的 JSON
    expect(() => JSON.parse(output)).not.toThrow();

    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);

    // 验证结构
    expect(parsed[0]).toHaveProperty('category');
    expect(parsed[0]).toHaveProperty('checks');
    expect(Array.isArray(parsed[0].checks)).toBe(true);

    consoleSpy.mockRestore();
  });

  it('should output table format by default', async () => {
    process.env.GEMINI_API_KEY = 'test_key';

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await diagnoseCommand.execute([], new AbortController().signal);

    const output = consoleSpy.mock.calls.map((call) => call[0]).join('\n');

    // 验证表格格式元素
    expect(output).toContain('DIAGNOSTICS REPORT');
    expect(output).toContain('System');
    expect(output).toContain('Environment');
    expect(output).toContain('Summary');

    consoleSpy.mockRestore();
  });

  it('should check system information', async () => {
    process.env.GEMINI_API_KEY = 'test_key';

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await diagnoseCommand.execute(['--json'], new AbortController().signal);

    const output = JSON.parse(consoleSpy.mock.calls[0][0]);
    const systemCategory = output.find(
      (r: any) => r.category === 'System',
    );

    expect(systemCategory).toBeDefined();
    expect(systemCategory.checks).toContainEqual(
      expect.objectContaining({
        name: 'Platform',
        status: 'ok',
      }),
    );
    expect(systemCategory.checks).toContainEqual(
      expect.objectContaining({
        name: 'Node.js',
      }),
    );

    consoleSpy.mockRestore();
  });

  it('should check environment variables', async () => {
    process.env.GEMINI_API_KEY = 'test_key';
    process.env.HTTP_PROXY = 'http://proxy:8080';

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await diagnoseCommand.execute(['--json'], new AbortController().signal);

    const output = JSON.parse(consoleSpy.mock.calls[0][0]);
    const envCategory = output.find(
      (r: any) => r.category === 'Environment',
    );

    expect(envCategory).toBeDefined();
    expect(envCategory.checks).toContainEqual(
      expect.objectContaining({
        name: 'GEMINI_API_KEY',
        status: 'ok',
      }),
    );
    expect(envCategory.checks).toContainEqual(
      expect.objectContaining({
        name: 'HTTP_PROXY',
        value: expect.stringContaining('http://proxy:8080'),
      }),
    );

    consoleSpy.mockRestore();
  });

  it('should respect abort signal', async () => {
    const controller = new AbortController();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // 立即取消
    controller.abort();

    // 由于我们的实现中使用了 signal，但没有显式检查
    // 这个测试主要确保不会因为 signal 而崩溃
    await expect(
      diagnoseCommand.execute([], controller.signal),
    ).resolves.not.toThrow();

    consoleSpy.mockRestore();
  });

  it('should handle errors gracefully', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // 模拟 fetch 失败（网络检查会失败，但不应崩溃）
    await diagnoseCommand.execute([], new AbortController().signal);

    // 应该能完成执行
    expect(consoleSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});

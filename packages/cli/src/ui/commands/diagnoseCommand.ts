/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommand, CommandContext } from './types.js';
import { CommandKind } from './types.js';
import os from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const execAsync = promisify(exec);

interface DiagnosticResult {
  category: string;
  checks: Array<{
    name: string;
    status: 'ok' | 'warning' | 'error';
    value?: string;
    message?: string;
  }>;
}

/**
 * Diagnose 命令：检测系统环境、配置与依赖
 */
export const diagnoseCommand: SlashCommand = {
  name: 'diagnose',
  description: '检测系统环境、依赖与 API 连接状态 (Usage: /diagnose [--json])',
  kind: CommandKind.BUILT_IN,

  async action(context: CommandContext, args: string) {
    const isJson = args.includes('--json');
    const signal = new AbortController().signal;

    try {
      const diagnostics = await runDiagnostics(signal);

      if (isJson) {
        console.log(JSON.stringify(diagnostics, null, 2));
      } else {
        printDiagnosticsTable(diagnostics);
      }
    } catch (error) {
      console.error('Diagnostics failed:', (error as Error).message);
      process.exitCode = 1;
    }
  },
};

async function runDiagnostics(
  signal: AbortSignal,
): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];

  // 1. 系统信息
  results.push({
    category: 'System',
    checks: [
      {
        name: 'Platform',
        status: 'ok',
        value: `${os.platform()} ${os.arch()}`,
      },
      {
        name: 'Node.js',
        status: checkNodeVersion(),
        value: process.version,
      },
      {
        name: 'Memory',
        status: 'ok',
        value: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB total, ${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB free`,
      },
      {
        name: 'Working Directory',
        status: 'ok',
        value: process.cwd(),
      },
    ],
  });

  // 2. 环境配置
  const envChecks = [
    {
      name: 'GEMINI_API_KEY',
      status: process.env['GEMINI_API_KEY']
        ? ('ok' as const)
        : ('error' as const),
      value: process.env['GEMINI_API_KEY'] ? '✓ Set' : '✗ Not found',
      message: !process.env['GEMINI_API_KEY']
        ? 'Please set GEMINI_API_KEY environment variable'
        : undefined,
    },
    {
      name: 'GEMINI_BASE_URL',
      status: 'ok' as const,
      value:
        process.env['GEMINI_BASE_URL'] ||
        'https://generativelanguage.googleapis.com (default)',
    },
    {
      name: 'HTTP_PROXY',
      status: 'ok' as const,
      value: process.env['HTTP_PROXY'] || 'Not set',
    },
  ];

  results.push({
    category: 'Environment',
    checks: envChecks,
  });

  // 3. 配置文件
  const configPaths = [
    { path: join(os.homedir(), '.gemini', 'settings.json'), name: 'User' },
    { path: join(process.cwd(), '.gemini', 'settings.json'), name: 'Project' },
  ];

  results.push({
    category: 'Configuration',
    checks: configPaths.map((c) => ({
      name: `${c.name} Config`,
      status: existsSync(c.path) ? ('ok' as const) : ('warning' as const),
      value: existsSync(c.path) ? `✓ Found at ${c.path}` : '✗ Not found',
    })),
  });

  // 4. 依赖工具
  const tools = [
    { cmd: 'git --version', name: 'Git' },
    { cmd: 'docker --version', name: 'Docker' },
    { cmd: 'rg --version', name: 'ripgrep' },
  ];

  const toolChecks = await Promise.all(
    tools.map(async (tool) => {
      const result = await checkCommand(tool.cmd, signal);
      return {
        name: tool.name,
        status: result.available ? ('ok' as const) : ('warning' as const),
        value: result.available ? `✓ ${result.version}` : '✗ Not installed',
        message: !result.available ? 'Optional but recommended' : undefined,
      };
    }),
  );

  results.push({
    category: 'Dependencies',
    checks: toolChecks,
  });

  // 5. 网络连通性
  const endpoints = [
    { url: 'https://google.com', name: 'Internet' },
    {
      url: 'https://generativelanguage.googleapis.com',
      name: 'Gemini API',
    },
  ];

  const networkChecks = await Promise.all(
    endpoints.map(async (endpoint) => {
      const available = await checkConnectivity(endpoint.url, signal);
      return {
        name: endpoint.name,
        status: available ? ('ok' as const) : ('error' as const),
        value: available ? '✓ Reachable' : '✗ Unreachable',
        message: !available ? 'Check your network or proxy settings' : undefined,
      };
    }),
  );

  results.push({
    category: 'Network',
    checks: networkChecks,
  });

  return results;
}

function checkNodeVersion(): 'ok' | 'warning' | 'error' {
  const version = process.versions.node;
  const major = parseInt(version.split('.')[0], 10);

  if (major >= 20) return 'ok';
  if (major >= 18) return 'warning';
  return 'error';
}

async function checkCommand(
  cmd: string,
  signal: AbortSignal,
): Promise<{ available: boolean; version?: string }> {
  try {
    const { stdout } = await execAsync(cmd, {
      timeout: 5000,
      signal,
    });
    return {
      available: true,
      version: stdout.trim().split('\n')[0],
    };
  } catch {
    return { available: false };
  }
}

async function checkConnectivity(
  url: string,
  signal: AbortSignal,
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const combinedSignal = signal.aborted ? signal : controller.signal;

    const response = await fetch(url, {
      method: 'HEAD',
      signal: combinedSignal,
    });

    clearTimeout(timeout);
    return response.ok || response.status === 301 || response.status === 302;
  } catch {
    return false;
  }
}

function printDiagnosticsTable(results: DiagnosticResult[]): void {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║           GEMINI CLI DIAGNOSTICS REPORT                  ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  for (const result of results) {
    console.log(`\n━━━ ${result.category} ━━━\n`);

    const maxNameLength = Math.max(
      ...result.checks.map((c) => c.name.length),
      10,
    );

    for (const check of result.checks) {
      const statusIcon = getStatusIcon(check.status);
      const paddedName = check.name.padEnd(maxNameLength);

      console.log(
        `  ${statusIcon} ${paddedName}  ${check.value || 'N/A'}`,
      );

      if (check.message) {
        console.log(`     └─ ${check.message}`);
      }
    }
  }

  // 汇总
  const allChecks = results.flatMap((r) => r.checks);
  const okCount = allChecks.filter((c) => c.status === 'ok').length;
  const warningCount = allChecks.filter((c) => c.status === 'warning').length;
  const errorCount = allChecks.filter((c) => c.status === 'error').length;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`  Summary: ${okCount} OK, ${warningCount} Warning, ${errorCount} Error\n`);

  if (errorCount > 0) {
    console.log(
      '  ⚠️  Critical issues detected. Please resolve errors before using CLI.\n',
    );
    process.exitCode = 1;
  } else if (warningCount > 0) {
    console.log(
      '  ⚠️  Some optional dependencies are missing. CLI will work but with limited features.\n',
    );
  } else {
    console.log('  ✅ All checks passed! System is ready.\n');
  }
}

function getStatusIcon(status: 'ok' | 'warning' | 'error'): string {
  switch (status) {
    case 'ok':
      return '✓';
    case 'warning':
      return '⚠';
    case 'error':
      return '✗';
  }
}

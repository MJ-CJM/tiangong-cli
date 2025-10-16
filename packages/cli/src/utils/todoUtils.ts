/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ExtendedTodo, TodoStatus, TodoPriority } from '@google/gemini-cli-core';
import type { PlanData } from '../types/plan.js';

/**
 * Format todos for display
 */
export function formatTodosDisplay(todos: ExtendedTodo[]): string {
  if (todos.length === 0) {
    return '📋 No todos';
  }

  const stats = {
    total: todos.length,
    pending: todos.filter(t => t.status === 'pending').length,
    in_progress: todos.filter(t => t.status === 'in_progress').length,
    completed: todos.filter(t => t.status === 'completed').length,
    cancelled: todos.filter(t => t.status === 'cancelled').length,
  };

  let output = `📋 **Todo List** (${stats.total} total)\n\n`;
  output += `✅ ${stats.completed} completed | `;
  output += `🔄 ${stats.in_progress} in progress | `;
  output += `⬜ ${stats.pending} pending | `;
  output += `❌ ${stats.cancelled} cancelled\n\n`;

  // Group by priority (only show active todos)
  const byPriority = {
    high: todos.filter(
      t =>
        t.priority === 'high' &&
        t.status !== 'completed' &&
        t.status !== 'cancelled',
    ),
    medium: todos.filter(
      t =>
        t.priority === 'medium' &&
        t.status !== 'completed' &&
        t.status !== 'cancelled',
    ),
    low: todos.filter(
      t =>
        t.priority === 'low' &&
        t.status !== 'completed' &&
        t.status !== 'cancelled',
    ),
  };

  for (const [priority, items] of Object.entries(byPriority)) {
    if (items.length === 0) continue;

    output += `### ${priority.toUpperCase()} Priority\n\n`;
    for (const todo of items) {
      const icon = getStatusIcon(todo.status);
      output += `${icon} \`${todo.id}\` - ${todo.description}`;

      if (todo.dependencies && todo.dependencies.length > 0) {
        output += ` [deps: ${todo.dependencies.join(', ')}]`;
      }
      
      if (todo.estimatedTime) {
        output += ` ⏱️ ${todo.estimatedTime}`;
      }
      
      output += '\n';

      if (todo.risks && todo.risks.length > 0) {
        output += `  ⚠️  ${todo.risks.join(', ')}\n`;
      }
    }
    output += '\n';
  }

  // Show completed todos
  const completed = todos.filter(t => t.status === 'completed');
  if (completed.length > 0) {
    output += `### ✅ Completed (${completed.length})\n\n`;
    completed.forEach(t => {
      output += `✅ \`${t.id}\` - ${t.description}\n`;
    });
    output += '\n';
  }

  // Show cancelled todos
  const cancelled = todos.filter(t => t.status === 'cancelled');
  if (cancelled.length > 0) {
    output += `### ❌ Cancelled (${cancelled.length})\n\n`;
    cancelled.forEach(t => {
      output += `❌ \`${t.id}\` - ${t.description}\n`;
    });
  }

  return output;
}

/**
 * Get status icon for display
 */
function getStatusIcon(status: TodoStatus): string {
  return {
    pending: '⬜',
    in_progress: '🔄',
    completed: '✅',
    cancelled: '❌',
  }[status];
}

/**
 * Convert plan to todos
 */
export function planToTodos(plan: PlanData): ExtendedTodo[] {
  return plan.steps.map((step, idx) => ({
    id: step.id,
    description: step.description,
    status: 'pending' as TodoStatus,
    priority: (idx < 3 ? 'high' : idx < 6 ? 'medium' : 'low') as TodoPriority,
    module: step.module,
    dependencies: step.dependencies || [],
    risks: step.risks || [],
    estimatedTime: step.estimatedTime,
    createdFrom: 'plan' as const,
    createdAt: new Date(),
  }));
}

/**
 * Check if todo's dependencies are satisfied
 */
export function checkDependencies(
  todo: ExtendedTodo,
  allTodos: ExtendedTodo[],
): { satisfied: boolean; incomplete: string[] } {
  if (!todo.dependencies || todo.dependencies.length === 0) {
    return { satisfied: true, incomplete: [] };
  }

  const incomplete: string[] = [];

  for (const depId of todo.dependencies) {
    const dep = allTodos.find(t => t.id === depId);
    if (!dep || dep.status !== 'completed') {
      incomplete.push(depId);
    }
  }

  return {
    satisfied: incomplete.length === 0,
    incomplete,
  };
}

/**
 * Get next executable todo (considering dependencies)
 */
export function getNextExecutableTodo(todos: ExtendedTodo[]): ExtendedTodo | null {
  const pending = todos.filter(t => t.status === 'pending');

  for (const todo of pending) {
    const { satisfied } = checkDependencies(todo, todos);
    if (satisfied) {
      return todo;
    }
  }

  return null;
}

/**
 * Export todos to JSON format
 */
export function exportTodosToJson(
  todos: ExtendedTodo[],
  plan: PlanData | null,
): string {
  const stats = {
    total: todos.length,
    pending: todos.filter(t => t.status === 'pending').length,
    in_progress: todos.filter(t => t.status === 'in_progress').length,
    completed: todos.filter(t => t.status === 'completed').length,
    cancelled: todos.filter(t => t.status === 'cancelled').length,
  };

  const exportData = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    sourcePlan: plan?.title || null,
    todos,
    statistics: stats,
  };

  return JSON.stringify(exportData, null, 2);
}



/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '../config/config.js';
import type { ToolInvocation } from './tools.js';
import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
  type ToolResult,
} from './tools.js';
import { SpecManager } from '../spec/SpecManager.js';

/**
 * Parameters for the update_task_status tool
 */
export interface UpdateTaskStatusParams {
  taskId: string;
  tasksId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  notes?: string;
}

const description = `Update the status of a specific task.

This tool updates a task's execution status and optionally adds execution notes.
It automatically tracks:
- Status transitions
- Completion timestamp (when status is 'completed')
- Execution attempts and timestamps
- Execution notes for debugging

Status values:
- pending: Task not yet started
- in_progress: Currently working on the task
- completed: Task finished successfully
- blocked: Task cannot proceed (dependencies, errors, etc.)

Input: Task ID, Task List ID, new status, and optional notes
Output: Updated task information`;

class UpdateTaskStatusToolInvocation extends BaseToolInvocation<
  UpdateTaskStatusParams,
  ToolResult
> {
  constructor(
    params: UpdateTaskStatusParams,
    private readonly config: Config,
  ) {
    super(params);
  }

  getDescription(): string {
    return `Update task ${this.params.taskId} status to ${this.params.status}`;
  }

  async execute(
    _signal: AbortSignal,
    _updateOutput?: (output: string) => void,
  ): Promise<ToolResult> {
    const specManager = new SpecManager(this.config);

    // Get task list
    const taskList = specManager.getTaskListById(this.params.tasksId);
    if (!taskList) {
      return {
        llmContent: `Error: Task list '${this.params.tasksId}' not found.`,
        returnDisplay: `❌ Error: Task list '${this.params.tasksId}' not found.`,
      };
    }

    // Find the task
    const task = taskList.tasks.find((t) => t.id === this.params.taskId);
    if (!task) {
      return {
        llmContent: `Error: Task '${this.params.taskId}' not found in task list '${this.params.tasksId}'.`,
        returnDisplay: `❌ Error: Task '${this.params.taskId}' not found.`,
      };
    }

    const oldStatus = task.status;

    // Update task status
    specManager.updateTaskStatus(
      this.params.tasksId,
      this.params.taskId,
      this.params.status,
      this.params.notes
    );

    // Get updated task list to show progress
    const updatedTaskList = specManager.getTaskListById(this.params.tasksId);
    const updatedTask = updatedTaskList?.tasks.find(
      (t) => t.id === this.params.taskId
    );

    // Create formatted output
    let output = '';

    const statusEmoji = {
      pending: '⏳',
      in_progress: '🔄',
      completed: '✅',
      blocked: '🚫',
    };

    output += `${statusEmoji[this.params.status]} **Task Status Updated**\n\n`;
    output += `**Task**: ${task.title} (\`${this.params.taskId}\`)\n`;
    output += `**Status**: ${oldStatus} → **${this.params.status}**\n`;

    if (this.params.status === 'completed' && updatedTask?.completedAt) {
      output += `**Completed At**: ${updatedTask.completedAt.toISOString()}\n`;
    }

    if (this.params.notes) {
      output += `**Notes**: ${this.params.notes}\n`;
    }

    output += '\n';

    // Show execution info if available
    if (updatedTask?.execution) {
      output += `### 📊 Execution Info\n\n`;
      output += `- **Attempts**: ${updatedTask.execution.attempts}\n`;
      if (updatedTask.execution.lastAttemptAt) {
        output += `- **Last Attempt**: ${updatedTask.execution.lastAttemptAt.toISOString()}\n`;
      }
      if (updatedTask.execution.executionNotes) {
        output += `- **Execution Notes**: ${updatedTask.execution.executionNotes}\n`;
      }
      output += '\n';
    }

    // Show task list progress
    if (updatedTaskList?.execution?.progress) {
      const progress = updatedTaskList.execution.progress;
      const percentage = Math.round(
        (progress.completed / progress.total) * 100
      );

      output += `### 📈 Task List Progress\n\n`;
      output += `**Overall**: ${progress.completed}/${progress.total} tasks completed (${percentage}%)\n`;
      output += `- ✅ Completed: ${progress.completed}\n`;
      output += `- ⏳ Pending: ${progress.pending}\n`;
      if (progress.failed > 0) {
        output += `- ❌ Failed: ${progress.failed}\n`;
      }
      output += '\n';
    }

    // Check for next task and suggest continuation
    output += `---\n\n`;

    let llmContent = `Successfully updated task '${this.params.taskId}' status from '${oldStatus}' to '${this.params.status}'. ${
      this.params.notes ? `Notes: ${this.params.notes}. ` : ''
    }${
      updatedTaskList?.execution?.progress
        ? `Task list progress: ${updatedTaskList.execution.progress.completed}/${updatedTaskList.execution.progress.total} completed.`
        : ''
    }`;

    if (this.params.status === 'completed') {
      // Check if there are more tasks to execute
      const nextTaskId = specManager.getNextExecutableTask(this.params.tasksId);

      if (nextTaskId) {
        const nextTask = updatedTaskList?.tasks.find((t) => t.id === nextTaskId);
        output += `### 🎯 Next Task Available\n\n`;
        output += `**${nextTask?.title}** (\`${nextTaskId}\`)\n`;
        output += `Type: ${nextTask?.type} | Priority: ${nextTask?.priority}\n\n`;
        output += `**AUTO-CONTINUE**: If in batch mode, immediately execute the next task using execute_task tool.\n`;

        llmContent += ` Next executable task found: '${nextTaskId}' (${nextTask?.title}). If in batch mode, continue execution automatically by calling execute_task with taskId='${nextTaskId}' and tasksId='${this.params.tasksId}'.`;
      } else {
        output += `### 🎉 All Tasks Completed!\n\n`;
        output += `No more pending tasks with satisfied dependencies.\n`;
        output += `View final status: \`/spec execute status ${this.params.tasksId}\`\n`;

        llmContent += ` All tasks completed or blocked. No more executable tasks.`;
      }
    } else if (this.params.status === 'blocked') {
      output += `**Task is blocked**. Please resolve the issues before continuing.\n`;
      llmContent += ` Task is blocked - execution stopped.`;
    } else {
      output += `**Next Steps**:\n`;
      output += `- View progress: \`/spec execute status ${this.params.tasksId}\`\n`;
    }

    return {
      llmContent,
      returnDisplay: output,
    };
  }
}

export class UpdateTaskStatusTool extends BaseDeclarativeTool<
  UpdateTaskStatusParams,
  ToolResult
> {
  static readonly Name: string = 'update_task_status';

  constructor(private readonly config: Config) {
    super(
      UpdateTaskStatusTool.Name,
      'Update Task Status',
      description,
      Kind.Other,
      {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'The ID of the task to update',
          },
          tasksId: {
            type: 'string',
            description: 'The ID of the task list containing the task',
          },
          status: {
            type: 'string',
            enum: ['pending', 'in_progress', 'completed', 'blocked'],
            description: 'New status for the task',
          },
          notes: {
            type: 'string',
            description: 'Optional execution notes (e.g., error messages, completion notes)',
          },
        },
        required: ['taskId', 'tasksId', 'status'],
      }
    );
  }

  protected override validateToolParamValues(
    params: UpdateTaskStatusParams,
  ): string | null {
    if (!params.taskId || params.taskId.trim() === '') {
      return 'Task ID is required';
    }

    if (!params.tasksId || params.tasksId.trim() === '') {
      return 'Task list ID is required';
    }

    const validStatuses = ['pending', 'in_progress', 'completed', 'blocked'];
    if (!validStatuses.includes(params.status)) {
      return `Invalid status. Must be one of: ${validStatuses.join(', ')}`;
    }

    return null;
  }

  protected createInvocation(
    params: UpdateTaskStatusParams,
  ): ToolInvocation<UpdateTaskStatusParams, ToolResult> {
    return new UpdateTaskStatusToolInvocation(params, this.config);
  }
}

export function createUpdateTaskStatusTool(
  config: Config
): UpdateTaskStatusTool {
  return new UpdateTaskStatusTool(config);
}

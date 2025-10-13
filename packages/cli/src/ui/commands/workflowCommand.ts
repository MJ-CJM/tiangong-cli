/**
 * @license
 * Copyright 2025 Gemini CLI
 * SPDX-License-Identifier: MIT
 */

import { MessageType, ToolCallStatus, type IndividualToolCallDisplay } from '../types.js';
import {
  type CommandContext,
  type SlashCommand,
  CommandKind,
} from './types.js';

/**
 * Get WorkflowManager from config
 */
async function getWorkflowManager(context: CommandContext) {
  if (!context.services.config) {
    throw new Error('Config not available');
  }
  return await context.services.config.getWorkflowManager();
}

/**
 * Get WorkflowExecutor from config
 */
async function getWorkflowExecutor(context: CommandContext) {
  if (!context.services.config) {
    throw new Error('Config not available');
  }
  return await context.services.config.getWorkflowExecutor();
}

export const workflowCommand: SlashCommand = {
  name: 'workflow',
  description: 'Manage and execute workflows - list, info, run, validate, delete',
  kind: CommandKind.BUILT_IN,
  subCommands: [
    {
      name: 'list',
      description: 'List all available workflows',
      kind: CommandKind.BUILT_IN,
      action: async (context: CommandContext) => {
        try {
          const workflowManager = await getWorkflowManager(context);

          const workflows = workflowManager.listWorkflows();

          if (workflows.length === 0) {
            context.ui.addItem(
              {
                type: MessageType.INFO,
                text: 'No workflows found.\n\nCreate workflows in:\n  • Project: .gemini/workflows/*.yaml\n  • Global: ~/.gemini/workflows/*.yaml',
              },
              Date.now()
            );
            return;
          }

          // Group by scope
          const globalWorkflows = workflows.filter((w) => w.scope === 'global');
          const projectWorkflows = workflows.filter((w) => w.scope === 'project');

          let message = `📋 Available Workflows (${workflows.length} total)\n\n`;

          if (projectWorkflows.length > 0) {
            message += '**Project Workflows** (.gemini/workflows/):\n';
            for (const workflow of projectWorkflows) {
              message += `  • **${workflow.name}** - ${workflow.title}\n`;
              message += `    Steps: ${workflow.stepCount}\n`;
              message += `    Updated: ${workflow.updatedAt.toLocaleDateString()}\n`;
            }
            message += '\n';
          }

          if (globalWorkflows.length > 0) {
            message += '**Global Workflows** (~/.gemini/workflows/):\n';
            for (const workflow of globalWorkflows) {
              message += `  • **${workflow.name}** - ${workflow.title}\n`;
              message += `    Steps: ${workflow.stepCount}\n`;
              message += `    Updated: ${workflow.updatedAt.toLocaleDateString()}\n`;
            }
          }

          message += '\n💡 **Usage**:\n';
          message += '  • View details: `/workflow info <name>`\n';
          message += '  • Execute: `/workflow run <name> <input>`\n';
          message += '  • Validate: `/workflow validate <name>`\n';

          context.ui.addItem(
            {
              type: MessageType.INFO,
              text: message.trim(),
            },
            Date.now()
          );
        } catch (error) {
          context.ui.addItem(
            {
              type: MessageType.ERROR,
              text: `Failed to list workflows: ${error instanceof Error ? error.message : String(error)}`,
            },
            Date.now()
          );
        }
      },
    },

    {
      name: 'info',
      description: 'Show workflow details: /workflow info <name>',
      kind: CommandKind.BUILT_IN,
      action: async (context: CommandContext, args?: string) => {
        try {
          if (!args || args.trim().length === 0) {
            context.ui.addItem(
              {
                type: MessageType.ERROR,
                text: 'Usage: /workflow info <name>\n\nExample: /workflow info code-quality-pipeline',
              },
              Date.now()
            );
            return;
          }

          const name = args.trim();
          const workflowManager = await getWorkflowManager(context);

          const workflow = workflowManager.getWorkflow(name);

          if (!workflow) {
            context.ui.addItem(
              {
                type: MessageType.ERROR,
                text: `Workflow "${name}" not found. Use /workflow list to see available workflows.`,
              },
              Date.now()
            );
            return;
          }

          let message = `📋 Workflow: **${workflow.title}** (${workflow.name})\n\n`;

          if (workflow.description) {
            message += `**Description**: ${workflow.description}\n\n`;
          }

          message += `**Scope**: ${workflow.scope}\n`;
          message += `**Version**: ${workflow.version || 'N/A'}\n`;
          message += `**File**: ${workflow.filePath}\n`;
          message += `**Steps**: ${workflow.steps.length}\n`;

          if (workflow.timeout) {
            message += `**Timeout**: ${workflow.timeout}ms\n`;
          }

          if (workflow.error_handling) {
            message += `**Error Handling**: ${workflow.error_handling.on_error}`;
            if (workflow.error_handling.max_retries) {
              message += ` (max retries: ${workflow.error_handling.max_retries})`;
            }
            message += '\n';
          }

          message += '\n**Steps**:\n';
          workflow.steps.forEach((step, index) => {
            message += `  ${index + 1}. **${step.id}** (agent: ${step.agent})\n`;
            if (step.description) {
              message += `     ${step.description}\n`;
            }
            if (step.when) {
              message += `     Condition: ${step.when}\n`;
            }
          });

          message += `\n**Created**: ${workflow.createdAt.toLocaleString()}`;
          message += `\n**Updated**: ${workflow.updatedAt.toLocaleString()}`;

          message += '\n\n💡 **Run this workflow**:\n';
          message += `  /workflow run ${workflow.name} "<your input>"`;

          context.ui.addItem(
            {
              type: MessageType.INFO,
              text: message,
            },
            Date.now()
          );
        } catch (error) {
          context.ui.addItem(
            {
              type: MessageType.ERROR,
              text: `Failed to show workflow info: ${error instanceof Error ? error.message : String(error)}`,
            },
            Date.now()
          );
        }
      },
    },

    {
      name: 'run',
      description: 'Execute a workflow: /workflow run <name> <input>',
      kind: CommandKind.BUILT_IN,
      action: async (context: CommandContext, args?: string) => {
        try {
          if (!args || args.trim().length === 0) {
            context.ui.addItem(
              {
                type: MessageType.ERROR,
                text: 'Usage: /workflow run <name> <input>\n\nExample: /workflow run code-quality-pipeline "Review src/auth.ts"',
              },
              Date.now()
            );
            return;
          }

          // Parse: first word is workflow name, rest is input
          const trimmed = args.trim();
          const firstSpaceIndex = trimmed.indexOf(' ');

          if (firstSpaceIndex === -1) {
            context.ui.addItem(
              {
                type: MessageType.ERROR,
                text: 'Usage: /workflow run <name> <input>\n\nPlease provide input for the workflow.',
              },
              Date.now()
            );
            return;
          }

          const workflowName = trimmed.substring(0, firstSpaceIndex);
          const input = trimmed.substring(firstSpaceIndex + 1).trim();

          if (!input) {
            context.ui.addItem(
              {
                type: MessageType.ERROR,
                text: 'Please provide input for the workflow',
              },
              Date.now()
            );
            return;
          }

          const workflowManager = await getWorkflowManager(context);
          const workflow = workflowManager.getWorkflow(workflowName);

          if (!workflow) {
            context.ui.addItem(
              {
                type: MessageType.ERROR,
                text: `Workflow '${workflowName}' not found. Use /workflow list to see available workflows.`,
              },
              Date.now()
            );
            return;
          }

          // Show workflow info
          context.ui.addItem(
            {
              type: MessageType.INFO,
              text: `🚀 Starting workflow: **${workflow.title}**\n\nSteps: ${workflow.steps.length}\nInput: ${input}\n\n${'─'.repeat(70)}`,
            },
            Date.now()
          );

          // Get workflow executor
          const workflowExecutor = await getWorkflowExecutor(context);

          // Execute workflow with callbacks
          const result = await workflowExecutor.execute(
            workflowName,
            input,
            {
              onStepStart: (step, index, total) => {
                let stepInfo = `\n📍 **Step ${index}/${total}**: ${step.description || step.id}\n`;

                // Show agent info for sequential steps, or parallel group info
                if (step.type === 'parallel') {
                  stepInfo += `   Type: Parallel (${step.parallel?.length || 0} substeps)`;
                } else {
                  stepInfo += `   Agent: ${step.agent}`;
                }

                context.ui.addItem(
                  {
                    type: MessageType.INFO,
                    text: stepInfo,
                  },
                  Date.now()
                );
              },
              onStepComplete: (stepResult) => {
                const icon = stepResult.status === 'completed' ? '✅' :
                             stepResult.status === 'failed' ? '❌' :
                             stepResult.status === 'skipped' ? '⏭️' : '⏳';

                let message = `${icon} **${stepResult.stepId}** - ${stepResult.status}`;

                if (stepResult.status === 'failed' && stepResult.error) {
                  message += `\n   Error: ${stepResult.error}`;
                } else if (stepResult.status === 'completed' && stepResult.output) {
                  // Show abbreviated output
                  const preview = stepResult.output.substring(0, 200);
                  message += `\n   Output: ${preview}${stepResult.output.length > 200 ? '...' : ''}`;
                }

                context.ui.addItem(
                  {
                    type: stepResult.status === 'failed' ? MessageType.ERROR : MessageType.INFO,
                    text: message,
                  },
                  Date.now()
                );
              },
              onStepError: (error, step) => {
                context.ui.addItem(
                  {
                    type: MessageType.ERROR,
                    text: `❌ Error in step '${step.id}': ${error.message}`,
                  },
                  Date.now()
                );
              },
              onToolCall: (toolName, args, stepId) => {
                // Create a tool display similar to agent execution
                const toolDisplay: IndividualToolCallDisplay = {
                  callId: `workflow-${stepId}-${toolName}-${Date.now()}`,
                  name: toolName,
                  description: toolName,
                  status: ToolCallStatus.Success,
                  resultDisplay: undefined,
                  confirmationDetails: undefined,
                };

                context.ui.addItem(
                  {
                    type: 'tool_group',
                    tools: [toolDisplay],
                  } as any,
                  Date.now()
                );
              },
              onToolResult: (toolName, result, stepId) => {
                // Tool results are usually shown automatically by the UI
                // We can optionally add additional handling here if needed
              },
            }
          );

          // Show final result
          context.ui.addItem(
            {
              type: MessageType.INFO,
              text: `\n${'─'.repeat(70)}\n\n${result.output}`,
            },
            Date.now()
          );

          // Show statistics
          const stats = [
            `Status: ${result.status}`,
            `Duration: ${Math.round(result.duration / 1000)}s`,
          ];

          if (result.error) {
            stats.push(`Error: ${result.error}`);
          }

          context.ui.addItem(
            {
              type: result.status === 'completed' ? MessageType.INFO : MessageType.ERROR,
              text: `\n📊 ${stats.join(' | ')}`,
            },
            Date.now()
          );

        } catch (error) {
          context.ui.addItem(
            {
              type: MessageType.ERROR,
              text: `Failed to run workflow: ${error instanceof Error ? error.message : String(error)}`,
            },
            Date.now()
          );
        }
      },
    },

    {
      name: 'validate',
      description: 'Validate a workflow definition: /workflow validate <name>',
      kind: CommandKind.BUILT_IN,
      action: async (context: CommandContext, args?: string) => {
        try {
          if (!args || args.trim().length === 0) {
            context.ui.addItem(
              {
                type: MessageType.ERROR,
                text: 'Usage: /workflow validate <name>\n\nExample: /workflow validate code-quality-pipeline',
              },
              Date.now()
            );
            return;
          }

          const name = args.trim();
          const workflowManager = await getWorkflowManager(context);

          const workflow = workflowManager.getWorkflow(name);

          if (!workflow) {
            context.ui.addItem(
              {
                type: MessageType.ERROR,
                text: `Workflow "${name}" not found. Use /workflow list to see available workflows.`,
              },
              Date.now()
            );
            return;
          }

          const validation = workflowManager.validateWorkflow(workflow);

          let message = `🔍 Validation Results for "${name}":\n\n`;

          if (validation.valid) {
            message += '✅ All validations passed!\n\n';
            message += '**Checks**:\n';
            message += `  ✓ Workflow name format\n`;
            message += `  ✓ Step definitions (${workflow.steps.length} steps)\n`;
            message += `  ✓ Step IDs uniqueness\n`;
            message += `  ✓ Agent names\n`;
            message += `  ✓ Input templates\n`;
            if (workflow.error_handling) {
              message += `  ✓ Error handling configuration\n`;
            }
            if (workflow.timeout) {
              message += `  ✓ Timeout configuration\n`;
            }
          } else {
            message += '❌ Validation failed:\n\n';
            for (const error of validation.errors) {
              message += `  • ${error}\n`;
            }
          }

          context.ui.addItem(
            {
              type: validation.valid ? MessageType.INFO : MessageType.ERROR,
              text: message.trim(),
            },
            Date.now()
          );
        } catch (error) {
          context.ui.addItem(
            {
              type: MessageType.ERROR,
              text: `Failed to validate workflow: ${error instanceof Error ? error.message : String(error)}`,
            },
            Date.now()
          );
        }
      },
    },

    {
      name: 'delete',
      description: 'Delete a workflow: /workflow delete <name>',
      kind: CommandKind.BUILT_IN,
      action: async (context: CommandContext, args?: string) => {
        try {
          if (!args || args.trim().length === 0) {
            context.ui.addItem(
              {
                type: MessageType.ERROR,
                text: 'Usage: /workflow delete <name>\n\nExample: /workflow delete my-workflow',
              },
              Date.now()
            );
            return;
          }

          const name = args.trim();
          const workflowManager = await getWorkflowManager(context);

          // Check if workflow exists
          const workflow = workflowManager.getWorkflow(name);
          if (!workflow) {
            context.ui.addItem(
              {
                type: MessageType.ERROR,
                text: `Workflow "${name}" not found.`,
              },
              Date.now()
            );
            return;
          }

          // Delete workflow
          await workflowManager.deleteWorkflow(name);

          context.ui.addItem(
            {
              type: MessageType.INFO,
              text: `✅ Deleted workflow "${name}"\n\nFile: ${workflow.filePath}`,
            },
            Date.now()
          );
        } catch (error) {
          context.ui.addItem(
            {
              type: MessageType.ERROR,
              text: `Failed to delete workflow: ${error instanceof Error ? error.message : String(error)}`,
            },
            Date.now()
          );
        }
      },
    },
  ],
};

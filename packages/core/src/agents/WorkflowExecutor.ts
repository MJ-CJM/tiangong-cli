/**
 * @license
 * Copyright 2025 Gemini CLI
 * SPDX-License-Identifier: MIT
 */

import type { AgentExecutor } from './AgentExecutor.js';
import type { WorkflowManager } from './WorkflowManager.js';
import type {
  WorkflowDefinition,
  WorkflowStep,
  WorkflowContext,
  WorkflowStepResult,
  WorkflowExecutionResult,
} from './types.js';
import { WorkflowError } from './types.js';

/**
 * Workflow Executor
 * Executes workflow steps sequentially, handling templates and conditions
 */
export class WorkflowExecutor {
  constructor(
    private agentExecutor: AgentExecutor,
    private workflowManager: WorkflowManager
  ) {}

  /**
   * Execute a workflow
   */
  async execute(
    workflowName: string,
    input: string,
    options?: {
      onStepStart?: (step: WorkflowStep, index: number, total: number) => void;
      onStepComplete?: (result: WorkflowStepResult) => void;
      onStepError?: (error: Error, step: WorkflowStep) => void;
    }
  ): Promise<WorkflowExecutionResult> {
    const workflow = this.workflowManager.getWorkflow(workflowName);
    if (!workflow) {
      throw new WorkflowError(
        `Workflow '${workflowName}' not found`,
        'WORKFLOW_NOT_FOUND'
      );
    }

    const startTime = Date.now();
    const context: WorkflowContext = {
      workflowName,
      input,
      stepResults: new Map(),
      currentStepIndex: 0,
      startTime,
      metadata: {},
    };

    const results: WorkflowStepResult[] = [];
    let finalStatus: 'completed' | 'failed' | 'timeout' = 'completed';
    let finalError: string | undefined;

    try {
      // Execute each step
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        context.currentStepIndex = i;

        // Notify step start
        if (options?.onStepStart) {
          options.onStepStart(step, i + 1, workflow.steps.length);
        }

        // Check if step should be executed (evaluate condition)
        if (step.when) {
          const shouldExecute = this.evaluateCondition(step.when, context);
          if (!shouldExecute) {
            const skippedResult: WorkflowStepResult = {
              stepId: step.id,
              agentName: step.agent,
              status: 'skipped',
              output: '',
              startTime: Date.now(),
              endTime: Date.now(),
            };
            results.push(skippedResult);
            context.stepResults.set(step.id, skippedResult);
            continue;
          }
        }

        // Execute step
        try {
          const result = await this.executeStep(step, context, workflow);
          results.push(result);
          context.stepResults.set(step.id, result);

          // Notify step complete
          if (options?.onStepComplete) {
            options.onStepComplete(result);
          }

          // Handle step failure
          if (result.status === 'failed') {
            const errorHandling = workflow.error_handling || {
              on_error: 'stop',
            };

            if (errorHandling.on_error === 'stop') {
              finalStatus = 'failed';
              finalError = `Step '${step.id}' failed: ${result.error}`;
              break;
            }
            // If 'continue', just move to next step
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          // Notify error
          if (options?.onStepError) {
            options.onStepError(
              error instanceof Error ? error : new Error(errorMessage),
              step
            );
          }

          const failedResult: WorkflowStepResult = {
            stepId: step.id,
            agentName: step.agent,
            status: 'failed',
            output: '',
            error: errorMessage,
            startTime: Date.now(),
            endTime: Date.now(),
          };
          results.push(failedResult);
          context.stepResults.set(step.id, failedResult);

          const errorHandling = workflow.error_handling || {
            on_error: 'stop',
          };
          if (errorHandling.on_error === 'stop') {
            finalStatus = 'failed';
            finalError = errorMessage;
            break;
          }
        }
      }

      // Check timeout
      if (workflow.timeout) {
        const duration = Date.now() - startTime;
        if (duration > workflow.timeout) {
          finalStatus = 'timeout';
          finalError = `Workflow exceeded timeout of ${workflow.timeout}ms`;
        }
      }
    } catch (error) {
      finalStatus = 'failed';
      finalError =
        error instanceof Error ? error.message : 'Unknown error occurred';
    }

    // Build final output
    const finalOutput = this.buildFinalOutput(results, workflow);

    return {
      workflowName,
      status: finalStatus,
      steps: results,
      output: finalOutput,
      error: finalError,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    step: WorkflowStep,
    context: WorkflowContext,
    workflow: WorkflowDefinition
  ): Promise<WorkflowStepResult> {
    const startTime = Date.now();

    try {
      // Render input template
      const renderedInput = this.renderTemplate(step.input, context);

      // Execute agent
      const agentResult = await this.agentExecutor.execute(
        step.agent,
        renderedInput
      );

      const output = agentResult.text || '';

      return {
        stepId: step.id,
        agentName: step.agent,
        status: 'completed',
        output,
        startTime,
        endTime: Date.now(),
        data: this.extractData(output, step.id),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        stepId: step.id,
        agentName: step.agent,
        status: 'failed',
        output: '',
        error: errorMessage,
        startTime,
        endTime: Date.now(),
      };
    }
  }

  /**
   * Evaluate a condition expression
   * Simple implementation: supports basic comparisons
   */
  private evaluateCondition(
    condition: string,
    context: WorkflowContext
  ): boolean {
    try {
      // Replace template variables first
      const renderedCondition = this.renderTemplate(condition, context);

      // Very basic evaluation - just check if the string is truthy
      // In a full implementation, you'd use a safe expression evaluator
      // For now, support simple patterns like:
      // - "true" / "false"
      // - "${stepId.data.someValue}" (already rendered)

      const trimmed = renderedCondition.trim().toLowerCase();

      if (trimmed === 'true' || trimmed === '1') {
        return true;
      }
      if (trimmed === 'false' || trimmed === '0' || trimmed === '') {
        return false;
      }

      // If it's a number > 0, consider it true
      const num = Number(trimmed);
      if (!isNaN(num)) {
        return num > 0;
      }

      // Default: if the condition has any content, it's true
      return renderedCondition.length > 0;
    } catch (error) {
      console.error('Condition evaluation error:', error);
      return false;
    }
  }

  /**
   * Render template variables in a string
   * Supports: ${workflow.input}, ${stepId.output}, ${stepId.data.key}
   */
  private renderTemplate(template: string, context: WorkflowContext): string {
    let rendered = template;

    // Replace ${workflow.input}
    rendered = rendered.replace(/\$\{workflow\.input\}/g, context.input);

    // Replace ${stepId.output}
    const outputRegex = /\$\{(\w+)\.output\}/g;
    rendered = rendered.replace(outputRegex, (match, stepId) => {
      const result = context.stepResults.get(stepId);
      return result?.output || '';
    });

    // Replace ${stepId.data.key}
    const dataRegex = /\$\{(\w+)\.data\.(\w+)\}/g;
    rendered = rendered.replace(dataRegex, (match, stepId, key) => {
      const result = context.stepResults.get(stepId);
      if (result?.data && key in result.data) {
        return String(result.data[key]);
      }
      return '';
    });

    return rendered;
  }

  /**
   * Extract data from step output for use in templates
   * Simple implementation: looks for key-value patterns
   */
  private extractData(
    output: string,
    stepId: string
  ): Record<string, any> {
    const data: Record<string, any> = {};

    // Look for patterns like "issues_found: 3" or "status: success"
    const patterns = [
      /(\w+):\s*(\d+)/g, // numbers
      /(\w+):\s*"([^"]+)"/g, // quoted strings
      /(\w+):\s*'([^']+)'/g, // single quoted
      /(\w+):\s*(\w+)/g, // simple words
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(output)) !== null) {
        const key = match[1];
        const value = match[2];

        // Try to parse as number
        const numValue = Number(value);
        data[key] = isNaN(numValue) ? value : numValue;
      }
    }

    return data;
  }

  /**
   * Build final output from all step results
   */
  private buildFinalOutput(
    results: WorkflowStepResult[],
    workflow: WorkflowDefinition
  ): string {
    let output = `# Workflow: ${workflow.title}\n\n`;

    const completedSteps = results.filter((r) => r.status === 'completed');
    const failedSteps = results.filter((r) => r.status === 'failed');
    const skippedSteps = results.filter((r) => r.status === 'skipped');

    output += `**Summary**: ${completedSteps.length}/${results.length} steps completed`;
    if (failedSteps.length > 0) {
      output += `, ${failedSteps.length} failed`;
    }
    if (skippedSteps.length > 0) {
      output += `, ${skippedSteps.length} skipped`;
    }
    output += `\n\n---\n\n`;

    // Include output from each completed step
    results.forEach((result, index) => {
      const step = workflow.steps.find((s) => s.id === result.stepId);
      if (!step) return;

      output += `## Step ${index + 1}: ${step.description || step.id}\n`;
      output += `**Agent**: ${result.agentName}\n`;
      output += `**Status**: ${result.status}\n\n`;

      if (result.status === 'completed' && result.output) {
        output += result.output + '\n\n';
      } else if (result.status === 'failed' && result.error) {
        output += `**Error**: ${result.error}\n\n`;
      } else if (result.status === 'skipped') {
        output += `*Skipped (condition not met)*\n\n`;
      }

      output += `---\n\n`;
    });

    return output;
  }
}

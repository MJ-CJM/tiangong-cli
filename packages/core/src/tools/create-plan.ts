/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ToolInvocation } from './tools.js';
import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
  type ToolResult,
} from './tools.js';

/**
 * A single step in an execution plan
 */
export interface PlanStep {
  id: string;
  description: string;
  module?: string;
  dependencies?: string[];
  risks?: string[];
  estimatedTime?: string;
}

/**
 * Parameters for the create_plan tool
 */
export interface PlanToolParams {
  title: string;
  overview: string;
  steps: PlanStep[];
  risks?: string[];
  testingStrategy?: string;
  estimatedDuration?: string;
}

export const CREATE_PLAN_TOOL_NAME = 'create_plan';

export const CREATE_PLAN_DESCRIPTION = `Create a structured execution plan with steps, risks, and testing strategy.

This tool should be used when:
- Complex tasks requiring multiple steps
- Tasks that need risk analysis  
- When user explicitly requests planning
- In PLAN MODE (Ctrl+P)

REQUIRED FIELDS:
- title: Brief plan title
- overview: 1-2 sentence summary of what will be accomplished
- steps: Array of execution steps, each with:
  - id: Unique identifier (e.g., "step-1", "setup-db")
  - description: Clear, actionable task description
  - dependencies: (Optional) Array of step IDs this depends on
  - risks: (Optional) Potential issues for this step
  - module: (Optional) Which module/component this affects
  - estimatedTime: (Optional) Time estimate (e.g., "30min", "2h")

OPTIONAL FIELDS:
- risks: Overall project-level risks
- testingStrategy: How to verify the implementation works
- estimatedDuration: Total time estimate

OUTPUT EXAMPLE:
{
  "title": "Implement User Authentication",
  "overview": "Add JWT-based authentication with login/logout endpoints",
  "steps": [
    {
      "id": "step-1",
      "description": "Create User model and database schema",
      "module": "backend/models",
      "dependencies": [],
      "risks": ["Database migration might fail in production"],
      "estimatedTime": "30min"
    },
    {
      "id": "step-2", 
      "description": "Implement JWT token generation and validation",
      "module": "backend/auth",
      "dependencies": ["step-1"],
      "risks": ["Token security vulnerabilities"],
      "estimatedTime": "45min"
    }
  ],
  "risks": [
    "Password hashing performance issues",
    "Session management complexity"
  ],
  "testingStrategy": "Unit tests for each component, integration tests for full auth flow",
  "estimatedDuration": "3-4 hours"
}

IMPORTANT: In Plan mode, focus on thorough analysis and planning. Do NOT execute the plan.
User will convert the plan to todos and execute them step by step.`;

class CreatePlanToolInvocation extends BaseToolInvocation<
  PlanToolParams,
  ToolResult
> {
  getDescription(): string {
    return `Create plan: ${this.params.title}`;
  }

  async execute(
    _signal: AbortSignal,
    _updateOutput?: (output: string) => void,
  ): Promise<ToolResult> {
    const plan = this.params;

    // Build formatted output
    let output = `✅ **Plan Created**: "${plan.title}"\n\n`;
    output += `**Overview**: ${plan.overview}\n\n`;
    output += `**Steps**: ${plan.steps.length}\n`;
    
    plan.steps.forEach((step, idx) => {
      output += `\n${idx + 1}. **${step.id}**: ${step.description}`;
      if (step.dependencies && step.dependencies.length > 0) {
        output += `\n   - Dependencies: ${step.dependencies.join(', ')}`;
      }
      if (step.risks && step.risks.length > 0) {
        output += `\n   - ⚠️ Risks: ${step.risks.join(', ')}`;
      }
      if (step.estimatedTime) {
        output += `\n   - ⏱️ Estimated: ${step.estimatedTime}`;
      }
    });

    if (plan.risks && plan.risks.length > 0) {
      output += `\n\n**Overall Risks**:\n`;
      plan.risks.forEach(r => output += `- ${r}\n`);
    }

    if (plan.testingStrategy) {
      output += `\n**Testing Strategy**: ${plan.testingStrategy}\n`;
    }

    if (plan.estimatedDuration) {
      output += `\n**Estimated Duration**: ${plan.estimatedDuration}\n`;
    }

    output += `\n💡 Next steps:\n`;
    output += `1. Review the plan above\n`;
    output += `2. Exit Plan mode: Ctrl+P\n`;
    output += `3. Convert to todos: /plan to-todos\n`;
    output += `4. Execute todos: /todos execute <id>\n`;

    return {
      llmContent: `Successfully created execution plan with ${plan.steps.length} steps. The plan is now available for review.`,
      returnDisplay: output,
    };
  }
}

export class CreatePlanTool extends BaseDeclarativeTool<
  PlanToolParams,
  ToolResult
> {
  static readonly Name: string = CREATE_PLAN_TOOL_NAME;

  constructor() {
    super(
      CreatePlanTool.Name,
      'Create Execution Plan',
      CREATE_PLAN_DESCRIPTION,
      Kind.Other,
      {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Brief descriptive title of the plan',
          },
          overview: {
            type: 'string',
            description: '1-2 sentence summary of what will be accomplished',
          },
          steps: {
            type: 'array',
            description: 'Ordered list of execution steps',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Unique identifier for this step',
                },
                description: {
                  type: 'string',
                  description: 'Clear, actionable description of what to do',
                },
                module: {
                  type: 'string',
                  description: 'Optional: which module/component this affects',
                },
                dependencies: {
                  type: 'array',
                  description: 'Optional: IDs of steps this depends on',
                  items: { type: 'string' },
                },
                risks: {
                  type: 'array',
                  description: 'Optional: potential issues for this step',
                  items: { type: 'string' },
                },
                estimatedTime: {
                  type: 'string',
                  description: 'Optional: time estimate (e.g., "30min", "2h")',
                },
              },
              required: ['id', 'description'],
            },
          },
          risks: {
            type: 'array',
            description: 'Optional: overall project-level risks',
            items: { type: 'string' },
          },
          testingStrategy: {
            type: 'string',
            description: 'Optional: how to verify the implementation',
          },
          estimatedDuration: {
            type: 'string',
            description: 'Optional: total time estimate',
          },
        },
        required: ['title', 'overview', 'steps'],
      },
    );
  }

  protected override validateToolParamValues(
    params: PlanToolParams,
  ): string | null {
    if (!params || typeof params !== 'object') {
      return 'Plan parameters must be an object';
    }

    if (!params.title || typeof params.title !== 'string') {
      return 'Plan must have a title';
    }

    if (!params.overview || typeof params.overview !== 'string') {
      return 'Plan must have an overview';
    }

    if (!Array.isArray(params.steps) || params.steps.length === 0) {
      return 'Plan must have at least one step';
    }

    for (const step of params.steps) {
      if (!step.id || typeof step.id !== 'string') {
        return 'Each step must have an id';
      }
      if (!step.description || typeof step.description !== 'string') {
        return 'Each step must have a description';
      }

      // Validate dependencies reference valid step IDs
      if (step.dependencies && Array.isArray(step.dependencies)) {
        const allStepIds = params.steps.map(s => s.id);
        for (const depId of step.dependencies) {
          if (!allStepIds.includes(depId)) {
            return `Step ${step.id} has invalid dependency: ${depId}`;
          }
        }
      }
    }

    return null;
  }

  protected createInvocation(
    params: PlanToolParams,
  ): ToolInvocation<PlanToolParams, ToolResult> {
    return new CreatePlanToolInvocation(params);
  }
}


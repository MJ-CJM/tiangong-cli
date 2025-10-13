/**
 * @license
 * Copyright 2025 Gemini CLI
 * SPDX-License-Identifier: MIT
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as yaml from 'yaml';
import type { Config } from '../config/config.js';
import type {
  WorkflowDefinition,
  WorkflowListItem,
} from './types.js';
import { WorkflowError } from './types.js';

/**
 * Workflow Manager
 * Loads, validates, and manages workflow definitions from .yaml files
 */
export class WorkflowManager {
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private loaded = false;

  constructor(private config: Config) {}

  /**
   * Load all workflows from global and project directories
   */
  async loadWorkflows(): Promise<void> {
    this.workflows.clear();

    const workflowDirs: Array<{ dir: string; scope: 'global' | 'project' }> =
      [];

    // Global workflows: ~/.gemini/workflows
    const globalDir = path.join(os.homedir(), '.gemini', 'workflows');
    workflowDirs.push({ dir: globalDir, scope: 'global' });

    // Project workflows: .gemini/workflows
    const targetDir = this.config.getTargetDir();
    const projectDir = path.join(targetDir, '.gemini', 'workflows');
    workflowDirs.push({ dir: projectDir, scope: 'project' });

    for (const { dir, scope } of workflowDirs) {
      try {
        await fs.access(dir);
        const files = await fs.readdir(dir);

        for (const file of files) {
          if (file.endsWith('.yaml') || file.endsWith('.yml')) {
            const filePath = path.join(dir, file);
            try {
              const workflow = await this.loadWorkflowFromFile(
                filePath,
                scope
              );
              this.workflows.set(workflow.name, workflow);
            } catch (error) {
              console.error(`Failed to load workflow ${file}:`, error);
            }
          }
        }
      } catch (error) {
        // Directory doesn't exist, skip
      }
    }

    this.loaded = true;
  }

  /**
   * Load a single workflow from file
   */
  private async loadWorkflowFromFile(
    filePath: string,
    scope: 'global' | 'project'
  ): Promise<WorkflowDefinition> {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = yaml.parse(content);

    // Validate basic structure
    if (!data || typeof data !== 'object') {
      throw new WorkflowError(
        `Invalid workflow file: ${filePath}`,
        'INVALID_DEFINITION'
      );
    }

    if (data.kind !== 'workflow') {
      throw new WorkflowError(
        `Invalid workflow kind: expected 'workflow', got '${data.kind}'`,
        'INVALID_DEFINITION'
      );
    }

    if (!data.name || typeof data.name !== 'string') {
      throw new WorkflowError('Workflow must have a name', 'INVALID_DEFINITION');
    }

    if (!Array.isArray(data.steps) || data.steps.length === 0) {
      throw new WorkflowError(
        'Workflow must have at least one step',
        'INVALID_DEFINITION'
      );
    }

    // Get file stats
    const stats = await fs.stat(filePath);

    const workflow: WorkflowDefinition = {
      kind: 'workflow',
      name: data.name,
      title: data.title || data.name,
      description: data.description,
      scope,
      version: data.version,
      triggers: data.triggers,
      steps: data.steps,
      error_handling: data.error_handling,
      timeout: data.timeout,
      filePath,
      createdAt: stats.birthtime,
      updatedAt: stats.mtime,
    };

    // Validate workflow
    const validation = this.validateWorkflow(workflow);
    if (!validation.valid) {
      throw new WorkflowError(
        `Invalid workflow: ${validation.errors.join(', ')}`,
        'INVALID_DEFINITION'
      );
    }

    return workflow;
  }

  /**
   * Get a workflow by name
   */
  getWorkflow(name: string): WorkflowDefinition | null {
    if (!this.loaded) {
      throw new Error('Workflows not loaded. Call loadWorkflows() first.');
    }
    return this.workflows.get(name) || null;
  }

  /**
   * List all workflows
   */
  listWorkflows(): WorkflowListItem[] {
    if (!this.loaded) {
      throw new Error('Workflows not loaded. Call loadWorkflows() first.');
    }

    return Array.from(this.workflows.values()).map((workflow) => ({
      name: workflow.name,
      title: workflow.title,
      scope: workflow.scope || 'project',
      filePath: workflow.filePath,
      updatedAt: workflow.updatedAt,
      stepCount: workflow.steps.length,
    }));
  }

  /**
   * Validate a workflow definition
   */
  validateWorkflow(workflow: WorkflowDefinition): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate name
    if (!workflow.name || !/^[a-z0-9_-]+$/.test(workflow.name)) {
      errors.push(
        'Workflow name must contain only lowercase letters, numbers, hyphens, and underscores'
      );
    }

    // Validate steps
    if (!Array.isArray(workflow.steps) || workflow.steps.length === 0) {
      errors.push('Workflow must have at least one step');
    } else {
      const stepIds = new Set<string>();

      workflow.steps.forEach((step, index) => {
        // Validate step ID
        if (!step.id || typeof step.id !== 'string') {
          errors.push(`Step ${index + 1}: Missing or invalid step ID`);
        } else if (stepIds.has(step.id)) {
          errors.push(`Step ${index + 1}: Duplicate step ID '${step.id}'`);
        } else {
          stepIds.add(step.id);
        }

        // Check step type
        const isParallel = step.type === 'parallel';

        if (isParallel) {
          // Validate parallel step
          if (!step.parallel || !Array.isArray(step.parallel) || step.parallel.length === 0) {
            errors.push(`Step ${index + 1} (${step.id}): Parallel step must have at least one substep`);
          } else {
            // Validate substeps
            const subStepIds = new Set<string>();
            step.parallel.forEach((subStep, subIndex) => {
              // Validate substep ID
              if (!subStep.id || typeof subStep.id !== 'string') {
                errors.push(`Step ${index + 1} (${step.id}), substep ${subIndex + 1}: Missing or invalid substep ID`);
              } else if (subStepIds.has(subStep.id)) {
                errors.push(`Step ${index + 1} (${step.id}), substep ${subIndex + 1}: Duplicate substep ID '${subStep.id}'`);
              } else {
                subStepIds.add(subStep.id);
              }

              // Validate substep agent
              if (!subStep.agent || typeof subStep.agent !== 'string') {
                errors.push(`Step ${index + 1} (${step.id}), substep ${subIndex + 1} (${subStep.id}): Missing or invalid agent name`);
              }

              // Validate substep input
              if (!subStep.input || typeof subStep.input !== 'string') {
                errors.push(`Step ${index + 1} (${step.id}), substep ${subIndex + 1} (${subStep.id}): Missing or invalid input`);
              }
            });
          }

          // Validate error handling for parallel group
          if (step.error_handling) {
            const validActions = ['continue', 'stop'];
            if (!validActions.includes(step.error_handling.on_error)) {
              errors.push(`Step ${index + 1} (${step.id}): Invalid error handling action: ${step.error_handling.on_error}`);
            }

            if (step.error_handling.min_success !== undefined) {
              if (typeof step.error_handling.min_success !== 'number' || step.error_handling.min_success < 1) {
                errors.push(`Step ${index + 1} (${step.id}): min_success must be a positive number`);
              }
              if (step.parallel && step.error_handling.min_success > step.parallel.length) {
                errors.push(`Step ${index + 1} (${step.id}): min_success (${step.error_handling.min_success}) cannot exceed number of substeps (${step.parallel.length})`);
              }
            }
          }
        } else {
          // Validate sequential step
          // Validate agent name
          if (!step.agent || typeof step.agent !== 'string') {
            errors.push(`Step ${index + 1} (${step.id}): Missing or invalid agent name`);
          }

          // Validate input
          if (!step.input || typeof step.input !== 'string') {
            errors.push(`Step ${index + 1} (${step.id}): Missing or invalid input`);
          }

          // Validate condition (if present)
          if (step.when && typeof step.when !== 'string') {
            errors.push(`Step ${index + 1} (${step.id}): Invalid condition expression`);
          }
        }
      });
    }

    // Validate error handling
    if (workflow.error_handling) {
      const validActions = ['continue', 'stop', 'retry'];
      if (!validActions.includes(workflow.error_handling.on_error)) {
        errors.push(
          `Invalid error handling action: ${workflow.error_handling.on_error}`
        );
      }

      if (
        workflow.error_handling.max_retries !== undefined &&
        (typeof workflow.error_handling.max_retries !== 'number' ||
          workflow.error_handling.max_retries < 0)
      ) {
        errors.push('max_retries must be a non-negative number');
      }
    }

    // Validate timeout
    if (
      workflow.timeout !== undefined &&
      (typeof workflow.timeout !== 'number' || workflow.timeout <= 0)
    ) {
      errors.push('timeout must be a positive number');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Delete a workflow
   */
  async deleteWorkflow(name: string): Promise<void> {
    const workflow = this.getWorkflow(name);
    if (!workflow) {
      throw new WorkflowError(
        `Workflow '${name}' not found`,
        'WORKFLOW_NOT_FOUND'
      );
    }

    await fs.unlink(workflow.filePath);
    this.workflows.delete(name);
  }

  /**
   * Check if workflows are loaded
   */
  isLoaded(): boolean {
    return this.loaded;
  }
}

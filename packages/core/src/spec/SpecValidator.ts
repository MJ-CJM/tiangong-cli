/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Constitution,
  Specification,
  TechnicalPlan,
  SpecTask,
  ValidationResult,
} from './types.js';

/**
 * SpecValidator - Validates spec-driven development artifacts
 *
 * Provides comprehensive validation for:
 * - Constitution (project principles and standards)
 * - Specifications (business requirements)
 * - Technical Plans (technical design)
 * - Spec Tasks (executable tasks)
 *
 * Includes dependency cycle detection and data integrity checks.
 */
export class SpecValidator {
  /**
   * Validate a constitution
   */
  validateConstitution(constitution: Constitution): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!constitution.version || constitution.version.trim() === '') {
      errors.push('Constitution version is required');
    } else {
      // Validate semver format (basic check)
      const semverRegex = /^\d+\.\d+\.\d+$/;
      if (!semverRegex.test(constitution.version)) {
        warnings.push(
          `Version '${constitution.version}' does not follow semver format (e.g., 1.0.0)`
        );
      }
    }

    // Validate principles
    if (!constitution.principles || constitution.principles.length === 0) {
      errors.push('Constitution must have at least one principle');
    } else {
      constitution.principles.forEach((principle, idx) => {
        if (!principle || principle.trim() === '') {
          errors.push(`Principle ${idx + 1} is empty`);
        } else if (principle.length < 10) {
          warnings.push(`Principle ${idx + 1} is very short (less than 10 characters)`);
        }
      });
    }

    // Validate quality standards
    if (!constitution.qualityStandards) {
      errors.push('Quality standards are required');
    } else {
      if (!constitution.qualityStandards.testing) {
        errors.push('Testing standards are required');
      }
      if (!constitution.qualityStandards.security) {
        errors.push('Security standards are required');
      }
      if (!constitution.qualityStandards.performance) {
        errors.push('Performance standards are required');
      }
    }

    // Validate constraints (optional but should be array if present)
    if (
      constitution.constraints &&
      !Array.isArray(constitution.constraints)
    ) {
      errors.push('Constraints must be an array');
    }

    // Validate architecture guidelines (optional)
    if (
      constitution.architectureGuidelines &&
      !Array.isArray(constitution.architectureGuidelines)
    ) {
      errors.push('Architecture guidelines must be an array');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate a specification
   */
  validateSpecification(
    spec: Specification,
    allSpecs: Specification[]
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!spec.id || spec.id.trim() === '') {
      errors.push('Specification ID is required');
    } else {
      // Check ID uniqueness
      const duplicates = allSpecs.filter((s) => s.id === spec.id);
      if (duplicates.length > 1) {
        errors.push(`Specification ID '${spec.id}' is not unique`);
      }

      // Check ID format (should be kebab-case)
      const kebabRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
      if (!kebabRegex.test(spec.id)) {
        warnings.push(
          `Specification ID '${spec.id}' should use kebab-case format (e.g., feat-user-auth)`
        );
      }
    }

    if (!spec.title || spec.title.trim() === '') {
      errors.push('Specification title is required');
    }

    if (!spec.category) {
      errors.push('Specification category is required');
    }

    if (!spec.status) {
      errors.push('Specification status is required');
    }

    // Validate business goal
    if (!spec.businessGoal || spec.businessGoal.trim() === '') {
      errors.push('Business goal is required');
    } else if (spec.businessGoal.length < 20) {
      warnings.push('Business goal is very short (less than 20 characters)');
    }

    // Validate user stories
    if (!spec.userStories || spec.userStories.length === 0) {
      errors.push('Specification must have at least one user story');
    } else {
      spec.userStories.forEach((story, idx) => {
        if (!story || story.trim() === '') {
          errors.push(`User story ${idx + 1} is empty`);
        }
      });
    }

    // Validate acceptance criteria
    if (!spec.acceptanceCriteria || spec.acceptanceCriteria.length === 0) {
      errors.push('Specification must have at least one acceptance criterion');
    } else {
      spec.acceptanceCriteria.forEach((criterion, idx) => {
        if (!criterion || criterion.trim() === '') {
          errors.push(`Acceptance criterion ${idx + 1} is empty`);
        }
      });
    }

    // Validate priority
    if (
      spec.priority !== undefined &&
      (spec.priority < 1 || spec.priority > 5)
    ) {
      errors.push('Priority must be between 1 and 5');
    }

    // Validate business value
    if (
      spec.businessValue !== undefined &&
      (spec.businessValue < 1 || spec.businessValue > 10)
    ) {
      errors.push('Business value must be between 1 and 10');
    }

    // Validate dependencies
    if (spec.dependencies && spec.dependencies.length > 0) {
      spec.dependencies.forEach((depId) => {
        const depExists = allSpecs.some((s) => s.id === depId);
        if (!depExists) {
          errors.push(
            `Dependency '${depId}' does not exist`
          );
        }
      });

      // Check for circular dependencies
      const cycles = this.checkDependencyCycles(spec, allSpecs);
      if (cycles.length > 0) {
        errors.push(
          `Circular dependency detected: ${cycles.join(' -> ')}`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate a technical plan
   */
  validateTechnicalPlan(
    plan: TechnicalPlan,
    spec: Specification | null
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!plan.id || plan.id.trim() === '') {
      errors.push('Technical plan ID is required');
    }

    if (!plan.specId || plan.specId.trim() === '') {
      errors.push('Specification ID is required');
    } else if (!spec) {
      errors.push(
        `Specification '${plan.specId}' does not exist`
      );
    }

    if (!plan.title || plan.title.trim() === '') {
      errors.push('Technical plan title is required');
    }

    // Validate architecture
    if (!plan.architecture) {
      errors.push('Architecture is required');
    } else {
      if (!plan.architecture.approach || plan.architecture.approach.trim() === '') {
        errors.push('Architecture approach is required');
      }

      if (!plan.architecture.components || plan.architecture.components.length === 0) {
        errors.push('Architecture must have at least one component');
      }

      if (!plan.architecture.dataFlow || plan.architecture.dataFlow.trim() === '') {
        errors.push('Data flow description is required');
      }
    }

    // Validate implementation
    if (!plan.implementation) {
      errors.push('Implementation details are required');
    } else {
      if (!plan.implementation.files || plan.implementation.files.length === 0) {
        errors.push('Implementation must specify at least one file');
      } else {
        // Validate file paths
        plan.implementation.files.forEach((file) => {
          if (file.includes('\\')) {
            warnings.push(
              `File path '${file}' uses backslashes, consider using forward slashes`
            );
          }
        });
      }
    }

    // Validate risks
    if (!plan.risks || plan.risks.length === 0) {
      errors.push('Technical plan must identify at least one risk');
    } else {
      plan.risks.forEach((risk, idx) => {
        if (!risk.description || risk.description.trim() === '') {
          errors.push(`Risk ${idx + 1} description is required`);
        }
        if (!risk.severity) {
          errors.push(`Risk ${idx + 1} severity is required`);
        }
        if (!risk.mitigation || risk.mitigation.trim() === '') {
          errors.push(`Risk ${idx + 1} mitigation strategy is required`);
        }
      });
    }

    // Validate testing strategy
    if (!plan.testingStrategy) {
      errors.push('Testing strategy is required');
    } else {
      if (!plan.testingStrategy.unit || plan.testingStrategy.unit.trim() === '') {
        errors.push('Unit testing strategy is required');
      }
      if (!plan.testingStrategy.integration || plan.testingStrategy.integration.trim() === '') {
        errors.push('Integration testing strategy is required');
      }
    }

    // Validate estimated duration
    if (!plan.estimatedDuration || plan.estimatedDuration.trim() === '') {
      errors.push('Estimated duration is required');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate spec tasks
   */
  validateTasks(tasks: SpecTask[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (tasks.length === 0) {
      errors.push('At least one task is required');
      return { valid: false, errors, warnings };
    }

    // Check task ID uniqueness
    const taskIds = tasks.map((t) => t.id);
    const duplicateIds = taskIds.filter(
      (id, index) => taskIds.indexOf(id) !== index
    );
    if (duplicateIds.length > 0) {
      errors.push(
        `Duplicate task IDs found: ${[...new Set(duplicateIds)].join(', ')}`
      );
    }

    // Validate each task
    tasks.forEach((task, idx) => {
      const taskLabel = `Task ${idx + 1} (${task.id})`;

      if (!task.id || task.id.trim() === '') {
        errors.push(`${taskLabel}: ID is required`);
      }

      if (!task.title || task.title.trim() === '') {
        errors.push(`${taskLabel}: Title is required`);
      }

      if (!task.description || task.description.trim() === '') {
        errors.push(`${taskLabel}: Description is required`);
      }

      if (!task.type) {
        errors.push(`${taskLabel}: Type is required`);
      }

      if (!task.priority) {
        errors.push(`${taskLabel}: Priority is required`);
      }

      if (!task.files || task.files.length === 0) {
        errors.push(`${taskLabel}: Must reference at least one file`);
      }

      if (!task.estimatedTime || task.estimatedTime.trim() === '') {
        errors.push(`${taskLabel}: Estimated time is required`);
      }

      // Validate dependencies
      if (task.dependencies && task.dependencies.length > 0) {
        task.dependencies.forEach((depId) => {
          if (!taskIds.includes(depId)) {
            errors.push(
              `${taskLabel}: Dependency '${depId}' does not exist`
            );
          }
        });
      }
    });

    // Check for circular dependencies
    const cycles = this.checkTaskDependencyCycles(tasks);
    if (cycles.length > 0) {
      errors.push(
        `Circular task dependencies detected: ${cycles.join(' -> ')}`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check for circular dependencies in specifications
   */
  checkDependencyCycles(
    spec: Specification,
    allSpecs: Specification[]
  ): string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (specId: string, path: string[]): string[] | null => {
      if (recursionStack.has(specId)) {
        // Found a cycle
        return [...path, specId];
      }

      if (visited.has(specId)) {
        return null;
      }

      visited.add(specId);
      recursionStack.add(specId);

      const currentSpec = allSpecs.find((s) => s.id === specId);
      if (currentSpec && currentSpec.dependencies) {
        for (const depId of currentSpec.dependencies) {
          const cycle = hasCycle(depId, [...path, specId]);
          if (cycle) {
            return cycle;
          }
        }
      }

      recursionStack.delete(specId);
      return null;
    };

    return hasCycle(spec.id, []) || [];
  }

  /**
   * Check for circular dependencies in tasks
   */
  private checkTaskDependencyCycles(tasks: SpecTask[]): string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (taskId: string, path: string[]): string[] | null => {
      if (recursionStack.has(taskId)) {
        // Found a cycle
        return [...path, taskId];
      }

      if (visited.has(taskId)) {
        return null;
      }

      visited.add(taskId);
      recursionStack.add(taskId);

      const currentTask = tasks.find((t) => t.id === taskId);
      if (currentTask && currentTask.dependencies) {
        for (const depId of currentTask.dependencies) {
          const cycle = hasCycle(depId, [...path, taskId]);
          if (cycle) {
            return cycle;
          }
        }
      }

      recursionStack.delete(taskId);
      return null;
    };

    // Check all tasks
    for (const task of tasks) {
      const cycle = hasCycle(task.id, []);
      if (cycle) {
        return cycle;
      }
    }

    return [];
  }
}

export function createSpecValidator(): SpecValidator {
  return new SpecValidator();
}

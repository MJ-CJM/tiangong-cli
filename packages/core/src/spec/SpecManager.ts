/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '../config/config.js';
import type { Constitution, Specification, SpecMetadata, TechnicalPlan, TechnicalPlanMetadata, TaskList, TaskListMetadata } from './types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * SpecManager - Simplified read-only version for MVP
 *
 * Manages Spec-Driven Development artifacts:
 * - Constitution (project principles)
 * - Specifications (business requirements)
 *
 * Full CRUD operations will be added in Phase 3.
 */
export class SpecManager {
  private specsDir: string;

  constructor(config: Config) {
    this.specsDir = path.join(config.getWorkingDir(), '.gemini', 'specs');
  }

  /**
   * Load constitution from file system
   */
  loadConstitution(): Constitution | null {
    const constitutionPath = path.join(this.specsDir, 'constitution.json');

    if (!fs.existsSync(constitutionPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(constitutionPath, 'utf-8');
      const data = JSON.parse(content);

      // Convert date strings back to Date objects
      return {
        ...data,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
      };
    } catch (error) {
      console.error('Failed to load constitution:', error);
      return null;
    }
  }

  /**
   * Check if constitution exists
   */
  constitutionExists(): boolean {
    const constitutionPath = path.join(this.specsDir, 'constitution.json');
    return fs.existsSync(constitutionPath);
  }

  /**
   * Get a single specification by ID
   */
  getSpec(id: string): Specification | null {
    const specPath = path.join(this.specsDir, 'features', `${id}.json`);

    if (!fs.existsSync(specPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(specPath, 'utf-8');
      const data = JSON.parse(content);

      // Convert date strings back to Date objects
      return {
        ...data,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
      };
    } catch (error) {
      console.error(`Failed to load specification ${id}:`, error);
      return null;
    }
  }

  /**
   * Check if a specification exists
   */
  specExists(id: string): boolean {
    const specPath = path.join(this.specsDir, 'features', `${id}.json`);
    return fs.existsSync(specPath);
  }

  /**
   * List all specifications
   */
  listSpecs(): SpecMetadata[] {
    const featuresDir = path.join(this.specsDir, 'features');

    if (!fs.existsSync(featuresDir)) {
      return [];
    }

    const specs: SpecMetadata[] = [];

    try {
      const files = fs.readdirSync(featuresDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(featuresDir, file);
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);

            specs.push({
              id: data.id,
              title: data.title,
              category: data.category,
              status: data.status,
              priority: data.priority,
              createdAt: new Date(data.createdAt),
              updatedAt: new Date(data.updatedAt),
            });
          } catch (error) {
            console.error(`Failed to parse ${file}:`, error);
          }
        }
      }

      // Sort by updatedAt (most recent first)
      specs.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      return specs;
    } catch (error) {
      console.error('Failed to list specifications:', error);
      return [];
    }
  }

  /**
   * Get specifications directory path
   */
  getSpecsDir(): string {
    return this.specsDir;
  }

  /**
   * Get a technical plan by spec ID
   * Finds the plan file by searching for a plan with matching specId
   */
  getTechPlan(specId: string): TechnicalPlan | null {
    const plansDir = path.join(this.specsDir, 'plans');

    if (!fs.existsSync(plansDir)) {
      return null;
    }

    try {
      const files = fs.readdirSync(plansDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(plansDir, file);
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);

            // Check if this plan belongs to the spec
            if (data.specId === specId) {
              // Convert date strings back to Date objects
              return {
                ...data,
                createdAt: new Date(data.createdAt),
                updatedAt: new Date(data.updatedAt),
              };
            }
          } catch (error) {
            console.error(`Failed to parse plan file ${file}:`, error);
          }
        }
      }

      return null;
    } catch (error) {
      console.error(`Failed to load technical plan for ${specId}:`, error);
      return null;
    }
  }

  /**
   * Check if a technical plan exists for a spec
   */
  techPlanExists(specId: string): boolean {
    return this.getTechPlan(specId) !== null;
  }

  /**
   * Get tasks for a spec ID
   */
  getTasks(specId: string): any | null {
    const tasksPath = path.join(this.specsDir, 'tasks', `${specId}-tasks.json`);

    if (!fs.existsSync(tasksPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(tasksPath, 'utf-8');
      const data = JSON.parse(content);

      // Convert date strings back to Date objects
      return {
        ...data,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
        tasks: data.tasks.map((task: any) => ({
          ...task,
          createdAt: new Date(task.createdAt),
        })),
      };
    } catch (error) {
      console.error(`Failed to load tasks for ${specId}:`, error);
      return null;
    }
  }

  /**
   * Check if tasks exist for a spec
   */
  tasksExist(specId: string): boolean {
    const tasksPath = path.join(this.specsDir, 'tasks', `${specId}-tasks.json`);
    return fs.existsSync(tasksPath);
  }

  /**
   * Ensure specs directory structure exists
   */
  ensureSpecsDirectory(): void {
    const dirs = [
      this.specsDir,
      path.join(this.specsDir, 'features'),
      path.join(this.specsDir, 'plans'),
      path.join(this.specsDir, 'tasks'),
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  // ==================== CRUD Operations (Phase 3) ====================

  /**
   * Save constitution to file system
   */
  saveConstitution(constitution: Constitution): void {
    this.ensureSpecsDirectory();
    const constitutionPath = path.join(this.specsDir, 'constitution.json');

    const data = {
      ...constitution,
      updatedAt: new Date().toISOString(),
      createdAt: constitution.createdAt
        ? constitution.createdAt.toISOString()
        : new Date().toISOString(),
    };

    fs.writeFileSync(constitutionPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Create a new specification
   */
  createSpec(spec: Specification): void {
    this.ensureSpecsDirectory();
    const specPath = path.join(this.specsDir, 'features', `${spec.id}.json`);

    if (fs.existsSync(specPath)) {
      throw new Error(`Specification '${spec.id}' already exists`);
    }

    const data = {
      ...spec,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(specPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Update an existing specification
   */
  updateSpec(id: string, updates: Partial<Specification>): void {
    const spec = this.getSpec(id);
    if (!spec) {
      throw new Error(`Specification '${id}' not found`);
    }

    const updatedSpec = {
      ...spec,
      ...updates,
      id: spec.id, // Prevent ID changes
      createdAt: spec.createdAt,
      updatedAt: new Date(),
    };

    const specPath = path.join(this.specsDir, 'features', `${id}.json`);
    const data = {
      ...updatedSpec,
      createdAt: updatedSpec.createdAt.toISOString(),
      updatedAt: updatedSpec.updatedAt.toISOString(),
    };

    fs.writeFileSync(specPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Delete a specification
   */
  deleteSpec(id: string): void {
    const specPath = path.join(this.specsDir, 'features', `${id}.json`);

    if (!fs.existsSync(specPath)) {
      throw new Error(`Specification '${id}' not found`);
    }

    fs.unlinkSync(specPath);

    // Also delete associated plan and tasks
    const plan = this.getTechPlan(id);
    if (plan) {
      this.deletePlan(plan.id);
    }

    if (this.tasksExist(id)) {
      this.deleteTasks(id);
    }
  }

  /**
   * Create a technical plan
   */
  createPlan(plan: TechnicalPlan): void {
    this.ensureSpecsDirectory();
    const planPath = path.join(this.specsDir, 'plans', `${plan.id}.json`);

    if (fs.existsSync(planPath)) {
      throw new Error(`Technical plan '${plan.id}' already exists`);
    }

    const data = {
      ...plan,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(planPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Update a technical plan
   */
  updatePlan(id: string, updates: Partial<TechnicalPlan>): void {
    // Find plan by ID
    const plansDir = path.join(this.specsDir, 'plans');
    const planPath = path.join(plansDir, `${id}.json`);

    if (!fs.existsSync(planPath)) {
      throw new Error(`Technical plan '${id}' not found`);
    }

    const content = fs.readFileSync(planPath, 'utf-8');
    const data = JSON.parse(content);
    const plan: TechnicalPlan = {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    };

    const updatedPlan = {
      ...plan,
      ...updates,
      id: plan.id, // Prevent ID changes
      specId: plan.specId, // Prevent specId changes
      createdAt: plan.createdAt,
      updatedAt: new Date(),
    };

    const updatedData = {
      ...updatedPlan,
      createdAt: updatedPlan.createdAt.toISOString(),
      updatedAt: updatedPlan.updatedAt.toISOString(),
    };

    fs.writeFileSync(planPath, JSON.stringify(updatedData, null, 2), 'utf-8');
  }

  /**
   * Delete a technical plan
   */
  deletePlan(id: string): void {
    const planPath = path.join(this.specsDir, 'plans', `${id}.json`);

    if (!fs.existsSync(planPath)) {
      throw new Error(`Technical plan '${id}' not found`);
    }

    fs.unlinkSync(planPath);
  }

  /**
   * Delete tasks for a spec
   */
  deleteTasks(specId: string): void {
    const tasksPath = path.join(this.specsDir, 'tasks', `${specId}-tasks.json`);

    if (!fs.existsSync(tasksPath)) {
      throw new Error(`Tasks for '${specId}' not found`);
    }

    fs.unlinkSync(tasksPath);
  }

  /**
   * Search specifications by query string
   */
  searchSpecs(query: string): SpecMetadata[] {
    const allSpecs = this.listSpecs();
    const lowerQuery = query.toLowerCase();

    return allSpecs.filter((spec) =>
      spec.title.toLowerCase().includes(lowerQuery) ||
      spec.id.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get specifications by category
   */
  getSpecsByCategory(category: string): Specification[] {
    const allSpecs = this.listSpecs();
    return allSpecs
      .filter((meta) => meta.category === category)
      .map((meta) => this.getSpec(meta.id))
      .filter((spec): spec is Specification => spec !== null);
  }

  /**
   * Get specifications by status
   */
  getSpecsByStatus(status: string): Specification[] {
    const allSpecs = this.listSpecs();
    return allSpecs
      .filter((meta) => meta.status === status)
      .map((meta) => this.getSpec(meta.id))
      .filter((spec): spec is Specification => spec !== null);
  }

  /**
   * Get dependencies for a specification
   */
  getSpecDependencies(specId: string): Specification[] {
    const spec = this.getSpec(specId);
    if (!spec || !spec.dependencies) {
      return [];
    }

    return spec.dependencies
      .map((depId) => this.getSpec(depId))
      .filter((s): s is Specification => s !== null);
  }

  // ==================== Plan Management (One-to-Many) ====================

  /**
   * List all technical plans for a specification
   */
  listPlansBySpec(specId: string): TechnicalPlanMetadata[] {
    const plansDir = path.join(this.specsDir, 'plans');

    if (!fs.existsSync(plansDir)) {
      return [];
    }

    const plans: TechnicalPlanMetadata[] = [];

    try {
      const files = fs.readdirSync(plansDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(plansDir, file);
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);

            // Only include plans for this spec
            if (data.specId === specId) {
              plans.push({
                id: data.id,
                specId: data.specId,
                version: data.version,
                description: data.description,
                isActive: data.isActive,
                title: data.title,
                estimatedDuration: data.estimatedDuration,
                createdAt: new Date(data.createdAt),
                updatedAt: new Date(data.updatedAt),
              });
            }
          } catch (error) {
            console.error(`Failed to parse plan file ${file}:`, error);
          }
        }
      }

      // Sort by version (most recent first)
      plans.sort((a, b) => {
        const versionA = parseInt(a.version.substring(1)); // Remove 'v' prefix
        const versionB = parseInt(b.version.substring(1));
        return versionB - versionA;
      });

      return plans;
    } catch (error) {
      console.error(`Failed to list plans for spec ${specId}:`, error);
      return [];
    }
  }

  /**
   * Get the next plan version for a specification
   */
  getNextPlanVersion(specId: string): string {
    const plans = this.listPlansBySpec(specId);

    if (plans.length === 0) {
      return 'v1';
    }

    // Find the highest version number
    let maxVersion = 0;
    for (const plan of plans) {
      const versionNum = parseInt(plan.version.substring(1)); // Remove 'v' prefix
      if (versionNum > maxVersion) {
        maxVersion = versionNum;
      }
    }

    return `v${maxVersion + 1}`;
  }

  /**
   * Get a technical plan by its ID (not spec ID)
   */
  getPlanById(planId: string): TechnicalPlan | null {
    const planPath = path.join(this.specsDir, 'plans', `${planId}.json`);

    if (!fs.existsSync(planPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(planPath, 'utf-8');
      const data = JSON.parse(content);

      return {
        ...data,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
      };
    } catch (error) {
      console.error(`Failed to load plan ${planId}:`, error);
      return null;
    }
  }

  /**
   * Get the active technical plan for a specification
   */
  getActivePlan(specId: string): TechnicalPlan | null {
    const plans = this.listPlansBySpec(specId);

    const activePlan = plans.find(p => p.isActive);
    if (!activePlan) {
      return null;
    }

    return this.getPlanById(activePlan.id);
  }

  /**
   * Set a plan as active (and deactivate all others for the spec)
   */
  setActivePlan(planId: string): void {
    const plan = this.getPlanById(planId);
    if (!plan) {
      throw new Error(`Technical plan '${planId}' not found`);
    }

    const allPlans = this.listPlansBySpec(plan.specId);

    // Deactivate all plans for this spec
    for (const p of allPlans) {
      if (p.id === planId) {
        this.updatePlan(p.id, { isActive: true });
      } else if (p.isActive) {
        this.updatePlan(p.id, { isActive: false });
      }
    }
  }

  // ==================== Tasks Management (One-to-Many) ====================

  /**
   * List all task lists for a technical plan
   */
  listTasksByPlan(planId: string): TaskListMetadata[] {
    const tasksDir = path.join(this.specsDir, 'tasks');

    if (!fs.existsSync(tasksDir)) {
      return [];
    }

    const taskLists: TaskListMetadata[] = [];

    try {
      const files = fs.readdirSync(tasksDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(tasksDir, file);
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);

            // Only include task lists for this plan
            if (data.planId === planId) {
              taskLists.push({
                id: data.id,
                specId: data.specId,
                planId: data.planId,
                planVersion: data.planVersion,
                variant: data.variant,
                description: data.description,
                taskCount: data.tasks?.length || 0,
                createdAt: new Date(data.createdAt),
                updatedAt: new Date(data.updatedAt),
              });
            }
          } catch (error) {
            console.error(`Failed to parse task file ${file}:`, error);
          }
        }
      }

      // Sort by createdAt (most recent first)
      taskLists.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return taskLists;
    } catch (error) {
      console.error(`Failed to list tasks for plan ${planId}:`, error);
      return [];
    }
  }

  /**
   * Get a task list by its ID
   */
  getTaskListById(tasksId: string): TaskList | null {
    const tasksPath = path.join(this.specsDir, 'tasks', `${tasksId}.json`);

    if (!fs.existsSync(tasksPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(tasksPath, 'utf-8');
      const data = JSON.parse(content);

      return {
        ...data,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
        execution: data.execution ? {
          ...data.execution,
          startedAt: data.execution.startedAt ? new Date(data.execution.startedAt) : undefined,
          completedAt: data.execution.completedAt ? new Date(data.execution.completedAt) : undefined,
        } : undefined,
        tasks: data.tasks.map((task: any) => ({
          ...task,
          createdAt: new Date(task.createdAt),
          completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
          execution: task.execution ? {
            ...task.execution,
            lastAttemptAt: task.execution.lastAttemptAt ? new Date(task.execution.lastAttemptAt) : undefined,
          } : undefined,
        })),
      };
    } catch (error) {
      console.error(`Failed to load task list ${tasksId}:`, error);
      return null;
    }
  }

  /**
   * Delete a task list by its ID
   */
  deleteTaskList(tasksId: string): void {
    const tasksPath = path.join(this.specsDir, 'tasks', `${tasksId}.json`);

    if (!fs.existsSync(tasksPath)) {
      throw new Error(`Task list '${tasksId}' not found`);
    }

    fs.unlinkSync(tasksPath);
  }

  /**
   * List all task lists for a specification
   */
  listTasksBySpec(specId: string): TaskListMetadata[] {
    const tasksDir = path.join(this.specsDir, 'tasks');

    if (!fs.existsSync(tasksDir)) {
      return [];
    }

    const taskLists: TaskListMetadata[] = [];

    try {
      const files = fs.readdirSync(tasksDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(tasksDir, file);
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);

            // Only include task lists for this spec
            if (data.specId === specId) {
              taskLists.push({
                id: data.id,
                specId: data.specId,
                planId: data.planId,
                planVersion: data.planVersion,
                variant: data.variant,
                description: data.description,
                taskCount: data.tasks?.length || 0,
                createdAt: new Date(data.createdAt),
                updatedAt: new Date(data.updatedAt),
              });
            }
          } catch (error) {
            console.error(`Failed to parse task file ${file}:`, error);
          }
        }
      }

      // Sort by createdAt (most recent first)
      taskLists.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return taskLists;
    } catch (error) {
      console.error(`Failed to list tasks for spec ${specId}:`, error);
      return [];
    }
  }

  // ==================== Task Execution Management ====================

  /**
   * Update task status with execution tracking
   */
  updateTaskStatus(
    tasksId: string,
    taskId: string,
    status: 'pending' | 'in_progress' | 'completed' | 'blocked',
    notes?: string
  ): void {
    const taskList = this.getTaskListById(tasksId);
    if (!taskList) {
      throw new Error(`Task list '${tasksId}' not found`);
    }

    const task = taskList.tasks.find((t) => t.id === taskId);
    if (!task) {
      throw new Error(`Task '${taskId}' not found in task list '${tasksId}'`);
    }

    // Update task status
    task.status = status;

    // Update completion timestamp
    if (status === 'completed') {
      task.completedAt = new Date();
    }

    // Update execution tracking
    if (!task.execution) {
      task.execution = {
        attempts: 0,
        executionNotes: '',
      };
    }

    // Increment attempts when transitioning to in_progress
    if (status === 'in_progress') {
      task.execution.attempts += 1;
      task.execution.lastAttemptAt = new Date();
    }

    // Add execution notes
    if (notes) {
      const timestamp = new Date().toISOString();
      const newNote = `[${timestamp}] ${notes}`;
      task.execution.executionNotes = task.execution.executionNotes
        ? `${task.execution.executionNotes}\n${newNote}`
        : newNote;
    }

    // Update task list execution progress
    this.updateExecutionProgress(taskList);

    // Save updated task list
    taskList.updatedAt = new Date();
    this.saveTaskList(taskList);
  }

  /**
   * Update execution progress statistics for a task list
   */
  private updateExecutionProgress(taskList: TaskList): void {
    const total = taskList.tasks.length;
    const completed = taskList.tasks.filter(
      (t) => t.status === 'completed'
    ).length;
    const failed = taskList.tasks.filter((t) => t.status === 'blocked').length;
    const pending = taskList.tasks.filter((t) => t.status === 'pending').length;

    if (!taskList.execution) {
      taskList.execution = {
        status: 'not_started',
        failedTaskIds: [],
        progress: {
          total,
          completed,
          failed,
          pending,
        },
      };
    }

    // Update progress
    taskList.execution.progress = {
      total,
      completed,
      failed,
      pending,
    };

    // Update overall status
    if (completed === total) {
      taskList.execution.status = 'completed';
      taskList.execution.completedAt = new Date();
    } else if (failed > 0) {
      taskList.execution.status = 'failed';
      taskList.execution.failedTaskIds = taskList.tasks
        .filter((t) => t.status === 'blocked')
        .map((t) => t.id);
    } else if (completed > 0 || taskList.tasks.some((t) => t.status === 'in_progress')) {
      taskList.execution.status = 'in_progress';
      if (!taskList.execution.startedAt) {
        taskList.execution.startedAt = new Date();
      }
    }
  }

  /**
   * Save task list to file system
   */
  private saveTaskList(taskList: TaskList): void {
    const tasksPath = path.join(this.specsDir, 'tasks', `${taskList.id}.json`);

    const data = {
      ...taskList,
      createdAt: taskList.createdAt.toISOString(),
      updatedAt: taskList.updatedAt.toISOString(),
      execution: taskList.execution ? {
        ...taskList.execution,
        startedAt: taskList.execution.startedAt?.toISOString(),
        completedAt: taskList.execution.completedAt?.toISOString(),
      } : undefined,
      tasks: taskList.tasks.map((task) => ({
        ...task,
        createdAt: task.createdAt.toISOString(),
        completedAt: task.completedAt?.toISOString(),
        execution: task.execution ? {
          ...task.execution,
          lastAttemptAt: task.execution.lastAttemptAt?.toISOString(),
        } : undefined,
      })),
    };

    fs.writeFileSync(tasksPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Check if a task's dependencies are completed
   */
  checkDependencies(
    tasksId: string,
    taskId: string
  ): { canExecute: boolean; blockingTasks: string[] } {
    const taskList = this.getTaskListById(tasksId);
    if (!taskList) {
      throw new Error(`Task list '${tasksId}' not found`);
    }

    const task = taskList.tasks.find((t) => t.id === taskId);
    if (!task) {
      throw new Error(`Task '${taskId}' not found in task list '${tasksId}'`);
    }

    const blockingTasks: string[] = [];

    // Check each dependency
    for (const depId of task.dependencies) {
      const depTask = taskList.tasks.find((t) => t.id === depId);
      if (!depTask) {
        throw new Error(
          `Dependency task '${depId}' not found in task list '${tasksId}'`
        );
      }

      // If dependency is not completed, it's blocking
      if (depTask.status !== 'completed') {
        blockingTasks.push(depId);
      }
    }

    return {
      canExecute: blockingTasks.length === 0,
      blockingTasks,
    };
  }

  /**
   * Get the execution order of tasks using topological sort
   * Returns task IDs in the order they should be executed
   */
  getExecutionOrder(tasksId: string): string[] {
    const taskList = this.getTaskListById(tasksId);
    if (!taskList) {
      throw new Error(`Task list '${tasksId}' not found`);
    }

    const tasks = taskList.tasks;
    const order: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    // DFS-based topological sort
    const visit = (taskId: string): void => {
      if (visited.has(taskId)) {
        return;
      }

      if (visiting.has(taskId)) {
        throw new Error(`Circular dependency detected involving task '${taskId}'`);
      }

      visiting.add(taskId);

      const task = tasks.find((t) => t.id === taskId);
      if (!task) {
        throw new Error(`Task '${taskId}' not found`);
      }

      // Visit dependencies first
      for (const depId of task.dependencies) {
        visit(depId);
      }

      visiting.delete(taskId);
      visited.add(taskId);
      order.push(taskId);
    };

    // Visit all tasks
    for (const task of tasks) {
      visit(task.id);
    }

    return order;
  }

  /**
   * Get the next executable task (first pending task with all dependencies completed)
   */
  getNextExecutableTask(tasksId: string): string | null {
    const taskList = this.getTaskListById(tasksId);
    if (!taskList) {
      throw new Error(`Task list '${tasksId}' not found`);
    }

    // Get execution order
    const order = this.getExecutionOrder(tasksId);

    // Find first pending task with all dependencies completed
    for (const taskId of order) {
      const task = taskList.tasks.find((t) => t.id === taskId);
      if (!task) continue;

      // Skip if not pending
      if (task.status !== 'pending') continue;

      // Check dependencies
      const depCheck = this.checkDependencies(tasksId, taskId);
      if (depCheck.canExecute) {
        return taskId;
      }
    }

    return null;
  }

  /**
   * Start execution of a task list
   */
  startExecution(tasksId: string): void {
    const taskList = this.getTaskListById(tasksId);
    if (!taskList) {
      throw new Error(`Task list '${tasksId}' not found`);
    }

    if (!taskList.execution) {
      taskList.execution = {
        status: 'in_progress',
        startedAt: new Date(),
        failedTaskIds: [],
        progress: {
          total: taskList.tasks.length,
          completed: 0,
          failed: 0,
          pending: taskList.tasks.length,
        },
      };
    } else {
      taskList.execution.status = 'in_progress';
      if (!taskList.execution.startedAt) {
        taskList.execution.startedAt = new Date();
      }
    }

    taskList.updatedAt = new Date();
    this.saveTaskList(taskList);
  }

  /**
   * Pause execution of a task list
   */
  pauseExecution(tasksId: string): void {
    const taskList = this.getTaskListById(tasksId);
    if (!taskList) {
      throw new Error(`Task list '${tasksId}' not found`);
    }

    if (taskList.execution) {
      taskList.execution.status = 'paused';
    }

    taskList.updatedAt = new Date();
    this.saveTaskList(taskList);
  }

  /**
   * Resume execution of a paused task list
   */
  resumeExecution(tasksId: string): TaskList {
    const taskList = this.getTaskListById(tasksId);
    if (!taskList) {
      throw new Error(`Task list '${tasksId}' not found`);
    }

    if (taskList.execution) {
      taskList.execution.status = 'in_progress';
    }

    taskList.updatedAt = new Date();
    this.saveTaskList(taskList);

    return taskList;
  }
}

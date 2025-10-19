/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Spec-Driven Development (SDD) Type Definitions
 *
 * Implements GitHub Spec Kit-like workflow:
 * Constitution → Specification → Technical Plan → Tasks → Implementation
 */

/**
 * Project Constitution - Engineering principles and constraints
 */
export interface Constitution {
  /** Version of the constitution */
  version: string;

  /** Core engineering principles */
  principles: string[];

  /** Technical constraints and limitations */
  constraints: string[];

  /** Quality standards */
  qualityStandards: {
    /** Testing requirements */
    testing: string;
    /** Security requirements */
    security: string;
    /** Performance requirements */
    performance: string;
    /** Accessibility requirements */
    accessibility?: string;
  };

  /** Architecture guidelines */
  architectureGuidelines: string[];

  /** Coding standards and best practices */
  codingStandards?: string[];

  /** Created timestamp */
  createdAt: Date;

  /** Last updated timestamp */
  updatedAt: Date;
}

/**
 * Specification Category
 */
export enum SpecCategory {
  FEATURE = 'feature',
  BUG_FIX = 'bug-fix',
  REFACTOR = 'refactor',
  ENHANCEMENT = 'enhancement',
  DOCUMENTATION = 'documentation',
}

/**
 * Specification Status
 */
export enum SpecStatus {
  DRAFT = 'draft',
  REVIEW = 'review',
  APPROVED = 'approved',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

/**
 * Business Specification - What needs to be built (business perspective)
 */
export interface Specification {
  /** Unique identifier */
  id: string;

  /** Specification title */
  title: string;

  /** Category of the specification */
  category: SpecCategory;

  /** Current status */
  status: SpecStatus;

  /** Business goal and motivation */
  businessGoal: string;

  /** User stories */
  userStories: string[];

  /** Acceptance criteria */
  acceptanceCriteria: string[];

  /** Business constraints */
  constraints: string[];

  /** Dependencies on other specifications */
  dependencies: string[];

  /** Stakeholders */
  stakeholders?: string[];

  /** Priority (1-5, 1 being highest) */
  priority?: number;

  /** Estimated business value (1-10) */
  businessValue?: number;

  /** Target release/milestone */
  targetRelease?: string;

  /** Created timestamp */
  createdAt: Date;

  /** Last updated timestamp */
  updatedAt: Date;

  /** Created by */
  createdBy?: string;
}

/**
 * Technical Plan - How to build it (technical perspective)
 */
export interface TechnicalPlan {
  /** Unique identifier (e.g., plan-feat-user-auth-v1) */
  id: string;

  /** Reference to the specification ID */
  specId: string;

  /** Plan version (auto-incremented: v1, v2, v3...) */
  version: string;

  /** Plan description (e.g., "OAuth2 implementation", "JWT-based approach") */
  description?: string;

  /** Whether this is the active plan for the spec */
  isActive: boolean;

  /** Title of the technical plan */
  title: string;

  /** Architecture and design */
  architecture: {
    /** Technical approach and rationale */
    approach: string;
    /** System components to be created/modified */
    components: string[];
    /** Data flow description */
    dataFlow: string;
    /** Technology stack choices */
    techStack?: string[];
  };

  /** Implementation details */
  implementation: {
    /** Files to be created or modified */
    files: string[];
    /** API endpoints (if applicable) */
    apis?: string[];
    /** Database changes (if applicable) */
    database?: string[];
    /** Configuration changes */
    config?: string[];
  };

  /** Technical risks and mitigation strategies */
  risks: Array<{
    /** Risk description */
    description: string;
    /** Risk severity (low, medium, high, critical) */
    severity: 'low' | 'medium' | 'high' | 'critical';
    /** Mitigation strategy */
    mitigation: string;
  }>;

  /** Testing strategy */
  testingStrategy: {
    /** Unit testing approach */
    unit: string;
    /** Integration testing approach */
    integration: string;
    /** E2E testing approach */
    e2e?: string;
    /** Test coverage requirements */
    coverage?: string;
  };

  /** Rollback strategy */
  rollbackStrategy?: string;

  /** Performance considerations */
  performance?: {
    /** Expected metrics */
    expectedMetrics: string;
    /** Monitoring approach */
    monitoring: string;
  };

  /** Security considerations */
  security?: {
    /** Security measures */
    measures: string[];
    /** Authentication/Authorization */
    authStrategy?: string;
  };

  /** Estimated development time */
  estimatedDuration: string;

  /** Dependencies on other technical plans */
  dependencies: string[];

  /** Created timestamp */
  createdAt: Date;

  /** Last updated timestamp */
  updatedAt: Date;

  /** Created by */
  createdBy?: string;
}

/**
 * Spec Task - Granular executable task
 */
export interface SpecTask {
  /** Unique identifier */
  id: string;

  /** Reference to specification ID */
  specId: string;

  /** Reference to technical plan ID */
  planId: string;

  /** Task title */
  title: string;

  /** Detailed description */
  description: string;

  /** Task type */
  type: 'implementation' | 'testing' | 'documentation' | 'review';

  /** Task status */
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';

  /** Task priority */
  priority: 'high' | 'medium' | 'low';

  /** Dependencies on other task IDs */
  dependencies: string[];

  /** Files involved */
  files: string[];

  /** Estimated time */
  estimatedTime: string;

  /** Assigned to */
  assignedTo?: string;

  /** Created timestamp */
  createdAt: Date;

  /** Completed timestamp */
  completedAt?: Date;

  /** Notes */
  notes?: string;

  /** Execution record */
  execution?: {
    /** Number of execution attempts */
    attempts: number;
    /** Last execution attempt timestamp */
    lastAttemptAt?: Date;
    /** Execution notes (errors, issues, etc.) */
    executionNotes?: string;
  };
}

/**
 * Task List - Collection of tasks for a technical plan
 */
export interface TaskList {
  /** Unique identifier (e.g., tasks-user-auth-v1-detailed) */
  id: string;

  /** Reference to specification ID */
  specId: string;

  /** Reference to technical plan ID */
  planId: string;

  /** Plan version (redundant storage for easy querying) */
  planVersion: string;

  /** Task list variant (e.g., "detailed", "simplified", "milestones") */
  variant: string;

  /** Task list description */
  description?: string;

  /** List of tasks */
  tasks: SpecTask[];

  /** Created timestamp */
  createdAt: Date;

  /** Last updated timestamp */
  updatedAt: Date;

  /** Execution tracking */
  execution?: {
    /** Overall execution status */
    status: 'not_started' | 'in_progress' | 'paused' | 'completed' | 'failed';
    /** Execution started timestamp */
    startedAt?: Date;
    /** Execution completed timestamp */
    completedAt?: Date;
    /** Current task being executed */
    currentTaskId?: string;
    /** List of failed task IDs */
    failedTaskIds: string[];
    /** Execution progress statistics */
    progress: {
      /** Total number of tasks */
      total: number;
      /** Number of completed tasks */
      completed: number;
      /** Number of failed tasks */
      failed: number;
      /** Number of pending tasks */
      pending: number;
    };
  };
}

/**
 * Validation Result
 */
export interface ValidationResult {
  /** Is valid */
  valid: boolean;

  /** Validation errors */
  errors: string[];

  /** Validation warnings */
  warnings?: string[];
}

/**
 * Spec Metadata for listing
 */
export interface SpecMetadata {
  id: string;
  title: string;
  category: SpecCategory;
  status: SpecStatus;
  priority?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Technical Plan Metadata for listing
 */
export interface TechnicalPlanMetadata {
  id: string;
  specId: string;
  version: string;
  description?: string;
  isActive: boolean;
  title: string;
  estimatedDuration: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Task List Metadata for listing
 */
export interface TaskListMetadata {
  id: string;
  specId: string;
  planId: string;
  planVersion: string;
  variant: string;
  description?: string;
  taskCount: number;
  createdAt: Date;
  updatedAt: Date;
}

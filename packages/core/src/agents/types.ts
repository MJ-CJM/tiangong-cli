/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { UnifiedMessage } from '../adapters/base/types.js';

/**
 * Agent definition loaded from .md files
 */
export interface AgentDefinition {
  /** Must be 'agent' */
  kind: 'agent';

  /** Unique identifier (file name without .md) */
  name: string;

  /** Human-readable title */
  title: string;

  /** Optional description */
  description?: string;

  /** Model to use (defaults to system model) */
  model?: string;

  /** Color for UI display (hex code) */
  color?: string;

  /** Scope: global (~/.gemini/agents) or project (.gemini/agents) */
  scope?: 'global' | 'project';

  /** Version string */
  version?: string;

  /** Context mode: isolated (default) or shared */
  contextMode?: 'isolated' | 'shared';

  /** Tool access control */
  tools?: {
    /** Whitelist of allowed tools */
    allow?: string[];
    /** Blacklist of denied tools (takes precedence over allow) */
    deny?: string[];
  };

  /** MCP server integration */
  mcp?: {
    /** List of MCP server names to connect */
    servers?: string[];
  };

  /** Routing triggers */
  triggers?: {
    /** Keywords for rule-based routing */
    keywords?: string[];
    /** Regex patterns for rule-based routing */
    patterns?: string[];
    /** Priority (0-100, higher = more priority) */
    priority?: number;
  };

  /** Handoff configurations */
  handoffs?: Array<{
    /** Target agent name */
    to: string;
    /** When to trigger: manual (model decides), auto, conditional */
    when?: 'manual' | 'auto' | 'conditional';
    /** Description for the model */
    description?: string;
    /** Include conversation history in handoff */
    include_context?: boolean;
  }>;

  /** System prompt (from markdown body) */
  systemPrompt: string;

  /** Full path to the .md file */
  filePath: string;

  /** Creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Agent runtime context (isolated per agent)
 */
export interface AgentContext {
  /** Agent name */
  agentName: string;

  /** Conversation history (isolated from main session) */
  conversationHistory: UnifiedMessage[];

  /** Arbitrary metadata storage */
  metadata: Record<string, any>;

  /** Context creation time */
  createdAt: Date;

  /** Last interaction time */
  lastAccessedAt: Date;
}

/**
 * Agent runtime state (combines definition + context + resources)
 */
export interface AgentRuntime {
  /** Agent definition */
  definition: AgentDefinition;

  /** Isolated context */
  context: AgentContext;

  /** Filtered tool names (after allow/deny processing) */
  availableTools: string[];

  /** Connected MCP server names */
  mcpServers: string[];
}

/**
 * Agent validation result
 */
export interface AgentValidationResult {
  /** Validation passed */
  valid: boolean;

  /** Error messages (if validation failed) */
  errors: string[];

  /** Warning messages */
  warnings: string[];
}

/**
 * Agent execution options
 */
export interface AgentExecuteOptions {
  /** Enable streaming responses */
  stream?: boolean;

  /** Maximum tokens for response */
  maxTokens?: number;

  /** Temperature (0-1) */
  temperature?: number;

  /** Interactive mode (continuous conversation) */
  interactive?: boolean;

  /** Force context mode (overrides agent definition) */
  contextMode?: 'isolated' | 'shared';

  /** Callback when a tool is about to be called */
  onToolCall?: (toolName: string, args: any) => void;

  /** Callback when a tool execution completes */
  onToolResult?: (toolName: string, result: any, error?: Error) => void;

  /** Callback when a handoff is initiated */
  onHandoff?: (fromAgent: string, toAgent: string, reason: string) => void;
}

/**
 * Agent execution response
 */
export interface AgentExecuteResponse {
  /** Agent name */
  agentName: string;

  /** Response text */
  text: string;

  /** Tool calls made during execution */
  toolCalls?: Array<{
    toolName: string;
    args: any;
    result: any;
  }>;

  /** Updated context after execution */
  context: AgentContext;

  /** Execution metadata */
  metadata: {
    /** Tokens used */
    tokensUsed?: number;
    /** Model used */
    model: string;
    /** Duration in ms */
    durationMs: number;
    /** Number of iterations (tool calling rounds) */
    iterations?: number;
    /** Context mode used */
    contextMode?: 'isolated' | 'shared';
  };
}

/**
 * Agent creation options
 */
export interface AgentCreateOptions {
  /** Agent name (required) */
  name: string;

  /** Human-readable title */
  title: string;

  /** Description */
  description?: string;

  /** Model to use */
  model?: string;

  /** Context mode */
  contextMode?: 'isolated' | 'shared';

  /** Scope (global or project) */
  scope?: 'global' | 'project';

  /** Template to use */
  template?: string;

  /** Custom system prompt (overrides template) */
  customSystemPrompt?: string;

  /** Tool allow list */
  allowTools?: string[];

  /** Tool deny list */
  denyTools?: string[];

  /** MCP servers */
  mcpServers?: string[];
}

/**
 * Agent list item (lightweight representation)
 */
export interface AgentListItem {
  name: string;
  title: string;
  description?: string;
  scope: 'global' | 'project';
  model?: string;
  filePath: string;
  updatedAt: Date;
}

/**
 * Front-matter structure from Agent .md files
 */
export interface AgentFrontMatter {
  kind: 'agent';
  name: string;
  title: string;
  description?: string;
  model?: string;
  color?: string;
  scope?: 'global' | 'project';
  version?: string;
  contextMode?: 'isolated' | 'shared';
  tools?: {
    allow?: string[];
    deny?: string[];
  };
  mcp?: {
    servers?: string[];
  };
  triggers?: {
    keywords?: string[];
    patterns?: string[];
    priority?: number;
  };
  handoffs?: Array<{
    to: string;
    when?: 'manual' | 'auto' | 'conditional';
    description?: string;
    include_context?: boolean;
  }>;
}

/**
 * Routing configuration
 */
export interface RoutingConfig {
  /** Enable/disable routing */
  enabled: boolean;
  /** Routing strategy */
  strategy: 'rule' | 'llm' | 'hybrid';
  /** Rule-based routing configuration */
  rule: {
    confidence_threshold: number;
  };
  /** LLM-based routing configuration */
  llm: {
    model: string;
    timeout: number;
  };
  /** Fallback strategy when no match */
  fallback: 'none' | 'prompt_user' | 'default_agent';
}

/**
 * Routing score result
 */
export interface RoutingScore {
  /** Matched agent */
  agent: AgentDefinition;
  /** Score (0-100) */
  score: number;
  /** Confidence (0-100) */
  confidence: number;
  /** Matched keywords */
  matchedKeywords: string[];
  /** Matched patterns */
  matchedPatterns: string[];
}

/**
 * Handoff configuration
 */
export interface HandoffConfig {
  /** Target agent name */
  to: string;
  /** When to trigger handoff */
  when: 'manual' | 'auto' | 'conditional';
  /** Description for the model */
  description: string;
  /** Include conversation history */
  include_context?: boolean;
}

/**
 * Handoff context (passed between agents)
 */
export interface HandoffContext {
  /** Source agent */
  from_agent: string;
  /** Target agent */
  to_agent: string;
  /** Reason for handoff */
  reason: string;
  /** Additional context */
  context?: string;
  /** Work summary */
  summary?: string;
  /** Structured payload */
  payload?: Record<string, any>;
  /** Conversation history (optional) */
  conversation_history?: UnifiedMessage[];
  /** Metadata */
  metadata: {
    timestamp: number;
    handoff_chain: string[];
    chain_depth: number;
    correlation_id: string;
  };
}

/**
 * Handoff error
 */
export class HandoffError extends Error {
  constructor(
    message: string,
    public code: 'MAX_DEPTH_EXCEEDED' | 'CIRCULAR_HANDOFF' | 'PERMISSION_DENIED' | 'AGENT_NOT_FOUND'
  ) {
    super(message);
    this.name = 'HandoffError';
  }
}

// ============================================================================
// Workflow Types
// ============================================================================

/**
 * Workflow definition loaded from .yaml files
 */
export interface WorkflowDefinition {
  /** Must be 'workflow' */
  kind: 'workflow';

  /** Unique identifier (file name without .yaml) */
  name: string;

  /** Human-readable title */
  title: string;

  /** Optional description */
  description?: string;

  /** Scope: global (~/.gemini/workflows) or project (.gemini/workflows) */
  scope?: 'global' | 'project';

  /** Version string */
  version?: string;

  /** Routing triggers */
  triggers?: {
    /** Keywords for rule-based routing */
    keywords?: string[];
    /** Regex patterns for rule-based routing */
    patterns?: string[];
    /** Priority (0-100, higher = more priority) */
    priority?: number;
  };

  /** Execution steps */
  steps: WorkflowStep[];

  /** Error handling configuration */
  error_handling?: {
    /** What to do on error: continue to next step, stop, or retry */
    on_error: 'continue' | 'stop' | 'retry';
    /** Maximum retry attempts */
    max_retries?: number;
  };

  /** Timeout in milliseconds */
  timeout?: number;

  /** Full path to the .yaml file */
  filePath: string;

  /** Creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  /** Unique step identifier */
  id: string;

  /** Agent to execute */
  agent: string;

  /** Step description */
  description?: string;

  /** Input prompt (supports template variables like ${workflow.input}, ${stepId.output}) */
  input: string;

  /** Condition to execute this step (JavaScript expression) */
  when?: string;

  /** Step timeout in milliseconds */
  timeout?: number;

  /** Number of retry attempts on failure */
  retry?: number;
}

/**
 * Workflow execution context
 */
export interface WorkflowContext {
  /** Workflow name */
  workflowName: string;

  /** Original user input */
  input: string;

  /** Results from completed steps */
  stepResults: Map<string, WorkflowStepResult>;

  /** Current step index */
  currentStepIndex: number;

  /** Execution start time */
  startTime: number;

  /** Arbitrary metadata */
  metadata: Record<string, any>;
}

/**
 * Workflow step execution result
 */
export interface WorkflowStepResult {
  /** Step ID */
  stepId: string;

  /** Agent name that executed */
  agentName: string;

  /** Execution status */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

  /** Agent output */
  output: string;

  /** Error message if failed */
  error?: string;

  /** Start time */
  startTime: number;

  /** End time */
  endTime?: number;

  /** Extracted data for template variables */
  data?: Record<string, any>;
}

/**
 * Workflow execution result
 */
export interface WorkflowExecutionResult {
  /** Workflow name */
  workflowName: string;

  /** Overall execution status */
  status: 'completed' | 'failed' | 'timeout';

  /** All step results */
  steps: WorkflowStepResult[];

  /** Final aggregated output */
  output: string;

  /** Error message if failed */
  error?: string;

  /** Total execution duration in milliseconds */
  duration: number;
}

/**
 * Workflow list item (for display)
 */
export interface WorkflowListItem {
  /** Workflow name */
  name: string;

  /** Workflow title */
  title: string;

  /** Scope */
  scope: 'global' | 'project';

  /** File path */
  filePath: string;

  /** Last update time */
  updatedAt: Date;

  /** Number of steps */
  stepCount: number;
}

/**
 * Workflow error
 */
export class WorkflowError extends Error {
  constructor(
    message: string,
    public code:
      | 'WORKFLOW_NOT_FOUND'
      | 'INVALID_DEFINITION'
      | 'STEP_FAILED'
      | 'TIMEOUT'
      | 'AGENT_NOT_FOUND'
      | 'TEMPLATE_ERROR'
      | 'CONDITION_ERROR'
  ) {
    super(message);
    this.name = 'WorkflowError';
  }
}

/**
 * @license
 * Copyright 2025 Gemini CLI
 * SPDX-License-Identifier: MIT
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
}

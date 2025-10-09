/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Agents System - P1 Implementation
 *
 * Provides file-based agent definitions with isolated contexts,
 * tool whitelisting, and MCP integration.
 */

// Types
export type {
  AgentDefinition,
  AgentContext,
  AgentRuntime,
  AgentValidationResult,
  AgentExecuteOptions,
  AgentExecuteResponse,
  AgentCreateOptions,
  AgentListItem,
  AgentFrontMatter,
  RoutingConfig,
  RoutingScore,
  HandoffConfig,
  HandoffContext,
  WorkflowDefinition,
  WorkflowStep,
  WorkflowContext,
  WorkflowStepResult,
  WorkflowExecutionResult,
  WorkflowListItem,
} from './types.js';
export { HandoffError, WorkflowError } from './types.js';

// Core classes
export { AgentParser } from './AgentParser.js';
export { AgentValidator } from './AgentValidator.js';
export { AgentManager } from './AgentManager.js';
export { ContextManager } from './ContextManager.js';
export { ToolFilter } from './ToolFilter.js';
export { MCPRegistry } from './MCPRegistry.js';
export { AgentExecutor } from './AgentExecutor.js';
export { AgentContentGenerator } from './AgentContentGenerator.js';
export { AgentCreationSession, CreationStep } from './AgentCreationSession.js';
export type { GeneratedAgentContent } from './AgentContentGenerator.js';
export type { AgentCreationState } from './AgentCreationSession.js';

// P2: Routing and Handoff (Phase 1)
export { Router } from './Router.js';
export { RuleRouter } from './RuleRouter.js';
export { LLMRouter } from './LLMRouter.js';
export { HybridRouter } from './HybridRouter.js';
export { HandoffManager } from './HandoffManager.js';

// P2: Workflows (Phase 2)
export { WorkflowManager } from './WorkflowManager.js';
export { WorkflowExecutor } from './WorkflowExecutor.js';

// Tool Categories
export {
  ToolCategory,
  TOOL_CATEGORIES,
  getToolsForCategories,
  getCategoryForTool,
  requiresConfirmation,
  getCategoryDisplayText,
  DEFAULT_SAFE_CATEGORIES,
  ALL_CATEGORIES,
} from './ToolCategories.js';
export type { ToolCategoryDefinition } from './ToolCategories.js';

// Message Converter
export {
  convertGeminiToUnifiedMessages,
  convertContentToUnifiedMessage,
  convertUnifiedToGeminiContent,
} from './messageConverter.js';

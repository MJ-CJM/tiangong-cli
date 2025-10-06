/**
 * @license
 * Copyright 2025 Gemini CLI
 * SPDX-License-Identifier: MIT
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
} from './types.js';

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

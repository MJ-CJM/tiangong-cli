/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Supported model providers
 */
export enum ModelProvider {
  GEMINI = 'gemini',
  OPENAI = 'openai',
  CLAUDE = 'claude',
  CUSTOM = 'custom'
}

/**
 * Authentication types for different providers
 */
export enum AuthType {
  API_KEY = 'api-key',
  OAUTH = 'oauth',
  VERTEX_AI = 'vertex-ai',
  CUSTOM_AUTH = 'custom-auth'
}

/**
 * Configuration for a specific model provider
 */
export interface ModelConfig {
  /** The provider type */
  provider: ModelProvider;
  /** The specific model name */
  model: string;
  /** API key for authentication */
  apiKey?: string;
  /** Base URL for API endpoints */
  baseUrl?: string;
  /** Authentication type */
  authType?: AuthType;
  /** Custom headers for requests */
  customHeaders?: Record<string, string>;
  /** Additional provider-specific options */
  options?: Record<string, any>;
}

/**
 * Role types for conversation messages
 */
export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
  FUNCTION = 'function'
}

/**
 * Unified message content part
 */
export interface ContentPart {
  type: 'text' | 'image' | 'function_call' | 'function_response';
  text?: string;
  image?: {
    data: string;
    mimeType: string;
  };
  functionCall?: {
    name: string;
    args: Record<string, any>;
    id?: string;
  };
  functionResponse?: {
    name: string;
    content?: any;
    response?: any;
    id?: string;
  };
}

/**
 * Unified message format
 */
export interface UnifiedMessage {
  role: MessageRole;
  content: ContentPart[];
}

/**
 * Function/tool definition
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * Unified request format
 */
export interface UnifiedRequest {
  messages: UnifiedMessage[];
  tools?: ToolDefinition[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  systemMessage?: string;
}

/**
 * Usage statistics
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Unified response format
 */
export interface UnifiedResponse {
  content: ContentPart[];
  finishReason?: 'stop' | 'length' | 'function_call' | 'content_filter';
  usage?: TokenUsage;
  model?: string;
  metadata?: Record<string, any>;
}

/**
 * Token count response
 */
export interface TokenCountResponse {
  tokenCount: number;
}

/**
 * Embedding response
 */
export interface EmbeddingResponse {
  embeddings: number[][];
  usage?: TokenUsage;
}

/**
 * Streaming response chunk
 */
export interface StreamChunk {
  delta: Partial<UnifiedResponse>;
  done: boolean;
}

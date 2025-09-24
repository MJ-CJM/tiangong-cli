/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Export types
export type {
  ModelConfig,
  UnifiedRequest,
  UnifiedResponse,
  UnifiedMessage,
  ContentPart,
  ToolDefinition,
  TokenUsage,
  TokenCountResponse,
  EmbeddingResponse,
  StreamChunk
} from './types.js';

export {
  ModelProvider,
  AuthType,
  MessageRole
} from './types.js';

// Export base client
export type { BaseModelClient } from './baseModelClient.js';
export { AbstractModelClient } from './baseModelClient.js';

// Export errors
export {
  ModelAdapterError,
  AuthenticationError,
  QuotaExceededError,
  ModelNotFoundError,
  InvalidRequestError,
  ServiceUnavailableError,
  ContentFilterError,
  createErrorFromResponse
} from './errors.js';
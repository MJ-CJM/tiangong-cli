/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  UnifiedRequest,
  UnifiedResponse,
  TokenCountResponse,
  EmbeddingResponse,
  StreamChunk,
  ModelConfig
} from './types.js';

/**
 * Base interface for all model clients
 * This interface abstracts the differences between various AI model providers
 */
export interface BaseModelClient {
  /**
   * The configuration for this model client
   */
  readonly config: ModelConfig;

  /**
   * Generate content using the model
   */
  generateContent(request: UnifiedRequest): Promise<UnifiedResponse>;

  /**
   * Generate content with streaming response
   */
  generateContentStream(request: UnifiedRequest): AsyncGenerator<StreamChunk>;

  /**
   * Count tokens for the given request
   */
  countTokens(request: UnifiedRequest): Promise<TokenCountResponse>;

  /**
   * Generate embeddings (optional, not all providers support this)
   */
  embedContent?(request: { text: string }): Promise<EmbeddingResponse>;

  /**
   * Validate that the client is properly configured and can make requests
   */
  validate(): Promise<boolean>;

  /**
   * Get the list of available models for this provider
   */
  getAvailableModels?(): Promise<string[]>;
}

/**
 * Abstract base class providing common functionality for model clients
 */
export abstract class AbstractModelClient implements BaseModelClient {
  constructor(readonly config: ModelConfig) {}

  abstract generateContent(request: UnifiedRequest): Promise<UnifiedResponse>;
  abstract generateContentStream(request: UnifiedRequest): AsyncGenerator<StreamChunk>;
  abstract countTokens(request: UnifiedRequest): Promise<TokenCountResponse>;
  abstract validate(): Promise<boolean>;

  /**
   * Default implementation for embedding content
   * Override in subclasses that support embeddings
   */
  async embedContent?(request: { text: string }): Promise<EmbeddingResponse> {
    throw new Error(`Embedding not supported by ${this.config.provider} provider`);
  }

  /**
   * Get the effective API key from config or environment
   */
  protected getApiKey(): string {
    if (this.config.apiKey) {
      return this.config.apiKey;
    }

    // Try common environment variable patterns
    const envVars = [
      `${this.config.provider.toUpperCase()}_API_KEY`,
      `${this.config.provider.toUpperCase()}_KEY`,
      'API_KEY'
    ];

    for (const envVar of envVars) {
      const value = process.env[envVar];
      if (value) {
        return value;
      }
    }

    throw new Error(`No API key found for ${this.config.provider} provider`);
  }

  /**
   * Get the effective base URL
   */
  protected getBaseUrl(): string {
    if (this.config.baseUrl) {
      return this.config.baseUrl;
    }

    throw new Error(`No base URL configured for ${this.config.provider} provider`);
  }

  /**
   * Get request headers with authentication
   */
  protected getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.customHeaders
    };

    // Add authentication header based on auth type
    if (this.config.authType === 'api-key') {
      headers['Authorization'] = `Bearer ${this.getApiKey()}`;
    }

    return headers;
  }
}
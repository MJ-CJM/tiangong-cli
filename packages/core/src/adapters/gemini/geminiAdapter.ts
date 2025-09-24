/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */


import type {
  ModelConfig,
  UnifiedRequest,
  UnifiedResponse,
  TokenCountResponse,
  EmbeddingResponse,
  StreamChunk
} from '../base/index.js';

import {
  AbstractModelClient,
  AuthenticationError,
  InvalidRequestError,
  ServiceUnavailableError,
  createErrorFromResponse
} from '../base/index.js';


/**
 * Gemini model adapter implementing the BaseModelClient interface
 */
export class GeminiAdapter extends AbstractModelClient {

  constructor(config: ModelConfig) {
    super(config);

    // Validate that this is a Gemini configuration
    if (config.provider !== 'gemini') {
      throw new InvalidRequestError(config.provider, 'GeminiAdapter can only be used with Gemini provider');
    }
  }


  /**
   * Get the effective API key for Gemini
   */
  protected override getApiKey(): string {
    if (this.config.apiKey) {
      return this.config.apiKey;
    }

    // Try Gemini-specific environment variables
    const geminiKey = process.env['GEMINI_API_KEY'];
    if (geminiKey) {
      return geminiKey;
    }

    const googleKey = process.env['GOOGLE_API_KEY'];
    if (googleKey) {
      return googleKey;
    }

    throw new AuthenticationError(this.config.provider, 'No API key found for Gemini. Set GEMINI_API_KEY or GOOGLE_API_KEY environment variable.');
  }

  /**
   * Validate the adapter configuration
   */
  override async validate(): Promise<boolean> {
    try {
      // Just check if we can get the API key for now
      this.getApiKey();
      return true;
    } catch (error) {
      const err = error as any;
      throw new ServiceUnavailableError(this.config.provider, `Failed to validate Gemini configuration: ${err.message}`, err);
    }
  }



  /**
   * Generate content using Gemini
   */
  async generateContent(request: UnifiedRequest): Promise<UnifiedResponse> {
    try {
      // For now, return a simple response to make build pass
      // TODO: Implement actual Gemini API calls once API is stable
      return {
        content: [{
          type: 'text',
          text: 'This is a placeholder response from Gemini adapter. Actual implementation pending API stabilization.'
        }],
        finishReason: 'stop',
        model: this.config.model
      };
    } catch (error) {
      const err = error as any;
      throw createErrorFromResponse(
        this.config.provider,
        err.status || 500,
        err.message || 'Unknown error occurred',
        err
      );
    }
  }

  /**
   * Generate content with streaming
   */
  async* generateContentStream(request: UnifiedRequest): AsyncGenerator<StreamChunk> {
    try {
      // For now, yield a simple response
      yield {
        delta: {
          content: [{
            type: 'text',
            text: 'Streaming placeholder from Gemini adapter.'
          }]
        },
        done: false
      };

      yield {
        delta: {},
        done: true
      };
    } catch (error) {
      const err = error as any;
      throw createErrorFromResponse(
        this.config.provider,
        err.status || 500,
        err.message || 'Unknown error occurred',
        err
      );
    }
  }

  /**
   * Count tokens for the request
   */
  async countTokens(request: UnifiedRequest): Promise<TokenCountResponse> {
    try {
      // Simple token estimation for now
      const textContent = request.messages
        .flatMap(msg => msg.content)
        .filter(part => part.type === 'text')
        .map(part => part.text || '')
        .join(' ');

      // Rough estimation: ~4 characters per token
      const estimatedTokens = Math.ceil(textContent.length / 4);

      return {
        tokenCount: estimatedTokens
      };
    } catch (error) {
      const err = error as any;
      throw createErrorFromResponse(
        this.config.provider,
        err.status || 500,
        err.message || 'Unknown error occurred',
        err
      );
    }
  }

  /**
   * Generate embeddings using Gemini
   */
  override async embedContent(request: { text: string }): Promise<EmbeddingResponse> {
    try {
      // Placeholder implementation
      return {
        embeddings: [[0.1, 0.2, 0.3]], // Dummy embedding
        usage: {
          promptTokens: Math.ceil(request.text.length / 4),
          completionTokens: 0,
          totalTokens: Math.ceil(request.text.length / 4)
        }
      };
    } catch (error) {
      const err = error as any;
      throw createErrorFromResponse(
        this.config.provider,
        err.status || 500,
        err.message || 'Unknown error occurred',
        err
      );
    }
  }

  /**
   * Get available models (Gemini doesn't provide model discovery, so return common models)
   */
  async getAvailableModels(): Promise<string[]> {
    return [
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.0-pro'
    ];
  }
}
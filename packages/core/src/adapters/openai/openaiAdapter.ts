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

import { APITranslator } from '../utils/apiTranslator.js';

/**
 * OpenAI model adapter implementing the BaseModelClient interface
 */
export class OpenAIAdapter extends AbstractModelClient {
  private readonly defaultBaseUrl = 'https://api.openai.com/v1';

  constructor(config: ModelConfig) {
    super(config);

    // Validate that this is an OpenAI configuration
    if (config.provider !== 'openai') {
      throw new InvalidRequestError(config.provider, 'OpenAIAdapter can only be used with OpenAI provider');
    }
  }

  /**
   * Get the effective base URL for OpenAI API
   */
  protected override getBaseUrl(): string {
    return this.config.baseUrl || this.defaultBaseUrl;
  }

  /**
   * Get the effective API key for OpenAI
   */
  protected override getApiKey(): string {
    if (this.config.apiKey) {
      return this.config.apiKey;
    }

    const openaiKey = process.env['OPENAI_API_KEY'];
    if (openaiKey) {
      return openaiKey;
    }

    throw new AuthenticationError(this.config.provider, 'No API key found for OpenAI. Set OPENAI_API_KEY environment variable.');
  }

  /**
   * Make an HTTP request to OpenAI API
   */
  private async makeRequest(endpoint: string, body: any, options: { stream?: boolean } = {}): Promise<any> {
    const url = `${this.getBaseUrl()}${endpoint}`;
    const headers = this.getHeaders();

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = errorText;

      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorData.message || errorText;
      } catch {
        // Use raw text if JSON parsing fails
      }

      throw createErrorFromResponse(
        this.config.provider,
        response.status,
        errorMessage
      );
    }

    if (options.stream) {
      return response; // Return the response object for streaming
    }

    return response.json();
  }

  /**
   * Validate the adapter configuration
   */
  override async validate(): Promise<boolean> {
    try {
      // Try to list models to validate the API key
      await this.makeRequest('/models', {}, {});
      return true;
    } catch (error) {
      const err = error as any;

      if (err.statusCode === 401 || err.statusCode === 403) {
        throw new AuthenticationError(this.config.provider, 'Invalid API key or insufficient permissions', err);
      }

      throw new ServiceUnavailableError(this.config.provider, `Failed to validate OpenAI configuration: ${err.message}`, err);
    }
  }

  /**
   * Generate content using OpenAI
   */
  async generateContent(request: UnifiedRequest): Promise<UnifiedResponse> {
    try {
      const openaiRequest = APITranslator.unifiedToOpenaiRequest(request);
      openaiRequest.model = this.config.model;

      const response = await this.makeRequest('/chat/completions', openaiRequest);

      return APITranslator.openaiResponseToUnified(response);
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error) {
        throw error; // Re-throw adapter errors
      }

      throw new ServiceUnavailableError(
        this.config.provider,
        `OpenAI request failed: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Generate content with streaming
   */
  async* generateContentStream(request: UnifiedRequest): AsyncGenerator<StreamChunk> {
    try {
      const openaiRequest = APITranslator.unifiedToOpenaiRequest(request);
      openaiRequest.model = this.config.model;
      openaiRequest.stream = true;

      const response = await this.makeRequest('/chat/completions', openaiRequest, { stream: true });

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body available');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            yield {
              delta: {},
              done: true
            };
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep the last incomplete line in buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === '') continue;
            if (trimmed === 'data: [DONE]') {
              yield {
                delta: {},
                done: true
              };
              return;
            }

            if (trimmed.startsWith('data: ')) {
              try {
                const jsonStr = trimmed.substring(6);
                const chunk = JSON.parse(jsonStr);

                const unifiedResponse = APITranslator.openaiResponseToUnified(chunk);

                yield {
                  delta: unifiedResponse,
                  done: false
                };
              } catch (parseError) {
                // Skip malformed chunks
                continue;
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error) {
        throw error; // Re-throw adapter errors
      }

      throw new ServiceUnavailableError(
        this.config.provider,
        `OpenAI streaming request failed: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Count tokens for the request (approximate, as OpenAI doesn't provide exact token counting)
   */
  async countTokens(request: UnifiedRequest): Promise<TokenCountResponse> {
    // OpenAI doesn't provide a direct token counting API
    // We'll use a rough estimation based on text length
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
  }

  /**
   * Generate embeddings using OpenAI
   */
  override async embedContent(request: { text: string }): Promise<EmbeddingResponse> {
    try {
      const embeddingRequest = {
        model: this.config.options?.['embeddingModel'] || 'text-embedding-3-small',
        input: request.text
      };

      const response = await this.makeRequest('/embeddings', embeddingRequest);

      const embeddings = response.data?.map((item: any) => item.embedding) || [];

      return {
        embeddings,
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: 0,
          totalTokens: response.usage.total_tokens
        } : undefined
      };
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error) {
        throw error; // Re-throw adapter errors
      }

      throw new ServiceUnavailableError(
        this.config.provider,
        `OpenAI embedding request failed: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Get available models from OpenAI
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await this.makeRequest('/models', {});

      const models = response.data?.map((model: any) => model.id) || [];

      // Filter to only chat completion models
      return models.filter((model: string) =>
        model.includes('gpt') ||
        model.includes('o1') ||
        model.includes('claude') // In case using OpenAI-compatible endpoint
      );
    } catch (error) {
      // Return common models if API call fails
      return [
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'gpt-4',
        'gpt-3.5-turbo',
        'o1-preview',
        'o1-mini'
      ];
    }
  }
}
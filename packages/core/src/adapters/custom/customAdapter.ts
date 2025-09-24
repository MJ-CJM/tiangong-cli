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
  createErrorFromResponse,
  MessageRole
} from '../base/index.js';

import { APITranslator } from '../utils/apiTranslator.js';

/**
 * Response format options for custom adapters
 */
export enum CustomResponseFormat {
  OPENAI = 'openai',
  CLAUDE = 'claude',
  RAW = 'raw'
}

/**
 * Custom model adapter for self-deployed models and OpenAI-compatible APIs
 */
export class CustomAdapter extends AbstractModelClient {
  private responseFormat: CustomResponseFormat;

  constructor(config: ModelConfig) {
    super(config);

    // Validate that this is a custom configuration
    if (config.provider !== 'custom') {
      throw new InvalidRequestError(config.provider, 'CustomAdapter can only be used with custom provider');
    }

    // Determine response format from config
    this.responseFormat = (config.options?.['responseFormat'] as CustomResponseFormat) || CustomResponseFormat.OPENAI;
  }

  /**
   * Get the effective API key for the custom provider
   */
  protected override getApiKey(): string {
    if (this.config.apiKey) {
      return this.config.apiKey;
    }

    // Try common custom environment variables
    const customKey = process.env['CUSTOM_API_KEY'] ||
                     process.env['LOCAL_API_KEY'] ||
                     process.env['API_KEY'];

    if (customKey) {
      return customKey;
    }

    // Custom providers might not require API keys (local deployments)
    return '';
  }

  /**
   * Get request headers with authentication
   */
  protected override getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.customHeaders
    };

    const apiKey = this.getApiKey();
    if (apiKey) {
      // Use Authorization header by default, but allow custom auth via headers
      if (!headers['Authorization'] && !headers['authorization']) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
    }

    return headers;
  }

  /**
   * Make an HTTP request to the custom API
   */
  private async makeRequest(endpoint: string, body: any, options: { stream?: boolean } = {}): Promise<any> {
    const baseUrl = this.getBaseUrl();
    const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
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
   * Convert custom response to UnifiedResponse based on response format
   */
  private convertResponse(response: any): UnifiedResponse {
    switch (this.responseFormat) {
      case CustomResponseFormat.OPENAI:
        return APITranslator.openaiResponseToUnified(response);

      case CustomResponseFormat.CLAUDE:
        return this.convertClaudeResponse(response);

      case CustomResponseFormat.RAW:
      default:
        return this.convertRawResponse(response);
    }
  }

  /**
   * Convert Claude-style response to UnifiedResponse
   */
  private convertClaudeResponse(response: any): UnifiedResponse {
    const content = response.content?.map((item: any) => {
      if (item.type === 'text') {
        return { type: 'text' as const, text: item.text };
      }
      return { type: 'text' as const, text: '' };
    }) || [];

    return {
      content,
      finishReason: response.stop_reason === 'end_turn' ? 'stop' :
                   response.stop_reason === 'max_tokens' ? 'length' :
                   'stop',
      usage: response.usage ? {
        promptTokens: response.usage.input_tokens || 0,
        completionTokens: response.usage.output_tokens || 0,
        totalTokens: (response.usage.input_tokens || 0) + (response.usage.output_tokens || 0)
      } : undefined,
      model: response.model
    };
  }

  /**
   * Convert raw/unknown response to UnifiedResponse
   */
  private convertRawResponse(response: any): UnifiedResponse {
    // Try to handle common response structures
    let text = '';

    if (typeof response === 'string') {
      text = response;
    } else if (response.text) {
      text = response.text;
    } else if (response.content) {
      text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    } else if (response.message) {
      text = response.message;
    } else if (response.response) {
      text = response.response;
    } else {
      text = JSON.stringify(response);
    }

    return {
      content: [{ type: 'text', text }],
      finishReason: 'stop',
      model: this.config.model
    };
  }

  /**
   * Validate the adapter configuration
   */
  override async validate(): Promise<boolean> {
    try {
      // For custom adapters, we'll try a simple health check or test request
      const testEndpoint = this.config.options?.['healthEndpoint'] || '/health';

      try {
        const response = await fetch(`${this.getBaseUrl()}${testEndpoint}`, {
          method: 'GET',
          headers: this.getHeaders()
        });

        if (response.ok) {
          return true;
        }
      } catch {
        // Health check failed, try a simple completion
      }

      // Try a minimal completion request
      const testRequest = this.convertRequest({
        messages: [{ role: MessageRole.USER, content: [{ type: 'text', text: 'Hi' }] }],
        model: this.config.model,
        maxTokens: 1
      });

      await this.makeRequest('/chat/completions', testRequest);
      return true;
    } catch (error) {
      const err = error as any;

      if (err.statusCode === 401 || err.statusCode === 403) {
        throw new AuthenticationError(this.config.provider, 'Invalid API key or insufficient permissions', err);
      }

      throw new ServiceUnavailableError(this.config.provider, `Failed to validate custom configuration: ${err.message}`, err);
    }
  }

  /**
   * Convert UnifiedRequest based on response format
   */
  private convertRequest(request: UnifiedRequest): any {
    switch (this.responseFormat) {
      case CustomResponseFormat.OPENAI:
        const openaiRequest = APITranslator.unifiedToOpenaiRequest(request);
        openaiRequest.model = this.config.model;
        return openaiRequest;

      case CustomResponseFormat.CLAUDE:
        return this.convertToClaudeRequest(request);

      case CustomResponseFormat.RAW:
      default:
        return this.convertToRawRequest(request);
    }
  }

  /**
   * Convert to Claude-style request
   */
  private convertToClaudeRequest(request: UnifiedRequest): any {
    const messages = request.messages.map(msg => ({
      role: msg.role === MessageRole.ASSISTANT ? 'assistant' : 'user',
      content: msg.content.map(part => {
        if (part.type === 'text') {
          return { type: 'text', text: part.text };
        }
        return { type: 'text', text: '' };
      })
    }));

    const result: any = {
      model: this.config.model,
      messages
    };

    if (request.systemMessage) {
      result.system = request.systemMessage;
    }

    if (request.maxTokens) {
      result.max_tokens = request.maxTokens;
    }

    if (request.temperature !== undefined) {
      result.temperature = request.temperature;
    }

    return result;
  }

  /**
   * Convert to raw/simple request format
   */
  private convertToRawRequest(request: UnifiedRequest): any {
    const text = request.messages
      .flatMap(msg => msg.content)
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join('\n');

    return {
      model: this.config.model,
      prompt: text,
      max_tokens: request.maxTokens,
      temperature: request.temperature
    };
  }

  /**
   * Generate content using the custom API
   */
  async generateContent(request: UnifiedRequest): Promise<UnifiedResponse> {
    try {
      const customRequest = this.convertRequest(request);
      const endpoint = this.config.options?.['completionEndpoint'] || '/chat/completions';

      const response = await this.makeRequest(endpoint, customRequest);

      return this.convertResponse(response);
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error) {
        throw error; // Re-throw adapter errors
      }

      throw new ServiceUnavailableError(
        this.config.provider,
        `Custom API request failed: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Generate content with streaming
   */
  async* generateContentStream(request: UnifiedRequest): AsyncGenerator<StreamChunk> {
    try {
      const customRequest = this.convertRequest(request);
      const endpoint = this.config.options?.['completionEndpoint'] || '/chat/completions';

      // Add stream parameter based on format
      if (this.responseFormat === CustomResponseFormat.OPENAI) {
        customRequest.stream = true;
      }

      const response = await this.makeRequest(endpoint, customRequest, { stream: true });

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

                const unifiedResponse = this.convertResponse(chunk);

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
        `Custom API streaming request failed: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Count tokens for the request (estimate)
   */
  async countTokens(request: UnifiedRequest): Promise<TokenCountResponse> {
    // For custom APIs, we'll use the same estimation as OpenAI
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
   * Generate embeddings (if supported by the custom API)
   */
  override async embedContent(request: { text: string }): Promise<EmbeddingResponse> {
    try {
      const embeddingRequest = {
        model: this.config.options?.['embeddingModel'] || this.config.model,
        input: request.text
      };

      const endpoint = this.config.options?.['embeddingEndpoint'] || '/embeddings';
      const response = await this.makeRequest(endpoint, embeddingRequest);

      // Try to handle OpenAI-style embedding response
      if (response.data && Array.isArray(response.data)) {
        const embeddings = response.data.map((item: any) => item.embedding);
        return {
          embeddings,
          usage: response.usage ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: 0,
            totalTokens: response.usage.total_tokens
          } : undefined
        };
      }

      // Handle raw embedding response
      if (Array.isArray(response)) {
        return {
          embeddings: [response]
        };
      }

      throw new Error('Unexpected embedding response format');
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error) {
        throw error; // Re-throw adapter errors
      }

      throw new ServiceUnavailableError(
        this.config.provider,
        `Custom API embedding request failed: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Get available models (if supported by the custom API)
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const endpoint = this.config.options?.['modelsEndpoint'] || '/models';
      const response = await this.makeRequest(endpoint, {});

      if (response.data && Array.isArray(response.data)) {
        return response.data.map((model: any) => model.id || model.name);
      }

      if (Array.isArray(response)) {
        return response;
      }

      // Return the configured model if discovery fails
      return [this.config.model];
    } catch (error) {
      // Return the configured model if discovery fails
      return [this.config.model];
    }
  }
}
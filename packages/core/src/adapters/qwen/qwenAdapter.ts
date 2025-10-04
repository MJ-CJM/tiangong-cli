/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AbstractModelClient } from '../base/baseModelClient.js';
import type { ModelConfig, UnifiedRequest, UnifiedResponse } from '../base/types.js';
import { ModelProvider, AuthenticationError } from '../base/index.js';
import { APITranslator } from '../utils/apiTranslator.js';
import { createErrorFromResponse } from '../base/errors.js';

/**
 * Qwen adapter - uses OpenAI-compatible API
 * Qwen's DashScope API is compatible with OpenAI's API format
 */
export class QwenAdapter extends AbstractModelClient {
  private readonly defaultBaseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

  constructor(config: ModelConfig) {
    super(config);

    // Validate that this is a Qwen configuration
    if (config.provider !== ModelProvider.QWEN) {
      throw new Error('QwenAdapter can only be used with Qwen provider');
    }
  }

  /**
   * Get the effective base URL for Qwen API
   */
  protected override getBaseUrl(): string {
    return this.config.baseUrl || this.defaultBaseUrl;
  }

  /**
   * Get the effective API key for Qwen
   */
  protected override getApiKey(): string {
    if (this.config.apiKey) {
      return this.config.apiKey;
    }

    const qwenKey = process.env['QWEN_CODER_API_KEY'] || process.env['QWEN_API_KEY'] || process.env['DASHSCOPE_API_KEY'];
    if (qwenKey) {
      return qwenKey;
    }

    throw new AuthenticationError(this.config.provider, 'No API key found for Qwen. Set QWEN_CODER_API_KEY environment variable.');
  }

  /**
   * Make an HTTP request to Qwen API (OpenAI-compatible)
   */
  private async makeRequest(endpoint: string, body: any): Promise<any> {
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

    return response.json();
  }

  /**
   * Generate content using Qwen API
   */
  async generateContent(request: UnifiedRequest): Promise<UnifiedResponse> {
    const openaiRequest = APITranslator.unifiedToOpenaiRequest(request);
    const response = await this.makeRequest('/chat/completions', openaiRequest);
    return APITranslator.openaiResponseToUnified(response);
  }

  /**
   * Generate content with streaming
   */
  async* generateContentStream(request: UnifiedRequest): AsyncGenerator<any> {
    const openaiRequest = {
      ...APITranslator.unifiedToOpenaiRequest(request),
      model: this.config.model,
      stream: true
    };

    const url = `${this.getBaseUrl()}/chat/completions`;
    const headers = this.getHeaders();

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(openaiRequest)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw createErrorFromResponse(this.config.provider, response.status, errorText);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
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
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;

          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              const choice = data.choices?.[0];

              if (choice) {
                yield {
                  delta: {
                    content: choice.delta?.content || '',
                    role: choice.delta?.role,
                    toolCalls: choice.delta?.tool_calls
                  },
                  done: false,
                  finishReason: choice.finish_reason
                };
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Validate the adapter configuration
   */
  async validate(): Promise<boolean> {
    try {
      // Simple validation: check if API key exists
      this.getApiKey();
      return true;
    } catch (error) {
      throw new AuthenticationError(
        this.config.provider,
        'No API key found for Qwen. Set QWEN_CODER_API_KEY environment variable.',
        error as Error
      );
    }
  }

  /**
   * Count tokens for a request (Qwen doesn't have a native tokenizer API)
   */
  async countTokens(request: any): Promise<any> {
    // Rough estimation: 1 token ≈ 4 characters for Chinese/English mix
    const text = JSON.stringify(request.messages || request);
    const estimatedTokens = Math.ceil(text.length / 4);

    return {
      totalTokens: estimatedTokens,
      promptTokens: estimatedTokens,
      completionTokens: 0
    };
  }

  /**
   * Get available Qwen models
   */
  async getAvailableModels(): Promise<string[]> {
    // Common Qwen models
    return [
      'qwen-coder-turbo',
      'qwen-max',
      'qwen-plus',
      'qwen-turbo',
      'qwen-long',
      'qwen3-coder-flash',
      'qwen-coder-plus',
    ];
  }
}

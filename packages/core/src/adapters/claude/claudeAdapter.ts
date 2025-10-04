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
  StreamChunk,
  ContentPart
} from '../base/index.js';

import {
  AbstractModelClient,
  AuthenticationError,
  InvalidRequestError,
  ServiceUnavailableError,
  createErrorFromResponse
} from '../base/index.js';

/**
 * Claude model adapter implementing the BaseModelClient interface
 */
export class ClaudeAdapter extends AbstractModelClient {
  private readonly defaultBaseUrl = 'https://api.anthropic.com/v1';

  constructor(config: ModelConfig) {
    super(config);

    // Validate that this is a Claude configuration
    if (config.provider !== 'claude') {
      throw new InvalidRequestError(config.provider, 'ClaudeAdapter can only be used with Claude provider');
    }
  }

  /**
   * Get the effective base URL for Claude API
   */
  protected override getBaseUrl(): string {
    return this.config.baseUrl || this.defaultBaseUrl;
  }

  /**
   * Get the effective API key for Claude
   */
  protected override getApiKey(): string {
    if (this.config.apiKey) {
      return this.config.apiKey;
    }

    const claudeKey = process.env['CLAUDE_API_KEY'] || process.env['ANTHROPIC_API_KEY'];
    if (claudeKey) {
      return claudeKey;
    }

    throw new AuthenticationError(this.config.provider, 'No API key found for Claude. Set CLAUDE_API_KEY or ANTHROPIC_API_KEY environment variable.');
  }

  /**
   * Get request headers for Claude API
   */
  protected override getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.getApiKey(),
      'anthropic-version': '2023-06-01',
      ...this.config.customHeaders
    };
  }

  /**
   * Convert UnifiedRequest to Claude format
   */
  private convertRequest(request: UnifiedRequest): any {
    const messages: any[] = [];
    let systemMessage = request.systemMessage;

    // Convert messages
    for (const msg of request.messages) {
      if (msg.role === 'system') {
        // Claude handles system messages separately
        systemMessage = msg.content.find(part => part.type === 'text')?.text || systemMessage;
        continue;
      }

      const role = msg.role === 'user' ? 'user' :
                   msg.role === 'assistant' ? 'assistant' :
                   'user'; // Default to user for function messages

      const content: any[] = [];

      for (const part of msg.content) {
        switch (part.type) {
          case 'text':
            content.push({
              type: 'text',
              text: part.text
            });
            break;
          case 'image':
            content.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: part.image?.mimeType || 'image/jpeg',
                data: part.image?.data?.replace(/^data:.*?;base64,/, '') || ''
              }
            });
            break;
          case 'function_call':
            // Claude uses tool_use format
            content.push({
              type: 'tool_use',
              id: part.functionCall?.id || `tool_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              name: part.functionCall?.name,
              input: part.functionCall?.args
            });
            break;
          case 'function_response':
            // Claude uses tool_result format
            content.push({
              type: 'tool_result',
              tool_use_id: part.functionResponse?.id || `tool_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              content: JSON.stringify(part.functionResponse?.content)
            });
            break;
        }
      }

      if (content.length > 0) {
        messages.push({ role, content });
      }
    }

    const result: any = {
      model: this.config.model,
      messages
    };

    if (systemMessage) {
      result.system = systemMessage;
    }

    if (request.maxTokens) {
      result.max_tokens = request.maxTokens;
    }

    if (request.temperature !== undefined) {
      result.temperature = request.temperature;
    }

    // Handle tools
    if (request.tools && request.tools.length > 0) {
      result.tools = request.tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters
      }));
    }

    return result;
  }

  /**
   * Convert Claude response to UnifiedResponse
   */
  private convertResponse(response: any): UnifiedResponse {
    const content: ContentPart[] = [];

    if (response.content) {
      for (const item of response.content) {
        switch (item.type) {
          case 'text':
            content.push({
              type: 'text',
              text: item.text
            });
            break;
          case 'tool_use':
            content.push({
              type: 'function_call',
              functionCall: {
                name: item.name,
                args: item.input
              }
            });
            break;
        }
      }
    }

    return {
      content,
      finishReason: response.stop_reason === 'end_turn' ? 'stop' :
                   response.stop_reason === 'max_tokens' ? 'length' :
                   response.stop_reason === 'tool_use' ? 'function_call' :
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
   * Make an HTTP request to Claude API
   */
  private async makeRequest(endpoint: string, body: any, options: { stream?: boolean } = {}): Promise<any> {
    const url = `${this.getBaseUrl()}${endpoint}`;
    const headers = this.getHeaders();

    if (options.stream) {
      headers['Accept'] = 'text/event-stream';
      body.stream = true;
    }

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
      // Try a simple completion to validate the API key
      const testRequest = {
        model: this.config.model,
        messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        max_tokens: 1
      };

      await this.makeRequest('/messages', testRequest);
      return true;
    } catch (error) {
      const err = error as any;

      if (err.statusCode === 401 || err.statusCode === 403) {
        throw new AuthenticationError(this.config.provider, 'Invalid API key or insufficient permissions', err);
      }

      throw new ServiceUnavailableError(this.config.provider, `Failed to validate Claude configuration: ${err.message}`, err);
    }
  }

  /**
   * Generate content using Claude
   */
  async generateContent(request: UnifiedRequest): Promise<UnifiedResponse> {
    try {
      const claudeRequest = this.convertRequest(request);

      const response = await this.makeRequest('/messages', claudeRequest);

      return this.convertResponse(response);
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error) {
        throw error; // Re-throw adapter errors
      }

      throw new ServiceUnavailableError(
        this.config.provider,
        `Claude request failed: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Generate content with streaming
   */
  async* generateContentStream(request: UnifiedRequest): AsyncGenerator<StreamChunk> {
    try {
      const claudeRequest = this.convertRequest(request);

      const response = await this.makeRequest('/messages', claudeRequest, { stream: true });

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

            if (trimmed.startsWith('data: ')) {
              try {
                const jsonStr = trimmed.substring(6);

                if (jsonStr === '[DONE]') {
                  yield {
                    delta: {},
                    done: true
                  };
                  return;
                }

                const chunk = JSON.parse(jsonStr);

                // Handle different Claude streaming event types
                if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
                  const unifiedResponse: UnifiedResponse = {
                    content: [{
                      type: 'text',
                      text: chunk.delta.text
                    }]
                  };

                  yield {
                    delta: unifiedResponse,
                    done: false
                  };
                } else if (chunk.type === 'message_stop') {
                  yield {
                    delta: {},
                    done: true
                  };
                  return;
                }
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
        `Claude streaming request failed: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Count tokens for the request (approximate, as Claude doesn't provide exact token counting)
   */
  async countTokens(request: UnifiedRequest): Promise<TokenCountResponse> {
    // Claude doesn't provide a direct token counting API
    // We'll use a rough estimation based on text length
    const textContent = request.messages
      .flatMap(msg => msg.content)
      .filter(part => part.type === 'text')
      .map(part => part.text || '')
      .join(' ');

    // Rough estimation: ~4 characters per token (similar to OpenAI)
    const estimatedTokens = Math.ceil(textContent.length / 4);

    return {
      tokenCount: estimatedTokens
    };
  }

  /**
   * Claude doesn't support embeddings
   */
  override async embedContent(request: { text: string }): Promise<EmbeddingResponse> {
    throw new InvalidRequestError(
      this.config.provider,
      'Claude does not support embedding generation. Use a different provider for embeddings.'
    );
  }

  /**
   * Get available Claude models
   */
  async getAvailableModels(): Promise<string[]> {
    // Claude doesn't provide model discovery, return known models
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-sonnet-20240620',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307'
    ];
  }
}
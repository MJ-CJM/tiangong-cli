/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Content,
  GenerateContentConfig,
  Part,
  EmbedContentParameters,
  GenerateContentResponse,
} from '@google/genai';
import type { Config } from '../config/config.js';
import type { ContentGenerator } from './contentGenerator.js';
import { getResponseText } from '../utils/partUtils.js';
import { reportError } from '../utils/errorReporting.js';
import { getErrorMessage } from '../utils/errors.js';
import { logMalformedJsonResponse } from '../telemetry/loggers.js';
import { MalformedJsonResponseEvent } from '../telemetry/types.js';
import { retryWithBackoff } from '../utils/retry.js';
import { ModelService } from '../services/modelService.js';
import type { UnifiedRequest, MessageRole } from '../adapters/base/types.js';

const DEFAULT_MAX_ATTEMPTS = 5;

/**
 * Options for the generateJson utility function.
 */
export interface GenerateJsonOptions {
  /** The input prompt or history. */
  contents: Content[];
  /** The required JSON schema for the output. */
  schema: Record<string, unknown>;
  /** The specific model to use for this task. */
  model: string;
  /**
   * Task-specific system instructions.
   * If omitted, no system instruction is sent.
   */
  systemInstruction?: string | Part | Part[] | Content;
  /**
   * Overrides for generation configuration (e.g., temperature).
   */
  config?: Omit<
    GenerateContentConfig,
    | 'systemInstruction'
    | 'responseJsonSchema'
    | 'responseMimeType'
    | 'tools'
    | 'abortSignal'
  >;
  /** Signal for cancellation. */
  abortSignal: AbortSignal;
  /**
   * A unique ID for the prompt, used for logging/telemetry correlation.
   */
  promptId: string;
  /**
   * The maximum number of attempts for the request.
   */
  maxAttempts?: number;
}

/**
 * A client dedicated to stateless, utility-focused LLM calls.
 */
export class BaseLlmClient {
  // Default configuration for utility tasks
  private readonly defaultUtilityConfig: GenerateContentConfig = {
    temperature: 0,
    topP: 1,
  };

  constructor(
    private readonly contentGenerator: ContentGenerator,
    private readonly config: Config,
  ) {}

  async generateJson(
    options: GenerateJsonOptions,
  ): Promise<Record<string, unknown>> {
    const {
      contents,
      schema,
      model,
      abortSignal,
      systemInstruction,
      promptId,
      maxAttempts,
    } = options;

    // If model router is enabled, use ModelService instead
    if (this.config.getUseModelRouter()) {
      return this.generateJsonWithModelRouter(options);
    }

    const requestConfig: GenerateContentConfig = {
      abortSignal,
      ...this.defaultUtilityConfig,
      ...options.config,
      ...(systemInstruction && { systemInstruction }),
      responseJsonSchema: schema,
      responseMimeType: 'application/json',
    };

    try {
      const apiCall = () =>
        this.contentGenerator.generateContent(
          {
            model,
            config: requestConfig,
            contents,
          },
          promptId,
        );

      const shouldRetryOnContent = (response: GenerateContentResponse) => {
        const text = getResponseText(response)?.trim();
        if (!text) {
          return true; // Retry on empty response
        }
        try {
          JSON.parse(this.cleanJsonResponse(text, model));
          return false;
        } catch (_e) {
          return true;
        }
      };

      const result = await retryWithBackoff(apiCall, {
        shouldRetryOnContent,
        maxAttempts: maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      });

      // If we are here, the content is valid (not empty and parsable).
      return JSON.parse(
        this.cleanJsonResponse(getResponseText(result)!.trim(), model),
      );
    } catch (error) {
      if (abortSignal.aborted) {
        throw error;
      }

      // Check if the error is from exhausting retries, and report accordingly.
      if (
        error instanceof Error &&
        error.message.includes('Retry attempts exhausted')
      ) {
        await reportError(
          error,
          'API returned invalid content (empty or unparsable JSON) after all retries.',
          contents,
          'generateJson-invalid-content',
        );
      } else {
        await reportError(
          error,
          'Error generating JSON content via API.',
          contents,
          'generateJson-api',
        );
      }

      throw new Error(
        `Failed to generate JSON content: ${getErrorMessage(error)}`,
      );
    }
  }

  async generateEmbedding(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) {
      return [];
    }

    // If model router is enabled, use ModelService instead
    if (this.config.getUseModelRouter()) {
      return this.generateEmbeddingWithModelRouter(texts);
    }

    const embedModelParams: EmbedContentParameters = {
      model: this.config.getEmbeddingModel(),
      contents: texts,
    };

    const embedContentResponse =
      await this.contentGenerator.embedContent(embedModelParams);
    if (
      !embedContentResponse.embeddings ||
      embedContentResponse.embeddings.length === 0
    ) {
      throw new Error('No embeddings found in API response.');
    }

    if (embedContentResponse.embeddings.length !== texts.length) {
      throw new Error(
        `API returned a mismatched number of embeddings. Expected ${texts.length}, got ${embedContentResponse.embeddings.length}.`,
      );
    }

    return embedContentResponse.embeddings.map((embedding, index) => {
      const values = embedding.values;
      if (!values || values.length === 0) {
        throw new Error(
          `API returned an empty embedding for input text at index ${index}: "${texts[index]}"`,
        );
      }
      return values;
    });
  }

  private cleanJsonResponse(text: string, model: string): string {
    const prefix = '```json';
    const suffix = '```';
    if (text.startsWith(prefix) && text.endsWith(suffix)) {
      logMalformedJsonResponse(
        this.config,
        new MalformedJsonResponseEvent(model),
      );
      return text.substring(prefix.length, text.length - suffix.length).trim();
    }
    return text;
  }

  /**
   * Generate JSON using ModelService when model router is enabled
   */
  private async generateJsonWithModelRouter(
    options: GenerateJsonOptions,
  ): Promise<Record<string, unknown>> {
    const {
      contents,
      model,
      systemInstruction,
    } = options;

    try {
      // Create ModelService instance
      const modelService = new ModelService(this.config);

      // Convert Gemini contents to unified format
      const messages: UnifiedRequest['messages'] = contents.map(content => ({
        role: content.role === 'user' ? 'user' as MessageRole : 'assistant' as MessageRole,
        content: (content.parts || []).map(part => ({
          type: 'text' as const,
          text: part.text || ''
        }))
      }));

      const unifiedRequest: UnifiedRequest = {
        messages,
        model: model || this.config.getModel(),
        maxTokens: 65536, // Increased from 1000 to allow for longer responses
        temperature: 0,
        systemMessage: typeof systemInstruction === 'string' ? systemInstruction : undefined
      };

      // Generate content using ModelService
      const response = await modelService.generateContent(unifiedRequest, model || this.config.getModel());

      // Extract and parse JSON from response
      const text = response.content?.[0]?.text?.trim();
      if (!text) {
        throw new Error('API returned an empty response for generateJson.');
      }

      try {
        return JSON.parse(text);
      } catch (parseError) {
        // Try to extract JSON from markdown code blocks or other formats
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[1] || jsonMatch[0]);
        }
        throw parseError;
      }

    } catch (error) {
      reportError(error, 'BaseLlmClient generateJsonWithModelRouter failed', undefined, 'baseLlmClient');
      throw error;
    }
  }

  /**
   * Generate embeddings using ModelService when model router is enabled
   */
  private async generateEmbeddingWithModelRouter(texts: string[]): Promise<number[][]> {
    try {
      // For now, return dummy embeddings since our custom models might not support embeddings
      // This is a placeholder implementation
      return texts.map(() => Array(768).fill(0).map(() => Math.random()));

    } catch (error) {
      reportError(error, 'BaseLlmClient generateEmbeddingWithModelRouter failed', undefined, 'baseLlmClient');
      throw error;
    }
  }
}

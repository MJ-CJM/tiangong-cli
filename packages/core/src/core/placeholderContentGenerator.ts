/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  CountTokensResponse,
  GenerateContentResponse,
  GenerateContentParameters,
  CountTokensParameters,
  EmbedContentResponse,
  EmbedContentParameters,
} from '@google/genai';
import type { ContentGenerator } from './contentGenerator.js';

/**
 * Placeholder ContentGenerator for custom models
 * This should not be called when model router is properly enabled
 */
export class PlaceholderContentGenerator implements ContentGenerator {
  async generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<GenerateContentResponse> {
    throw new Error('This should not be called when model router is enabled. Please check your configuration.');
  }

  async generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    throw new Error('This should not be called when model router is enabled. Please check your configuration.');
  }

  async countTokens(request: CountTokensParameters): Promise<CountTokensResponse> {
    // This is expected to be called, so return a default
    return {
      totalTokens: 0
    };
  }

  async embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse> {
    // This may be called, so return a default
    return {
      embeddings: []
    };
  }
}
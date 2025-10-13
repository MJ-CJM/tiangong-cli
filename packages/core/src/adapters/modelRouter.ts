/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  BaseModelClient,
  ModelConfig,
  ModelProvider,
  UnifiedRequest,
  UnifiedResponse,
  TokenCountResponse,
  EmbeddingResponse,
  StreamChunk
} from './base/index.js';

import {
  ModelAdapterError,
  ModelNotFoundError,
  ErrorCategory
} from './base/index.js';

import { logger } from '../utils/logger.js';
import { AdapterRegistry } from './registry.js';

/**
 * @deprecated Use AdapterRegistry instead
 * Registry for model adapters - kept for backward compatibility
 */
export class ModelAdapterRegistry {
  private adapters = new Map<ModelProvider | string, new (config: ModelConfig) => BaseModelClient>();

  /**
   * Register a model adapter class for a provider
   */
  register(provider: ModelProvider | string, adapterClass: new (config: ModelConfig) => BaseModelClient): void {
    this.adapters.set(provider, adapterClass);
  }

  /**
   * Create an adapter instance for the given config
   * Now delegates to AdapterRegistry
   */
  createAdapter(config: ModelConfig): BaseModelClient {
    try {
      // Use new AdapterRegistry
      return AdapterRegistry.createAdapter(config);
    } catch (error) {
      // Fallback to old behavior if AdapterRegistry fails
      const AdapterClass = this.adapters.get(config.provider);
      if (!AdapterClass) {
        throw new ModelNotFoundError(config.provider as ModelProvider, `No adapter registered for provider: ${config.provider}`);
      }
      return new AdapterClass(config);
    }
  }

  /**
   * Get all registered providers
   */
  getRegisteredProviders(): (ModelProvider | string)[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Check if a provider is registered
   */
  isProviderRegistered(provider: ModelProvider | string): boolean {
    return this.adapters.has(provider);
  }
}

/**
 * Model router that routes requests to appropriate adapters
 */
export class ModelRouter {
  private adapters = new Map<string, BaseModelClient>();
  private fallbackConfigs: ModelConfig[] = [];

  constructor(private registry: ModelAdapterRegistry) {}

  /**
   * Set fallback configurations for error handling
   */
  setFallbackConfigs(configs: ModelConfig[]): void {
    this.fallbackConfigs = configs;
  }

  /**
   * Get or create an adapter for the given configuration
   */
  private async getAdapter(config: ModelConfig): Promise<BaseModelClient> {
    const key = this.getAdapterKey(config);

    logger.debug('Getting adapter', {
      provider: config.provider,
      model: config.model,
      cached: this.adapters.has(key)
    });

    if (!this.adapters.has(key)) {
      logger.info('Creating new adapter', {
        provider: config.provider,
        model: config.model
      });

      const adapter = this.registry.createAdapter(config);

      // Validate the adapter can make requests
      try {
        await adapter.validate();
        logger.info('Adapter validation successful', {
          provider: config.provider,
          model: config.model
        });
      } catch (error) {
        logger.error('Adapter validation failed', {
          provider: config.provider,
          model: config.model,
          error: error instanceof Error ? error.message : String(error)
        });

        throw new ModelAdapterError(
          `Failed to validate adapter for ${config.provider}:${config.model}`,
          config.provider,
          ErrorCategory.UNKNOWN,
          'VALIDATION_ERROR',
          undefined,
          error as Error,
          false
        );
      }

      this.adapters.set(key, adapter);
    } else {
      logger.debug('Using cached adapter', {
        provider: config.provider,
        model: config.model
      });
    }

    return this.adapters.get(key)!;
  }

  /**
   * Generate a unique key for an adapter based on its configuration
   */
  private getAdapterKey(config: ModelConfig): string {
    return `${config.provider}:${config.model}:${config.baseUrl || 'default'}`;
  }

  /**
   * Route a request to the appropriate adapter with fallback support and smart retry
   */
  async generateContent(config: ModelConfig, request: UnifiedRequest): Promise<UnifiedResponse> {
    const allConfigs = [
      { config, priority: 0, retryCount: 1 },
      ...this.fallbackConfigs.map((c, i) => ({ config: c, priority: i + 1, retryCount: 2 }))
    ];

    const errors: Array<{ config: ModelConfig; error: ModelAdapterError; attempt: number }> = [];

    for (const { config: attemptConfig, retryCount } of allConfigs) {
      for (let attempt = 0; attempt < retryCount; attempt++) {
        try {
          const adapter = await this.getAdapter(attemptConfig);
          const response = await adapter.generateContent(request);

          // Log success if fallback was used
          if (errors.length > 0) {
            logger.warn('Request succeeded after fallback', {
              primary: config.provider,
              successful: attemptConfig.provider,
              failedAttempts: errors.length
            });
          }

          return response;
        } catch (error) {
          const err = error as ModelAdapterError;

          logger.warn('Adapter request failed', {
            provider: attemptConfig.provider,
            model: attemptConfig.model,
            attempt: attempt + 1,
            maxAttempts: retryCount,
            category: err.category,
            retryable: err.retryable,
            error: err.message
          });

          // Non-retryable errors: skip to next fallback immediately
          if (!err.retryable) {
            logger.error('Non-retryable error encountered', {
              provider: attemptConfig.provider,
              category: err.category,
              code: err.code
            });
            errors.push({ config: attemptConfig, error: err, attempt: attempt + 1 });
            break; // Skip remaining retries for this config
          }

          // Retryable errors: wait and retry if attempts remain
          if (attempt < retryCount - 1) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
            logger.info(`Retrying after delay`, {
              provider: attemptConfig.provider,
              delayMs: delay,
              attempt: attempt + 1,
              maxAttempts: retryCount
            });

            await this.sleep(delay);
            continue;
          }

          errors.push({ config: attemptConfig, error: err, attempt: attempt + 1 });
        }
      }
    }

    // All attempts failed
    const errorSummary = errors.map(e =>
      `${e.config.provider}:${e.config.model} (${e.error.category}): ${e.error.message}`
    ).join('; ');

    throw new ModelAdapterError(
      `All model requests failed. Errors: ${errorSummary}`,
      config.provider,
      ErrorCategory.UNKNOWN,
      'ALL_REQUESTS_FAILED',
      undefined,
      errors[0]?.error,
      false
    );
  }

  /**
   * Helper: sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Route a streaming request to the appropriate adapter
   */
  async* generateContentStream(config: ModelConfig, request: UnifiedRequest): AsyncGenerator<StreamChunk> {
    try {
      const adapter = await this.getAdapter(config);
      yield* adapter.generateContentStream(request);
    } catch (error) {
      // For streaming, we don't try fallbacks since we can't restart a stream
      throw new ModelAdapterError(
        `Streaming request failed: ${(error as Error).message}`,
        config.provider,
        ErrorCategory.UNKNOWN,
        'STREAMING_FAILED',
        undefined,
        error as Error,
        false
      );
    }
  }

  /**
   * Count tokens for a request
   */
  async countTokens(config: ModelConfig, request: UnifiedRequest): Promise<TokenCountResponse> {
    try {
      const adapter = await this.getAdapter(config);
      return await adapter.countTokens(request);
    } catch (error) {
      throw new ModelAdapterError(
        `Token counting failed: ${(error as Error).message}`,
        config.provider,
        ErrorCategory.UNKNOWN,
        'TOKEN_COUNT_FAILED',
        undefined,
        error as Error,
        false
      );
    }
  }

  /**
   * Generate embeddings
   */
  async embedContent(config: ModelConfig, request: { text: string }): Promise<EmbeddingResponse> {
    try {
      const adapter = await this.getAdapter(config);
      if (!adapter.embedContent) {
        throw new Error(`Provider ${config.provider} does not support embeddings`);
      }
      return await adapter.embedContent(request);
    } catch (error) {
      throw new ModelAdapterError(
        `Embedding generation failed: ${(error as Error).message}`,
        config.provider,
        ErrorCategory.UNKNOWN,
        'EMBEDDING_FAILED',
        undefined,
        error as Error,
        false
      );
    }
  }

  /**
   * Get available models for a provider
   */
  async getAvailableModels(config: ModelConfig): Promise<string[]> {
    try {
      const adapter = await this.getAdapter(config);
      if (!adapter.getAvailableModels) {
        return [config.model]; // Return the configured model if discovery isn't supported
      }
      return await adapter.getAvailableModels();
    } catch (error) {
      throw new ModelAdapterError(
        `Failed to get available models: ${(error as Error).message}`,
        config.provider,
        ErrorCategory.UNKNOWN,
        'MODEL_DISCOVERY_FAILED',
        undefined,
        error as Error,
        false
      );
    }
  }

  /**
   * Clear all cached adapters
   */
  clearCache(): void {
    this.adapters.clear();
  }

  /**
   * Get adapter statistics
   */
  getStats(): { totalAdapters: number; providers: string[] } {
    const providers = Array.from(new Set(
      Array.from(this.adapters.keys()).map(key => key.split(':')[0])
    ));

    return {
      totalAdapters: this.adapters.size,
      providers
    };
  }
}

/**
 * Global registry instance
 */
export const globalAdapterRegistry = new ModelAdapterRegistry();
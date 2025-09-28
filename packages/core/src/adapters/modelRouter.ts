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
  ModelNotFoundError
} from './base/index.js';

/**
 * Registry for model adapters
 */
export class ModelAdapterRegistry {
  private adapters = new Map<ModelProvider, new (config: ModelConfig) => BaseModelClient>();

  /**
   * Register a model adapter class for a provider
   */
  register(provider: ModelProvider, adapterClass: new (config: ModelConfig) => BaseModelClient): void {
    this.adapters.set(provider, adapterClass);
  }

  /**
   * Create an adapter instance for the given config
   */
  createAdapter(config: ModelConfig): BaseModelClient {
    const AdapterClass = this.adapters.get(config.provider);
    if (!AdapterClass) {
      throw new ModelNotFoundError(config.provider, `No adapter registered for provider: ${config.provider}`);
    }

    return new AdapterClass(config);
  }

  /**
   * Get all registered providers
   */
  getRegisteredProviders(): ModelProvider[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Check if a provider is registered
   */
  isProviderRegistered(provider: ModelProvider): boolean {
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
    console.log(`Getting adapter for config:`, config);

    if (!this.adapters.has(key)) {
      console.log(`Creating new adapter for ${config.provider}:${config.model}`);
      const adapter = this.registry.createAdapter(config);

      // Validate the adapter can make requests
      try {
        await adapter.validate();
        console.log(`Adapter validation successful for ${config.provider}:${config.model}`);
      } catch (error) {
        console.log(`Adapter validation failed for ${config.provider}:${config.model}:`, error);
        throw new ModelAdapterError(
          `Failed to validate adapter for ${config.provider}:${config.model}`,
          config.provider,
          'VALIDATION_ERROR',
          undefined,
          error as Error
        );
      }

      this.adapters.set(key, adapter);
    } else {
      console.log(`Using cached adapter for ${config.provider}:${config.model}`);
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
   * Route a request to the appropriate adapter with fallback support
   */
  async generateContent(config: ModelConfig, request: UnifiedRequest): Promise<UnifiedResponse> {
    const errors: Error[] = [];

    // Try primary configuration
    try {
      const adapter = await this.getAdapter(config);
      return await adapter.generateContent(request);
    } catch (error) {
      console.log(`Primary adapter failed for ${config.provider}:${config.model}:`, error);
      errors.push(error as Error);
    }

    // Try fallback configurations
    for (const fallbackConfig of this.fallbackConfigs) {
      try {
        const adapter = await this.getAdapter(fallbackConfig);
        return await adapter.generateContent(request);
      } catch (error) {
        errors.push(error as Error);
      }
    }

    // If all attempts failed, throw the original error
    throw new ModelAdapterError(
      `All model requests failed. Errors: ${errors.map(e => e.message).join(', ')}`,
      config.provider,
      'ALL_REQUESTS_FAILED',
      undefined,
      errors[0]
    );
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
        'STREAMING_FAILED',
        undefined,
        error as Error
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
        'TOKEN_COUNT_FAILED',
        undefined,
        error as Error
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
        'EMBEDDING_FAILED',
        undefined,
        error as Error
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
        'MODEL_DISCOVERY_FAILED',
        undefined,
        error as Error
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
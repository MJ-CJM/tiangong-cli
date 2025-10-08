/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '../config/config.js';
import type {
  ModelConfig,
  UnifiedRequest,
  UnifiedResponse,
  TokenCountResponse,
  EmbeddingResponse,
  StreamChunk
} from '../adapters/base/index.js';

import {
  ModelRouter,
  globalAdapterRegistry,
  ModelProvider,
  ModelAuthType
} from '../adapters/index.js';

import {
  getModelConfig,
  getFallbackConfigs,
  DEFAULT_MODEL
} from '../config/models.js';

/**
 * Service for managing model interactions across different providers
 */
export class ModelService {
  private router: ModelRouter;
  private customModelConfigs: Record<string, ModelConfig> = {};

  constructor(private config: Config) {
    this.router = new ModelRouter(globalAdapterRegistry);
    this.loadCustomConfigs();
  }

  /**
   * Load custom model configurations from the config
   */
  private loadCustomConfigs(): void {
    // Check for custom model configurations in the config
    const customModels = this.config.getCustomModels?.();
    if (customModels) {
      this.customModelConfigs = customModels;
    }

    // Load environment-based configurations
    this.loadEnvironmentConfigs();
  }

  /**
   * Load model configurations from environment variables
   */
  private loadEnvironmentConfigs(): void {
    // OpenAI configuration
    if (process.env['OPENAI_API_KEY']) {
      const openaiConfig: ModelConfig = {
        provider: ModelProvider.OPENAI,
        model: 'gpt-4o',
        apiKey: process.env['OPENAI_API_KEY'],
        authType: ModelAuthType.API_KEY,
        baseUrl: process.env['OPENAI_BASE_URL'] || 'https://api.openai.com/v1'
      };
      this.customModelConfigs['openai:default'] = openaiConfig;
    }

    // Claude configuration
    const claudeKey = process.env['CLAUDE_API_KEY'] || process.env['ANTHROPIC_API_KEY'];
    if (claudeKey) {
      const claudeConfig: ModelConfig = {
        provider: ModelProvider.CLAUDE,
        model: 'claude-3-5-sonnet-20241022',
        apiKey: claudeKey,
        authType: ModelAuthType.API_KEY,
        baseUrl: process.env['CLAUDE_BASE_URL'] || 'https://api.anthropic.com/v1'
      };
      this.customModelConfigs['claude:default'] = claudeConfig;
    }

    // Qwen configuration
    const qwenKey = process.env['QWEN_CODER_API_KEY'] || process.env['QWEN_API_KEY'];
    if (qwenKey) {
      const qwenConfig: ModelConfig = {
        provider: ModelProvider.QWEN,
        model: 'qwen-coder-turbo',
        apiKey: qwenKey,
        authType: ModelAuthType.API_KEY,
        baseUrl: process.env['QWEN_BASE_URL'] || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
      };
      this.customModelConfigs['qwen:default'] = qwenConfig;
    }

    // Custom/local model configuration
    if (process.env['CUSTOM_MODEL_URL']) {
      const customConfig: ModelConfig = {
        provider: ModelProvider.CUSTOM,
        model: process.env['CUSTOM_MODEL_NAME'] || 'custom-model',
        apiKey: process.env['CUSTOM_API_KEY'],
        authType: ModelAuthType.API_KEY,
        baseUrl: process.env['CUSTOM_MODEL_URL'],
        options: {
          responseFormat: process.env['CUSTOM_RESPONSE_FORMAT'] || 'openai'
        }
      };
      this.customModelConfigs['custom:default'] = customConfig;
    }
  }

  /**
   * Get model configuration for the current request
   */
  private getEffectiveModelConfig(modelOverride?: string): ModelConfig {
    const modelString = modelOverride || this.config.getModel?.() || DEFAULT_MODEL;

    const modelConfig = getModelConfig(modelString, this.customModelConfigs);

    // Apply any config-specific overrides
    if (this.config.getProxy?.()) {
      modelConfig.options = {
        ...modelConfig.options,
        proxy: this.config.getProxy()
      };
    }

    return modelConfig;
  }

  /**
   * Set up fallback configurations
   */
  private setupFallbacks(primaryConfig: ModelConfig): void {
    const fallbackConfigs = getFallbackConfigs(primaryConfig);
    this.router.setFallbackConfigs(fallbackConfigs);
  }

  /**
   * Generate content using the configured model
   */
  async generateContent(
    request: UnifiedRequest,
    modelOverride?: string
  ): Promise<UnifiedResponse> {
    const modelConfig = this.getEffectiveModelConfig(modelOverride);
    this.setupFallbacks(modelConfig);

    return this.router.generateContent(modelConfig, request);
  }

  /**
   * Generate content with streaming
   */
  async* generateContentStream(
    request: UnifiedRequest,
    modelOverride?: string
  ): AsyncGenerator<StreamChunk> {
    const modelConfig = this.getEffectiveModelConfig(modelOverride);

    yield* this.router.generateContentStream(modelConfig, request);
  }

  /**
   * Count tokens for a request
   */
  async countTokens(
    request: UnifiedRequest,
    modelOverride?: string
  ): Promise<TokenCountResponse> {
    const modelConfig = this.getEffectiveModelConfig(modelOverride);

    return this.router.countTokens(modelConfig, request);
  }

  /**
   * Generate embeddings
   */
  async embedContent(
    request: { text: string },
    modelOverride?: string
  ): Promise<EmbeddingResponse> {
    const modelConfig = this.getEffectiveModelConfig(modelOverride);

    return this.router.embedContent(modelConfig, request);
  }

  /**
   * Get available models for a provider
   */
  async getAvailableModels(provider?: string): Promise<string[]> {
    if (!provider) {
      // Return all available models from all providers
      const allModels: string[] = [];

      for (const providerName of globalAdapterRegistry.getRegisteredProviders()) {
        try {
          const modelConfig = { provider: providerName, model: 'dummy' } as ModelConfig;
          const models = await this.router.getAvailableModels(modelConfig);
          allModels.push(...models.map(model => `${providerName}:${model}`));
        } catch (error) {
          // Skip providers that fail to list models
          continue;
        }
      }

      return allModels;
    }

    // Get models for specific provider
    const modelConfig = { provider: provider as any, model: 'dummy' } as ModelConfig;
    return this.router.getAvailableModels(modelConfig);
  }

  /**
   * Validate a model configuration
   */
  async validateModel(modelString: string): Promise<boolean> {
    try {
      const modelConfig = getModelConfig(modelString, this.customModelConfigs);
      const adapter = globalAdapterRegistry.createAdapter(modelConfig);
      return adapter.validate();
    } catch (error) {
      return false;
    }
  }

  /**
   * Add or update a custom model configuration
   */
  setCustomModelConfig(name: string, config: ModelConfig): void {
    this.customModelConfigs[name] = config;
  }

  /**
   * Remove a custom model configuration
   */
  removeCustomModelConfig(name: string): void {
    delete this.customModelConfigs[name];
  }

  /**
   * Get all custom model configurations
   */
  getCustomModelConfigs(): Record<string, ModelConfig> {
    return { ...this.customModelConfigs };
  }

  /**
   * Get statistics about the model router
   */
  getStats(): {
    totalAdapters: number;
    providers: string[];
    customConfigs: number;
    registeredProviders: string[];
  } {
    const routerStats = this.router.getStats();

    return {
      ...routerStats,
      customConfigs: Object.keys(this.customModelConfigs).length,
      registeredProviders: globalAdapterRegistry.getRegisteredProviders()
    };
  }

  /**
   * Clear all cached adapters
   */
  clearCache(): void {
    this.router.clearCache();
  }
}
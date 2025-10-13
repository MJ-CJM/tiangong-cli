/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AbstractModelClient } from './base/baseModelClient.js';
import { OpenAIAdapter } from './openai/openaiAdapter.js';
import { ClaudeAdapter } from './claude/claudeAdapter.js';
import { CustomAdapter } from './custom/customAdapter.js';
import type { ModelConfig } from './base/types.js';
import { ModelProvider } from './base/types.js';

/**
 * Registry for managing model adapters
 * Provides a centralized way to map providers and adapter types to implementations
 */
export class AdapterRegistry {
  private static adapters = new Map<string, new (config: ModelConfig) => AbstractModelClient>();

  /**
   * Static initializer - registers built-in adapters
   */
  static {
    // Register core adapters
    this.register('openai', OpenAIAdapter);
    this.register('claude', ClaudeAdapter);
    this.register('custom', CustomAdapter);
  }

  /**
   * Register a new adapter type
   */
  static register(type: string, adapter: new (config: ModelConfig) => AbstractModelClient): void {
    this.adapters.set(type, adapter);
  }

  /**
   * Create an adapter instance for the given config
   */
  static createAdapter(config: ModelConfig): AbstractModelClient {
    // Determine which adapter to use
    const adapterType = this.getAdapterType(config);

    const AdapterClass = this.adapters.get(adapterType);
    if (!AdapterClass) {
      throw new Error(`No adapter registered for type: ${adapterType}`);
    }

    // Normalize config for the adapter
    const normalizedConfig = this.normalizeConfig(config, adapterType);

    return new AdapterClass(normalizedConfig);
  }

  /**
   * Get the adapter type to use for a given config
   */
  private static getAdapterType(config: ModelConfig): string {
    // 1. Explicit adapterType has highest priority
    if (config.adapterType) {
      return config.adapterType;
    }

    // 2. Infer from provider
    return this.inferAdapterType(config.provider);
  }

  /**
   * Infer adapter type from provider name
   */
  private static inferAdapterType(provider: ModelProvider | string): string {
    // Map of providers to their adapter types
    const providerAdapterMap: Record<string, string> = {
      [ModelProvider.GEMINI]: 'gemini',
      [ModelProvider.OPENAI]: 'openai',
      [ModelProvider.CLAUDE]: 'claude',
      [ModelProvider.QWEN]: 'openai',      // Qwen is OpenAI-compatible
      [ModelProvider.CUSTOM]: 'custom',

      // Additional OpenAI-compatible providers
      'deepseek': 'openai',
      'moonshot': 'openai',
      'zhipu': 'openai',
      'minimax': 'openai',
      'openai-compatible': 'openai',

      // Additional Claude-compatible providers
      'claude-compatible': 'claude',
    };

    return providerAdapterMap[provider] || 'custom';
  }

  /**
   * Normalize config for adapter compatibility
   */
  private static normalizeConfig(config: ModelConfig, adapterType: string): ModelConfig {
    const normalized = { ...config };

    // If using OpenAI adapter but provider isn't 'openai', adjust the config
    if (adapterType === 'openai' && config.provider !== ModelProvider.OPENAI) {
      // Keep original provider for logging/tracking
      // But ensure the adapter sees it as compatible
      normalized.provider = ModelProvider.OPENAI;
    }

    // If using Claude adapter but provider isn't 'claude', adjust the config
    if (adapterType === 'claude' && config.provider !== ModelProvider.CLAUDE) {
      normalized.provider = ModelProvider.CLAUDE;
    }

    // If using custom adapter but provider isn't 'custom', adjust the config
    if (adapterType === 'custom' && config.provider !== ModelProvider.CUSTOM) {
      normalized.provider = ModelProvider.CUSTOM;
    }

    return normalized;
  }

  /**
   * Check if an adapter is registered for a given type
   */
  static hasAdapter(type: string): boolean {
    return this.adapters.has(type);
  }

  /**
   * Get all registered adapter types
   */
  static getRegisteredTypes(): string[] {
    return Array.from(this.adapters.keys());
  }
}

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
   * Note: With the new unified design, all OpenAI-compatible services use provider='openai'
   */
  private static inferAdapterType(provider: ModelProvider | string): string {
    // Map of providers to their adapter types
    const providerAdapterMap: Record<string, string> = {
      [ModelProvider.GEMINI]: 'gemini',
      [ModelProvider.OPENAI]: 'openai',    // All OpenAI-compatible use this
      [ModelProvider.CLAUDE]: 'claude',
      [ModelProvider.QWEN]: 'openai',      // Legacy: Qwen now uses provider='openai' + metadata
      [ModelProvider.CUSTOM]: 'custom',

      // Legacy support for old provider names (backward compatibility)
      'deepseek': 'openai',
      'moonshot': 'openai',
      'zhipu': 'openai',
      'minimax': 'openai',
      'openai-compatible': 'openai',

      // Claude-compatible
      'claude-compatible': 'claude',
    };

    return providerAdapterMap[provider] || 'custom';
  }

  /**
   * Normalize config for adapter compatibility
   * Note: With the new design, we keep the original provider intact
   * so adapters can use it for logging and API key lookup
   */
  private static normalizeConfig(config: ModelConfig, adapterType: string): ModelConfig {
    // Simply return the config as-is
    // The OpenAIAdapter now accepts multiple providers natively
    return { ...config };
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

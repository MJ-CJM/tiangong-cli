/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Export base types and interfaces
export * from './base/index.js';

// Export adapters
export { OpenAIAdapter } from './openai/openaiAdapter.js';
export { ClaudeAdapter } from './claude/claudeAdapter.js';
export { CustomAdapter, CustomResponseFormat } from './custom/customAdapter.js';

// Export router and registry
export { ModelRouter, ModelAdapterRegistry, globalAdapterRegistry } from './modelRouter.js';
export { AdapterRegistry } from './registry.js';

// Export utilities
export { APITranslator } from './utils/apiTranslator.js';

// Auto-register all adapters
import { ModelProvider } from './base/index.js';
import { globalAdapterRegistry } from './modelRouter.js';
import { OpenAIAdapter } from './openai/openaiAdapter.js';
import { ClaudeAdapter } from './claude/claudeAdapter.js';
import { CustomAdapter } from './custom/customAdapter.js';

// Register adapters on module load
// Note: Gemini uses the existing geminiChat.ts implementation, not the adapter pattern

// Old registry (backward compatibility)
// OpenAIAdapter now handles Qwen, DeepSeek, and other OpenAI-compatible providers
globalAdapterRegistry.register(ModelProvider.OPENAI, OpenAIAdapter);
globalAdapterRegistry.register(ModelProvider.CLAUDE, ClaudeAdapter);
globalAdapterRegistry.register(ModelProvider.QWEN, OpenAIAdapter);  // Qwen uses OpenAIAdapter
globalAdapterRegistry.register(ModelProvider.CUSTOM, CustomAdapter);
globalAdapterRegistry.register('deepseek', OpenAIAdapter);  // DeepSeek uses OpenAIAdapter
globalAdapterRegistry.register('moonshot', OpenAIAdapter);  // Moonshot uses OpenAIAdapter
globalAdapterRegistry.register('zhipu', OpenAIAdapter);     // Zhipu uses OpenAIAdapter

// New AdapterRegistry is already auto-registered in registry.ts static block
// AdapterRegistry uses OpenAIAdapter for all OpenAI-compatible providers
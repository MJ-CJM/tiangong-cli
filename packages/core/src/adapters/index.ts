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
export { QwenAdapter } from './qwen/qwenAdapter.js';
export { CustomAdapter, CustomResponseFormat } from './custom/customAdapter.js';

// Export router and registry
export { ModelRouter, ModelAdapterRegistry, globalAdapterRegistry } from './modelRouter.js';

// Export utilities
export { APITranslator } from './utils/apiTranslator.js';

// Auto-register all adapters
import { ModelProvider } from './base/index.js';
import { globalAdapterRegistry } from './modelRouter.js';
import { OpenAIAdapter } from './openai/openaiAdapter.js';
import { ClaudeAdapter } from './claude/claudeAdapter.js';
import { QwenAdapter } from './qwen/qwenAdapter.js';
import { CustomAdapter } from './custom/customAdapter.js';

// Register adapters on module load
// Note: Gemini uses the existing geminiChat.ts implementation, not the adapter pattern
globalAdapterRegistry.register(ModelProvider.OPENAI, OpenAIAdapter);
globalAdapterRegistry.register(ModelProvider.CLAUDE, ClaudeAdapter);
globalAdapterRegistry.register(ModelProvider.QWEN, QwenAdapter);
globalAdapterRegistry.register(ModelProvider.CUSTOM, CustomAdapter);
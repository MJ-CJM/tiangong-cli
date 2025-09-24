/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Export base types and interfaces
export * from './base/index.js';

// Export adapters
export { GeminiAdapter } from './gemini/geminiAdapter.js';
export { OpenAIAdapter } from './openai/openaiAdapter.js';
export { ClaudeAdapter } from './claude/claudeAdapter.js';
export { CustomAdapter, CustomResponseFormat } from './custom/customAdapter.js';

// Export router and registry
export { ModelRouter, ModelAdapterRegistry, globalAdapterRegistry } from './modelRouter.js';

// Export utilities
export { APITranslator } from './utils/apiTranslator.js';

// Auto-register all adapters
import { ModelProvider } from './base/index.js';
import { globalAdapterRegistry } from './modelRouter.js';
import { GeminiAdapter } from './gemini/geminiAdapter.js';
import { OpenAIAdapter } from './openai/openaiAdapter.js';
import { ClaudeAdapter } from './claude/claudeAdapter.js';
import { CustomAdapter } from './custom/customAdapter.js';

// Register all adapters on module load
globalAdapterRegistry.register(ModelProvider.GEMINI, GeminiAdapter);
globalAdapterRegistry.register(ModelProvider.OPENAI, OpenAIAdapter);
globalAdapterRegistry.register(ModelProvider.CLAUDE, ClaudeAdapter);
globalAdapterRegistry.register(ModelProvider.CUSTOM, CustomAdapter);
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Example demonstrating multi-model support in TIANGONG CLI
 */

import { ModelService } from '../../services/modelService.js';
import type { UnifiedRequest, ModelConfig } from '../base/index.js';
import { MessageRole, ModelProvider, AuthType } from '../base/index.js';
import type { Config } from '../../config/config.js';

export async function multiModelExample(config: Config) {
  const modelService = new ModelService(config);

  // Example 1: Using different models for different tasks
  console.log('=== Multi-Model Example ===\n');

  // Create a simple request
  const request: UnifiedRequest = {
    messages: [{
      role: MessageRole.USER,
      content: [{
        type: 'text',
        text: 'Explain quantum computing in simple terms'
      }]
    }],
    maxTokens: 100
  };

  try {
    // Use Gemini for technical explanations
    console.log('1. Using Gemini for technical explanation:');
    const geminiResponse = await modelService.generateContent(request, 'gemini-2.5-flash');
    console.log('Gemini:', geminiResponse.content[0]?.text?.substring(0, 200) + '...\n');

    // Use OpenAI GPT-4 for comparison
    console.log('2. Using OpenAI GPT-4 for comparison:');
    const openaiResponse = await modelService.generateContent(request, 'openai:gpt-4o');
    console.log('OpenAI:', openaiResponse.content[0]?.text?.substring(0, 200) + '...\n');

    // Use Claude for another perspective
    console.log('3. Using Claude for another perspective:');
    const claudeResponse = await modelService.generateContent(request, 'claude:claude-3-5-sonnet');
    console.log('Claude:', claudeResponse.content[0]?.text?.substring(0, 200) + '...\n');

  } catch (error) {
    console.error('Error:', error);
  }

  // Example 2: Custom model configuration
  console.log('=== Custom Model Configuration ===\n');

  // Add a custom local model
  const customConfig: ModelConfig = {
    provider: ModelProvider.CUSTOM,
    model: 'local-llama',
    baseUrl: 'http://localhost:8000/v1',
    authType: AuthType.API_KEY,
    apiKey: 'local-key',
    options: {
      responseFormat: 'openai'
    }
  };

  modelService.setCustomModelConfig('local-llama', customConfig);

  try {
    console.log('4. Using custom local model:');
    const customResponse = await modelService.generateContent(request, 'local-llama');
    console.log('Local Model:', customResponse.content[0]?.text?.substring(0, 200) + '...\n');
  } catch (error) {
    console.log('Local model not available (expected if not running locally)\n');
  }

  // Example 3: Model validation and discovery
  console.log('=== Model Discovery ===\n');

  try {
    console.log('5. Available models:');
    const availableModels = await modelService.getAvailableModels();
    console.log('Available models:', availableModels.slice(0, 5).join(', '), '...\n');

    console.log('6. Model validation:');
    const isGeminiValid = await modelService.validateModel('gemini-2.5-flash');
    console.log('Gemini 2.5 Flash valid:', isGeminiValid);

    const isCustomValid = await modelService.validateModel('openai:gpt-4o');
    console.log('OpenAI GPT-4o valid:', isCustomValid, '\n');

  } catch (error) {
    console.error('Discovery error:', error);
  }

  // Example 4: Streaming response
  console.log('=== Streaming Example ===\n');

  const streamRequest: UnifiedRequest = {
    messages: [{
      role: MessageRole.USER,
      content: [{
        type: 'text',
        text: 'Count from 1 to 5 slowly'
      }]
    }],
    maxTokens: 50
  };

  try {
    console.log('7. Streaming response from Gemini:');
    const stream = modelService.generateContentStream(streamRequest, 'gemini-2.5-flash');

    for await (const chunk of stream) {
      if (chunk.delta.content?.[0]?.text) {
        process.stdout.write(chunk.delta.content[0].text);
      }
      if (chunk.done) {
        console.log('\n--- Stream complete ---\n');
        break;
      }
    }
  } catch (error) {
    console.error('Streaming error:', error);
  }

  // Example 5: Statistics
  console.log('=== Service Statistics ===\n');
  const stats = modelService.getStats();
  console.log('Service stats:', {
    totalAdapters: stats.totalAdapters,
    providers: stats.providers,
    customConfigs: stats.customConfigs,
    registeredProviders: stats.registeredProviders
  });
}

/**
 * Environment configuration example
 */
export function showEnvironmentConfig() {
  console.log('=== Environment Configuration ===\n');
  console.log('Set these environment variables to configure different providers:\n');

  console.log('# Gemini (Google)');
  console.log('export GEMINI_API_KEY="your-gemini-key"');
  console.log('export GOOGLE_API_KEY="your-google-key"\n');

  console.log('# OpenAI');
  console.log('export OPENAI_API_KEY="your-openai-key"');
  console.log('export OPENAI_BASE_URL="https://api.openai.com/v1"  # Optional\n');

  console.log('# Claude (Anthropic)');
  console.log('export CLAUDE_API_KEY="your-claude-key"');
  console.log('export ANTHROPIC_API_KEY="your-anthropic-key"  # Alternative\n');

  console.log('# Custom/Local models');
  console.log('export CUSTOM_MODEL_URL="http://localhost:8000/v1"');
  console.log('export CUSTOM_MODEL_NAME="local-model"');
  console.log('export CUSTOM_API_KEY="optional-key"');
  console.log('export CUSTOM_RESPONSE_FORMAT="openai"  # or "claude" or "raw"\n');
}

/**
 * CLI usage examples
 */
export function showCLIExamples() {
  console.log('=== CLI Usage Examples ===\n');

  console.log('# Use specific models:');
  console.log('tiangong --model gemini-2.5-flash "What is AI?"');
  console.log('tiangong --model openai:gpt-4o "Explain machine learning"');
  console.log('tiangong --model claude:claude-3-5-sonnet "Write a poem"\n');

  console.log('# Model switching during conversation:');
  console.log('tiangong');
  console.log('> /model gemini-2.5-pro');
  console.log('> Tell me about quantum physics');
  console.log('> /model openai:gpt-4o');
  console.log('> Now explain it differently\n');

  console.log('# List available models:');
  console.log('tiangong --list-models\n');

  console.log('# Configuration file example (~/.tiangong/config.json):');
  console.log(JSON.stringify({
    defaultModel: 'gemini-2.5-flash',
    models: {
      'my-openai': {
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: '${OPENAI_API_KEY}',
        baseUrl: 'https://api.openai.com/v1'
      },
      'local-model': {
        provider: 'custom',
        model: 'llama-3',
        baseUrl: 'http://localhost:8000/v1',
        options: {
          responseFormat: 'openai'
        }
      }
    }
  }, null, 2));
}
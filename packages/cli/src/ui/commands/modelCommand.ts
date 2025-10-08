/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DEFAULT_GEMINI_FLASH_MODEL,
  DEFAULT_GEMINI_FLASH_LITE_MODEL,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_MODEL_AUTO,
  globalAdapterRegistry,
} from '@google/gemini-cli-core';
import { MessageType } from '../types.js';
import {
  type CommandContext,
  type SlashCommand,
  type SlashCommandActionReturn,
  CommandKind,
} from './types.js';

const BUILT_IN_MODELS = [
  DEFAULT_GEMINI_MODEL_AUTO,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_FLASH_MODEL,
  DEFAULT_GEMINI_FLASH_LITE_MODEL,
];

function requireConfig(
  context: CommandContext,
): NonNullable<CommandContext['services']['config']> {
  const config = context.services.config;
  if (!config) {
    throw new Error('Configuration is unavailable. Try reloading the CLI.');
  }
  return config;
}

function formatModelList(models: string[]): string {
  return models.map((model) => `  - ${model}`).join('\n');
}

export const modelCommand: SlashCommand = {
  name: 'model',
  description: 'view or change the active model (supports Gemini/OpenAI/Claude/Qwen)',
  kind: CommandKind.BUILT_IN,
  subCommands: [
    {
      name: 'current',
      description: 'Show the active model and provider.',
      kind: CommandKind.BUILT_IN,
      action: (context: CommandContext) => {
        try {
          const config = requireConfig(context);

          if (config.getUseModelRouter()) {
            const modelConfig = config.getModelConfig();
            if (!modelConfig) {
              context.ui.addItem(
                {
                  type: MessageType.ERROR,
                  text: 'ModelRouter is enabled but no model configured.',
                },
                Date.now(),
              );
              return;
            }

            const message = `
Current provider: ${modelConfig.provider}
Current model: ${modelConfig.model}
Base URL: ${modelConfig.baseUrl || 'default'}
Status: ${config.isInFallbackMode() ? 'Fallback mode active' : 'Normal'}
            `.trim();

            context.ui.addItem(
              {
                type: MessageType.INFO,
                text: message,
              },
              Date.now(),
            );
          } else {
            // Original Gemini-only logic
            const requestedModel = config.getModel();
            const inFallback = config.isInFallbackMode();
            const effectiveModel = inFallback
              ? DEFAULT_GEMINI_FLASH_MODEL
              : requestedModel;

            let message = `Current model: ${requestedModel}`;
            if (requestedModel !== effectiveModel) {
              message += `\nFallback active → requests are sent with ${effectiveModel}.`;
            }

            context.ui.addItem(
              {
                type: MessageType.INFO,
                text: message,
              },
              Date.now(),
            );
          }
        } catch (error) {
          context.ui.addItem(
            {
              type: MessageType.ERROR,
              text: error instanceof Error ? error.message : String(error),
            },
            Date.now(),
          );
        }
      },
    },
    {
      name: 'list',
      description: 'List all available models across providers.',
      kind: CommandKind.BUILT_IN,
      action: (context: CommandContext) => {
        try {
          const config = requireConfig(context);

          if (config.getUseModelRouter()) {
            const customModels = config.getCustomModels();

            if (Object.keys(customModels).length === 0) {
              context.ui.addItem(
                {
                  type: MessageType.INFO,
                  text: 'No models configured. Add models to ~/.gemini/config.json',
                },
                Date.now(),
              );
              return;
            }

            let message = 'Available models (from config.json):\n\n';

            // Group models by provider
            const modelsByProvider: Record<string, Array<{name: string, model: string}>> = {};

            for (const [modelName, modelConfig] of Object.entries(customModels)) {
              const provider = modelConfig.provider.toUpperCase();
              if (!modelsByProvider[provider]) {
                modelsByProvider[provider] = [];
              }
              modelsByProvider[provider].push({
                name: modelName,
                model: modelConfig.model
              });
            }

            // Display grouped by provider
            for (const [provider, models] of Object.entries(modelsByProvider)) {
              message += `${provider}:\n`;
              for (const {name, model} of models) {
                message += `  - ${name}${name !== model ? ` (${model})` : ''}\n`;
              }
              message += '\n';
            }

            message += `Use \`/model use <model-name>\` to switch.`;
            message += `\nExample: \`/model use qwen3-coder-flash\``;

            context.ui.addItem(
              {
                type: MessageType.INFO,
                text: message,
              },
              Date.now(),
            );
          } else {
            // Original Gemini-only logic
            const currentModel = config.getModel();
            const customModels = Object.keys(config.getCustomModels());

            let message = 'Available models:\n';
            message += formatModelList(BUILT_IN_MODELS);

            if (customModels.length > 0) {
              message += '\n\nCustom models:\n';
              message += formatModelList(customModels);
            }

            message += `\n\nCurrent selection: ${currentModel}`;
            message += '\nUse `/model use <model-name>` to switch.';

            context.ui.addItem(
              {
                type: MessageType.INFO,
                text: message,
              },
              Date.now(),
            );
          }
        } catch (error) {
          context.ui.addItem(
            {
              type: MessageType.ERROR,
              text: error instanceof Error ? error.message : String(error),
            },
            Date.now(),
          );
        }
      },
    },
    {
      name: 'use',
      description: 'Switch model. Usage: /model use <provider>:<model> or /model use <model>',
      kind: CommandKind.BUILT_IN,
      action: (
        context: CommandContext,
        args: string,
      ): SlashCommandActionReturn | void => {
        const trimmedArgs = args.trim();
        if (!trimmedArgs) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /model use <provider>:<model> (e.g., openai:gpt-4o, claude:claude-3-5-sonnet)',
          };
        }

        try {
          const config = requireConfig(context);

          if (config.getUseModelRouter()) {
            // First check if this is a configured model name from config.json
            const customModels = config.getCustomModels();
            if (customModels[trimmedArgs]) {
              const modelConfig = customModels[trimmedArgs];
              config.setModelConfig({
                provider: modelConfig.provider as any,
                model: modelConfig.model
              });
              config.setModel(trimmedArgs);

              context.ui.addItem(
                {
                  type: MessageType.INFO,
                  text: `Switched to ${trimmedArgs} (${modelConfig.provider}:${modelConfig.model})`,
                },
                Date.now(),
              );
              return;
            }

            // Parse provider:model format
            const parts = trimmedArgs.split(':');

            if (parts.length === 2) {
              const [provider, model] = parts;

              // Validate provider is registered
              if (!globalAdapterRegistry.isProviderRegistered(provider as any)) {
                return {
                  type: 'message',
                  messageType: 'error',
                  content: `Unknown provider: ${provider}. Available: ${globalAdapterRegistry.getRegisteredProviders().join(', ')}`,
                };
              }

              // Update configuration
              config.setModelConfig({
                provider: provider as any,
                model
              });

              context.ui.addItem(
                {
                  type: MessageType.INFO,
                  text: `Switched to ${provider}:${model}`,
                },
                Date.now(),
              );
            } else {
              // Assume Gemini model (backward compatibility)
              config.setModelConfig({
                provider: 'gemini',
                model: trimmedArgs
              });

              context.ui.addItem(
                {
                  type: MessageType.INFO,
                  text: `Switched to Gemini model: ${trimmedArgs}`,
                },
                Date.now(),
              );
            }
          } else {
            // Original Gemini-only logic
            if (config.isInFallbackMode() && trimmedArgs.includes('pro')) {
              return {
                type: 'message',
                messageType: 'error',
                content:
                  'Cannot switch to a Pro model while fallback mode is active. Resolve the quota issue or restart the session.',
              };
            }

            config.setFallbackMode(false);
            config.setModel(trimmedArgs);

            const newModel = config.getModel();
            context.ui.addItem(
              {
                type: MessageType.INFO,
                text: `Switched to model: ${newModel}`,
              },
              Date.now(),
            );
          }
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: error instanceof Error ? error.message : String(error),
          };
        }

        return undefined;
      },
    },
  ],
};

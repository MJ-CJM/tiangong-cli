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
  description: 'view or change the active model',
  kind: CommandKind.BUILT_IN,
  subCommands: [
    {
      name: 'current',
      description: 'Show the active model (and fallback status).',
      kind: CommandKind.BUILT_IN,
      action: (context: CommandContext) => {
        try {
          const config = requireConfig(context);
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
      description: 'List common Gemini CLI models and any custom models.',
      kind: CommandKind.BUILT_IN,
      action: (context: CommandContext) => {
        try {
          const config = requireConfig(context);
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
      description: 'Switch to a different model. Usage: /model use <model-name>',
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
            content: 'Usage: /model use <model-name>',
          };
        }

        try {
          const config = requireConfig(context);

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

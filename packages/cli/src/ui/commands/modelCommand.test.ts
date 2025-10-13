/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Config } from '@google/gemini-cli-core';
import { DEFAULT_GEMINI_FLASH_MODEL } from '@google/gemini-cli-core';
import { modelCommand } from './modelCommand.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import type { CommandContext } from './types.js';
import { MessageType } from '../types.js';

function getSubCommand(name: string) {
  return modelCommand.subCommands?.find((cmd) => cmd.name === name);
}

describe('modelCommand', () => {
  let configMock: Config;
  let getModel: ReturnType<typeof vi.fn>;
  let isInFallbackMode: ReturnType<typeof vi.fn>;
  let setModel: ReturnType<typeof vi.fn>;
  let setFallbackMode: ReturnType<typeof vi.fn>;
  let getCustomModels: ReturnType<typeof vi.fn>;
  let context: CommandContext;

  beforeEach(() => {
    getModel = vi.fn().mockReturnValue('gemini-2.5-pro');
    isInFallbackMode = vi.fn().mockReturnValue(false);
    setModel = vi.fn();
    setFallbackMode = vi.fn();
    getCustomModels = vi.fn().mockReturnValue({});

    configMock = {
      getModel,
      isInFallbackMode,
      setModel,
      setFallbackMode,
      getCustomModels,
    } as unknown as Config;
    context = createMockCommandContext({
      services: { config: configMock },
    });
  });

  it('shows the current model and fallback info', () => {
    const currentSubCommand = getSubCommand('current');
    if (!currentSubCommand?.action) {
      throw new Error('Expected current subcommand to have an action.');
    }

    getModel.mockReturnValue('gemini-2.5-pro');
    isInFallbackMode.mockReturnValue(true);

    currentSubCommand.action(context, '');

    expect(context.ui.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.INFO,
        text: expect.stringContaining(`Current model: gemini-2.5-pro`),
      }),
      expect.any(Number),
    );
    expect(context.ui.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining(DEFAULT_GEMINI_FLASH_MODEL),
      }),
      expect.any(Number),
    );
  });

  it('lists built-in and custom models', () => {
    const listSubCommand = getSubCommand('list');
    if (!listSubCommand?.action) {
      throw new Error('Expected list subcommand to have an action.');
    }

    getCustomModels.mockReturnValue({
      'custom-model': {},
    } as unknown as ReturnType<Config['getCustomModels']>);

    listSubCommand.action(context, '');

    expect(context.ui.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.INFO,
        text: expect.stringContaining('custom-model'),
      }),
      expect.any(Number),
    );
    expect(context.ui.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('auto'),
      }),
      expect.any(Number),
    );
  });

  it('errors when /model use is missing arguments', () => {
    const useSubCommand = getSubCommand('use');
    if (!useSubCommand?.action) {
      throw new Error('Expected use subcommand to have an action.');
    }

    const result = useSubCommand.action(context, '   ');

    expect(result).toEqual({
      type: 'message',
      messageType: 'error',
      content: 'Usage: /model use <model-name>',
    });
  });

  it('switches models and clears fallback mode', () => {
    const useSubCommand = getSubCommand('use');
    if (!useSubCommand?.action) {
      throw new Error('Expected use subcommand to have an action.');
    }

    const result = useSubCommand.action(context, 'gemini-2.5-flash');

    expect(result).toBeUndefined();
    expect(setFallbackMode).toHaveBeenCalledWith(false);
    expect(setModel).toHaveBeenCalledWith('gemini-2.5-flash');
    expect(context.ui.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.INFO,
        text: expect.stringContaining('Switched to model'),
      }),
      expect.any(Number),
    );
  });

  it('prevents switching to pro while fallback active', () => {
    const useSubCommand = getSubCommand('use');
    if (!useSubCommand?.action) {
      throw new Error('Expected use subcommand to have an action.');
    }

    isInFallbackMode.mockReturnValue(true);

    const result = useSubCommand.action(context, 'gemini-2.5-pro');

    expect(result).toEqual({
      type: 'message',
      messageType: 'error',
      content:
        'Cannot switch to a Pro model while fallback mode is active. Resolve the quota issue or restart the session.',
    });
    expect(setModel).not.toHaveBeenCalled();
  });
});

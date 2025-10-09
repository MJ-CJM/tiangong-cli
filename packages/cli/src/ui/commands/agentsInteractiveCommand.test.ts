/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { agentsCommand } from './agentsCommand.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import { MessageType } from '../types.js';
import {
  clearAllSessions,
  listSessions,
} from '../../services/AgentCreationSessionStore.js';

describe('Agents Interactive Commands', () => {
  beforeEach(() => {
    clearAllSessions();
  });

  describe('/agents begin', () => {
    it('should start interactive creation session', async () => {
      const context = createMockCommandContext();
      const beginCommand = agentsCommand.subCommands?.find(
        (cmd) => cmd.name === 'begin'
      );

      expect(beginCommand).toBeDefined();
      await beginCommand?.action?.(context, '');

      // Should add an info message
      expect(context.ui.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.INFO,
          text: expect.stringContaining('Interactive Agent Creation Started'),
        }),
        expect.any(Number)
      );

      // Should create a session
      const sessions = listSessions();
      expect(sessions.length).toBe(1);

      // Message should contain session ID and first step prompt
      const call = vi.mocked(context.ui.addItem).mock.calls[0];
      const message = call[0].text;
      expect(message).toContain('Session ID:');
      expect(message).toContain('Step 1/8: Agent Name');
      expect(message).toContain('/agents next');
    });
  });

  describe('/agents status', () => {
    it('should show no sessions message when empty', async () => {
      const context = createMockCommandContext();
      const statusCommand = agentsCommand.subCommands?.find(
        (cmd) => cmd.name === 'status'
      );

      expect(statusCommand).toBeDefined();
      await statusCommand?.action?.(context, '');

      expect(context.ui.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.INFO,
          text: 'No active creation sessions.',
        }),
        expect.any(Number)
      );
    });

    it('should list all active sessions', async () => {
      const context = createMockCommandContext();
      const beginCommand = agentsCommand.subCommands?.find(
        (cmd) => cmd.name === 'begin'
      );
      const statusCommand = agentsCommand.subCommands?.find(
        (cmd) => cmd.name === 'status'
      );

      // Create two sessions
      await beginCommand?.action?.(context, '');
      await beginCommand?.action?.(context, '');

      const sessions = listSessions();
      expect(sessions.length).toBe(2);

      // Check status
      await statusCommand?.action?.(context, '');

      const call = vi.mocked(context.ui.addItem).mock.calls[2]; // Third call
      const message = call[0].text;
      expect(message).toContain('Active Creation Sessions');
      expect(message).toContain('(2)');
    });

    it('should show detailed status for specific session', async () => {
      const context = createMockCommandContext();
      const beginCommand = agentsCommand.subCommands?.find(
        (cmd) => cmd.name === 'begin'
      );
      const statusCommand = agentsCommand.subCommands?.find(
        (cmd) => cmd.name === 'status'
      );

      // Start session
      await beginCommand?.action?.(context, '');

      const sessions = listSessions();
      const sessionId = sessions[0];

      // Get status
      await statusCommand?.action?.(context, sessionId);

      const call = vi.mocked(context.ui.addItem).mock.calls[1];
      const message = call[0].text;
      expect(message).toContain('Creation Session Status');
      expect(message).toContain(sessionId);
      expect(message).toContain('Current Step:');
      expect(message).toContain('Name (name)');
      expect(message).toContain('Progress:');
    });
  });

  describe('/agents cancel', () => {
    it('should show error when no session ID provided', async () => {
      const context = createMockCommandContext();
      const cancelCommand = agentsCommand.subCommands?.find(
        (cmd) => cmd.name === 'cancel'
      );

      await cancelCommand?.action?.(context, '');

      expect(context.ui.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.ERROR,
          text: 'Usage: /agents cancel <session-id>',
        }),
        expect.any(Number)
      );
    });

    it('should show error for non-existent session', async () => {
      const context = createMockCommandContext();
      const cancelCommand = agentsCommand.subCommands?.find(
        (cmd) => cmd.name === 'cancel'
      );

      await cancelCommand?.action?.(context, 'non-existent-id');

      expect(context.ui.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.ERROR,
          text: expect.stringContaining('not found'),
        }),
        expect.any(Number)
      );
    });

    it('should cancel and delete session', async () => {
      const context = createMockCommandContext();
      const beginCommand = agentsCommand.subCommands?.find(
        (cmd) => cmd.name === 'begin'
      );
      const cancelCommand = agentsCommand.subCommands?.find(
        (cmd) => cmd.name === 'cancel'
      );

      // Create session
      await beginCommand?.action?.(context, '');
      const sessions = listSessions();
      expect(sessions.length).toBe(1);

      const sessionId = sessions[0];

      // Cancel session
      await cancelCommand?.action?.(context, sessionId);

      expect(context.ui.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.INFO,
          text: expect.stringContaining('cancelled and deleted'),
        }),
        expect.any(Number)
      );

      // Session should be deleted
      expect(listSessions().length).toBe(0);
    });
  });

  describe('/agents next', () => {
    it('should show error when no args provided', async () => {
      const context = createMockCommandContext();
      const nextCommand = agentsCommand.subCommands?.find(
        (cmd) => cmd.name === 'next'
      );

      await nextCommand?.action?.(context, '');

      expect(context.ui.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.ERROR,
          text: 'Usage: /agents next <session-id> <your-input>',
        }),
        expect.any(Number)
      );
    });

    it('should show error for non-existent session', async () => {
      const context = createMockCommandContext();
      const nextCommand = agentsCommand.subCommands?.find(
        (cmd) => cmd.name === 'next'
      );

      await nextCommand?.action?.(context, 'non-existent-id test-input');

      expect(context.ui.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.ERROR,
          text: expect.stringContaining('not found'),
        }),
        expect.any(Number)
      );
    });

    it('should validate agent name format', async () => {
      const context = createMockCommandContext();
      const beginCommand = agentsCommand.subCommands?.find(
        (cmd) => cmd.name === 'begin'
      );
      const nextCommand = agentsCommand.subCommands?.find(
        (cmd) => cmd.name === 'next'
      );

      // Start session
      await beginCommand?.action?.(context, '');
      const sessionId = listSessions()[0];

      // Try invalid name (uppercase)
      await nextCommand?.action?.(context, `${sessionId} InvalidName`);

      expect(context.ui.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.ERROR,
          text: expect.stringContaining('Invalid name format'),
        }),
        expect.any(Number)
      );
    });

    it('should accept valid agent name and move to next step', async () => {
      const context = createMockCommandContext();
      const beginCommand = agentsCommand.subCommands?.find(
        (cmd) => cmd.name === 'begin'
      );
      const nextCommand = agentsCommand.subCommands?.find(
        (cmd) => cmd.name === 'next'
      );

      // Start session
      await beginCommand?.action?.(context, '');
      const sessionId = listSessions()[0];

      // Provide valid name
      await nextCommand?.action?.(context, `${sessionId} test-agent`);

      const call = vi.mocked(context.ui.addItem).mock.calls[1];
      const message = call[0].text;
      expect(message).toContain('Input accepted');
      expect(message).toContain('Step 2/8: Display Title');
    });

    it('should allow skipping optional fields', async () => {
      const context = createMockCommandContext();
      const beginCommand = agentsCommand.subCommands?.find(
        (cmd) => cmd.name === 'begin'
      );
      const nextCommand = agentsCommand.subCommands?.find(
        (cmd) => cmd.name === 'next'
      );

      // Start session and set name
      await beginCommand?.action?.(context, '');
      const sessionId = listSessions()[0];
      await nextCommand?.action?.(context, `${sessionId} test-agent`);

      // Skip title (empty input)
      await nextCommand?.action?.(context, `${sessionId}`);

      const call = vi.mocked(context.ui.addItem).mock.calls[2];
      const message = call[0].text;
      expect(message).toContain('Step 3/8: Description');
    });

    it('should validate scope input', async () => {
      const context = createMockCommandContext();
      const beginCommand = agentsCommand.subCommands?.find(
        (cmd) => cmd.name === 'begin'
      );
      const nextCommand = agentsCommand.subCommands?.find(
        (cmd) => cmd.name === 'next'
      );

      // Navigate to scope step
      await beginCommand?.action?.(context, '');
      const sessionId = listSessions()[0];
      await nextCommand?.action?.(context, `${sessionId} test-agent`); // name
      await nextCommand?.action?.(context, `${sessionId}`); // skip title
      await nextCommand?.action?.(context, `${sessionId}`); // skip description

      // Try invalid scope
      await nextCommand?.action?.(context, `${sessionId} 3`);

      expect(context.ui.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.ERROR,
          text: expect.stringContaining('Please enter 1 (project) or 2 (global)'),
        }),
        expect.any(Number)
      );

      // Try valid scope
      await nextCommand?.action?.(context, `${sessionId} 1`);

      // Find the last call that contains the next step
      const calls = vi.mocked(context.ui.addItem).mock.calls;
      const lastCall = calls[calls.length - 1];
      const message = lastCall[0].text;
      expect(message).toContain('Step 5/8: Model');
    });
  });
});

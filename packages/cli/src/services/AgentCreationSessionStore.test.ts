/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AgentCreationSession } from '@google/gemini-cli-core';
import {
  saveSession,
  loadSession,
  deleteSession,
  hasSession,
  listSessions,
  clearAllSessions,
  getSessionCount,
} from './AgentCreationSessionStore.js';

describe('AgentCreationSessionStore', () => {
  beforeEach(() => {
    clearAllSessions();
  });

  describe('saveSession and loadSession', () => {
    it('should save and load a session', () => {
      const session = new AgentCreationSession();
      const sessionId = session.getState().sessionId;

      saveSession(sessionId, session);

      const loaded = loadSession(sessionId);
      expect(loaded).toBeDefined();
      expect(loaded?.getState().sessionId).toBe(sessionId);
    });

    it('should return null for non-existent session', () => {
      const loaded = loadSession('non-existent-id');
      expect(loaded).toBeNull();
    });
  });

  describe('deleteSession', () => {
    it('should delete a session', () => {
      const session = new AgentCreationSession();
      const sessionId = session.getState().sessionId;

      saveSession(sessionId, session);
      expect(hasSession(sessionId)).toBe(true);

      const deleted = deleteSession(sessionId);
      expect(deleted).toBe(true);
      expect(hasSession(sessionId)).toBe(false);
    });

    it('should return false when deleting non-existent session', () => {
      const deleted = deleteSession('non-existent-id');
      expect(deleted).toBe(false);
    });
  });

  describe('hasSession', () => {
    it('should return true for existing session', () => {
      const session = new AgentCreationSession();
      const sessionId = session.getState().sessionId;

      saveSession(sessionId, session);
      expect(hasSession(sessionId)).toBe(true);
    });

    it('should return false for non-existent session', () => {
      expect(hasSession('non-existent-id')).toBe(false);
    });
  });

  describe('listSessions', () => {
    it('should return empty array when no sessions', () => {
      const sessions = listSessions();
      expect(sessions).toEqual([]);
    });

    it('should return all session IDs', () => {
      const session1 = new AgentCreationSession();
      const session2 = new AgentCreationSession();
      const id1 = session1.getState().sessionId;
      const id2 = session2.getState().sessionId;

      saveSession(id1, session1);
      saveSession(id2, session2);

      const sessions = listSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions).toContain(id1);
      expect(sessions).toContain(id2);
    });
  });

  describe('clearAllSessions', () => {
    it('should clear all sessions', () => {
      const session1 = new AgentCreationSession();
      const session2 = new AgentCreationSession();

      saveSession(session1.getState().sessionId, session1);
      saveSession(session2.getState().sessionId, session2);

      expect(getSessionCount()).toBe(2);

      clearAllSessions();

      expect(getSessionCount()).toBe(0);
      expect(listSessions()).toEqual([]);
    });
  });

  describe('getSessionCount', () => {
    it('should return 0 when no sessions', () => {
      expect(getSessionCount()).toBe(0);
    });

    it('should return correct count', () => {
      const session1 = new AgentCreationSession();
      const session2 = new AgentCreationSession();

      saveSession(session1.getState().sessionId, session1);
      expect(getSessionCount()).toBe(1);

      saveSession(session2.getState().sessionId, session2);
      expect(getSessionCount()).toBe(2);

      deleteSession(session1.getState().sessionId);
      expect(getSessionCount()).toBe(1);
    });
  });

  describe('session state persistence', () => {
    it('should preserve session state across save/load', () => {
      const session = new AgentCreationSession();
      const sessionId = session.getState().sessionId;

      // Modify session state
      session.setName('test-agent');
      session.setScope('project');
      session.setModel('gemini-2.0-flash');

      // Save and load
      saveSession(sessionId, session);
      const loaded = loadSession(sessionId);

      // Verify state
      expect(loaded).toBeDefined();
      const state = loaded!.getState();
      expect(state.name).toBe('test-agent');
      expect(state.scope).toBe('project');
      expect(state.model).toBe('gemini-2.0-flash');
    });
  });
});

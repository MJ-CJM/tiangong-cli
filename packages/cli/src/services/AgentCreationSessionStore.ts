/**
 * @license
 * Copyright 2025 Gemini CLI
 * SPDX-License-Identifier: MIT
 */

import { AgentCreationSession } from '@google/gemini-cli-core';

/**
 * In-memory storage for agent creation sessions
 * This allows users to create agents interactively across multiple commands
 */
class AgentCreationSessionStore {
  private sessions: Map<string, AgentCreationSession> = new Map();

  /**
   * Save a session
   */
  save(id: string, session: AgentCreationSession): void {
    this.sessions.set(id, session);
  }

  /**
   * Load a session by ID
   */
  load(id: string): AgentCreationSession | null {
    return this.sessions.get(id) || null;
  }

  /**
   * Delete a session
   */
  delete(id: string): boolean {
    return this.sessions.delete(id);
  }

  /**
   * Check if a session exists
   */
  has(id: string): boolean {
    return this.sessions.has(id);
  }

  /**
   * Get all active session IDs
   */
  listSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Clear all sessions
   */
  clear(): void {
    this.sessions.clear();
  }

  /**
   * Get session count
   */
  count(): number {
    return this.sessions.size;
  }
}

// Singleton instance
const store = new AgentCreationSessionStore();

export function saveSession(id: string, session: AgentCreationSession): void {
  store.save(id, session);
}

export function loadSession(id: string): AgentCreationSession | null {
  return store.load(id);
}

export function deleteSession(id: string): boolean {
  return store.delete(id);
}

export function hasSession(id: string): boolean {
  return store.has(id);
}

export function listSessions(): string[] {
  return store.listSessions();
}

export function clearAllSessions(): void {
  store.clear();
}

export function getSessionCount(): number {
  return store.count();
}

/**
 * @license
 * Copyright 2025 Gemini CLI
 * SPDX-License-Identifier: MIT
 */

/**
 * Agent command processor - detects natural language agent invocations
 *
 * Supported patterns:
 * - "使用 <agent-name> agent ..."
 * - "用 <agent-name> agent ..."
 * - "让 <agent-name> agent ..."
 * - "@<agent-name> ..."
 */

export interface AgentCommandMatch {
  /** Detected agent name */
  agentName: string;
  /** The actual prompt (without the agent reference) */
  prompt: string;
  /** Original full query */
  originalQuery: string;
}

/**
 * Detects if a query contains an agent invocation pattern
 *
 * @param query - User input query
 * @returns Match result or null if no agent pattern detected
 */
export function detectAgentCommand(query: string): AgentCommandMatch | null {
  const trimmed = query.trim();

  // Pattern 1: "使用 <agent-name> agent ..."
  // Pattern 2: "用 <agent-name> agent ..."
  const useAgentPattern = /^(?:使用|用)\s+([a-z][a-z0-9_-]*)\s+agent\s+(.+)$/i;
  let match = trimmed.match(useAgentPattern);

  if (match) {
    return {
      agentName: match[1],
      prompt: match[2].trim(),
      originalQuery: query,
    };
  }

  // Pattern 3: "让 <agent-name> agent ..."
  const letAgentPattern = /^让\s+([a-z][a-z0-9_-]*)\s+agent\s+(.+)$/i;
  match = trimmed.match(letAgentPattern);

  if (match) {
    return {
      agentName: match[1],
      prompt: match[2].trim(),
      originalQuery: query,
    };
  }

  // Pattern 4: "@<agent-name> ..."
  const atAgentPattern = /^@([a-z][a-z0-9_-]*)\s+(.+)$/i;
  match = trimmed.match(atAgentPattern);

  if (match) {
    return {
      agentName: match[1],
      prompt: match[2].trim(),
      originalQuery: query,
    };
  }

  // Pattern 5: "使用 <agent-name> ..." (without "agent" keyword)
  const useShortPattern = /^(?:使用|用)\s+([a-z][a-z0-9_-]*)\s+(.+)$/i;
  match = trimmed.match(useShortPattern);

  if (match) {
    // Only match if it looks like an agent name (has _ or -)
    const name = match[1];
    if (name.includes('_') || name.includes('-')) {
      return {
        agentName: name,
        prompt: match[2].trim(),
        originalQuery: query,
      };
    }
  }

  return null;
}

/**
 * Check if a query looks like it might be an agent command
 * (Quick check before full parsing)
 */
export function isAgentCommand(query: string): boolean {
  const trimmed = query.trim();

  // Quick check for common patterns
  if (trimmed.startsWith('@')) {
    return true;
  }

  if (trimmed.startsWith('使用 ') || trimmed.startsWith('用 ') || trimmed.startsWith('让 ')) {
    return /agent|[a-z_-]+\s/.test(trimmed);
  }

  return false;
}

/**
 * @license
 * Copyright 2025 Gemini CLI
 * SPDX-License-Identifier: MIT
 */

import * as crypto from 'node:crypto';
import type { AgentManager } from './AgentManager.js';
import type {
  AgentDefinition,
  HandoffContext,
  HandoffConfig,
} from './types.js';
import { HandoffError } from './types.js';
import type { UnifiedMessage } from '../adapters/base/types.js';

/**
 * Maximum depth for handoff chains to prevent infinite loops
 */
const MAX_HANDOFF_DEPTH = 5;

/**
 * Manages agent-to-agent handoffs with validation and safety checks
 *
 * Key features:
 * - Circular handoff detection
 * - Maximum depth enforcement
 * - Context passing between agents
 * - Handoff chain tracking
 */
export class HandoffManager {
  // Track active handoff chains to detect circular handoffs
  private activeHandoffs: Map<string, string[]> = new Map();

  constructor(private agentManager: AgentManager) {}

  /**
   * Initiate a handoff from one agent to another
   *
   * @param fromAgent Source agent name
   * @param toAgent Target agent name
   * @param reason Reason for handoff
   * @param context Optional context data
   * @param conversationHistory Optional conversation history to pass
   * @param existingChain Optional existing handoff chain (for recursive calls)
   * @returns HandoffContext for the target agent
   * @throws HandoffError if handoff is invalid or unsafe
   */
  async initiateHandoff(
    fromAgent: string,
    toAgent: string,
    reason: string,
    context?: string,
    conversationHistory?: UnifiedMessage[],
    existingChain?: string[]
  ): Promise<HandoffContext> {
    console.log(`[HandoffManager] Initiating handoff: ${fromAgent} -> ${toAgent}`);

    // Validate agents exist
    const sourceAgent = this.agentManager.getAgent(fromAgent);
    if (!sourceAgent) {
      throw new HandoffError(`Source agent '${fromAgent}' not found`, 'AGENT_NOT_FOUND');
    }

    const targetAgent = this.agentManager.getAgent(toAgent);
    if (!targetAgent) {
      throw new HandoffError(`Target agent '${toAgent}' not found`, 'AGENT_NOT_FOUND');
    }

    // Check if handoff is configured
    const handoffConfig = this.findHandoffConfig(sourceAgent, toAgent);
    if (!handoffConfig) {
      throw new HandoffError(
        `No handoff configured from '${fromAgent}' to '${toAgent}'`,
        'PERMISSION_DENIED'
      );
    }

    // Build or extend handoff chain
    const handoffChain = existingChain || [];
    handoffChain.push(fromAgent);

    // Check for circular handoffs
    if (handoffChain.includes(toAgent)) {
      throw new HandoffError(
        `Circular handoff detected: ${handoffChain.join(' -> ')} -> ${toAgent}`,
        'CIRCULAR_HANDOFF'
      );
    }

    // Check maximum depth
    if (handoffChain.length >= MAX_HANDOFF_DEPTH) {
      throw new HandoffError(
        `Maximum handoff depth (${MAX_HANDOFF_DEPTH}) exceeded: ${handoffChain.join(' -> ')}`,
        'MAX_DEPTH_EXCEEDED'
      );
    }

    // Generate correlation ID for tracking
    const correlationId = this.generateCorrelationId();

    // Build handoff context
    const handoffContext: HandoffContext = {
      from_agent: fromAgent,
      to_agent: toAgent,
      reason,
      context,
      summary: this.buildSummary(fromAgent, toAgent, reason),
      payload: {},
      conversation_history:
        handoffConfig.include_context !== false ? conversationHistory : undefined,
      metadata: {
        timestamp: Date.now(),
        handoff_chain: [...handoffChain],
        chain_depth: handoffChain.length,
        correlation_id: correlationId,
      },
    };

    // Track active handoff
    this.activeHandoffs.set(correlationId, handoffChain);

    console.log(
      `[HandoffManager] Handoff created: ${fromAgent} -> ${toAgent} (depth: ${handoffChain.length}, correlation: ${correlationId})`
    );

    return handoffContext;
  }

  /**
   * Complete a handoff and clean up tracking
   *
   * @param handoffContext The handoff context to complete
   */
  completeHandoff(handoffContext: HandoffContext): void {
    const correlationId = handoffContext.metadata.correlation_id;
    this.activeHandoffs.delete(correlationId);
    console.log(
      `[HandoffManager] Handoff completed: ${handoffContext.from_agent} -> ${handoffContext.to_agent} (correlation: ${correlationId})`
    );
  }

  /**
   * Check if a handoff is configured from source to target agent
   *
   * @param fromAgent Source agent name
   * @param toAgent Target agent name
   * @returns True if handoff is configured
   */
  isHandoffConfigured(fromAgent: string, toAgent: string): boolean {
    const sourceAgent = this.agentManager.getAgent(fromAgent);
    if (!sourceAgent) {
      return false;
    }

    return this.findHandoffConfig(sourceAgent, toAgent) !== null;
  }

  /**
   * Get all configured handoffs for an agent
   *
   * @param agentName Agent name
   * @returns Array of handoff configurations
   */
  getConfiguredHandoffs(agentName: string): HandoffConfig[] {
    const agent = this.agentManager.getAgent(agentName);
    if (!agent?.handoffs) {
      return [];
    }

    return agent.handoffs.map(h => ({
      to: h.to,
      when: h.when || 'manual',
      description: h.description || `Handoff to ${h.to}`,
      include_context: h.include_context,
    }));
  }

  /**
   * Find handoff configuration from source agent to target agent
   */
  private findHandoffConfig(
    sourceAgent: AgentDefinition,
    toAgent: string
  ): HandoffConfig | null {
    if (!sourceAgent.handoffs) {
      return null;
    }

    const handoff = sourceAgent.handoffs.find(h => h.to === toAgent);
    if (!handoff) {
      return null;
    }

    return {
      to: handoff.to,
      when: handoff.when || 'manual',
      description: handoff.description || `Handoff to ${handoff.to}`,
      include_context: handoff.include_context,
    };
  }

  /**
   * Build a summary of the handoff for context
   */
  private buildSummary(fromAgent: string, toAgent: string, reason: string): string {
    return `Agent '${fromAgent}' is handing off to agent '${toAgent}'. Reason: ${reason}`;
  }

  /**
   * Generate a unique correlation ID for tracking handoff chains
   */
  private generateCorrelationId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Get active handoff chains (for debugging/monitoring)
   */
  getActiveHandoffs(): Map<string, string[]> {
    return new Map(this.activeHandoffs);
  }

  /**
   * Validate if a handoff can proceed (safety checks)
   *
   * @param fromAgent Source agent
   * @param toAgent Target agent
   * @param existingChain Existing handoff chain
   * @returns Validation result with error message if invalid
   */
  validateHandoff(
    fromAgent: string,
    toAgent: string,
    existingChain?: string[]
  ): { valid: boolean; error?: string } {
    // Check if source agent exists
    const sourceAgent = this.agentManager.getAgent(fromAgent);
    if (!sourceAgent) {
      return { valid: false, error: `Source agent '${fromAgent}' not found` };
    }

    // Check if target agent exists
    const targetAgent = this.agentManager.getAgent(toAgent);
    if (!targetAgent) {
      return { valid: false, error: `Target agent '${toAgent}' not found` };
    }

    // Check if handoff is configured
    if (!this.findHandoffConfig(sourceAgent, toAgent)) {
      return {
        valid: false,
        error: `No handoff configured from '${fromAgent}' to '${toAgent}'`,
      };
    }

    // Check for circular handoffs
    if (existingChain?.includes(toAgent)) {
      return {
        valid: false,
        error: `Circular handoff detected: ${existingChain.join(' -> ')} -> ${toAgent}`,
      };
    }

    // Check maximum depth
    if (existingChain && existingChain.length >= MAX_HANDOFF_DEPTH) {
      return {
        valid: false,
        error: `Maximum handoff depth (${MAX_HANDOFF_DEPTH}) exceeded`,
      };
    }

    return { valid: true };
  }
}

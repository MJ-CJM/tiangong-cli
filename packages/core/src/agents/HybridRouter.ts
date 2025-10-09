/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { RuleRouter } from './RuleRouter.js';
import type { LLMRouter } from './LLMRouter.js';
import type { RoutingScore } from './types.js';

/**
 * Hybrid router that combines rule-based and LLM-based routing strategies
 *
 * Strategy:
 * 1. Try rule-based routing first (fast, < 10ms)
 * 2. If confidence >= threshold, use rule result
 * 3. Otherwise, fall back to LLM routing (slower, 1-3s)
 */
export class HybridRouter {
  constructor(
    private ruleRouter: RuleRouter,
    private llmRouter: LLMRouter,
    private confidenceThreshold: number
  ) {}

  /**
   * Route user input using hybrid strategy
   * @param userInput User's input text
   * @returns Best matching agent score or null if no match
   */
  async route(userInput: string): Promise<RoutingScore | null> {
    console.log('[HybridRouter] Starting hybrid routing...');

    // Step 1: Try rule-based routing first (fast path)
    console.log('[HybridRouter] Attempting rule-based routing...');
    const ruleResult = await this.ruleRouter.route(userInput);

    if (ruleResult) {
      console.log(
        `[HybridRouter] Rule-based result: agent=${ruleResult.agent.name}, confidence=${ruleResult.confidence}`
      );

      // Check if confidence meets threshold
      if (ruleResult.confidence >= this.confidenceThreshold) {
        console.log(
          `[HybridRouter] Confidence ${ruleResult.confidence} >= threshold ${this.confidenceThreshold}, using rule result`
        );
        return ruleResult;
      }

      console.log(
        `[HybridRouter] Confidence ${ruleResult.confidence} < threshold ${this.confidenceThreshold}, falling back to LLM`
      );
    } else {
      console.log('[HybridRouter] No rule-based match found, falling back to LLM');
    }

    // Step 2: Fall back to LLM routing (slower but more intelligent)
    console.log('[HybridRouter] Attempting LLM-based routing...');
    const llmResult = await this.llmRouter.route(userInput);

    if (llmResult) {
      console.log(
        `[HybridRouter] LLM-based result: agent=${llmResult.agent.name}, confidence=${llmResult.confidence}`
      );
      return llmResult;
    }

    console.log('[HybridRouter] No LLM-based match found');
    return null;
  }

  /**
   * Update confidence threshold
   * @param threshold New confidence threshold (0-100)
   */
  setConfidenceThreshold(threshold: number): void {
    if (threshold < 0 || threshold > 100) {
      throw new Error('Confidence threshold must be between 0 and 100');
    }
    this.confidenceThreshold = threshold;
    console.log(`[HybridRouter] Updated confidence threshold to ${threshold}`);
  }

  /**
   * Get current confidence threshold
   */
  getConfidenceThreshold(): number {
    return this.confidenceThreshold;
  }
}

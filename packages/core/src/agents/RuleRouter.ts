/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AgentManager } from './AgentManager.js';
import type { AgentDefinition, RoutingScore } from './types.js';

/**
 * Rule-based router using keyword and regex pattern matching
 */
export class RuleRouter {
  constructor(private agentManager: AgentManager) {}

  /**
   * Route user input to the best matching agent using rule-based scoring
   * @param userInput User's input text
   * @returns Best matching agent score or null if no match
   */
  async route(userInput: string): Promise<RoutingScore | null> {
    const agents = await this.agentManager.listAgents();
    const scores: RoutingScore[] = [];

    for (const agent of agents) {
      const agentDef = await this.agentManager.getAgent(agent.name);
      if (!agentDef?.triggers) continue;

      const score = this.calculateScore(agentDef, userInput);
      if (score.score > 0) {
        scores.push(score);
      }
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    return scores[0] || null;
  }

  /**
   * Calculate routing score for an agent based on triggers
   * @param agent Agent definition with triggers
   * @param input User input text
   * @returns Routing score with matched keywords and patterns
   */
  private calculateScore(agent: AgentDefinition, input: string): RoutingScore {
    const matchedKeywords: string[] = [];
    const matchedPatterns: string[] = [];
    let score = 0;

    const lowerInput = input.toLowerCase();

    // 1. Keyword matching (+10 points each)
    for (const keyword of agent.triggers?.keywords || []) {
      if (lowerInput.includes(keyword.toLowerCase())) {
        score += 10;
        matchedKeywords.push(keyword);
      }
    }

    // 2. Regex pattern matching (+20 points each)
    for (const pattern of agent.triggers?.patterns || []) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(input)) {
          score += 20;
          matchedPatterns.push(pattern);
        }
      } catch (e) {
        // Ignore invalid regex patterns
        console.warn(`Invalid regex pattern in agent ${agent.name}: ${pattern}`);
      }
    }

    // 3. Apply priority weight (0-100, default 50)
    const priority = agent.triggers?.priority ?? 50;
    score = Math.round(score * (priority / 100));

    // 4. Calculate confidence (0-100)
    // Base confidence on number of matches and score
    const matchCount = matchedKeywords.length + matchedPatterns.length;
    const baseConfidence = Math.min(100, score);

    // Boost confidence if multiple matches
    const confidenceBoost = matchCount > 1 ? 10 : 0;
    const confidence = Math.min(100, baseConfidence + confidenceBoost);

    return {
      agent,
      score,
      confidence,
      matchedKeywords,
      matchedPatterns,
    };
  }
}

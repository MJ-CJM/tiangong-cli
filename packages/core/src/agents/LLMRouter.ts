/**
 * @license
 * Copyright 2025 Gemini CLI
 * SPDX-License-Identifier: MIT
 */

import type { AgentManager } from './AgentManager.js';
import type { RoutingScore, RoutingConfig } from './types.js';
import type { ModelService } from '../services/modelService.js';
import type { UnifiedRequest } from '../adapters/base/types.js';
import { MessageRole } from '../adapters/base/types.js';

/**
 * LLM-based router using intelligent model inference to select the best agent
 */
export class LLMRouter {
  constructor(
    private agentManager: AgentManager,
    private modelService: ModelService,
    private config: RoutingConfig['llm']
  ) {}

  /**
   * Route user input to the best matching agent using LLM decision
   * @param userInput User's input text
   * @returns Best matching agent score or null if no match
   */
  async route(userInput: string): Promise<RoutingScore | null> {
    const agents = await this.agentManager.listAgents();

    if (agents.length === 0) {
      return null;
    }

    // Build agent descriptions for the routing prompt
    const agentDescriptions = agents
      .map((agent, idx) => {
        return `${idx + 1}. **${agent.name}**\n   - Title: ${agent.title}\n   - Description: ${agent.description || 'No description'}`;
      })
      .join('\n\n');

    // Create routing prompt
    const routingPrompt = `You are an intelligent agent router. Given a user's input, select the most appropriate agent to handle the request.

Available agents:
${agentDescriptions}

User input: "${userInput}"

Analyze the user's request and determine which agent is best suited to handle it. Consider:
1. The agent's title and description
2. The specific task or domain of the user's request
3. Which agent's expertise best matches the request

Respond with a JSON object in this exact format:
{
  "agent_name": "selected-agent-name",
  "confidence": 85,
  "reasoning": "Brief explanation of why this agent was selected"
}

The confidence should be a number from 0-100 indicating how confident you are in this selection.
If no agent is suitable, use confidence 0.`;

    try {
      // Call the LLM with timeout
      const request: UnifiedRequest = {
        model: this.config.model,
        messages: [
          {
            role: MessageRole.USER,
            content: [
              {
                type: 'text',
                text: routingPrompt,
              },
            ],
          },
        ],
        temperature: 0.1, // Low temperature for consistent routing decisions
        maxTokens: 500,
      };

      // Execute with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('LLM routing timeout')), this.config.timeout);
      });

      const responsePromise = this.modelService.generateContent(request);
      const response = await Promise.race([responsePromise, timeoutPromise]);

      // Extract text from response
      const textParts = response.content.filter(part => part.type === 'text');
      if (textParts.length === 0) {
        console.warn('[LLMRouter] No text response from model');
        return null;
      }

      const responseText = textParts.map(part => part.text).join('');

      // Parse JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[LLMRouter] No JSON found in response:', responseText);
        return null;
      }

      const decision = JSON.parse(jsonMatch[0]);

      // Validate response format
      if (!decision.agent_name || typeof decision.confidence !== 'number') {
        console.warn('[LLMRouter] Invalid response format:', decision);
        return null;
      }

      // Get the selected agent
      const selectedAgent = await this.agentManager.getAgent(decision.agent_name);
      if (!selectedAgent) {
        console.warn(`[LLMRouter] Agent not found: ${decision.agent_name}`);
        return null;
      }

      // Return routing score
      return {
        agent: selectedAgent,
        score: decision.confidence,
        confidence: decision.confidence,
        matchedKeywords: [], // LLM routing doesn't use keyword matching
        matchedPatterns: [], // LLM routing doesn't use pattern matching
      };
    } catch (error) {
      console.error('[LLMRouter] Error during routing:', error);
      return null;
    }
  }
}

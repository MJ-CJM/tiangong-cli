/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ModelService } from '../services/modelService.js';
import type { UnifiedRequest } from '../adapters/base/types.js';
import { MessageRole } from '../adapters/base/types.js';

export interface GeneratedAgentContent {
  systemPrompt: string;
  role: string;
  responsibilities: string[];
  guidelines: string[];
  constraints: string[];
}

/**
 * Generates agent content using AI based on a purpose description
 */
export class AgentContentGenerator {
  constructor(private modelService: ModelService) {}

  async generateContent(
    purpose: string,
    agentName: string,
    agentTitle: string,
  ): Promise<GeneratedAgentContent> {
    const prompt = this.buildPrompt(purpose, agentName, agentTitle);

    const request: UnifiedRequest = {
      messages: [
        {
          role: MessageRole.USER,
          content: [{ type: 'text', text: prompt }],
        },
      ],
      systemMessage:
        'You are an expert at designing AI agent specifications. Generate clear, concise, and actionable agent definitions.',
    };

    // Call the model service
    const response = await this.modelService.generateContent(request);

    // Extract text from response
    const textParts = response.content.filter(
      (part: any) => part.type === 'text',
    );
    const generatedText = textParts.map((p: any) => p.text).join('\n');

    return this.parseGeneratedContent(generatedText);
  }

  private buildPrompt(
    purpose: string,
    agentName: string,
    agentTitle: string,
  ): string {
    return `You are creating an AI agent specification.

**Agent Details:**
- Name: ${agentName}
- Title: ${agentTitle}
- Purpose: ${purpose}

Please generate a complete agent specification in the following format:

# Role
[A clear, concise description of the agent's role in 2-3 sentences]

## Responsibilities
[List 3-5 specific responsibilities, each as a bullet point]

## Guidelines
[List 3-5 guidelines for how the agent should operate, each as a bullet point]

## Constraints
[List 2-4 constraints or limitations, each as a bullet point]

**Important:**
- Be specific and actionable
- Use imperative language ("Analyze errors", "Provide suggestions")
- Keep each point concise (1-2 sentences max)
- Focus on the agent's unique purpose: ${purpose}

Generate the content now:`;
  }

  private parseGeneratedContent(text: string): GeneratedAgentContent {
    const lines = text.split('\n');
    let role = '';
    const responsibilities: string[] = [];
    const guidelines: string[] = [];
    const constraints: string[] = [];

    let currentSection: 'role' | 'responsibilities' | 'guidelines' | 'constraints' | null = null;
    const roleLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('# Role')) {
        currentSection = 'role';
        continue;
      } else if (trimmed.startsWith('## Responsibilities')) {
        currentSection = 'responsibilities';
        continue;
      } else if (trimmed.startsWith('## Guidelines')) {
        currentSection = 'guidelines';
        continue;
      } else if (trimmed.startsWith('## Constraints')) {
        currentSection = 'constraints';
        continue;
      }

      if (!trimmed || trimmed.startsWith('#')) continue;

      if (currentSection === 'role') {
        roleLines.push(trimmed);
      } else if (currentSection === 'responsibilities' && trimmed.startsWith('-')) {
        responsibilities.push(trimmed.substring(1).trim());
      } else if (currentSection === 'guidelines' && trimmed.startsWith('-')) {
        guidelines.push(trimmed.substring(1).trim());
      } else if (currentSection === 'constraints' && trimmed.startsWith('-')) {
        constraints.push(trimmed.substring(1).trim());
      }
    }

    role = roleLines.join(' ').trim();

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(
      role,
      responsibilities,
      guidelines,
      constraints,
    );

    return {
      systemPrompt,
      role,
      responsibilities,
      guidelines,
      constraints,
    };
  }

  private buildSystemPrompt(
    role: string,
    responsibilities: string[],
    guidelines: string[],
    constraints: string[],
  ): string {
    let prompt = `# Role\n\n${role}\n\n`;

    if (responsibilities.length > 0) {
      prompt += `## Responsibilities\n\n`;
      for (const resp of responsibilities) {
        prompt += `- ${resp}\n`;
      }
      prompt += '\n';
    }

    if (guidelines.length > 0) {
      prompt += `## Guidelines\n\n`;
      for (const guide of guidelines) {
        prompt += `- ${guide}\n`;
      }
      prompt += '\n';
    }

    if (constraints.length > 0) {
      prompt += `## Constraints\n\n`;
      for (const constraint of constraints) {
        prompt += `- ${constraint}\n`;
      }
    }

    return prompt.trim();
  }
}

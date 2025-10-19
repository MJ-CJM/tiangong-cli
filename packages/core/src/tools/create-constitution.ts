/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ToolInvocation } from './tools.js';
import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
  type ToolResult,
} from './tools.js';
import type { Constitution } from '../spec/types.js';
import type { Config } from '../config/config.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Parameters for the create_constitution tool
 */
export interface ConstitutionParams {
  version: string;
  principles: string[];
  constraints: string[];
  qualityStandards: {
    testing: string;
    security: string;
    performance: string;
    accessibility?: string;
  };
  architectureGuidelines: string[];
  codingStandards?: string[];
}

class CreateConstitutionToolInvocation extends BaseToolInvocation<
  ConstitutionParams,
  ToolResult
> {
  constructor(
    params: ConstitutionParams,
    private readonly config: Config,
  ) {
    super(params);
  }

  getDescription(): string {
    return `Create constitution version ${this.params.version}`;
  }

  async execute(
    _signal: AbortSignal,
    _updateOutput?: (output: string) => void,
  ): Promise<ToolResult> {
    const constitution: Constitution = {
      version: this.params.version,
      principles: this.params.principles,
      constraints: this.params.constraints,
      qualityStandards: this.params.qualityStandards,
      architectureGuidelines: this.params.architectureGuidelines,
      codingStandards: this.params.codingStandards,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Validate constitution
    if (constitution.principles.length === 0) {
      return {
        llmContent: 'Failed to create constitution: must have at least one principle',
        returnDisplay: '❌ Constitution must have at least one principle',
        error: {
          message: 'Constitution must have at least one principle',
        },
      };
    }

    // Ensure .gemini/specs directory exists
    const specsDir = path.join(this.config.getWorkingDir(), '.gemini', 'specs');
    if (!fs.existsSync(specsDir)) {
      fs.mkdirSync(specsDir, { recursive: true });
    }

    // Save constitution
    const constitutionPath = path.join(specsDir, 'constitution.json');
    const existingConstitution = fs.existsSync(constitutionPath);

    fs.writeFileSync(
      constitutionPath,
      JSON.stringify(constitution, null, 2),
      'utf-8'
    );

    let output = existingConstitution
      ? '✅ **Constitution Updated Successfully**\n\n'
      : '✅ **Constitution Created Successfully**\n\n';

    output += `📁 Saved to: \`.gemini/specs/constitution.json\`\n\n`;
    output += `## Constitution Summary\n\n`;
    output += `**Version**: ${constitution.version}\n\n`;
    output += `### 🎯 Core Principles (${constitution.principles.length})\n`;
    constitution.principles.forEach((p, i) => {
      output += `${i + 1}. ${p}\n`;
    });
    output += '\n';

    if (constitution.constraints.length > 0) {
      output += `### ⚠️ Technical Constraints (${constitution.constraints.length})\n`;
      constitution.constraints.forEach((c, i) => {
        output += `${i + 1}. ${c}\n`;
      });
      output += '\n';
    }

    output += `### ✅ Quality Standards\n`;
    output += `- **Testing**: ${constitution.qualityStandards.testing}\n`;
    output += `- **Security**: ${constitution.qualityStandards.security}\n`;
    output += `- **Performance**: ${constitution.qualityStandards.performance}\n`;
    if (constitution.qualityStandards.accessibility) {
      output += `- **Accessibility**: ${constitution.qualityStandards.accessibility}\n`;
    }
    output += '\n';

    if (constitution.architectureGuidelines.length > 0) {
      output += `### 🏗️ Architecture Guidelines (${constitution.architectureGuidelines.length})\n`;
      constitution.architectureGuidelines.forEach((g, i) => {
        output += `${i + 1}. ${g}\n`;
      });
      output += '\n';
    }

    if (constitution.codingStandards && constitution.codingStandards.length > 0) {
      output += `### 📝 Coding Standards (${constitution.codingStandards.length})\n`;
      constitution.codingStandards.forEach((s, i) => {
        output += `${i + 1}. ${s}\n`;
      });
      output += '\n';
    }

    output += `💡 **Next Steps**:\n`;
    output += `- Create specifications with \`/speckit.specify\`\n`;
    output += `- View constitution with \`/speckit.constitution show\`\n`;

    return {
      llmContent: `Successfully created constitution version ${constitution.version} with ${constitution.principles.length} principles`,
      returnDisplay: output,
    };
  }
}

export class CreateConstitutionTool extends BaseDeclarativeTool<
  ConstitutionParams,
  ToolResult
> {
  static readonly Name: string = 'create_constitution';

  constructor(private readonly config: Config) {
    super(
      CreateConstitutionTool.Name,
      'Create Constitution',
      `Create or update the project's constitution - engineering principles, technical constraints, quality standards, and architecture guidelines.

The constitution serves as the foundation for all specifications and technical plans. It should be created once and updated as the project evolves.

Use this tool when:
- Initializing a new project's engineering standards
- Updating project-wide principles or constraints
- Establishing quality standards for the team

Constitution includes:
- Core engineering principles (e.g., "Prefer composition over inheritance")
- Technical constraints (e.g., "Must support Node.js 20+", "No external dependencies allowed")
- Quality standards for testing, security, performance, and accessibility
- Architecture guidelines (e.g., "Use layered architecture", "Follow Clean Architecture principles")
- Coding standards (optional, e.g., "Use TypeScript strict mode", "Follow Airbnb style guide")`,
      Kind.Other,
      {
        type: 'object',
        properties: {
          version: {
            type: 'string',
            description: 'Version of the constitution (e.g., "1.0.0")',
          },
          principles: {
            type: 'array',
            description: 'Core engineering principles',
            items: { type: 'string' },
          },
          constraints: {
            type: 'array',
            description: 'Technical constraints and limitations',
            items: { type: 'string' },
          },
          qualityStandards: {
            type: 'object',
            description: 'Quality standards for the project',
            properties: {
              testing: {
                type: 'string',
                description: 'Testing requirements and standards',
              },
              security: {
                type: 'string',
                description: 'Security requirements and standards',
              },
              performance: {
                type: 'string',
                description: 'Performance requirements and standards',
              },
              accessibility: {
                type: 'string',
                description: 'Accessibility requirements (optional)',
              },
            },
            required: ['testing', 'security', 'performance'],
          },
          architectureGuidelines: {
            type: 'array',
            description: 'Architecture guidelines and best practices',
            items: { type: 'string' },
          },
          codingStandards: {
            type: 'array',
            description: 'Coding standards (optional)',
            items: { type: 'string' },
          },
        },
        required: ['version', 'principles', 'constraints', 'qualityStandards', 'architectureGuidelines'],
      },
    );
  }

  protected override validateToolParamValues(
    params: ConstitutionParams,
  ): string | null {
    if (!params || typeof params !== 'object') {
      return 'Constitution parameters must be an object';
    }

    if (!params.version || typeof params.version !== 'string') {
      return 'Constitution must have a version';
    }

    if (!Array.isArray(params.principles) || params.principles.length === 0) {
      return 'Constitution must have at least one principle';
    }

    if (!Array.isArray(params.constraints)) {
      return 'Constraints must be an array';
    }

    if (!params.qualityStandards || typeof params.qualityStandards !== 'object') {
      return 'Quality standards must be provided';
    }

    if (!params.qualityStandards.testing || !params.qualityStandards.security || !params.qualityStandards.performance) {
      return 'Quality standards must include testing, security, and performance';
    }

    if (!Array.isArray(params.architectureGuidelines)) {
      return 'Architecture guidelines must be an array';
    }

    return null;
  }

  protected createInvocation(
    params: ConstitutionParams,
  ): ToolInvocation<ConstitutionParams, ToolResult> {
    return new CreateConstitutionToolInvocation(params, this.config);
  }
}

/**
 * Factory function to create the constitution tool
 */
export function createConstitutionTool(config: Config): CreateConstitutionTool {
  return new CreateConstitutionTool(config);
}

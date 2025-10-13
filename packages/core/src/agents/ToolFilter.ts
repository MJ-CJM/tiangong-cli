/**
 * @license
 * Copyright 2025 Gemini CLI
 * SPDX-License-Identifier: MIT
 */

import type { TiangongAgentDefinition as AgentDefinition } from './types.js';

/**
 * Filters tools based on Agent's allow/deny lists
 *
 * Rules:
 * 1. If only `deny` is specified: allow all except denied
 * 2. If only `allow` is specified: allow only those listed
 * 3. If both specified: allow only those in allow AND not in deny (deny wins)
 * 4. If neither specified: allow all tools
 */
export class ToolFilter {
  /**
   * Filter tool names based on agent's allow/deny configuration
   *
   * @param allTools - All available tool names
   * @param agent - Agent definition with tool configuration
   * @returns Filtered tool names
   */
  filterTools(allTools: string[], agent: AgentDefinition): string[] {
    const { allow, deny } = agent.tools || {};

    // Case 1: No restrictions - allow all
    if (!allow && !deny) {
      return [...allTools];
    }

    // Case 2: Only deny list - allow all except denied
    if (!allow && deny) {
      return allTools.filter((tool) => !deny.includes(tool));
    }

    // Case 3: Only allow list - allow only those listed
    if (allow && !deny) {
      return allTools.filter((tool) => allow.includes(tool));
    }

    // Case 4: Both allow and deny - deny takes precedence
    if (allow && deny) {
      return allTools.filter((tool) => allow.includes(tool) && !deny.includes(tool));
    }

    return [];
  }

  /**
   * Check if a specific tool is allowed for an agent
   *
   * @param toolName - Tool name to check
   * @param agent - Agent definition
   * @returns True if tool is allowed
   */
  isToolAllowed(toolName: string, agent: AgentDefinition): boolean {
    const { allow, deny } = agent.tools || {};

    // No restrictions - allow all
    if (!allow && !deny) {
      return true;
    }

    // Check deny list first (highest priority)
    if (deny && deny.includes(toolName)) {
      return false;
    }

    // If allow list exists, tool must be in it
    if (allow) {
      return allow.includes(toolName);
    }

    // Only deny list exists, and tool is not denied
    return true;
  }

  /**
   * Get denied tools from all available tools
   *
   * @param allTools - All available tool names
   * @param agent - Agent definition
   * @returns Tools that are denied
   */
  getDeniedTools(allTools: string[], agent: AgentDefinition): string[] {
    const allowed = this.filterTools(allTools, agent);
    return allTools.filter((tool) => !allowed.includes(tool));
  }

  /**
   * Validate tool configuration and report issues
   *
   * @param agent - Agent definition
   * @param allTools - All available tool names
   * @returns Validation report
   */
  validateToolConfig(
    agent: AgentDefinition,
    allTools: string[]
  ): {
    valid: boolean;
    warnings: string[];
    unknownAllowed: string[];
    unknownDenied: string[];
  } {
    const warnings: string[] = [];
    const unknownAllowed: string[] = [];
    const unknownDenied: string[] = [];

    const { allow, deny } = agent.tools || {};

    // Check for unknown tools in allow list
    if (allow) {
      for (const tool of allow) {
        if (!allTools.includes(tool)) {
          unknownAllowed.push(tool);
        }
      }
    }

    // Check for unknown tools in deny list
    if (deny) {
      for (const tool of deny) {
        if (!allTools.includes(tool)) {
          unknownDenied.push(tool);
        }
      }
    }

    // Check for conflicts (same tool in both lists)
    if (allow && deny) {
      const conflicts = allow.filter((tool) => deny.includes(tool));
      if (conflicts.length > 0) {
        warnings.push(
          `Tools in both allow and deny lists (deny will take precedence): ${conflicts.join(', ')}`
        );
      }
    }

    // Check if configuration results in no tools
    const allowedTools = this.filterTools(allTools, agent);
    if (allowedTools.length === 0) {
      warnings.push('Agent configuration results in no available tools');
    }

    // Add warnings for unknown tools
    if (unknownAllowed.length > 0) {
      warnings.push(`Unknown tools in allow list: ${unknownAllowed.join(', ')}`);
    }

    if (unknownDenied.length > 0) {
      warnings.push(`Unknown tools in deny list: ${unknownDenied.join(', ')}`);
    }

    return {
      valid: warnings.length === 0,
      warnings,
      unknownAllowed,
      unknownDenied,
    };
  }

  /**
   * Get tool configuration summary
   *
   * @param agent - Agent definition
   * @param allTools - All available tool names
   * @returns Human-readable summary
   */
  getToolSummary(agent: AgentDefinition, allTools: string[]): string {
    const { allow, deny } = agent.tools || {};
    const allowedTools = this.filterTools(allTools, agent);

    if (!allow && !deny) {
      return `All tools allowed (${allTools.length} total)`;
    }

    if (!allow && deny) {
      return `All tools except: ${deny.join(', ')} (${allowedTools.length}/${allTools.length} allowed)`;
    }

    if (allow && !deny) {
      return `Only: ${allow.join(', ')} (${allowedTools.length}/${allTools.length} allowed)`;
    }

    return `Allowed: ${allow?.join(', ')} except ${deny?.join(', ')} (${allowedTools.length}/${allTools.length} allowed)`;
  }

  /**
   * Merge tool configurations from multiple sources
   * Useful for layered configurations (global → project → agent)
   *
   * @param configs - Array of tool configurations (later overrides earlier)
   * @returns Merged configuration
   */
  mergeToolConfigs(
    configs: Array<{ allow?: string[]; deny?: string[] }>
  ): { allow?: string[]; deny?: string[] } {
    const result: { allow?: string[]; deny?: string[] } = {};

    for (const config of configs) {
      if (config.allow !== undefined) {
        result.allow = [...config.allow];
      }
      if (config.deny !== undefined) {
        result.deny = [...config.deny];
      }
    }

    return result;
  }
}

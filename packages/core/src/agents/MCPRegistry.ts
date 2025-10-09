/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MCPServerConfig } from '../config/config.js';
import type { AgentDefinition } from './types.js';

/**
 * Registry for MCP servers available to Agents
 *
 * This is a lightweight wrapper around the existing McpClientManager
 * to provide agent-specific MCP server filtering and validation.
 */
export class MCPRegistry {
  private availableServers: Map<string, MCPServerConfig> = new Map();

  /**
   * Register available MCP servers from config
   *
   * @param servers - MCP server configurations from config
   */
  registerServers(servers: Record<string, MCPServerConfig>): void {
    this.availableServers.clear();
    for (const [name, config] of Object.entries(servers)) {
      this.availableServers.set(name, config);
    }
  }

  /**
   * Get MCP servers for a specific agent
   *
   * @param agent - Agent definition
   * @returns Array of server names the agent is allowed to use
   */
  getServersForAgent(agent: AgentDefinition): string[] {
    const requestedServers = agent.mcp?.servers || [];

    // Filter to only servers that exist in config
    return requestedServers.filter((name) => this.availableServers.has(name));
  }

  /**
   * Get MCP server configuration
   *
   * @param serverName - Server name
   * @returns Server config or null
   */
  getServerConfig(serverName: string): MCPServerConfig | null {
    return this.availableServers.get(serverName) || null;
  }

  /**
   * Check if a server is available
   *
   * @param serverName - Server name
   * @returns True if server exists
   */
  hasServer(serverName: string): boolean {
    return this.availableServers.has(serverName);
  }

  /**
   * Get all available server names
   *
   * @returns Array of server names
   */
  getAllServerNames(): string[] {
    return Array.from(this.availableServers.keys());
  }

  /**
   * Validate agent's MCP server configuration
   *
   * @param agent - Agent definition
   * @returns Validation result
   */
  validateAgentServers(agent: AgentDefinition): {
    valid: boolean;
    unknownServers: string[];
    warnings: string[];
  } {
    const requestedServers = agent.mcp?.servers || [];
    const unknownServers: string[] = [];
    const warnings: string[] = [];

    for (const serverName of requestedServers) {
      if (!this.hasServer(serverName)) {
        unknownServers.push(serverName);
      }
    }

    if (unknownServers.length > 0) {
      warnings.push(
        `Unknown MCP servers requested: ${unknownServers.join(', ')}`
      );
    }

    return {
      valid: unknownServers.length === 0,
      unknownServers,
      warnings,
    };
  }

  /**
   * Get MCP tool prefixes for an agent
   *
   * MCP tools are namespaced as "mcp.<server>.<tool>"
   *
   * @param agent - Agent definition
   * @returns Array of allowed MCP tool prefixes
   */
  getMCPToolPrefixes(agent: AgentDefinition): string[] {
    const servers = this.getServersForAgent(agent);
    return servers.map((serverName) => `mcp.${serverName}.`);
  }

  /**
   * Check if a tool name is an MCP tool for this agent
   *
   * @param toolName - Tool name (e.g., "mcp.github.get_pull_request")
   * @param agent - Agent definition
   * @returns True if this is an MCP tool the agent can use
   */
  isMCPToolAllowed(toolName: string, agent: AgentDefinition): boolean {
    if (!toolName.startsWith('mcp.')) {
      return false;
    }

    const prefixes = this.getMCPToolPrefixes(agent);
    return prefixes.some((prefix) => toolName.startsWith(prefix));
  }

  /**
   * Get summary of agent's MCP configuration
   *
   * @param agent - Agent definition
   * @returns Human-readable summary
   */
  getMCPSummary(agent: AgentDefinition): string {
    const requestedServers = agent.mcp?.servers || [];

    if (requestedServers.length === 0) {
      return 'No MCP servers configured';
    }

    const availableServers = this.getServersForAgent(agent);
    const unknownServers = requestedServers.filter(
      (name) => !this.hasServer(name)
    );

    if (unknownServers.length > 0) {
      return `MCP servers: ${availableServers.join(', ')} (unknown: ${unknownServers.join(', ')})`;
    }

    return `MCP servers: ${availableServers.join(', ')}`;
  }

  /**
   * Clear all registered servers
   */
  clear(): void {
    this.availableServers.clear();
  }

  /**
   * Get count of registered servers
   */
  getServerCount(): number {
    return this.availableServers.size;
  }
}

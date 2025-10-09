/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Tool Categories for Agent Configuration
 *
 * This module defines tool categories to help users configure agents
 * with appropriate tool permissions based on the agent's purpose.
 */

export enum ToolCategory {
  READ = 'read',
  WRITE = 'write',
  EXECUTE = 'execute',
  NETWORK = 'network',
  MEMORY = 'memory',
}

export interface ToolCategoryDefinition {
  category: ToolCategory;
  name: string;
  description: string;
  tools: string[];
  requiresConfirmation: boolean;
}

/**
 * Tool category definitions with all available tools
 */
export const TOOL_CATEGORIES: ToolCategoryDefinition[] = [
  {
    category: ToolCategory.READ,
    name: 'Read Tools',
    description: 'Read files and search code (safe, no modifications)',
    tools: [
      'read_file',        // Read single file
      'read_many_files',  // Read multiple files
      'ls',               // List directory contents
      'glob',             // Find files by pattern
      'grep',             // Search file contents
      'rg',               // Ripgrep (faster grep)
    ],
    requiresConfirmation: false,
  },
  {
    category: ToolCategory.WRITE,
    name: 'Write Tools',
    description: 'Modify files and create content (requires confirmation)',
    tools: [
      'edit',             // Edit existing files
      'smart_edit',       // AI-powered smart editing
      'write_file',       // Create or overwrite files
    ],
    requiresConfirmation: true,
  },
  {
    category: ToolCategory.EXECUTE,
    name: 'Execute Tools',
    description: 'Run commands and scripts (requires confirmation)',
    tools: [
      'bash',             // Execute shell commands
      'shell',            // Shell execution (alias)
    ],
    requiresConfirmation: true,
  },
  {
    category: ToolCategory.NETWORK,
    name: 'Network Tools',
    description: 'Access web resources and search (requires confirmation)',
    tools: [
      'web_fetch',        // Fetch web pages
      'web_search',       // Search the web
    ],
    requiresConfirmation: true,
  },
  {
    category: ToolCategory.MEMORY,
    name: 'Memory Tools',
    description: 'Manage context and memory (safe)',
    tools: [
      'memory',           // Context memory management
    ],
    requiresConfirmation: false,
  },
];

/**
 * Get all tools for a list of categories
 */
export function getToolsForCategories(categories: ToolCategory[]): string[] {
  const tools = new Set<string>();

  for (const categoryDef of TOOL_CATEGORIES) {
    if (categories.includes(categoryDef.category)) {
      for (const tool of categoryDef.tools) {
        tools.add(tool);
      }
    }
  }

  return Array.from(tools);
}

/**
 * Get category for a specific tool
 */
export function getCategoryForTool(toolName: string): ToolCategory | null {
  for (const categoryDef of TOOL_CATEGORIES) {
    if (categoryDef.tools.includes(toolName)) {
      return categoryDef.category;
    }
  }
  return null;
}

/**
 * Check if a category requires user confirmation
 */
export function requiresConfirmation(category: ToolCategory): boolean {
  const categoryDef = TOOL_CATEGORIES.find(c => c.category === category);
  return categoryDef?.requiresConfirmation ?? true;
}

/**
 * Get friendly display text for categories
 */
export function getCategoryDisplayText(categories: ToolCategory[]): string {
  const names = categories.map(cat => {
    const def = TOOL_CATEGORIES.find(c => c.category === cat);
    return def?.name ?? cat;
  });
  return names.join(', ');
}

/**
 * Default safe categories (read-only)
 */
export const DEFAULT_SAFE_CATEGORIES = [ToolCategory.READ];

/**
 * All categories
 */
export const ALL_CATEGORIES = [
  ToolCategory.READ,
  ToolCategory.WRITE,
  ToolCategory.EXECUTE,
  ToolCategory.NETWORK,
  ToolCategory.MEMORY,
];

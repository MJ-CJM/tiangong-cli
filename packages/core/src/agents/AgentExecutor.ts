/**
 * @license
 * Copyright 2025 Gemini CLI
 * SPDX-License-Identifier: MIT
 */

import type { Config } from '../config/config.js';
import type { ModelService } from '../services/modelService.js';
import type { ToolRegistry } from '../tools/tool-registry.js';
import type { McpClientManager } from '../tools/mcp-client-manager.js';
import type {
  UnifiedRequest,
  UnifiedMessage,
} from '../adapters/base/types.js';
import { MessageRole } from '../adapters/base/types.js';
import { AgentManager } from './AgentManager.js';
import { ContextManager } from './ContextManager.js';
import { ToolFilter } from './ToolFilter.js';
import { MCPRegistry } from './MCPRegistry.js';
import type {
  AgentDefinition,
  AgentExecuteOptions,
  AgentExecuteResponse,
  AgentRuntime,
} from './types.js';

/**
 * Executes Agent conversations with isolated contexts and tool filtering
 */
export class AgentExecutor {
  private agentManager: AgentManager;
  private contextManager: ContextManager;
  private toolFilter: ToolFilter;
  private mcpRegistry: MCPRegistry;

  constructor(
    private config: Config,
    private modelService: ModelService,
    private toolRegistry: ToolRegistry,
    // MCP client manager will be used in P2 for MCP tool integration
    // @ts-ignore
    _mcpClientManager: McpClientManager
  ) {
    this.agentManager = new AgentManager();
    this.contextManager = new ContextManager();
    this.toolFilter = new ToolFilter();
    this.mcpRegistry = new MCPRegistry();
  }

  /**
   * Initialize the executor by loading agents and MCP servers
   */
  async initialize(): Promise<void> {
    // Load agents
    await this.agentManager.loadAgents();

    // Register MCP servers
    const mcpServers = this.config.getMcpServers();
    if (mcpServers) {
      this.mcpRegistry.registerServers(mcpServers);
    }
  }

  /**
   * Execute an agent with a prompt
   *
   * @param agentName - Name of the agent to execute
   * @param prompt - User prompt
   * @param options - Execution options
   * @returns Agent response
   */
  async execute(
    agentName: string,
    prompt: string,
    options: AgentExecuteOptions = {}
  ): Promise<AgentExecuteResponse> {
    const startTime = Date.now();

    // Get agent definition
    const agent = this.agentManager.getAgent(agentName);
    if (!agent) {
      throw new Error(`Agent '${agentName}' not found`);
    }

    // Build runtime (validate agent configuration)
    const runtime = await this.buildRuntime(agent);

    // Determine context mode (priority: runtime > agent definition > default)
    const contextMode =
      options.contextMode ||        // Runtime parameter (highest priority)
      agent.contextMode ||           // Agent definition
      'isolated';                    // Default

    // Get or create context with specified mode
    const context = this.contextManager.getContext(agentName, contextMode);

    // Add user message to history
    const userMessage: UnifiedMessage = {
      role: MessageRole.USER,
      content: [
        {
          type: 'text',
          text: prompt,
        },
      ],
    };

    this.contextManager.addMessage(agentName, userMessage, contextMode);

    // Get filtered tools for agent
    const toolDefinitions = this.getToolDefinitions(runtime.availableTools);

    // Execute with tool calling loop
    let totalTokensUsed = 0;
    const maxIterations = 10; // Prevent infinite loops
    let iteration = 0;
    let finalText = '';

    while (iteration < maxIterations) {
      iteration++;

      // Prepare request
      const model = agent.model || this.config.getModel() || 'gemini-2.0-flash';

      // Build system message with context mode instructions
      const systemMessage = this.buildSystemMessage(agent, contextMode, context);

      const request: UnifiedRequest = {
        model,
        messages: [...context.conversationHistory],
        systemMessage,
        tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
        stream: options.stream || false,
      };

      // Execute via model service
      const response = await this.modelService.generateContent(request);

      // Track token usage
      if (response.usage) {
        totalTokensUsed += response.usage.totalTokens;
      }

      // Check for function calls
      const functionCalls = response.content.filter(
        part => part.type === 'function_call'
      );

      // Add assistant message to history
      const assistantMessage: UnifiedMessage = {
        role: MessageRole.ASSISTANT,
        content: response.content,
      };
      this.contextManager.addMessage(agentName, assistantMessage, contextMode);

      // If no function calls, we're done
      if (functionCalls.length === 0) {
        finalText = response.content
          .filter(part => part.type === 'text')
          .map(part => part.text || '')
          .join('\n');
        break;
      }

      // Execute function calls
      const functionResponses: UnifiedMessage[] = [];

      for (const call of functionCalls) {
        if (!call.functionCall) continue;

        const { name, args, id } = call.functionCall;

        try {
          // Notify tool call start
          if (options.onToolCall) {
            options.onToolCall(name, args);
          }

          // Get tool and build invocation
          const tool = this.toolRegistry.getTool(name);
          if (!tool) {
            throw new Error(`Tool '${name}' not found`);
          }

          const invocation = tool.build(args);

          // Execute tool invocation with AbortController
          const abortController = new AbortController();
          const result = await invocation.execute(abortController.signal);

          // Notify tool call result
          if (options.onToolResult) {
            options.onToolResult(name, result);
          }

          // Add function response
          functionResponses.push({
            role: MessageRole.FUNCTION,
            content: [
              {
                type: 'function_response',
                functionResponse: {
                  name,
                  content: result.llmContent,
                  id,
                },
              },
            ],
          });
        } catch (error) {
          // Notify tool call error
          if (options.onToolResult) {
            options.onToolResult(name, null, error as Error);
          }

          // Add error response
          functionResponses.push({
            role: MessageRole.FUNCTION,
            content: [
              {
                type: 'function_response',
                functionResponse: {
                  name,
                  content: {
                    error: error instanceof Error ? error.message : String(error),
                  },
                  id,
                },
              },
            ],
          });
        }
      }

      // Add function responses to context
      for (const funcResp of functionResponses) {
        this.contextManager.addMessage(agentName, funcResp, contextMode);
      }

      // Continue loop to get final response
    }

    // Build response
    const executeResponse: AgentExecuteResponse = {
      agentName,
      text: finalText,
      context: this.contextManager.getContext(agentName, contextMode),
      metadata: {
        model: agent.model || this.config.getModel() || 'gemini-2.0-flash',
        tokensUsed: totalTokensUsed,
        durationMs: Date.now() - startTime,
        iterations: iteration,
        contextMode,
      },
    };

    return executeResponse;
  }

  /**
   * Convert tool names to ToolDefinition format
   */
  private getToolDefinitions(toolNames: string[]): import('../adapters/base/types.js').ToolDefinition[] {
    const definitions: import('../adapters/base/types.js').ToolDefinition[] = [];

    for (const toolName of toolNames) {
      const tool = this.toolRegistry.getTool(toolName);
      if (tool) {
        const schema = tool.parameterSchema as any;
        definitions.push({
          name: tool.name,
          description: tool.description || '',
          parameters: schema || {
            type: 'object',
            properties: {},
            required: [],
          },
        });
      }
    }

    return definitions;
  }

  /**
   * Build runtime state for an agent
   */
  private async buildRuntime(agent: AgentDefinition): Promise<AgentRuntime> {
    // Get all available tools
    const allToolNames = this.toolRegistry.getAllToolNames();

    // Filter tools based on agent's allow/deny lists
    const filteredTools = this.toolFilter.filterTools(allToolNames, agent);

    // Add MCP tool filtering
    const mcpServers = this.mcpRegistry.getServersForAgent(agent);

    return {
      definition: agent,
      context: this.contextManager.getContext(agent.name),
      availableTools: filteredTools,
      mcpServers,
    };
  }

  /**
   * Get agent manager (for CLI commands)
   */
  getAgentManager(): AgentManager {
    return this.agentManager;
  }

  /**
   * Get context manager (for debugging/inspection)
   */
  getContextManager(): ContextManager {
    return this.contextManager;
  }

  /**
   * Clear context for an agent
   *
   * @param agentName - Agent name
   */
  clearContext(agentName: string): void {
    this.contextManager.clearHistory(agentName);
  }

  /**
   * Validate an agent before execution
   *
   * @param agentName - Agent name
   * @returns Validation result with errors/warnings
   */
  validateAgent(agentName: string): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const agent = this.agentManager.getAgent(agentName);
    if (!agent) {
      return {
        valid: false,
        errors: [`Agent '${agentName}' not found`],
        warnings: [],
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate tools
    const allTools = this.toolRegistry.getAllToolNames();
    const toolValidation = this.toolFilter.validateToolConfig(agent, allTools);
    warnings.push(...toolValidation.warnings);

    // Validate MCP servers
    const mcpValidation = this.mcpRegistry.validateAgentServers(agent);
    warnings.push(...mcpValidation.warnings);

    // Check if agent has at least one tool
    const availableTools = this.toolFilter.filterTools(allTools, agent);
    if (availableTools.length === 0 && (!agent.mcp?.servers || agent.mcp.servers.length === 0)) {
      warnings.push('Agent has no available tools (all filtered out)');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get runtime information for an agent
   *
   * @param agentName - Agent name
   * @returns Runtime info or null
   */
  async getRuntimeInfo(agentName: string): Promise<AgentRuntime | null> {
    const agent = this.agentManager.getAgent(agentName);
    if (!agent) {
      return null;
    }

    return this.buildRuntime(agent);
  }

  /**
   * Build system message with context mode instructions
   *
   * @param agent - Agent definition
   * @param contextMode - Context mode (isolated or shared)
   * @param context - Agent context
   * @returns Enhanced system message
   */
  private buildSystemMessage(
    agent: import('./types.js').AgentDefinition,
    contextMode: 'isolated' | 'shared',
    context: import('./types.js').AgentContext
  ): string {
    let systemMessage = agent.systemPrompt || '';

    // Add context mode instructions
    if (contextMode === 'isolated') {
      // Check if this is the first message (empty history besides current user message)
      const hasHistory = context.conversationHistory.length > 1;

      if (!hasHistory) {
        systemMessage += `\n\n**IMPORTANT - Context Mode: Isolated**

You are running in ISOLATED context mode. You do NOT have access to the main conversation history or other agents' conversations. Your conversation history only includes messages directly exchanged with the user in your isolated context.

When the user asks you to reference "previous content", "above discussion", "上述内容", or similar:
- If you don't see it in your conversation history, clearly state: "I'm running in isolated context mode and don't have access to previous conversations. Could you please provide the specific content you'd like me to work with?"
- Do NOT attempt to summarize, reference, or infer content that's not explicitly in your conversation history.
- Do NOT use your tool descriptions or role definition as a substitute for missing context.`;
      } else {
        systemMessage += `\n\n**Context Mode**: You are running in isolated context mode. You can reference your own conversation history with this user, but not the main session or other agents' conversations.`;
      }
    } else if (contextMode === 'shared') {
      systemMessage += `\n\n**Context Mode**: You are running in SHARED context mode. You have access to the main conversation history and can reference previous discussions from the main session.`;
    }

    return systemMessage;
  }
}

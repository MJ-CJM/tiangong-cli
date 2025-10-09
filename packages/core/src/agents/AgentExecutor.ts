/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '../config/config.js';
import type { ModelService } from '../services/modelService.js';
import type { ToolRegistry } from '../tools/tool-registry.js';
import type {
  UnifiedRequest,
  UnifiedMessage,
} from '../adapters/base/types.js';
import { MessageRole } from '../adapters/base/types.js';
import { AgentManager } from './AgentManager.js';
import { ContextManager } from './ContextManager.js';
import { ToolFilter } from './ToolFilter.js';
import { MCPRegistry } from './MCPRegistry.js';
import { Router } from './Router.js';
import { HandoffManager } from './HandoffManager.js';
import type {
  AgentDefinition,
  AgentExecuteOptions,
  AgentExecuteResponse,
  AgentRuntime,
  HandoffContext,
  RoutingConfig,
} from './types.js';
import { HandoffError } from './types.js';

/**
 * Executes Agent conversations with isolated contexts and tool filtering
 */
export class AgentExecutor {
  private agentManager: AgentManager;
  private contextManager: ContextManager;
  private toolFilter: ToolFilter;
  private mcpRegistry: MCPRegistry;
  private router: Router | null = null;
  private handoffManager: HandoffManager | null = null;

  constructor(
    private config: Config,
    private modelService: ModelService,
    private toolRegistry: ToolRegistry,
  ) {
    this.agentManager = new AgentManager();
    this.contextManager = new ContextManager();
    this.toolFilter = new ToolFilter();
    this.mcpRegistry = new MCPRegistry();
  }

  /**
   * Initialize the executor by loading agents and MCP servers
   */
  async initialize(routingConfig?: Partial<RoutingConfig>): Promise<void> {
    // Load agents
    await this.agentManager.loadAgents();

    // Register MCP servers
    const mcpServers = this.config.getMcpServers();
    if (mcpServers) {
      this.mcpRegistry.registerServers(mcpServers);
    }

    // Initialize router
    this.router = new Router(
      this.config,
      this.agentManager,
      this.modelService,
      routingConfig
    );

    // Initialize handoff manager
    this.handoffManager = new HandoffManager(this.agentManager);

    console.log('[AgentExecutor] Initialized with routing and handoff support');
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

    // Add handoff tools (transfer_to_* functions)
    const handoffTools = this.buildHandoffTools(agent);
    toolDefinitions.push(...handoffTools);

    console.log(`[AgentExecutor] Tool definitions passed to model (${toolDefinitions.length}):`);
    const mcpToolDefs = toolDefinitions.filter(t => t.name.includes('__'));
    const handoffToolDefs = toolDefinitions.filter(t => t.name.startsWith('transfer_to_'));
    console.log(`[AgentExecutor] MCP tool definitions (${mcpToolDefs.length}):`, mcpToolDefs.map(t => t.name));
    console.log(`[AgentExecutor] Handoff tool definitions (${handoffToolDefs.length}):`, handoffToolDefs.map(t => t.name));

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

        // Check if this is a handoff tool call
        if (this.isHandoffTool(name)) {
          console.log(`[AgentExecutor] Detected handoff tool call: ${name}`);

          try {
            // Extract target agent from tool name
            const targetAgent = this.extractHandoffTarget(name);

            // Validate handoff
            if (!this.handoffManager) {
              throw new Error('HandoffManager not initialized');
            }

            // Get conversation history for handoff context
            const conversationHistory = this.contextManager.getContext(agentName, contextMode)
              .conversationHistory;

            // Create handoff context
            const handoffContext = await this.handoffManager.initiateHandoff(
              agentName,
              targetAgent,
              args['reason'] || 'Agent requested handoff',
              args['context'],
              conversationHistory
            );

            // Execute handoff
            const handoffResponse = await this.executeWithHandoff(
              targetAgent,
              handoffContext,
              options
            );

            // Add handoff response
            functionResponses.push({
              role: MessageRole.FUNCTION,
              content: [
                {
                  type: 'function_response',
                  functionResponse: {
                    name,
                    content: {
                      success: true,
                      target_agent: targetAgent,
                      response: handoffResponse.text,
                    },
                    id,
                  },
                },
              ],
            });

            // After handoff, we can optionally return the handoff response directly
            // For now, continue the loop to let the original agent acknowledge the handoff
          } catch (error) {
            console.error(`[AgentExecutor] Handoff error:`, error);

            // Add error response
            functionResponses.push({
              role: MessageRole.FUNCTION,
              content: [
                {
                  type: 'function_response',
                  functionResponse: {
                    name,
                    content: {
                      error:
                        error instanceof HandoffError
                          ? `Handoff failed: ${error.message} (${error.code})`
                          : error instanceof Error
                            ? error.message
                            : String(error),
                    },
                    id,
                  },
                },
              ],
            });
          }
        } else {
          // Regular tool call
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
   * Auto-route user input to the best matching agent and execute
   *
   * @param prompt - User prompt
   * @param options - Execution options
   * @returns Agent response with routing info
   */
  async executeWithRouting(
    prompt: string,
    options: AgentExecuteOptions = {}
  ): Promise<AgentExecuteResponse & { routedAgent?: string }> {
    if (!this.router) {
      throw new Error('Router not initialized. Call initialize() first.');
    }

    console.log('[AgentExecutor] Auto-routing user input...');

    // Route to best agent
    const routingResult = await this.router.route(prompt);

    if (!routingResult) {
      throw new Error('No suitable agent found for this request');
    }

    console.log(
      `[AgentExecutor] Routed to agent: ${routingResult.agent.name} (confidence: ${routingResult.confidence})`
    );

    // Execute with routed agent
    const response = await this.execute(routingResult.agent.name, prompt, options);

    return {
      ...response,
      routedAgent: routingResult.agent.name,
    };
  }

  /**
   * Execute agent with handoff context (internal method for handoff chains)
   *
   * @param agentName - Target agent name
   * @param handoffContext - Handoff context from previous agent
   * @param options - Execution options
   * @returns Agent response
   */
  async executeWithHandoff(
    agentName: string,
    handoffContext: HandoffContext,
    options: AgentExecuteOptions = {}
  ): Promise<AgentExecuteResponse> {
    if (!this.handoffManager) {
      throw new Error('HandoffManager not initialized. Call initialize() first.');
    }

    console.log(
      `[AgentExecutor] Executing handoff: ${handoffContext.from_agent} -> ${agentName}`
    );

    // Notify about handoff via callback
    if (options.onHandoff) {
      options.onHandoff(handoffContext.from_agent, agentName, handoffContext.reason);
    }

    // Build prompt with handoff context
    const handoffPrompt = this.buildHandoffPrompt(handoffContext);

    // Execute target agent with handoff context
    const response = await this.execute(agentName, handoffPrompt, options);

    // Complete handoff
    this.handoffManager.completeHandoff(handoffContext);

    return response;
  }

  /**
   * Build prompt for handoff including context from previous agent
   */
  private buildHandoffPrompt(handoffContext: HandoffContext): string {
    let prompt = `[Handoff from ${handoffContext.from_agent}]\n\n`;
    prompt += `Reason: ${handoffContext.reason}\n\n`;

    if (handoffContext.summary) {
      prompt += `Summary: ${handoffContext.summary}\n\n`;
    }

    if (handoffContext.context) {
      prompt += `Context: ${handoffContext.context}\n\n`;
    }

    if (handoffContext.conversation_history && handoffContext.conversation_history.length > 0) {
      prompt += `Previous conversation:\n`;
      for (const msg of handoffContext.conversation_history.slice(-5)) {
        // Last 5 messages
        const role = msg.role.toUpperCase();
        const text = msg.content
          .filter(p => p.type === 'text')
          .map(p => p.text)
          .join(' ');
        prompt += `[${role}]: ${text}\n`;
      }
      prompt += '\n';
    }

    prompt += 'Please continue from here.';

    return prompt;
  }

  /**
   * Build handoff tools for an agent (transfer_to_* functions)
   */
  private buildHandoffTools(agent: AgentDefinition): Array<import('../adapters/base/types.js').ToolDefinition> {
    if (!agent.handoffs || agent.handoffs.length === 0) {
      return [];
    }

    const handoffTools: Array<import('../adapters/base/types.js').ToolDefinition> = [];

    for (const handoff of agent.handoffs) {
      handoffTools.push({
        name: `transfer_to_${handoff.to}`,
        description:
          handoff.description ||
          `Transfer this conversation to ${handoff.to} agent. ${handoff.when === 'auto' ? 'This handoff happens automatically when appropriate.' : 'Use this when you need specialized help from this agent.'}`,
        parameters: {
          type: 'object',
          properties: {
            reason: {
              type: 'string',
              description: 'Reason for transferring to this agent',
            },
            context: {
              type: 'string',
              description: 'Additional context to pass to the next agent',
            },
          },
          required: ['reason'],
        },
      });
    }

    return handoffTools;
  }

  /**
   * Check if a tool call is a handoff (transfer_to_*)
   */
  private isHandoffTool(toolName: string): boolean {
    return toolName.startsWith('transfer_to_');
  }

  /**
   * Extract target agent name from handoff tool name
   */
  private extractHandoffTarget(toolName: string): string {
    return toolName.replace('transfer_to_', '');
  }

  /**
   * Get router instance (for CLI commands)
   */
  getRouter(): Router | null {
    return this.router;
  }

  /**
   * Get handoff manager instance (for CLI commands)
   */
  getHandoffManager(): HandoffManager | null {
    return this.handoffManager;
  }

  /**
   * Convert tool names to ToolDefinition format
   */
  private getToolDefinitions(toolNames: string[]): Array<import('../adapters/base/types.js').ToolDefinition> {
    const definitions: Array<import('../adapters/base/types.js').ToolDefinition> = [];

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
    console.log(`[AgentExecutor] Agent: ${agent.name}`);
    console.log(`[AgentExecutor] All tools from registry (${allToolNames.length}):`, allToolNames.filter(t => t.includes('__')).slice(0, 10));

    // Get agent's allowed MCP servers
    const mcpServers = this.mcpRegistry.getServersForAgent(agent);
    console.log(`[AgentExecutor] MCP servers for agent:`, mcpServers);

    // Filter out MCP tools from servers the agent is not allowed to use
    const toolsWithMCPFilter = this.filterMCPTools(allToolNames, mcpServers);
    console.log(`[AgentExecutor] After MCP server filter (${toolsWithMCPFilter.length}):`, toolsWithMCPFilter.filter(t => t.includes('__')));

    // Filter tools based on agent's allow/deny lists
    const filteredTools = this.toolFilter.filterTools(toolsWithMCPFilter, agent);
    console.log(`[AgentExecutor] After allow/deny filter (${filteredTools.length}):`, filteredTools.filter(t => t.includes('__')));
    console.log(`[AgentExecutor] Final available tools:`, filteredTools);

    return {
      definition: agent,
      context: this.contextManager.getContext(agent.name),
      availableTools: filteredTools,
      mcpServers,
    };
  }

  /**
   * Filter MCP tools based on agent's allowed MCP servers
   *
   * MCP tools are named like "<server-name>__<tool-name>" (e.g., "context7__get-library-docs")
   * This method removes MCP tools from servers not in the agent's mcp.servers list
   *
   * @param allTools - All available tool names
   * @param allowedServers - Server names the agent is allowed to use
   * @returns Filtered tool names
   */
  private filterMCPTools(allTools: string[], allowedServers: string[]): string[] {
    // If no MCP servers configured, allow all non-MCP tools
    if (allowedServers.length === 0) {
      return allTools.filter(tool => {
        // Check if this looks like an MCP tool (has "__" separator)
        // MCP tools are namespaced as "server__tool"
        const parts = tool.split('__');
        if (parts.length >= 2) {
          // Check if this matches MCP server pattern
          const firstPart = parts[0];
          if (firstPart && /^[a-z][a-z0-9_-]*$/.test(firstPart)) {
            // This looks like an MCP tool, exclude it
            return false;
          }
        }
        return true;
      });
    }

    // Filter tools: keep non-MCP tools and MCP tools from allowed servers
    return allTools.filter(tool => {
      const parts = tool.split('__');
      if (parts.length >= 2) {
        const serverName = parts[0];
        // If this looks like an MCP tool, only allow if server is in allowed list
        if (serverName && /^[a-z][a-z0-9_-]*$/.test(serverName)) {
          return allowedServers.includes(serverName);
        }
      }
      // Not an MCP tool, allow it
      return true;
    });
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

    // Add handoff instructions if agent has configured handoffs
    if (agent.handoffs && agent.handoffs.length > 0) {
      systemMessage += '\n\n**Available Agent Handoffs**\n\n';
      systemMessage += 'You have access to the following specialized agents through handoff tools:\n\n';

      for (const handoff of agent.handoffs) {
        const toolName = `transfer_to_${handoff.to}`;
        const description = handoff.description || `Transfer to ${handoff.to} agent`;

        systemMessage += `- **${toolName}**: ${description}\n`;
      }

      systemMessage += '\n**When to use handoff tools:**\n';
      systemMessage += '- When the user\'s request falls outside your area of expertise or responsibility\n';
      systemMessage += '- When you recognize keywords or patterns that match another agent\'s specialty\n';
      systemMessage += '- When you identify that the task requires capabilities you don\'t have\n';
      systemMessage += '- **IMPORTANT**: Call the handoff tool IMMEDIATELY when you recognize the need to transfer. Do NOT attempt to handle tasks that should be transferred to another agent.\n\n';
    }

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

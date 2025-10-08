#!/usr/bin/env node

/**
 * Quick test script to verify MCP tool availability for agents
 */

import { Config } from './packages/core/dist/src/config/config.js';
import { ModelService } from './packages/core/dist/src/services/modelService.js';
import { ToolRegistry } from './packages/core/dist/src/tools/tool-registry.js';
import { AgentExecutor } from './packages/core/dist/src/agents/AgentExecutor.js';

async function main() {
  console.log('=== Testing Agent MCP Tool Integration ===\n');

  // Initialize config
  const config = new Config();

  await config.init();

  // Get tool registry
  const toolRegistry = config.getToolRegistry();

  // Get all tools
  const allTools = toolRegistry.getAllToolNames();
  console.log(`Total tools in registry: ${allTools.length}`);

  // Filter MCP tools (tools with __)
  const mcpTools = allTools.filter(t => t.includes('__'));
  console.log(`\nMCP tools found (${mcpTools.length}):`);
  mcpTools.forEach(t => console.log(`  - ${t}`));

  // Filter context7 tools specifically
  const context7Tools = allTools.filter(t => t.startsWith('context7__'));
  console.log(`\nContext7 tools specifically (${context7Tools.length}):`);
  context7Tools.forEach(t => console.log(`  - ${t}`));

  // Initialize agent executor
  const modelService = config.getModelService();
  const agentExecutor = new AgentExecutor(config, modelService, toolRegistry);
  await agentExecutor.initialize();

  // Get agent
  const agent = agentExecutor.getAgentManager().getAgent('code_imple');
  if (!agent) {
    console.log('\n❌ Agent "code_imple" not found!');
    return;
  }

  console.log(`\n=== Agent: ${agent.name} ===`);
  console.log(`MCP servers configured: ${JSON.stringify(agent.mcp?.servers || [])}`);
  console.log(`Tools allow list: ${JSON.stringify(agent.tools?.allow?.slice(0, 5) || [])}...`);

  // Get runtime info (this will trigger our debug logs)
  console.log('\n=== Getting Runtime Info (check debug logs above) ===');
  const runtime = await agentExecutor.getRuntimeInfo('code_imple');

  if (runtime) {
    console.log(`\nAvailable tools for agent (${runtime.availableTools.length}):`);

    // Show MCP tools specifically
    const agentMcpTools = runtime.availableTools.filter(t => t.includes('__'));
    console.log(`\nMCP tools available to agent (${agentMcpTools.length}):`);
    agentMcpTools.forEach(t => console.log(`  - ${t}`));

    // Check if context7 tools are there
    const agentContext7Tools = runtime.availableTools.filter(t => t.startsWith('context7__'));
    console.log(`\nContext7 tools available to agent (${agentContext7Tools.length}):`);
    agentContext7Tools.forEach(t => console.log(`  - ${t}`));
  }
}

main().catch(console.error);

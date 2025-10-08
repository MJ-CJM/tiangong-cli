#!/usr/bin/env node

import { AgentManager } from '../packages/core/dist/src/agents/AgentManager.js';

async function test() {
  const manager = new AgentManager();

  console.log('Loading agents...');
  const count = await manager.loadAgents(process.cwd());
  console.log(`Loaded ${count} agents`);

  const agents = manager.listAgents();
  console.log('Agents:', agents);
}

test().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

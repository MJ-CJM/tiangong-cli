#!/bin/bash

# Test script for shared context mode
# This script tests if agents with contextMode: shared can see main session history

set -e

echo "🧪 Testing Shared Context Mode"
echo "================================"
echo ""

# Create a test agent with shared context
echo "📝 Creating test agent with shared context..."
cat > /tmp/test_shared_agent.md << 'EOF'
---
kind: agent
name: test_shared
title: Test Shared Context
description: A test agent to verify shared context mode
model: gemini-2.0-flash-exp
scope: global
version: 1.0.0
contextMode: shared
---

You are a test agent with shared context mode enabled.
When asked to summarize, reference the previous conversation visible to you.
If you can see previous messages, say "✅ I can see the conversation history."
If not, say "❌ No conversation history visible."
EOF

echo "✅ Created test agent at /tmp/test_shared_agent.md"
echo ""

# Build the project
echo "🔨 Building project..."
npm run build > /dev/null 2>&1
echo "✅ Build complete"
echo ""

echo "📋 Test Plan:"
echo "1. Start CLI and have a conversation"
echo "2. Run the test_shared agent"
echo "3. Check if agent can see previous conversation"
echo ""
echo "Manual test commands:"
echo "  > Tell me a fun fact about cats"
echo "  > @test_shared Can you see what we just discussed?"
echo ""
echo "Expected: Agent should reference the cat fact conversation"
echo ""
echo "🎯 To test, copy the agent file to your .gemini directory:"
echo "   cp /tmp/test_shared_agent.md ~/.gemini/agents/"
echo ""

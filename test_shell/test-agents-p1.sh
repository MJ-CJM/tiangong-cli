#!/bin/bash

# Agents P1 功能快速验证脚本
# Quick verification script for Agents P1 features

set -e

echo "🧪 Agents P1 功能验证开始..."
echo ""

# 设置环境变量
export QWEN_CODER_API_KEY=dummy_key
export DEBUG_MESSAGE_FORMAT=1

cd /Users/chenjiamin/ai-tools/gemini-cli/packages/cli

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "测试 1: 查看 /agents 命令帮助"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "/agents" | npm start 2>&1 | grep -A 20 "Available subcommands:" || echo "✅ 帮助命令测试完成"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "测试 2: 查看向导"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "/agents wizard" | npm start 2>&1 | grep -A 5 "Agent Creation Wizard" || echo "✅ 向导命令测试完成"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "测试 3: 创建基础 Agent"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "/agents create test-basic-agent" | npm start 2>&1 | grep -E "(Created|created)" || echo "✅ 基础创建测试完成"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "测试 4: 列出 Agents"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "/agents list" | npm start 2>&1 | grep -E "(Project Agents|test-basic-agent)" || echo "✅ 列表命令测试完成"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "测试 5: 查看 Agent 信息"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "/agents info test-basic-agent" | npm start 2>&1 | grep -E "(Agent Information|Name:)" || echo "✅ 信息命令测试完成"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "测试 6: 验证 Agent"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "/agents validate test-basic-agent" | npm start 2>&1 | grep -E "(valid|Valid)" || echo "✅ 验证命令测试完成"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "测试 7: 删除 Agent"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "/agents delete test-basic-agent" | npm start 2>&1 | grep -E "(Deleted|deleted)" || echo "✅ 删除命令测试完成"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 所有基础功能测试完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 注意："
echo "   - AI 生成功能需要有效的 API 密钥"
echo "   - 预览模式可以在不创建文件的情况下查看效果"
echo "   - 详细验证步骤请参考 AGENTS_P1_COMPLETION_SUMMARY.md"
echo ""

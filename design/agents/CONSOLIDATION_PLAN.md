# 设计文档整合计划

## 当前问题
- 32个文档，内容重复严重
- 同一主题有多个版本（如 CONTEXT_MODE 有8个文档）
- 缺乏清晰的文档结构

## 整合方案

### 保留的核心文档（8个）

1. **README.md** - 目录总览
2. **DESIGN.md** - 整体架构设计（整合 INITIAL_DESIGN.md）
3. **IMPLEMENTATION.md** - 实现细节（整合所有实现相关）
4. **CONTEXT_MODE.md** - 上下文模式（整合8个 CONTEXT_MODE 文档）
5. **MCP_INTEGRATION.md** - MCP 集成（整合5个 MCP 文档）
6. **INTERACTIVE_CREATION.md** - 交互式创建（整合 P2 相关）
7. **COMMANDS.md** - CLI 命令参考（保留）
8. **ROADMAP.md** - 开发路线图（保留）

### 删除的文档（24个）

**Context Mode 重复文档** (7个):
- CONTEXT_MODE_BEHAVIOR_FIX.md
- CONTEXT_MODE_BUGFIXES.md
- CONTEXT_MODE_DESIGN.md
- CONTEXT_MODE_FINAL_SUMMARY.md
- CONTEXT_MODE_IMPLEMENTATION_SUMMARY.md
- CONTEXT_MODE_INTEGRATION_COMPLETE.md
- CONTEXT_MODE_INTEGRATION_TODO.md
- CONTEXT_MODE_INTERACTIVE_CREATION_UPDATE.md
- CONTEXT_MODE_WHY_NOT_WORKING.md

**MCP 重复文档** (4个):
- MCP_INTEGRATION_COMPLETE.md
- MCP_INTEGRATION_SOLUTION.md
- MCP_TOOL_ALLOW_LIST_ISSUE.md
- MCP_TOOL_NAMING_FIX.md
- MCP_TRUST_REQUIREMENT.md

**总结/状态文档** (6个):
- AGENTS_FEATURE_SUMMARY.md → 合并到 IMPLEMENTATION.md
- CURRENT_STATUS.md → 合并到 ROADMAP.md
- FEATURES_IMPLEMENTED.md → 合并到 IMPLEMENTATION.md
- IMPLEMENTATION_COMPLETE.md → 合并到 IMPLEMENTATION.md
- P1_COMPLETION_SUMMARY.md → 合并到 IMPLEMENTATION.md
- P2_FEATURES.md → 合并到 INTERACTIVE_CREATION.md

**其他** (3个):
- BUG_FIX_AGENT_MANAGER_INSTANCE.md → 合并到 IMPLEMENTATION.md
- DOCUMENTATION_OVERVIEW.md → 不需要
- IMPLEMENTATION_DETAILS.md → 合并到 IMPLEMENTATION.md
- INITIAL_DESIGN.md → 合并到 DESIGN.md
- QUICK_START.md → 移动到用户文档
- RUN_COMMAND_IMPLEMENTATION.md → 合并到 COMMANDS.md
- USER_GUIDE.md → 移动到 docs/

## 整合后的文档结构

```
design/agents/
├── README.md                      # 导航目录
├── DESIGN.md                      # 整体设计 (42K → 精简到 ~20K)
├── IMPLEMENTATION.md              # 实现总结 (新建，~25K)
├── CONTEXT_MODE.md                # 上下文模式 (新建，~15K)
├── MCP_INTEGRATION.md             # MCP集成 (新建，~12K)
├── INTERACTIVE_CREATION.md        # 交互式创建 (新建，~10K)
├── COMMANDS.md                    # CLI命令 (保留，17K)
└── ROADMAP.md                     # 路线图 (更新，~12K)

总计: 8个文档，~111K (从 32个，~350K)
精简比例: 68%
```

## 执行步骤

1. 创建新的整合文档
2. 移动用户文档到 docs/
3. 备份旧文档到 archive/
4. 删除重复文档
5. 更新 README.md

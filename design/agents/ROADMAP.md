# Agents 系统实施路线图

> **快速参考**: 本文档是 [AGENTS_SYSTEM_DESIGN.md](./AGENTS_SYSTEM_DESIGN.md) 的精简版，专注于实施步骤和里程碑。

## 🎯 两阶段目标

### P1: 基础版（4-6 周）
**目标**: 对齐 Claude Code Subagents，实现单 Agent 闭环

**核心价值**:
- ✅ 文件式 Agent 定义
- ✅ CLI 管理命令
- ✅ 独立上下文
- ✅ 工具白名单
- ✅ MCP 集成

### P2: 扩展版（6-8 周）
**目标**: 对齐 OpenAI Agents / LangGraph，实现多 Agent 编排

**核心价值**:
- 🎯 自动路由（triggers）
- 🎯 跨 Agent 移交（handoffs）
- 🎯 输出校验（guardrails）
- 🎯 状态记忆（memory）
- 🎯 图编排（graph）
- 🎯 可观测性（tracing）

---

## 📅 P1 实施时间线

### Week 1-2: 基础设施

#### Week 1: 文件解析与验证
```typescript
// 交付物
packages/core/src/agents/
  ├── types.ts              // AgentDefinition, AgentContext
  ├── AgentParser.ts        // Markdown + YAML 解析
  └── AgentValidator.ts     // 校验逻辑

// 验收
✓ 能正确解析 front-matter
✓ 能验证必需字段
✓ 能检测工具/MCP 配置错误
```

**关键决策**:
- YAML 库: `js-yaml`
- Markdown 解析: `gray-matter`
- 校验: JSON Schema

#### Week 2: Agent Manager 与 CLI 基础
```typescript
// 交付物
packages/core/src/agents/
  └── AgentManager.ts       // 加载、创建、列表、删除

packages/cli/src/commands/
  └── agentsCommand.ts      // create, list, validate

// 验收
✓ agents create 能生成 .md 文件
✓ agents list 能显示可用 Agent
✓ agents validate 能检查配置
```

**关键决策**:
- 文件位置: `~/.gemini/agents/` (全局), `.gemini/agents/` (项目)
- 模板存储: `~/.gemini/agents/templates/`
- 优先级: 项目级覆盖全局级

### Week 3-4: 执行引擎

#### Week 3: 上下文隔离与工具过滤
```typescript
// 交付物
packages/core/src/agents/
  ├── ContextManager.ts     // 独立上下文管理
  ├── ToolFilter.ts         // allow/deny 过滤
  └── AgentExecutor.ts      // 执行引擎核心

// 验收
✓ 不同 Agent 的对话历史完全隔离
✓ 工具白名单/黑名单生效
✓ agents run 能执行基本对话
```

**关键实现**:
```typescript
class ContextManager {
  private contexts: Map<string, AgentContext>;

  getContext(agentName: string): AgentContext {
    // 返回独立上下文，不与主会话共享
  }
}

class ToolFilter {
  filterTools(
    allTools: Tool[],
    allow?: string[],
    deny?: string[]
  ): Tool[] {
    // deny 优先级高于 allow
  }
}
```

#### Week 4: MCP 集成
```typescript
// 交付物
packages/core/src/agents/
  ├── MCPRegistry.ts        // MCP 服务器管理
  └── MCPToolWrapper.ts     // MCP 工具包装

// 验收
✓ 能连接配置的 MCP 服务器
✓ MCP 工具能被 Agent 调用
✓ MCP 工具也受 allow/deny 控制
```

**关键实现**:
```typescript
class MCPRegistry {
  async getConnection(serverName: string): Promise<MCPConnection> {
    // 懒加载连接
  }

  async getMCPTools(serverName: string): Promise<Tool[]> {
    const conn = await this.getConnection(serverName);
    const mcpTools = await conn.listTools();

    return mcpTools.map(t => wrapMCPTool(t, serverName, conn));
  }
}
```

### Week 5-6: 完善与测试

#### Week 5: UI 与用户体验
```typescript
// 交付物
packages/cli/src/ui/
  └── AgentUI.tsx           // Agent 执行 UI

// 新增 CLI 功能
agents run --interactive    // 交互式模式
agents edit <name>          // 编辑 Agent
agents delete <name>        // 删除 Agent

// 验收
✓ 执行过程有清晰的可视化反馈
✓ 交互模式能持续对话
✓ 高风险工具需要用户确认
```

#### Week 6: 测试与文档
```bash
# 测试
npm run test:agents         # 单元测试
npm run test:agents:e2e     # E2E 测试

# 文档
docs/AGENTS.md              # 用户指南
docs/AGENT_DEVELOPMENT.md   # 开发者指南
```

**验收标准** (所有 P1 DoD):
```bash
# Scenario 1: 创建与加载
✓ agents create 生成正确格式文件
✓ agents list 显示 Agent
✓ agents validate 校验通过

# Scenario 2: 工具白名单
✓ 只能调用 allow 列表内工具
✓ deny 列表工具被拒绝

# Scenario 3: 上下文隔离
✓ Agent 对话不污染主会话
✓ Agent 记住自己的历史

# Scenario 4: MCP 集成
✓ MCP 工具能正常调用
✓ MCP 连接错误能优雅处理
```

---

## 📅 P2 实施时间线

### Week 7-9: 路由与移交

#### Week 7: Triggers（自动路由）
```typescript
// 新增字段
triggers:
  - keywords: [debug, bug]
    priority: 10

// 交付物
packages/core/src/agents/
  └── Router.ts

// 验收
✓ 根据关键词自动选择 Agent
✓ 优先级排序正确
✓ 用户能手动覆盖
```

#### Week 8: Handoffs（跨 Agent 移交）
```typescript
// 新增字段
handoffs:
  - to: code-reviewer
    when: task.status == 'ready'

// 交付物
packages/core/src/agents/
  └── HandoffManager.ts

// 验收
✓ handoff_to_X 工具自动生成
✓ 条件满足时能移交
✓ 移交链路有限制（防止死循环）
```

#### Week 9: CLI 增强
```bash
# 新增命令
agents create --extended    # 引导填写高级配置
agents route "<prompt>"     # 测试路由

# 验收
✓ 创建流程支持 triggers/handoffs
✓ 路由结果准确
```

### Week 10-12: Guardrails 与 Memory

#### Week 10: Guardrails（输出校验）
```typescript
// 新增字段
guardrails:
  - schema: { type: 'object', ... }
    policy: reject

// 交付物
packages/core/src/agents/
  └── GuardrailValidator.ts

// 验收
✓ JSON Schema 校验生效
✓ reject 策略抛出错误
✓ repair 策略自动修复
```

#### Week 11: Memory（状态记忆）
```typescript
// 新增字段
memory:
  session: [task_id, files]
  long_term: { backend: 'vector_store' }

// 交付物
packages/core/src/agents/
  └── Memory.ts

// 验收
✓ session 内存在上下文间保持
✓ long_term 能持久化与检索
```

#### Week 12: 集成测试
```bash
# 完整流程测试
自动路由 → Agent A → Handoff → Agent B → Guardrail → 返回

✓ 整条链路通顺
✓ 事件记录完整
```

### Week 13-14: Graph 与 Tracing

#### Week 13: Graph（图编排）
```typescript
// 新增字段
graph:
  entry: analyzer
  nodes: [...]
  edges: [...]

// 交付物
packages/core/src/agents/
  └── GraphBuilder.ts

// 集成
@langchain/langgraph         # LangGraph 依赖

// 验收
✓ 能构建 StateGraph
✓ 条件边正确执行
✓ agents graph visualize 能显示图
```

#### Week 14: Tracing（可观测性）
```typescript
// 新增字段
tracing:
  enabled: true
  events: [llm, tool, handoff]

// 交付物
packages/core/src/agents/
  └── Tracer.ts

// 验收
✓ 能记录所有事件类型
✓ agents graph replay 能回放
✓ 能导出 JSON 格式
```

### Week 15-16: 测试与发布

#### Week 15: 完整测试
```bash
# P2 所有场景
✓ 自动路由准确
✓ Handoff 链路通顺
✓ Guardrails 生效
✓ Memory 持久化
✓ Graph 可视化
✓ Tracing 完整

# 性能测试
✓ Agent 切换 < 100ms
✓ 上下文隔离无泄漏
✓ MCP 连接池稳定
```

#### Week 16: 文档与发布
```markdown
# 文档
docs/AGENTS_ADVANCED.md     # P2 高级特性
docs/AGENT_PATTERNS.md      # 最佳实践
examples/multi-agent/       # 示例项目

# 发布
- Beta 版发布
- 收集用户反馈
- 迭代优化
```

---

## 🔑 关键里程碑

### M1: P1 完成（Week 6）
**交付**:
- ✅ 文件式 Agent 定义可用
- ✅ CLI 命令完整
- ✅ 独立上下文工作
- ✅ 工具白名单生效
- ✅ MCP 集成正常

**验收**: 能创建并运行一个独立的 debug-analyzer Agent，完全隔离于主会话

### M2: P2 路由与移交（Week 9）
**交付**:
- ✅ 自动路由可用
- ✅ Handoff 机制工作
- ✅ 多 Agent 协作成功

**验收**: 能自动路由到 debug-analyzer，分析后移交给 code-fixer，修复后移交给 reviewer

### M3: P2 完成（Week 16）
**交付**:
- ✅ 所有 P2 特性实现
- ✅ 文档完善
- ✅ Beta 版发布

**验收**: 完整的多 Agent 系统，对齐 OpenAI Agents 与 LangGraph 语义

---

## 🎯 优先级矩阵

### 必须有（P1）
- Agent 文件定义与加载
- 独立上下文管理
- 工具白名单控制
- MCP 基础集成
- CLI 基本命令

### 应该有（P2 早期）
- 自动路由
- Handoffs
- Guardrails (reject)

### 可以有（P2 后期）
- Guardrails (repair)
- Long-term memory
- Graph 可视化
- LangGraph 深度集成

### 暂不做（未来）
- Agent Marketplace
- Visual Agent Builder
- Real-time collaboration
- Cloud sync

---

## 🛠️ 技术栈决策

### 核心依赖
```json
{
  "dependencies": {
    "js-yaml": "^4.1.0",           // YAML 解析
    "gray-matter": "^4.0.3",       // Front-matter 解析
    "ajv": "^8.12.0",              // JSON Schema 验证
    "@langchain/langgraph": "^0.0.19"  // P2: 图编排
  }
}
```

### 可选依赖
```json
{
  "optionalDependencies": {
    "vectordb": "^1.0.0",          // P2: 长期记忆
    "opentelemetry": "^1.0.0"      // P2: Tracing 导出
  }
}
```

---

## 📊 成功指标

### P1 成功指标
- ✅ 能在 5 分钟内创建并运行一个 Agent
- ✅ 上下文隔离 100% 无泄漏
- ✅ 工具白名单 100% 生效
- ✅ MCP 集成成功率 > 95%
- ✅ 用户文档覆盖率 100%

### P2 成功指标
- ✅ 自动路由准确率 > 90%
- ✅ Handoff 成功率 > 95%
- ✅ Guardrail 覆盖率 > 80%
- ✅ Graph 执行成功率 > 95%
- ✅ Tracing 事件完整性 100%

### 用户满意度指标
- 😊 首次成功率 > 80%（用户第一次尝试就成功）
- 😊 文档满意度 > 4.0/5.0
- 😊 功能完整性 > 4.0/5.0
- 😊 Bug 报告率 < 5%

---

## 🚨 风险缓解

### Top 3 风险

1. **MCP 集成复杂度**
   - 缓解: Week 4 提前 POC，优先支持 GitHub MCP
   - 备选: 先做简单的工具扩展，MCP 作为高级特性

2. **LangGraph 依赖冲突**
   - 缓解: 做好依赖隔离，提供降级方案（纯 JS 实现图逻辑）
   - 备选: Graph 作为可选特性，不强制依赖

3. **性能开销**
   - 缓解: 上下文用浅拷贝 + COW，按需持久化
   - 备选: 提供配置项让用户权衡性能与功能

---

## 📝 下一步行动

### 立即开始（本周）
1. [ ] Review 完整设计文档
2. [ ] 确认技术栈选型
3. [ ] 搭建项目结构
4. [ ] 实现第一个 Agent 文件解析器

### Week 1 冲刺
- [ ] AgentParser 实现与测试
- [ ] AgentValidator 实现与测试
- [ ] 第一个 Agent 模板（debugging.md）
- [ ] 单元测试覆盖率 > 80%

### Week 2 冲刺
- [ ] AgentManager 实现
- [ ] `agents create` 命令
- [ ] `agents list` 命令
- [ ] `agents validate` 命令
- [ ] E2E 测试第一个场景

---

**更多详情请参考**:
- [完整设计文档](./AGENTS_SYSTEM_DESIGN.md)
- [Agent 模板](./agent-templates/)
- [API 参考](./api-reference.md)（待创建）

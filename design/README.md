# 设计文档索引

本目录包含 Gemini CLI 的架构设计文档。

## 📚 文档列表

### 1. [Agents 系统设计文档](./AGENTS_SYSTEM_DESIGN.md)

**完整的 Agents 系统架构设计**，包括：

- **P1 基础版**: 文件定义、CLI 管理、独立上下文、工具白名单、MCP 集成
- **P2 扩展版**: 自动路由、Handoffs、Guardrails、Memory、Graph、Tracing
- **技术架构**: 模块结构、数据流、文件系统布局
- **实施计划**: 16 周详细排期，里程碑定义
- **风险评估**: 技术风险、安全风险、用户体验风险及缓解措施

**何时阅读**: 需要了解完整系统设计时

**关键章节**:
- [§3 P1 基础版设计](#3-p1-基础版设计) - Agent 定义格式、CLI 命令、运行时架构
- [§4 P2 扩展版设计](#4-p2-扩展版设计) - 高级特性（triggers、handoffs、guardrails 等）
- [§5 技术架构](#5-技术架构) - 模块结构、数据流、配置
- [§6 实施计划](#6-实施计划) - 详细的分阶段实施步骤

---

### 2. [Agents 实施路线图](./AGENTS_IMPLEMENTATION_ROADMAP.md)

**精简版实施指南**，专注于：

- **两阶段时间线**: P1 (4-6周) 和 P2 (6-8周) 的周级排期
- **关键里程碑**: M1、M2、M3 的验收标准
- **优先级矩阵**: 必须有、应该有、可以有、暂不做
- **成功指标**: P1/P2 的量化成功指标
- **下一步行动**: 立即可开始的具体任务

**何时阅读**: 准备开始实施时，需要快速了解时间线和优先级

**适合人群**: 项目经理、开发 Lead、想快速了解进度的人

---

### 3. [Agent 模板库](./agent-templates/)

**开箱即用的 Agent 模板**，包括：

#### [debugging.md](./agent-templates/debugging.md)
- **用途**: 调试分析专家
- **工具**: read_file, grep, bash (只读)
- **MCP**: GitHub
- **特点**: 系统化的调试流程，从错误分析到解决方案

#### [code-review.md](./agent-templates/code-review.md)
- **用途**: 代码审查专家
- **工具**: read_file, grep, GitHub PR 相关
- **MCP**: GitHub
- **特点**: 多维度评审（质量、安全、性能），结构化反馈

#### [documentation.md](./agent-templates/documentation.md)
- **用途**: 文档生成专家
- **工具**: read_file, write_file, grep
- **MCP**: 无
- **特点**: 多种文档类型（API、README、架构），丰富模板

**何时使用**:
- 创建新 Agent 时作为参考
- 学习如何编写高质量的 Agent 定义
- 直接复制使用，快速启动

---

## 🎯 快速导航

### 按角色

**项目经理**:
1. [实施路线图](./AGENTS_IMPLEMENTATION_ROADMAP.md) - 了解时间线和里程碑
2. [系统设计 §2](./AGENTS_SYSTEM_DESIGN.md#2-设计目标) - 了解目标和价值

**架构师**:
1. [系统设计 §5](./AGENTS_SYSTEM_DESIGN.md#5-技术架构) - 技术架构
2. [系统设计 §7](./AGENTS_SYSTEM_DESIGN.md#7-风险与缓解) - 风险评估

**开发者**:
1. [系统设计 §3](./AGENTS_SYSTEM_DESIGN.md#3-p1-基础版设计) - P1 详细设计
2. [实施路线图](./AGENTS_IMPLEMENTATION_ROADMAP.md) - 实施步骤
3. [Agent 模板](./agent-templates/) - 代码示例

**用户/文档编写者**:
1. [Agent 模板](./agent-templates/) - 学习如何定义 Agent
2. [系统设计 §3.1](./AGENTS_SYSTEM_DESIGN.md#31-agent-定义格式) - Agent 文件格式规范

---

### 按任务

**想要快速了解 Agents 是什么**:
→ [系统设计 §1 概述](./AGENTS_SYSTEM_DESIGN.md#1-概述)

**准备开始实施 P1**:
→ [实施路线图 P1 时间线](./AGENTS_IMPLEMENTATION_ROADMAP.md#-p1-实施时间线)

**需要理解技术架构**:
→ [系统设计 §5 技术架构](./AGENTS_SYSTEM_DESIGN.md#5-技术架构)

**想创建第一个 Agent**:
→ [debugging.md 模板](./agent-templates/debugging.md)

**评估风险与可行性**:
→ [系统设计 §7 风险与缓解](./AGENTS_SYSTEM_DESIGN.md#7-风险与缓解)

**了解与业界标准的对齐**:
→ [系统设计 §1.1 背景](./AGENTS_SYSTEM_DESIGN.md#11-背景)

---

## 📖 阅读顺序建议

### 第一次阅读（快速了解）
1. **系统设计 §1 概述** (5 分钟) - 了解背景和目标
2. **实施路线图** (10 分钟) - 了解时间线和优先级
3. **一个 Agent 模板** (10 分钟) - 看看实际的 Agent 长什么样

### 深入理解（准备实施）
1. **系统设计 §3 P1 基础版** (30 分钟) - 详细了解 P1 设计
2. **系统设计 §5 技术架构** (20 分钟) - 理解技术实现
3. **实施路线图 P1 时间线** (15 分钟) - 详细实施步骤
4. **所有 Agent 模板** (20 分钟) - 学习最佳实践

### 完整掌握（架构师必读）
1. **完整阅读系统设计文档** (2 小时)
2. **完整阅读实施路线图** (30 分钟)
3. **研究所有 Agent 模板** (1 小时)

---

## 🔄 文档更新记录

| 日期 | 文档 | 更新内容 |
|------|------|----------|
| 2025-10-04 | 全部 | 初始版本创建 |

---

## 🤝 贡献指南

### 更新现有文档

1. 确保理解完整的设计意图
2. 保持与其他文档的一致性
3. 更新相关的交叉引用
4. 更新本 README 的版本记录

### 添加新文档

1. 在本 README 添加索引
2. 在相关文档中添加交叉引用
3. 考虑读者的角色和使用场景
4. 提供清晰的导航和目录

### 文档规范

- **格式**: Markdown
- **标题**: 使用 ATX 风格 (`#` 不是 `===`)
- **代码块**: 指定语言 (```typescript 不是 ```)
- **链接**: 使用相对路径，便于本地查看
- **图表**: 使用 ASCII art 或 Mermaid（未来支持）

---

## 📞 联系方式

**问题或建议**:
- GitHub Issues: [项目 issues 页面](#)
- 讨论: [GitHub Discussions](#)
- 文档维护者: Gemini CLI Team

---

## 📄 许可证

本设计文档采用与 Gemini CLI 项目相同的许可证。

---

**最后更新**: 2025-10-04
**文档版本**: 1.0

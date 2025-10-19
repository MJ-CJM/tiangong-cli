# 规格驱动开发 (SDD) - 快速入门指南

> ⚡ 5 分钟快速上手规格驱动开发

**状态**: 核心功能完成
**版本**: 1.0.0
**最后更新**: 2025-01-19

---

## 📋 什么是规格驱动开发？

规格驱动开发 (SDD) 是一种结构化的软件开发方法，灵感来自 GitHub 的 Spec Kit：

```
宪章 (Constitution) → 规格 (Specification) → 技术方案 (Technical Plan) → 任务 (Tasks) → 实现 (Implementation)
```

**核心优势**：
- ✅ 编码前明确业务需求
- ✅ 减少返工和沟通误差
- ✅ 可追溯的决策和需求
- ✅ 业务团队和技术团队更好的协作

---

## 🚀 快速开始 (MVP 功能)

### 前置条件

```bash
# 构建项目
npm run build

# 启动 tiangong-cli
npm start
```

---

## 步骤 1: 创建宪章 (一次性设置)

**宪章 (Constitution)** 为你的项目建立工程原则和标准。

```bash
# 开始交互式宪章创建
/spec constitution --init
```

**AI 会引导你完成**：
1. 这是什么类型的项目？
2. 核心工程原则是什么？
3. 技术约束是什么？
4. 测试标准是什么？
5. 安全要求是什么？
6. 性能目标是什么？
7. 架构偏好是什么？

**示例输出**：
```
✅ 宪章创建成功

📁 保存到: `.gemini/specs/constitution.json`

## 宪章摘要

**版本**: 1.0.0

### 🎯 核心原则 (3)
1. 优先使用组合而非继承
2. 为所有关键路径编写测试
3. 为公共 API 编写文档

### ⚠️ 技术约束 (2)
1. 必须支持 Node.js 20+
2. 不允许外部运行时依赖

### ✅ 质量标准
- **测试**: 80% 代码覆盖率，单元测试 + 集成测试
- **安全**: 符合 OWASP Top 10，安全审计
- **性能**: API 响应时间 < 100ms
```

**查看你的宪章**：
```bash
/spec constitution
```

---

## 步骤 2: 创建规格

**规格 (Specification)** 从**业务视角**描述**需要构建什么**。

**重要提示**: 专注于业务需求，而非技术实现！

```bash
# 开始交互式规格创建
/spec new
```

**AI 会引导你完成**：
1. 你想构建什么功能/变更？
2. 业务目标是什么？（为什么要构建这个？）
3. 用户是谁？他们想要什么？（用户故事）
4. 如何知道已经完成？（验收标准）
5. 有什么业务约束吗？
6. 优先级（1-5）？
7. 业务价值（1-10）？

**示例输出**：
```
✅ 规格创建成功

📁 保存到: `.gemini/specs/features/feat-user-auth.json`

# 用户认证系统

**ID**: `feat-user-auth`
**类别**: feature
**状态**: draft
**优先级**: 1/5
**业务价值**: 9/10

## 🎯 业务目标

使用户能够安全访问其个性化内容，并保护敏感数据免受未授权访问。

## 👥 用户故事 (3)

1. 作为新用户，我想用邮箱/密码注册，以便创建账户
2. 作为已注册用户，我想登录，以便访问我的内容
3. 作为已登录用户，我想注销，以便保护我的账户

## ✅ 验收标准 (4)

1. 用户可以使用有效邮箱和强密码注册
2. 用户注册后收到邮箱验证
3. 用户可以使用正确的凭据登录
4. 用户会话在 24 小时不活动后过期
```

---

## 步骤 3: 管理你的规格

### 列出所有规格

```bash
/spec list
```

**输出**：
```
# 📋 规格列表 (3)

## 📝 草稿 (DRAFT) (2)
- `feat-user-auth` - 用户认证系统 [P1]
  📂 feature | 📅 10/17/2025

- `feat-payment` - 支付处理 [P2]
  📂 feature | 📅 10/16/2025

## 🔄 进行中 (IN-PROGRESS) (1)
- `bug-login-fix` - 修复登录超时问题 [P1]
  📂 bug-fix | 📅 10/15/2025
```

### 查看规格详情

```bash
/spec show feat-user-auth
```

---

## 📁 文件结构

创建宪章和规格后，你将拥有：

```
.gemini/
└── specs/
    ├── constitution.json          # 项目原则
    └── features/
        ├── feat-user-auth.json    # 用户认证规格
        └── feat-payment.json      # 支付规格
```

---

## 🎯 Phase 2: 技术方案和任务分解（已完成）

Phase 2 功能现已可用！

### 步骤 4: 生成技术方案

基于规格创建详细的技术设计。

```bash
# 为规格生成技术方案
/spec plan new feat-user-auth
# → 生成 plan-feat-user-auth-v1
```

**AI 会生成**：
- 架构设计（技术方法、组件、数据流）
- 实现细节（需要创建/修改的文件）
- 技术风险和缓解策略
- 完整的测试策略
- 性能和安全考虑
- 工作量估算

**查看生成的方案**：
```bash
/spec plan show plan-feat-user-auth-v1
```

---

### 步骤 5: 生成任务列表

将技术方案分解为可执行的任务。

```bash
# 基于技术方案生成任务
/spec tasks new plan-feat-user-auth-v1
# → 生成 plan-feat-user-auth-v1-default
```

**AI 会生成**：
- 按类型分类的任务（implementation、testing、documentation、review）
- 任务之间的依赖关系
- 每个任务的文件关联
- 工作量估算
- 优先级设置

**查看生成的任务**：
```bash
/spec tasks show plan-feat-user-auth-v1-default
```

---

### 完整工作流示例

```bash
# 1. 创建宪章（一次性）
/spec constitution --init

# 2. 创建业务规格
/spec new
# → 输入: feat-user-auth, 用户认证系统

# 3. 查看规格
/spec show feat-user-auth

# 4. 生成技术方案
/spec plan new feat-user-auth
# → 生成 plan-feat-user-auth-v1

# 5. 查看技术方案
/spec plan show plan-feat-user-auth-v1

# 6. 生成任务列表
/spec tasks new plan-feat-user-auth-v1
# → 生成 plan-feat-user-auth-v1-default

# 7. 查看任务详情
/spec tasks show plan-feat-user-auth-v1-default

# 8. 开始实现
# 根据任务列表逐步实现功能
```

---

## 🎯 接下来做什么？

### 第三阶段（计划中）

1. **完整的 CRUD 操作**
   - 更新和删除规格、方案、任务
   - 规格验证和依赖检查

2. **与 Todo 系统集成**
   ```bash
   /spec tasks sync-todos feat-user-auth
   /todos execute-all --mode=auto_edit
   # 转换为待办事项并执行实现
   ```

3. **完整工作流**
   ```bash
   /workflow run spec-driven-development "构建用户认证"
   # 运行完整的 宪章 → 规格 → 方案 → 任务 → 实现 流程
   ```

---

## 💡 最佳实践

### 1. 宪章

- ✅ **应该**: 创建一次，很少更新
- ✅ **应该**: 让原则具体且可操作
- ❌ **不应该**: 包含项目特定的功能
- ❌ **不应该**: 写得太长（建议 3-7 条原则）

**好的示例**：
```
原则: "所有 API 端点必须有速率限制"
```

**不好的示例**：
```
原则: "编写好的代码"  # 太模糊了！
```

### 2. 规格

- ✅ **应该**: 专注于业务价值和用户需求
- ✅ **应该**: 编写清晰、可测试的验收标准
- ✅ **应该**: 包含业务约束（预算、时间表、合规性）
- ❌ **不应该**: 包含技术实现细节
- ❌ **不应该**: 提及特定的技术或框架

**好的示例**：
```
用户故事: "作为客户，我希望在订单发货时收到邮件通知，
以便我知道何时能收到货物"

验收标准: "客户在发货后 5 分钟内收到邮件"
```

**不好的示例**：
```
用户故事: "使用 SendGrid API 发送邮件"  # 这是技术细节！

验收标准: "使用 React hooks 实现"  # 太技术化了！
```

---

## 🐛 故障排查

### 宪章未找到

**问题**: `/spec constitution` 显示 "未找到宪章"

**解决方案**: 先使用 `/spec constitution --init` 创建一个

### 规格创建失败

**问题**: AI 在创建规格时返回错误

**可能的原因**：
1. 宪章不存在 → 先创建宪章
2. 规格 ID 已存在 → 使用不同的 ID
3. 缺少必填字段 → 确保提供所有字段

### 命令未显示

**问题**: `/spec` 命令无法识别

**解决方案**：
```bash
# 重新构建项目
npm run build

# 重启 CLI
npm start
```

---

## 📚 其他资源

### 完整文档（即将推出）

- **用户指南**: 包含高级功能的完整使用指南
- **工作流指南**: 端到端工作流示例
- **API 参考**: SpecManager 和 CLI 命令参考
- **示例**: 真实案例研究

### 路线图

查看 [`ROADMAP.md`](./ROADMAP.md) 获取完整实现计划，包括：
- 第二阶段: 完整工具集（方案、任务）
- 第三阶段: 完整的 SpecManager 与 CRUD 操作
- 第四阶段: 系统集成（Todo、Workflow）
- 第五阶段: 文档和测试

---

## 🤝 反馈和问题

这是一个 MVP 版本。我们期待您的反馈！

**发现 bug？** 在 GitHub 上提交 issue
**有建议？** 发起讨论
**想要贡献？** 查看 ROADMAP.md 了解计划中的功能

---

## 📄 许可证

Apache License 2.0

---

**祝你规格驱动开发愉快！🚀**

*让软件开发更加结构化和可预测，一次一个规格。*

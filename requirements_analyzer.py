# requirements_analyzer.py
import os
from dotenv import load_dotenv
from google.genai import types
from google.adk.agents import LlmAgent, SequentialAgent
from google.adk.tools.tool_context import ToolContext
import json
from typing import Dict, List, Any

load_dotenv()
MODEL = os.getenv("MODEL", "gemini-2.5-flash")

class RequirementsAnalyzer:
    """需求分析智能体类"""

    def __init__(self, model: str = MODEL):
        self.model = model
        self.analyzer_agent = LlmAgent(
            name="requirements_analyzer",
            model=model,
            description="Analyze user requirements and generate detailed requirement specifications",
            instruction=self._get_analysis_instruction(),
            output_key="REQUIREMENTS_ANALYSIS",
            generate_content_config=types.GenerateContentConfig(temperature=0.1),
        )

    def _get_analysis_instruction(self) -> str:
        return """
# 需求分析智能体指令

## 任务目标
分析用户提供的需求描述，生成详细的需求规格说明，为后续的设计和开发提供清晰的指导。

## 输入内容
用户需求: {USER_REQUEST}

## 分析维度
请从以下维度分析用户需求：

### 1. 功能需求分析
- 核心功能清单
- 功能优先级（高、中、低）
- 功能间的依赖关系
- 用户交互流程

### 2. 技术需求分析
- 技术栈建议
- 架构模式推荐
- 性能要求
- 安全需求
- 兼容性要求

### 3. 约束条件分析
- 时间约束
- 资源约束
- 预算约束
- 技术限制

### 4. 质量属性分析
- 可用性要求
- 可维护性要求
- 可扩展性要求
- 可测试性要求

### 5. 风险评估
- 技术风险
- 业务风险
- 时间风险
- 解决方案建议

## 输出格式
请以JSON格式输出分析结果：

```json
{
  "需求概述": {
    "项目名称": "项目名称",
    "项目描述": "项目的简要描述",
    "目标用户": "目标用户群体",
    "预期价值": "项目预期带来的价值"
  },
  "功能需求": {
    "核心功能": [
      {
        "功能名称": "功能名称",
        "功能描述": "详细描述",
        "优先级": "高/中/低",
        "验收标准": ["标准1", "标准2"]
      }
    ],
    "次要功能": [
      {
        "功能名称": "功能名称",
        "功能描述": "详细描述",
        "优先级": "高/中/低"
      }
    ]
  },
  "技术需求": {
    "推荐技术栈": {
      "前端": ["技术1", "技术2"],
      "后端": ["技术1", "技术2"],
      "数据库": ["数据库类型"],
      "部署": ["部署方案"]
    },
    "架构模式": "推荐的架构模式",
    "性能要求": "性能指标",
    "安全要求": ["安全要求1", "安全要求2"]
  },
  "约束条件": {
    "时间约束": "时间限制",
    "资源约束": "资源限制",
    "技术约束": ["约束1", "约束2"]
  },
  "实施建议": {
    "开发阶段": [
      {
        "阶段名称": "阶段1",
        "主要任务": ["任务1", "任务2"],
        "预估工期": "时间估计",
        "关键里程碑": "里程碑描述"
      }
    ],
    "技术选型理由": "选型的详细理由",
    "潜在风险": [
      {
        "风险描述": "风险说明",
        "影响程度": "高/中/低",
        "应对措施": "具体的应对方案"
      }
    ]
  },
  "下一步行动": [
    "行动项1：具体的下一步操作",
    "行动项2：具体的下一步操作"
  ]
}
```

请确保分析详细、准确，并提供实用的建议。
"""

    def analyze_requirements(self, user_request: str) -> Dict[str, Any]:
        """
        分析用户需求

        Args:
            user_request: 用户的需求描述

        Returns:
            Dict: 包含分析结果的字典
        """
        # 创建工具上下文
        tool_context = ToolContext()
        tool_context.state['USER_REQUEST'] = user_request

        try:
            # 执行需求分析
            result = self.analyzer_agent(tool_context)
            analysis_result = result.get("REQUIREMENTS_ANALYSIS", "")

            # 尝试解析JSON结果
            try:
                # 提取JSON内容（如果被包装在markdown代码块中）
                if "```json" in analysis_result:
                    start = analysis_result.find("```json") + 7
                    end = analysis_result.find("```", start)
                    json_content = analysis_result[start:end].strip()
                else:
                    json_content = analysis_result

                parsed_result = json.loads(json_content)

                return {
                    "status": "success",
                    "analysis": parsed_result,
                    "raw_analysis": analysis_result,
                    "message": "需求分析完成"
                }
            except json.JSONDecodeError:
                return {
                    "status": "success",
                    "analysis": None,
                    "raw_analysis": analysis_result,
                    "message": "需求分析完成，但JSON解析失败，返回原始分析结果"
                }

        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "message": f"需求分析失败: {str(e)}"
            }

# 工具函数
def analyze_user_requirements(tool_context: ToolContext, user_request: str = None) -> dict:
    """
    分析用户需求的工具函数

    Args:
        tool_context: 工具上下文
        user_request: 用户需求（可选，如果不提供则从context中获取）

    Returns:
        dict: 分析结果
    """
    if not user_request:
        user_request = tool_context.state.get('USER_REQUEST', '')

    if not user_request:
        return {
            "status": "error",
            "message": "没有提供用户需求"
        }

    analyzer = RequirementsAnalyzer()
    return analyzer.analyze_requirements(user_request)

# 创建需求分析智能体实例
requirements_analyzer = LlmAgent(
    name="requirements_analyzer",
    model=MODEL,
    description="分析用户需求并生成详细的需求规格说明",
    instruction=RequirementsAnalyzer()._get_analysis_instruction(),
    output_key="REQUIREMENTS_ANALYSIS",
    generate_content_config=types.GenerateContentConfig(temperature=0.1),
)

# 需求驱动的代码生成工作流
def create_requirements_driven_workflow():
    """创建需求驱动的完整开发工作流"""

    # 需求分析智能体
    analyzer = LlmAgent(
        name="requirements_analyzer",
        model=MODEL,
        description="分析用户需求并生成结构化需求文档",
        instruction=RequirementsAnalyzer()._get_analysis_instruction(),
        output_key="REQUIREMENTS_ANALYSIS",
        generate_content_config=types.GenerateContentConfig(temperature=0.1),
    )

    # 架构设计智能体
    architect = LlmAgent(
        name="system_architect",
        model=MODEL,
        description="基于需求分析结果设计系统架构",
        instruction="""
基于需求分析结果，设计系统架构：

# 需求分析结果
{REQUIREMENTS_ANALYSIS}

# 任务
1. 设计系统整体架构
2. 定义模块划分
3. 设计数据模型
4. 定义接口规范
5. 制定技术实施方案

# 输出格式
请提供详细的架构设计文档，包括：
- 系统架构图描述
- 模块设计
- 数据库设计
- API设计
- 技术实施计划
        """,
        output_key="ARCHITECTURE_DESIGN",
        generate_content_config=types.GenerateContentConfig(temperature=0.2),
    )

    # 代码生成智能体
    coder = LlmAgent(
        name="code_generator",
        model=MODEL,
        description="基于架构设计生成具体代码实现",
        instruction="""
基于需求分析和架构设计，生成具体的代码实现：

# 需求分析
{REQUIREMENTS_ANALYSIS}

# 架构设计
{ARCHITECTURE_DESIGN}

# 任务
1. 生成核心模块代码
2. 实现关键功能
3. 添加必要的测试代码
4. 提供部署配置
5. 生成文档

# 代码质量要求
- 代码结构清晰
- 注释完整
- 遵循最佳实践
- 易于维护和扩展
        """,
        output_key="GENERATED_CODE",
        generate_content_config=types.GenerateContentConfig(temperature=0.3),
    )

    # 测试和验证智能体
    tester = LlmAgent(
        name="code_reviewer_tester",
        model=MODEL,
        description="审查代码质量并生成测试方案",
        instruction="""
审查生成的代码并制定测试方案：

# 需求分析
{REQUIREMENTS_ANALYSIS}

# 生成的代码
{GENERATED_CODE}

# 任务
1. 代码质量审查
2. 安全性检查
3. 性能优化建议
4. 测试用例设计
5. 部署验证方案

# 输出
- 代码审查报告
- 改进建议
- 详细测试计划
- 验收标准
        """,
        output_key="REVIEW_AND_TESTS",
        generate_content_config=types.GenerateContentConfig(temperature=0.2),
    )

    # 创建完整的顺序工作流
    complete_workflow = SequentialAgent(
        name="requirements_driven_development_workflow",
        description="从需求分析到代码生成的完整开发工作流",
        sub_agents=[
            analyzer,      # 1. 需求分析
            architect,     # 2. 架构设计
            coder,         # 3. 代码生成
            tester         # 4. 测试和验证
        ],
    )

    return complete_workflow

# 使用示例
if __name__ == "__main__":
    # 创建需求分析器实例
    analyzer = RequirementsAnalyzer()

    # 示例用户需求
    user_request = """
    我需要开发一个在线任务管理系统，用户可以创建、编辑、删除任务，
    支持任务分类、优先级设置、截止日期提醒。
    需要支持多用户协作，实时同步更新。
    希望界面简洁易用，支持移动端访问。
    """

    # 分析需求
    result = analyzer.analyze_requirements(user_request)

    if result["status"] == "success":
        print("需求分析完成！")
        if result["analysis"]:
            print("\n结构化分析结果：")
            print(json.dumps(result["analysis"], indent=2, ensure_ascii=False))
        else:
            print("\n原始分析结果：")
            print(result["raw_analysis"])
    else:
        print(f"分析失败: {result['message']}")
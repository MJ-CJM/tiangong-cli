/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  UnifiedRequest,
  UnifiedResponse,
  UnifiedMessage,
  ContentPart,
  ToolDefinition
} from '../base/index.js';

import {
  MessageRole
} from '../base/index.js';

/**
 * Utility class for translating between different API formats
 */
export class APITranslator {
  /**
   * Convert Gemini Content format to UnifiedMessage
   */
  static geminiContentToUnified(content: any): UnifiedMessage {
    const role = content.role === 'user' ? MessageRole.USER :
                 content.role === 'model' ? MessageRole.ASSISTANT :
                 MessageRole.SYSTEM;

    const parts: ContentPart[] = content.parts?.map((part: any) => {
      if (part.text) {
        return { type: 'text', text: part.text };
      }
      if (part.inlineData) {
        return {
          type: 'image',
          image: {
            data: part.inlineData.data,
            mimeType: part.inlineData.mimeType
          }
        };
      }
      if (part.functionCall) {
        return {
          type: 'function_call',
          functionCall: {
            name: part.functionCall.name,
            args: part.functionCall.args
          }
        };
      }
      if (part.functionResponse) {
        return {
          type: 'function_response',
          functionResponse: {
            name: part.functionResponse.name,
            content: part.functionResponse.response
          }
        };
      }
      return { type: 'text', text: '' };
    }) || [];

    return { role, content: parts };
  }

  /**
   * Convert UnifiedMessage to Gemini Content format
   */
  static unifiedToGeminiContent(message: UnifiedMessage): any {
    const role = message.role === MessageRole.USER ? 'user' :
                 message.role === MessageRole.ASSISTANT ? 'model' :
                 'user'; // Default to user for system messages

    const parts = message.content.map(part => {
      switch (part.type) {
        case 'text':
          return { text: part.text };
        case 'image':
          return {
            inlineData: {
              data: part.image?.data,
              mimeType: part.image?.mimeType
            }
          };
        case 'function_call':
          return {
            functionCall: {
              name: part.functionCall?.name,
              args: part.functionCall?.args
            }
          };
        case 'function_response':
          return {
            functionResponse: {
              name: part.functionResponse?.name,
              response: part.functionResponse?.content
            }
          };
        default:
          return { text: part.text || '' };
      }
    });

    return { role, parts };
  }

  /**
   * Convert OpenAI message format to UnifiedMessage
   */
  static openaiMessageToUnified(message: any): UnifiedMessage {
    const role = message.role === 'user' ? MessageRole.USER :
                 message.role === 'assistant' ? MessageRole.ASSISTANT :
                 message.role === 'system' ? MessageRole.SYSTEM :
                 MessageRole.FUNCTION;

    let content: ContentPart[];

    if (typeof message.content === 'string') {
      content = [{ type: 'text', text: message.content }];
    } else if (Array.isArray(message.content)) {
      content = message.content.map((part: any) => {
        if (part.type === 'text') {
          return { type: 'text', text: part.text };
        }
        if (part.type === 'image_url') {
          return {
            type: 'image',
            image: {
              data: part.image_url.url,
              mimeType: 'image/jpeg' // Default, should be detected
            }
          };
        }
        return { type: 'text', text: '' };
      });
    } else {
      content = [{ type: 'text', text: '' }];
    }

    // Handle function calls
    if (message.function_call) {
      content.push({
        type: 'function_call',
        functionCall: {
          name: message.function_call.name,
          args: JSON.parse(message.function_call.arguments || '{}')
        }
      });
    }

    // Handle tool calls
    if (message.tool_calls) {
      for (const toolCall of message.tool_calls) {
        if (toolCall.type === 'function') {
          content.push({
            type: 'function_call',
            functionCall: {
              name: toolCall.function.name,
              args: JSON.parse(toolCall.function.arguments || '{}')
            }
          });
        }
      }
    }

    return { role, content };
  }

  /**
   * Convert UnifiedMessage to OpenAI message format
   */
  static unifiedToOpenaiMessage(message: UnifiedMessage): any {
    const role = message.role === MessageRole.USER ? 'user' :
                 message.role === MessageRole.ASSISTANT ? 'assistant' :
                 message.role === MessageRole.SYSTEM ? 'system' :
                 'function';

    const textParts = message.content.filter(part => part.type === 'text');
    const imageParts = message.content.filter(part => part.type === 'image');
    const functionCalls = message.content.filter(part => part.type === 'function_call');
    // const functionResponses = message.content.filter(part => part.type === 'function_response');

    // Simple text message
    if (textParts.length === 1 && imageParts.length === 0 && functionCalls.length === 0) {
      const result: any = {
        role,
        content: textParts[0].text
      };

      return result;
    }

    // Multimodal or complex message
    const content: any[] = [];

    // Add text parts
    for (const part of textParts) {
      content.push({
        type: 'text',
        text: part.text
      });
    }

    // Add image parts
    for (const part of imageParts) {
      content.push({
        type: 'image_url',
        image_url: {
          url: part.image?.data
        }
      });
    }

    const result: any = { role, content };

    // Add function calls as tool_calls
    if (functionCalls.length > 0) {
      result.tool_calls = functionCalls.map((part, index) => ({
        id: `call_${index}`,
        type: 'function',
        function: {
          name: part.functionCall?.name,
          arguments: JSON.stringify(part.functionCall?.args)
        }
      }));
    }

    return result;
  }

  /**
   * Convert UnifiedRequest to OpenAI chat completion format
   */
  static unifiedToOpenaiRequest(request: UnifiedRequest): any {
    const messages = request.messages.map(msg => this.unifiedToOpenaiMessage(msg));

    // Add system message if provided
    if (request.systemMessage) {
      messages.unshift({
        role: 'system',
        content: request.systemMessage
      });
    }

    const result: any = {
      model: request.model,
      messages,
      stream: request.stream || false
    };

    if (request.maxTokens) {
      result.max_tokens = request.maxTokens;
    }

    if (request.temperature !== undefined) {
      result.temperature = request.temperature;
    }

    if (request.tools && request.tools.length > 0) {
      result.tools = request.tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }
      }));
    }

    return result;
  }

  /**
   * Convert OpenAI response to UnifiedResponse
   */
  static openaiResponseToUnified(response: any): UnifiedResponse {
    const choice = response.choices?.[0];
    if (!choice) {
      return {
        content: [],
        finishReason: 'stop'
      };
    }

    const message = choice.message || choice.delta;
    const content: ContentPart[] = [];

    if (message.content) {
      content.push({
        type: 'text',
        text: message.content
      });
    }

    // Handle tool calls
    if (message.tool_calls) {
      for (const toolCall of message.tool_calls) {
        if (toolCall.function) {
          content.push({
            type: 'function_call',
            functionCall: {
              name: toolCall.function.name,
              args: JSON.parse(toolCall.function.arguments || '{}')
            }
          });
        }
      }
    }

    return {
      content,
      finishReason: choice.finish_reason || 'stop',
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens
      } : undefined,
      model: response.model
    };
  }

  /**
   * Convert Gemini tool definition to unified format
   */
  static geminiToolToUnified(tool: any): ToolDefinition {
    return {
      name: tool.function_declarations[0].name,
      description: tool.function_declarations[0].description,
      parameters: tool.function_declarations[0].parameters
    };
  }

  /**
   * Convert unified tool definition to Gemini format
   */
  static unifiedToGeminiTool(tool: ToolDefinition): any {
    return {
      function_declarations: [{
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }]
    };
  }
}
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Content, Part } from '@google/genai';
import type { UnifiedMessage, ContentPart } from '../adapters/base/types.js';
import { MessageRole } from '../adapters/base/types.js';

/**
 * Convert Gemini SDK Content format to UnifiedMessage format
 *
 * This enables sharing main session conversation history with agents.
 */
export function convertGeminiToUnifiedMessages(
  history: Content[]
): UnifiedMessage[] {
  return history.map((content) => convertContentToUnifiedMessage(content));
}

/**
 * Convert a single Gemini Content to UnifiedMessage
 */
export function convertContentToUnifiedMessage(
  content: Content
): UnifiedMessage {
  return {
    role: convertRole(content.role || 'user'),
    content: (content.parts || []).map((part) => convertPart(part)),
  };
}

/**
 * Convert Gemini role to MessageRole
 */
function convertRole(role: string): MessageRole {
  switch (role) {
    case 'user':
      return MessageRole.USER;
    case 'model':
      return MessageRole.ASSISTANT;
    case 'function':
      return MessageRole.FUNCTION;
    default:
      return MessageRole.USER;
  }
}

/**
 * Convert Gemini Part to ContentPart
 */
function convertPart(part: Part): ContentPart {
  // Text part
  if ('text' in part && part.text !== undefined) {
    return {
      type: 'text',
      text: part.text,
    };
  }

  // Function call part
  if ('functionCall' in part && part.functionCall) {
    return {
      type: 'function_call',
      functionCall: {
        name: part.functionCall.name || '',
        args: part.functionCall.args || {},
        id: '', // Gemini SDK doesn't provide ID
      },
    };
  }

  // Function response part
  if ('functionResponse' in part && part.functionResponse) {
    return {
      type: 'function_response',
      functionResponse: {
        name: part.functionResponse.name || '',
        content: part.functionResponse.response,
        id: '', // Gemini SDK doesn't provide ID
      },
    };
  }

  // Inline data (images, etc.)
  if ('inlineData' in part && part.inlineData) {
    return {
      type: 'text',
      text: '[Image or inline data content]',
    };
  }

  // File data
  if ('fileData' in part && part.fileData) {
    return {
      type: 'text',
      text: `[File: ${part.fileData.fileUri}]`,
    };
  }

  // Executable code
  if ('executableCode' in part && part.executableCode) {
    return {
      type: 'text',
      text: `[Code: ${part.executableCode.language}]\n${part.executableCode.code}`,
    };
  }

  // Code execution result
  if ('codeExecutionResult' in part && part.codeExecutionResult) {
    return {
      type: 'text',
      text: `[Execution result: ${part.codeExecutionResult.outcome}]\n${part.codeExecutionResult.output || ''}`,
    };
  }

  // Thought (for thinking mode)
  if ('thought' in part && part.thought !== undefined) {
    return {
      type: 'text',
      text: `[Thought: ${part.thought}]`,
    };
  }

  // Fallback for unknown part types
  return {
    type: 'text',
    text: '[Unknown content type]',
  };
}

/**
 * Convert UnifiedMessage back to Gemini Content format
 *
 * This is useful if we need to sync agent messages back to main session.
 */
export function convertUnifiedToGeminiContent(
  message: UnifiedMessage
): Content {
  return {
    role: convertMessageRoleToGemini(message.role),
    parts: message.content.map((part) => convertContentPartToPart(part)),
  };
}

/**
 * Convert MessageRole to Gemini role
 */
function convertMessageRoleToGemini(role: MessageRole): string {
  switch (role) {
    case MessageRole.USER:
      return 'user';
    case MessageRole.ASSISTANT:
      return 'model';
    case MessageRole.FUNCTION:
      return 'function';
    default:
      return 'user';
  }
}

/**
 * Convert ContentPart to Gemini Part
 */
function convertContentPartToPart(part: ContentPart): Part {
  switch (part.type) {
    case 'text':
      return { text: part.text || '' };

    case 'function_call':
      return {
        functionCall: {
          name: part.functionCall!.name,
          args: part.functionCall!.args,
        },
      };

    case 'function_response':
      return {
        functionResponse: {
          name: part.functionResponse!.name,
          response: part.functionResponse!.content,
        },
      };

    default:
      return { text: '[Unknown content]' };
  }
}

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { APITranslator } from './apiTranslator.js';
import { MessageRole } from '../base/index.js';
import type { UnifiedRequest } from '../base/types.js';

describe('APITranslator', () => {
  describe('validateAndFixToolCalls', () => {
    it('should preserve complete tool_calls with responses', () => {
      const request: UnifiedRequest = {
        model: 'test-model',
        messages: [
          {
            role: MessageRole.USER,
            content: [{ type: 'text', text: 'Please help me' }]
          },
          {
            role: MessageRole.ASSISTANT,
            content: [
              { type: 'text', text: 'Let me use a tool' },
              {
                type: 'function_call',
                functionCall: {
                  name: 'test_tool',
                  args: { param: 'value' },
                  id: 'call_123'
                }
              }
            ]
          },
          {
            role: MessageRole.FUNCTION,
            content: [
              {
                type: 'function_response',
                functionResponse: {
                  name: 'test_tool',
                  content: { result: 'success' },
                  id: 'call_123'
                }
              }
            ]
          }
        ]
      };

      const result = APITranslator.unifiedToOpenaiRequest(request);
      
      // Should have 4 messages: system (none), user, assistant with tool_call, tool response
      expect(result.messages).toHaveLength(3);
      expect(result.messages[1].tool_calls).toBeDefined();
      expect(result.messages[1].tool_calls).toHaveLength(1);
      expect(result.messages[2].role).toBe('tool');
    });

    it('should remove incomplete tool_calls without responses', () => {
      const request: UnifiedRequest = {
        model: 'test-model',
        messages: [
          {
            role: MessageRole.USER,
            content: [{ type: 'text', text: 'Please help me' }]
          },
          {
            role: MessageRole.ASSISTANT,
            content: [
              { type: 'text', text: 'Let me use a tool' },
              {
                type: 'function_call',
                functionCall: {
                  name: 'test_tool',
                  args: { param: 'value' },
                  id: 'call_incomplete'
                }
              }
            ]
          },
          {
            role: MessageRole.USER,
            content: [{ type: 'text', text: 'Follow up question' }]
          }
        ]
      };

      const result = APITranslator.unifiedToOpenaiRequest(request);
      
      // Assistant message should have been cleaned (tool_calls removed, text preserved)
      const assistantMsg = result.messages.find((m: any) => m.role === 'assistant');
      expect(assistantMsg).toBeDefined();
      expect(assistantMsg.tool_calls).toBeUndefined();
      // Content can be string or array depending on format
      const content = Array.isArray(assistantMsg.content) 
        ? assistantMsg.content.find((c: any) => c.type === 'text')?.text || ''
        : assistantMsg.content;
      expect(content).toContain('Let me use a tool');
    });

    it('should handle multiple tool_calls with partial responses', () => {
      const request: UnifiedRequest = {
        model: 'test-model',
        messages: [
          {
            role: MessageRole.USER,
            content: [{ type: 'text', text: 'Please help me' }]
          },
          {
            role: MessageRole.ASSISTANT,
            content: [
              {
                type: 'function_call',
                functionCall: {
                  name: 'tool_1',
                  args: {},
                  id: 'call_1'
                }
              },
              {
                type: 'function_call',
                functionCall: {
                  name: 'tool_2',
                  args: {},
                  id: 'call_2'
                }
              }
            ]
          },
          {
            role: MessageRole.FUNCTION,
            content: [
              {
                type: 'function_response',
                functionResponse: {
                  name: 'tool_1',
                  content: { result: 'success' },
                  id: 'call_1'
                }
              }
            ]
          }
        ]
      };

      const result = APITranslator.unifiedToOpenaiRequest(request);
      
      // Assistant message should be removed since not all tool_calls have responses
      const assistantMsg = result.messages.find((m: any) => m.role === 'assistant' && m.tool_calls);
      expect(assistantMsg).toBeUndefined();
    });

    it('should preserve assistant message with only text (no tool_calls)', () => {
      const request: UnifiedRequest = {
        model: 'test-model',
        messages: [
          {
            role: MessageRole.USER,
            content: [{ type: 'text', text: 'Hello' }]
          },
          {
            role: MessageRole.ASSISTANT,
            content: [{ type: 'text', text: 'Hi there!' }]
          }
        ]
      };

      const result = APITranslator.unifiedToOpenaiRequest(request);
      
      expect(result.messages).toHaveLength(2);
      expect(result.messages[1].role).toBe('assistant');
      expect(result.messages[1].content).toBe('Hi there!');
      expect(result.messages[1].tool_calls).toBeUndefined();
    });

    it('should handle empty assistant message with incomplete tool_calls', () => {
      const request: UnifiedRequest = {
        model: 'test-model',
        messages: [
          {
            role: MessageRole.USER,
            content: [{ type: 'text', text: 'Please help me' }]
          },
          {
            role: MessageRole.ASSISTANT,
            content: [
              {
                type: 'function_call',
                functionCall: {
                  name: 'test_tool',
                  args: {},
                  id: 'call_empty'
                }
              }
            ]
          },
          {
            role: MessageRole.USER,
            content: [{ type: 'text', text: 'Next question' }]
          }
        ]
      };

      const result = APITranslator.unifiedToOpenaiRequest(request);
      
      // Empty assistant message with incomplete tool_calls should be completely removed
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[1].role).toBe('user');
    });
  });

  describe('unifiedToOpenaiMessage', () => {
    it('should convert function_response to tool role', () => {
      const message = {
        role: MessageRole.FUNCTION,
        content: [
          {
            type: 'function_response' as const,
            functionResponse: {
              name: 'test_tool',
              content: { result: 'success' },
              id: 'call_123'
            }
          }
        ]
      };

      const result = APITranslator.unifiedToOpenaiMessage(message, true);
      
      expect(result.role).toBe('tool');
      expect(result.tool_call_id).toBe('call_123');
      expect(result.content).toBeDefined();
    });

    it('should handle tool_calls in assistant message', () => {
      const message = {
        role: MessageRole.ASSISTANT,
        content: [
          { type: 'text' as const, text: 'Using a tool' },
          {
            type: 'function_call' as const,
            functionCall: {
              name: 'test_tool',
              args: { param: 'value' },
              id: 'call_456'
            }
          }
        ]
      };

      const result = APITranslator.unifiedToOpenaiMessage(message, true);
      
      expect(result.role).toBe('assistant');
      expect(result.tool_calls).toBeDefined();
      expect(result.tool_calls).toHaveLength(1);
      expect(result.tool_calls[0].id).toBe('call_456');
      expect(result.tool_calls[0].function.name).toBe('test_tool');
    });
  });
});


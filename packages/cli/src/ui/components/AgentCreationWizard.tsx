/**
 * @license
 * Copyright 2025 Gemini CLI
 * SPDX-License-Identifier: MIT
 */

import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { useKeypress } from '../hooks/useKeypress.js';
import type { Key } from '../hooks/useKeypress.js';
import chalk from 'chalk';

export interface AgentCreationConfig {
  name: string;
  title: string;
  description: string;
  scope: 'global' | 'project';
  model: string;
  contentMode: 'manual' | 'ai';
  purpose?: string;
  allowTools: string[];
  denyTools: string[];
}

interface AgentCreationWizardProps {
  availableModels: string[];
  onComplete: (config: AgentCreationConfig) => void;
  onCancel: () => void;
}

type Step =
  | 'name'
  | 'title'
  | 'description'
  | 'scope'
  | 'model'
  | 'contentMode'
  | 'purpose'
  | 'confirm';

export function AgentCreationWizard({
  availableModels,
  onComplete,
  onCancel,
}: AgentCreationWizardProps): React.JSX.Element {
  const [step, setStep] = useState<Step>('name');
  const [config, setConfig] = useState<Partial<AgentCreationConfig>>({
    scope: 'project',
    model: availableModels[0] || 'gemini-2.0-flash',
    contentMode: 'manual',
    allowTools: ['read_file', 'grep', 'glob', 'bash'],
    denyTools: [],
  });

  // Input buffer for text fields
  const [inputBuffer, setInputBuffer] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleTextInput = useCallback(
    (key: Key) => {
      if (key.name === 'return') {
        // Submit current input
        const value = inputBuffer.trim();
        if (value.length === 0) return;

        setConfig((prev) => ({ ...prev, [step]: value }));
        setInputBuffer('');

        // Move to next step
        if (step === 'name') {
          // Auto-generate title from name
          const title = value
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (l) => l.toUpperCase());
          setConfig((prev) => ({ ...prev, title }));
          setStep('description');
        } else if (step === 'description') {
          setStep('scope');
        } else if (step === 'title') {
          setStep('description');
        } else if (step === 'purpose') {
          setStep('confirm');
        }
      } else if (key.name === 'escape') {
        onCancel();
      } else if (key.name === 'backspace' || key.name === 'delete') {
        setInputBuffer((prev) => prev.slice(0, -1));
      } else if (key.sequence && key.sequence.length === 1) {
        setInputBuffer((prev) => prev + key.sequence);
      }
    },
    [step, inputBuffer, onCancel],
  );

  const handleSelectionInput = useCallback(
    (key: Key) => {
      if (key.name === 'escape') {
        onCancel();
        return;
      }

      if (step === 'scope') {
        const options = ['project', 'global'];
        if (key.name === 'up' || key.name === 'k') {
          setSelectedIndex((prev) => Math.max(0, prev - 1));
        } else if (key.name === 'down' || key.name === 'j') {
          setSelectedIndex((prev) => Math.min(options.length - 1, prev + 1));
        } else if (key.name === 'return') {
          setConfig((prev) => ({
            ...prev,
            scope: options[selectedIndex] as 'project' | 'global',
          }));
          setSelectedIndex(0);
          setStep('model');
        }
      } else if (step === 'model') {
        if (key.name === 'up' || key.name === 'k') {
          setSelectedIndex((prev) => Math.max(0, prev - 1));
        } else if (key.name === 'down' || key.name === 'j') {
          setSelectedIndex((prev) =>
            Math.min(availableModels.length - 1, prev + 1),
          );
        } else if (key.name === 'return') {
          setConfig((prev) => ({
            ...prev,
            model: availableModels[selectedIndex],
          }));
          setSelectedIndex(0);
          setStep('contentMode');
        }
      } else if (step === 'contentMode') {
        const options = ['manual', 'ai'];
        if (key.name === 'up' || key.name === 'k') {
          setSelectedIndex((prev) => Math.max(0, prev - 1));
        } else if (key.name === 'down' || key.name === 'j') {
          setSelectedIndex((prev) => Math.min(options.length - 1, prev + 1));
        } else if (key.name === 'return') {
          const mode = options[selectedIndex] as 'manual' | 'ai';
          setConfig((prev) => ({ ...prev, contentMode: mode }));
          setSelectedIndex(0);

          if (mode === 'ai') {
            setStep('purpose');
          } else {
            setStep('confirm');
          }
        }
      } else if (step === 'confirm') {
        const options = ['confirm', 'cancel'];
        if (key.name === 'up' || key.name === 'k') {
          setSelectedIndex((prev) => Math.max(0, prev - 1));
        } else if (key.name === 'down' || key.name === 'j') {
          setSelectedIndex((prev) => Math.min(options.length - 1, prev + 1));
        } else if (key.name === 'return') {
          if (selectedIndex === 0) {
            // Confirm
            onComplete(config as AgentCreationConfig);
          } else {
            // Cancel
            onCancel();
          }
        }
      }
    },
    [
      step,
      selectedIndex,
      availableModels,
      config,
      onCancel,
      onComplete,
    ],
  );

  useKeypress(
    step === 'name' ||
      step === 'title' ||
      step === 'description' ||
      step === 'purpose'
      ? handleTextInput
      : handleSelectionInput,
    { isActive: true },
  );

  const renderTextInput = (
    label: string,
    placeholder: string,
    value: string,
  ) => (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.text.accent}>
          {label}
        </Text>
      </Box>
      <Box
        borderStyle="round"
        borderColor={theme.border.focused}
        paddingX={1}
      >
        <Text>
          {'> '}
          {value}
          {chalk.inverse(' ')}
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>{placeholder}</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={theme.text.secondary}>
          Press <Text bold>Enter</Text> to continue, <Text bold>Esc</Text> to
          cancel
        </Text>
      </Box>
    </Box>
  );

  const renderSelection = (
    label: string,
    options: Array<{ label: string; value: string; description?: string }>,
  ) => (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.text.accent}>
          {label}
        </Text>
      </Box>
      <Box flexDirection="column">
        {options.map((option, index) => (
          <Box key={option.value} marginY={0}>
            <Text color={index === selectedIndex ? theme.text.accent : undefined}>
              {index === selectedIndex ? '▸ ' : '  '}
              {option.label}
              {option.description && (
                <Text color={theme.text.secondary}> - {option.description}</Text>
              )}
            </Text>
          </Box>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text color={theme.text.secondary}>
          Use <Text bold>↑/↓</Text> to navigate, <Text bold>Enter</Text> to
          select, <Text bold>Esc</Text> to cancel
        </Text>
      </Box>
    </Box>
  );

  return (
    <Box flexDirection="column">
      <Box
        borderStyle="round"
        borderColor={theme.border.default}
        flexDirection="column"
      >
        <Box
          paddingX={2}
          paddingY={1}
          borderStyle="round"
          borderColor={theme.text.accent}
        >
          <Text bold color={theme.text.accent}>
            🤖 Create New Agent - Interactive Wizard
          </Text>
        </Box>

        {step === 'name' &&
          renderTextInput(
            '1. Agent Name (identifier)',
            'e.g., my-debugger, code-reviewer (use lowercase with hyphens)',
            inputBuffer,
          )}

        {step === 'title' &&
          renderTextInput(
            '2. Display Title',
            'e.g., My Debug Helper',
            inputBuffer,
          )}

        {step === 'description' &&
          renderTextInput(
            '3. Short Description (optional, press Enter to skip)',
            'e.g., Analyzes code errors and suggests fixes',
            inputBuffer,
          )}

        {step === 'scope' &&
          renderSelection('4. Scope', [
            {
              label: 'Project',
              value: 'project',
              description: 'Available in this project only (.gemini/agents/)',
            },
            {
              label: 'Global',
              value: 'global',
              description: 'Available in all projects (~/.gemini/agents/)',
            },
          ])}

        {step === 'model' &&
          renderSelection(
            '5. Model',
            availableModels.map((model) => ({
              label: model,
              value: model,
            })),
          )}

        {step === 'contentMode' &&
          renderSelection('6. Content Generation', [
            {
              label: 'Edit Manually',
              value: 'manual',
              description: 'Create empty template, edit yourself',
            },
            {
              label: 'AI Generate',
              value: 'ai',
              description: 'Use AI to generate role and guidelines',
            },
          ])}

        {step === 'purpose' &&
          renderTextInput(
            '7. Agent Purpose (for AI generation)',
            'Describe what this agent should do (e.g., "Debug Python errors with detailed explanations")',
            inputBuffer,
          )}

        {step === 'confirm' && (
          <Box flexDirection="column" paddingX={2} paddingY={1}>
            <Box marginBottom={1}>
              <Text bold color={theme.text.accent}>
                8. Review Configuration
              </Text>
            </Box>
            <Box flexDirection="column" marginBottom={1}>
              <Text>
                <Text bold>Name:</Text> {config.name}
              </Text>
              <Text>
                <Text bold>Title:</Text> {config.title}
              </Text>
              {config.description && (
                <Text>
                  <Text bold>Description:</Text> {config.description}
                </Text>
              )}
              <Text>
                <Text bold>Scope:</Text> {config.scope}
              </Text>
              <Text>
                <Text bold>Model:</Text> {config.model}
              </Text>
              <Text>
                <Text bold>Content:</Text>{' '}
                {config.contentMode === 'ai'
                  ? 'AI Generated'
                  : 'Manual Template'}
              </Text>
              {config.purpose && (
                <Text>
                  <Text bold>Purpose:</Text> {config.purpose}
                </Text>
              )}
            </Box>
            {renderSelection('Confirm Creation?', [
              { label: '✅ Create Agent', value: 'confirm' },
              { label: '❌ Cancel', value: 'cancel' },
            ])}
          </Box>
        )}
      </Box>
    </Box>
  );
}

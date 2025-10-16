/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PlanStep } from '@google/gemini-cli-core';

/**
 * Plan data structure stored in session
 */
export interface PlanData {
  title: string;
  overview: string;
  steps: PlanStep[];
  risks?: string[];
  testingStrategy?: string;
  estimatedDuration?: string;
  createdAt: Date;
}



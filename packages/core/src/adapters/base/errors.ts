/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ModelProvider } from './types.js';

/**
 * Error categories for better error handling and retry logic
 */
export enum ErrorCategory {
  /** Authentication or authorization failures */
  AUTHENTICATION = 'auth',
  /** Rate limiting or quota exceeded */
  RATE_LIMIT = 'rate_limit',
  /** Invalid input or malformed request */
  INVALID_INPUT = 'invalid_input',
  /** Model or service unavailable */
  MODEL_UNAVAILABLE = 'model_unavailable',
  /** Network-related errors */
  NETWORK = 'network',
  /** Content filtered or blocked */
  CONTENT_FILTER = 'content_filter',
  /** Unknown or unclassified errors */
  UNKNOWN = 'unknown'
}

/**
 * Base error class for model adapter errors
 */
export class ModelAdapterError extends Error {
  constructor(
    message: string,
    public readonly provider: ModelProvider | string,
    public readonly category: ErrorCategory = ErrorCategory.UNKNOWN,
    public readonly code?: string,
    public readonly statusCode?: number,
    public readonly originalError?: Error,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'ModelAdapterError';
  }
}

/**
 * Error thrown when authentication fails
 */
export class AuthenticationError extends ModelAdapterError {
  constructor(provider: ModelProvider | string, message = 'Authentication failed', originalError?: Error) {
    super(message, provider, ErrorCategory.AUTHENTICATION, 'AUTH_ERROR', 401, originalError, false);
    this.name = 'AuthenticationError';
  }
}

/**
 * Error thrown when API quota is exceeded
 */
export class QuotaExceededError extends ModelAdapterError {
  constructor(provider: ModelProvider | string, message = 'API quota exceeded', originalError?: Error) {
    super(message, provider, ErrorCategory.RATE_LIMIT, 'QUOTA_EXCEEDED', 429, originalError, true);
    this.name = 'QuotaExceededError';
  }
}

/**
 * Error thrown when the requested model is not found
 */
export class ModelNotFoundError extends ModelAdapterError {
  constructor(provider: ModelProvider | string, model: string, originalError?: Error) {
    super(`Model ${model} not found for provider ${provider}`, provider, ErrorCategory.MODEL_UNAVAILABLE, 'MODEL_NOT_FOUND', 404, originalError, false);
    this.name = 'ModelNotFoundError';
  }
}

/**
 * Error thrown when the request is invalid
 */
export class InvalidRequestError extends ModelAdapterError {
  constructor(provider: ModelProvider | string, message: string, originalError?: Error) {
    super(message, provider, ErrorCategory.INVALID_INPUT, 'INVALID_REQUEST', 400, originalError, false);
    this.name = 'InvalidRequestError';
  }
}

/**
 * Error thrown when the provider service is unavailable
 */
export class ServiceUnavailableError extends ModelAdapterError {
  constructor(provider: ModelProvider | string, message = 'Service temporarily unavailable', originalError?: Error) {
    super(message, provider, ErrorCategory.MODEL_UNAVAILABLE, 'SERVICE_UNAVAILABLE', 503, originalError, true);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Error thrown when content is filtered/blocked
 */
export class ContentFilterError extends ModelAdapterError {
  constructor(provider: ModelProvider | string, message = 'Content was filtered', originalError?: Error) {
    super(message, provider, ErrorCategory.CONTENT_FILTER, 'CONTENT_FILTERED', 400, originalError, false);
    this.name = 'ContentFilterError';
  }
}

/**
 * Utility function to map HTTP status codes to appropriate error types
 */
export function createErrorFromResponse(
  provider: ModelProvider | string,
  statusCode: number,
  message: string,
  originalError?: Error
): ModelAdapterError {
  switch (statusCode) {
    case 401:
    case 403:
      return new AuthenticationError(provider, message, originalError);
    case 404:
      return new ModelNotFoundError(provider, message, originalError);
    case 400:
      if (message.toLowerCase().includes('content') && message.toLowerCase().includes('filter')) {
        return new ContentFilterError(provider, message, originalError);
      }
      return new InvalidRequestError(provider, message, originalError);
    case 429:
      return new QuotaExceededError(provider, message, originalError);
    case 503:
    case 502:
    case 504:
      return new ServiceUnavailableError(provider, message, originalError);
    default:
      return new ModelAdapterError(message, provider, ErrorCategory.UNKNOWN, 'UNKNOWN_ERROR', statusCode, originalError, false);
  }
}
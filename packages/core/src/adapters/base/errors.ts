/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ModelProvider } from './types.js';

/**
 * Base error class for model adapter errors
 */
export class ModelAdapterError extends Error {
  constructor(
    message: string,
    public readonly provider: ModelProvider,
    public readonly code?: string,
    public readonly statusCode?: number,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'ModelAdapterError';
  }
}

/**
 * Error thrown when authentication fails
 */
export class AuthenticationError extends ModelAdapterError {
  constructor(provider: ModelProvider, message = 'Authentication failed', originalError?: Error) {
    super(message, provider, 'AUTH_ERROR', 401, originalError);
    this.name = 'AuthenticationError';
  }
}

/**
 * Error thrown when API quota is exceeded
 */
export class QuotaExceededError extends ModelAdapterError {
  constructor(provider: ModelProvider, message = 'API quota exceeded', originalError?: Error) {
    super(message, provider, 'QUOTA_EXCEEDED', 429, originalError);
    this.name = 'QuotaExceededError';
  }
}

/**
 * Error thrown when the requested model is not found
 */
export class ModelNotFoundError extends ModelAdapterError {
  constructor(provider: ModelProvider, model: string, originalError?: Error) {
    super(`Model ${model} not found for provider ${provider}`, provider, 'MODEL_NOT_FOUND', 404, originalError);
    this.name = 'ModelNotFoundError';
  }
}

/**
 * Error thrown when the request is invalid
 */
export class InvalidRequestError extends ModelAdapterError {
  constructor(provider: ModelProvider, message: string, originalError?: Error) {
    super(message, provider, 'INVALID_REQUEST', 400, originalError);
    this.name = 'InvalidRequestError';
  }
}

/**
 * Error thrown when the provider service is unavailable
 */
export class ServiceUnavailableError extends ModelAdapterError {
  constructor(provider: ModelProvider, message = 'Service temporarily unavailable', originalError?: Error) {
    super(message, provider, 'SERVICE_UNAVAILABLE', 503, originalError);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Error thrown when content is filtered/blocked
 */
export class ContentFilterError extends ModelAdapterError {
  constructor(provider: ModelProvider, message = 'Content was filtered', originalError?: Error) {
    super(message, provider, 'CONTENT_FILTERED', 400, originalError);
    this.name = 'ContentFilterError';
  }
}

/**
 * Utility function to map HTTP status codes to appropriate error types
 */
export function createErrorFromResponse(
  provider: ModelProvider,
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
      return new ModelAdapterError(message, provider, 'UNKNOWN_ERROR', statusCode, originalError);
  }
}
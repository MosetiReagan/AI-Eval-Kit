import { ErrorCode } from './types.js';

export class EvaluationKitError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'EvaluationKitError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ConfigurationError extends EvaluationKitError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('CONFIGURATION_ERROR', message, details);
    this.name = 'ConfigurationError';
  }
}

export class ProviderError extends EvaluationKitError {
  public readonly statusCode?: number;
  public readonly isRetryable: boolean;

  constructor(message: string, statusCode?: number, isRetryable = false, details?: Record<string, unknown>) {
    super('PROVIDER_ERROR', message, details);
    this.name = 'ProviderError';
    this.statusCode = statusCode;
    this.isRetryable = isRetryable;
  }
}

export class TimeoutError extends EvaluationKitError {
  constructor(message = 'Operation timed out', details?: Record<string, unknown>) {
    super('TIMEOUT', message, details);
    this.name = 'TimeoutError';
  }
}

export class RateLimitError extends EvaluationKitError {
  public readonly retryAfterMs?: number;

  constructor(message = 'Rate limit exceeded', retryAfterMs?: number, details?: Record<string, unknown>) {
    super('RATE_LIMITED', message, details);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class AuthenticationError extends EvaluationKitError {
  constructor(message = 'Authentication failed. Please verify your API key or credentials.', details?: Record<string, unknown>) {
    super('AUTHENTICATION_ERROR', message, details);
    this.name = 'AuthenticationError';
  }
}

export class InvalidDatasetError extends EvaluationKitError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('INVALID_DATASET', message, details);
    this.name = 'InvalidDatasetError';
  }
}

export class InvalidOutputError extends EvaluationKitError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('INVALID_OUTPUT', message, details);
    this.name = 'InvalidOutputError';
  }
}

export class RegressionError extends EvaluationKitError {
  public readonly violations: string[];

  constructor(message: string, violations: string[] = [], details?: Record<string, unknown>) {
    super('REGRESSION_ERROR', message, details);
    this.name = 'RegressionError';
    this.violations = violations;
  }
}

import { WorkflowError as WorkflowErrorType, WorkflowStatus } from './types';

/**
 * Exception classes for the ChaosChain SDK.
 *
 * This module defines all custom exceptions used throughout the SDK
 * to provide clear error handling and debugging information.
 */

export class ChaosChainSDKError extends Error {
  public details: Record<string, any>;

  constructor(message: string, details: Record<string, any> = {}) {
    super(message);
    this.name = 'ChaosChainSDKError';
    this.details = details;
    Object.setPrototypeOf(this, ChaosChainSDKError.prototype);
  }

  toString(): string {
    if (Object.keys(this.details).length > 0) {
      return `${this.message} | Details: ${JSON.stringify(this.details)}`;
    }
    return this.message;
  }
}

export class AgentRegistrationError extends ChaosChainSDKError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
    this.name = 'AgentRegistrationError';
    Object.setPrototypeOf(this, AgentRegistrationError.prototype);
  }
}

export class PaymentError extends ChaosChainSDKError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
    this.name = 'PaymentError';
    Object.setPrototypeOf(this, PaymentError.prototype);
  }
}

export class StorageError extends ChaosChainSDKError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
    this.name = 'StorageError';
    Object.setPrototypeOf(this, StorageError.prototype);
  }
}

export class IntegrityVerificationError extends ChaosChainSDKError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
    this.name = 'IntegrityVerificationError';
    Object.setPrototypeOf(this, IntegrityVerificationError.prototype);
  }
}

export class NetworkError extends ChaosChainSDKError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

export class ContractError extends ChaosChainSDKError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
    this.name = 'ContractError';
    Object.setPrototypeOf(this, ContractError.prototype);
  }
}

export class ValidationError extends ChaosChainSDKError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class ConfigurationError extends ChaosChainSDKError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

export class AuthenticationError extends ChaosChainSDKError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Base error from Gateway API.
 */
export class GatewayError extends ChaosChainSDKError {
  public readonly statusCode?: number;
  public readonly response?: Record<string, any>;

  constructor(message: string, details?: { statusCode?: number; response?: Record<string, any> }) {
    super(message, details || {});
    this.name = 'GatewayError';
    this.statusCode = details?.statusCode;
    this.response = details?.response;
    Object.setPrototypeOf(this, GatewayError.prototype);
  }
}

/**
 * Failed to connect to Gateway.
 */
export class GatewayConnectionError extends GatewayError {
  constructor(message: string) {
    super(message);
    this.name = 'GatewayConnectionError';
    Object.setPrototypeOf(this, GatewayConnectionError.prototype);
  }
}

/**
 * Gateway request or polling timed out.
 */
export class GatewayTimeoutError extends GatewayError {
  public readonly workflowId: string;
  public readonly lastStatus?: WorkflowStatus;

  constructor(workflowId: string, message: string, lastStatus?: WorkflowStatus) {
    super(message);
    this.name = 'GatewayTimeoutError';
    this.workflowId = workflowId;
    this.lastStatus = lastStatus;
    Object.setPrototypeOf(this, GatewayTimeoutError.prototype);
  }
}

/**
 * Workflow reached FAILED state.
 */
export class WorkflowFailedError extends GatewayError {
  public readonly workflowId: string;
  public readonly workflowError: WorkflowErrorType;

  constructor(workflowId: string, error: WorkflowErrorType) {
    super(`Workflow ${workflowId} failed at step ${error.step}: ${error.message}`);
    this.name = 'WorkflowFailedError';
    this.workflowId = workflowId;
    this.workflowError = error;
    Object.setPrototypeOf(this, WorkflowFailedError.prototype);
  }
}

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

export class ConfigurationError extends ChaosChainSDKError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

export class NetworkError extends ChaosChainSDKError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

export class AgentRegistrationError extends ChaosChainSDKError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
    this.name = 'AgentRegistrationError';
    Object.setPrototypeOf(this, AgentRegistrationError.prototype);
  }
}

export class ContractError extends ChaosChainSDKError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
    this.name = 'ContractError';
    Object.setPrototypeOf(this, ContractError.prototype);
  }
}

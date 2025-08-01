/**
 * @module Errors
 * @description Custom error classes for DJ Config MCP.
 * Provides structured error handling with consistent error codes and detailed context.
 * 
 * @example
 * const { ClientError, FileSystemError } = require('./errors');
 * 
 * // Throw a client error
 * throw new ClientError('Unknown client: vscode', 'vscode');
 * 
 * // Throw a file system error with details
 * throw new FileSystemError('Failed to read config', '/path/to/file', 'read');
 */

/**
 * Base error class for all custom errors
 * @class
 * @extends Error
 */
class ConfigError extends Error {
  /**
   * Create a ConfigError
   * @param {string} message - Error message
   * @param {string} code - Error code for programmatic handling
   * @param {Object} [details={}] - Additional error details
   */
  constructor(message, code, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details
    };
  }
}

/**
 * Error for client-related issues
 * @class
 * @extends ConfigError
 */
class ClientError extends ConfigError {
  /**
   * Create a ClientError
   * @param {string} message - Error message
   * @param {string} clientId - The client identifier that caused the error
   * @param {Object} [details={}] - Additional error details
   */
  constructor(message, clientId, details = {}) {
    super(message, 'CLIENT_ERROR', { clientId, ...details });
    this.clientId = clientId;
  }
}

/**
 * Error for configuration-related issues
 * @class
 * @extends ConfigError
 */
class ConfigurationError extends ConfigError {
  /**
   * Create a ConfigurationError
   * @param {string} message - Error message
   * @param {string} configPath - Path to the configuration that caused the error
   * @param {Object} [details={}] - Additional error details
   */
  constructor(message, configPath, details = {}) {
    super(message, 'CONFIGURATION_ERROR', { configPath, ...details });
    this.configPath = configPath;
  }
}

/**
 * Error for file system operations
 * @class
 * @extends ConfigError
 */
class FileSystemError extends ConfigError {
  /**
   * Create a FileSystemError
   * @param {string} message - Error message
   * @param {string} path - File system path that caused the error
   * @param {string} operation - Operation that failed (e.g., 'read', 'write', 'mkdir')
   * @param {Object} [details={}] - Additional error details
   */
  constructor(message, path, operation, details = {}) {
    super(message, 'FILESYSTEM_ERROR', { path, operation, ...details });
    this.path = path;
    this.operation = operation;
  }
}

/**
 * Error for environment-related issues
 * @class
 * @extends ConfigError
 */
class EnvironmentError extends ConfigError {
  /**
   * Create an EnvironmentError
   * @param {string} message - Error message
   * @param {string} variable - Environment variable name that caused the error
   * @param {Object} [details={}] - Additional error details
   */
  constructor(message, variable, details = {}) {
    super(message, 'ENVIRONMENT_ERROR', { variable, ...details });
    this.variable = variable;
  }
}

/**
 * Error for validation failures
 * @class
 * @extends ConfigError
 */
class ValidationError extends ConfigError {
  /**
   * Create a ValidationError
   * @param {string} message - Error message
   * @param {string} field - Field that failed validation
   * @param {any} value - Value that failed validation
   * @param {Object} [details={}] - Additional error details
   */
  constructor(message, field, value, details = {}) {
    super(message, 'VALIDATION_ERROR', { field, value, ...details });
    this.field = field;
    this.value = value;
  }
}

/**
 * Error for storage operations
 * @class
 * @extends ConfigError
 */
class StorageError extends ConfigError {
  /**
   * Create a StorageError
   * @param {string} message - Error message
   * @param {string} storageType - Type of storage that failed (e.g., 'json', 'env')
   * @param {string} operation - Operation that failed (e.g., 'read', 'write')
   * @param {Object} [details={}] - Additional error details
   */
  constructor(message, storageType, operation, details = {}) {
    super(message, 'STORAGE_ERROR', { storageType, operation, ...details });
    this.storageType = storageType;
    this.operation = operation;
  }
}

/**
 * Error for distribution operations
 * @class
 * @extends ConfigError
 */
class DistributionError extends ConfigError {
  /**
   * Create a DistributionError
   * @param {string} message - Error message
   * @param {Array<string>} clients - Array of client IDs that failed
   * @param {string} operation - Operation that failed (e.g., 'distribute', 'distributeToClients')
   * @param {Object} [details={}] - Additional error details
   */
  constructor(message, clients, operation, details = {}) {
    super(message, 'DISTRIBUTION_ERROR', { clients, operation, ...details });
    this.clients = clients;
    this.operation = operation;
  }
}

module.exports = {
  ConfigError,
  ClientError,
  ConfigurationError,
  FileSystemError,
  EnvironmentError,
  ValidationError,
  StorageError,
  DistributionError
};
/**
 * @module Messages
 * @description Centralized user-facing messages for consistency across the application
 */

/**
 * Error messages
 */
const ERROR_MESSAGES = {
  // Environment errors
  ENV_VAR_NOT_FOUND: (varName, platform) => 
    `${varName} environment variable not found on ${platform}`,
  HOME_DIR_NOT_FOUND: 'Unable to determine home directory',
  
  // Client errors
  UNKNOWN_CLIENT: (clientId) => `Unknown client: ${clientId}`,
  CLIENT_NOT_INSTALLED: (clientName) => `${clientName} is not installed or accessible`,
  
  // Configuration errors
  NO_CONFIG_PATH: (clientId, platform) => 
    `No config path mapping for ${clientId} on ${platform}`,
  NO_ENV_PATH: (clientId, platform) => 
    `No env path mapping for ${clientId} on ${platform}`,
  NO_ENV_PATH_CONFIGURED: (clientId) => 
    `No env-path configured for client: ${clientId}`,
  INVALID_JSON: (path) => `Invalid JSON in configuration file: ${path}`,
  
  // File system errors
  FILE_READ_FAILED: (path, error) => 
    `Failed to read file at ${path}: ${error}`,
  FILE_WRITE_FAILED: (path, error) => 
    `Failed to write file at ${path}: ${error}`,
  DIR_CREATE_FAILED: (path, error) => 
    `Failed to create directory at ${path}: ${error}`,
  
  // Distribution errors
  DISTRIBUTION_FAILED: (count) => 
    `Failed to distribute configuration to ${count} client(s)`,
  DISTRIBUTION_TO_CLIENTS_FAILED: (clients) => 
    `Failed to distribute configuration to: ${clients.join(', ')}`,
  
  // Validation errors
  INVALID_KEY: 'Configuration key cannot be empty',
  INVALID_VALUE_TYPE: (key, expectedType, actualType) => 
    `Invalid value type for ${key}: expected ${expectedType}, got ${actualType}`,
  
  // Storage errors
  STORAGE_READ_FAILED: (type, error) => 
    `Failed to read from ${type} storage: ${error}`,
  STORAGE_WRITE_FAILED: (type, error) => 
    `Failed to write to ${type} storage: ${error}`
};

/**
 * Success messages
 */
const SUCCESS_MESSAGES = {
  CONFIG_SET: (key, storage) => 
    `Configuration '${key}' saved to ${storage}`,
  CONFIG_DELETED: (key) => 
    `Configuration '${key}' deleted successfully`,
  DISTRIBUTION_COMPLETE: (clients) => 
    `Configuration distributed to: ${clients.join(', ')}`,
  ENV_LOADED: 'Environment variables loaded successfully',
  CLIENT_ADDED: (clientId) => 
    `Client '${clientId}' added successfully`,
  MAPPINGS_SAVED: 'Client mappings saved successfully'
};

/**
 * Warning messages
 */
const WARNING_MESSAGES = {
  SENSITIVE_KEY_DETECTED: (key) => 
    `Warning: '${key}' appears to be sensitive and will be stored in .env file`,
  NO_CLIENTS_FOUND: 'No MCP clients found for distribution',
  CONFIG_ALREADY_EXISTS: (key) => 
    `Configuration '${key}' already exists and will be overwritten`,
  ENV_FILE_NOT_FOUND: 'No .env file found, creating new one',
  OLD_CONFIG_FORMAT: 'Old configuration format detected, migrating to new format'
};

/**
 * Info messages
 */
const INFO_MESSAGES = {
  USING_DEFAULT_CONFIG: 'Using default configuration',
  CONFIG_SOURCE: (key, source, path) => 
    `'${key}' found in ${source} (${path})`,
  NO_CONFIG_FOUND: (key) => 
    `No configuration found for '${key}'`,
  AVAILABLE_CLIENTS: (count) => 
    `Found ${count} available MCP client(s)`,
  LOADING_FROM: (path) => 
    `Loading configuration from ${path}`,
  SAVING_TO: (path) => 
    `Saving configuration to ${path}`
};

/**
 * Prompt messages
 */
const PROMPT_MESSAGES = {
  CONFIRM_DELETE: (key) => 
    `Are you sure you want to delete '${key}'?`,
  CONFIRM_OVERWRITE: (key) => 
    `'${key}' already exists. Overwrite?`,
  SELECT_CLIENTS: 'Select clients to distribute configuration to:',
  ENTER_VALUE: (key) => 
    `Enter value for '${key}':`,
  SELECT_STORAGE: 'Select storage location:'
};

module.exports = {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  WARNING_MESSAGES,
  INFO_MESSAGES,
  PROMPT_MESSAGES
};
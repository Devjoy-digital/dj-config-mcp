/**
 * @module Constants
 * @description Centralized constants and configuration values
 */

/**
 * Application metadata
 */
const APP_INFO = {
  NAME: 'dj-config-mcp',
  VENDOR: 'devjoy-digital',
  DEFAULT_SERVER_NAME: 'mcp-server'
};

/**
 * File and directory names
 */
const FILE_NAMES = {
  CLIENT_MAPPINGS: 'client-mappings.json',
  GLOBAL_CONFIG: 'global.json',
  LOCAL_CONFIG: 'default.json',
  ENV_FILE: '.env',
  GITIGNORE: '.gitignore',
  PACKAGE_JSON: 'package.json'
};

/**
 * Directory paths
 */
const DIRECTORIES = {
  CONFIG_SUBDIR: 'config-mcp',
  DEFAULT_CONFIG_PATH: '../../config/default-client-mappings.json'
};

/**
 * Configuration keys
 */
const CONFIG_KEYS = {
  GLOBAL_PATHS: 'global-paths',
  LOCAL_PATHS: 'local-paths',
  SENSITIVE_PATTERNS: 'sensitivePatterns',
  MCP_SERVERS: 'mcp-servers',
  CONFIG_PATH: 'config-path',
  ENV_PATH: 'env-path',
  CONFIG_KEY: 'configKey',
  AUTO_LOAD_ENV: 'autoLoadEnv',
  CONFIG_FORMAT: 'configFormat'
};

/**
 * Platform identifiers
 */
const PLATFORMS = {
  WINDOWS: 'win32',
  MACOS: 'darwin',
  LINUX: 'linux'
};

/**
 * Environment variables
 */
const ENV_VARS = {
  APPDATA: 'APPDATA',
  HOME: 'HOME',
  USERPROFILE: 'USERPROFILE',
  XDG_CONFIG_HOME: 'XDG_CONFIG_HOME',
  SERVER_NAME: 'SERVER_NAME'
};

/**
 * File permissions
 */
const FILE_PERMISSIONS = {
  ENV_FILE_UNIX: 0o600 // Read/write for owner only
};

/**
 * Default sensitive patterns
 */
const DEFAULT_SENSITIVE_PATTERNS = [
  'password',
  'secret',
  'key',
  'token',
  'auth',
  'credential',
  'private',
  'api_key',
  'api_secret',
  'access_token',
  'refresh_token',
  'private_key',
  'certificate'
];

/**
 * Configuration format types
 */
const CONFIG_FORMATS = {
  DEFAULT: 'default',
  STRUCTURED: 'structured'
};

/**
 * Storage types
 */
const STORAGE_TYPES = {
  JSON: 'json',
  ENV: 'env'
};

/**
 * Operation types
 */
const OPERATIONS = {
  READ: 'read',
  WRITE: 'write',
  DELETE: 'delete',
  MKDIR: 'mkdir',
  CHMOD: 'chmod',
  DISTRIBUTE: 'distribute',
  DISTRIBUTE_TO_CLIENTS: 'distributeToClients'
};

/**
 * Regex patterns
 */
const PATTERNS = {
  ENV_VAR: /\${(\w+)}/g,
  DOT_NOTATION: /\./,
  NEWLINE: /\r?\n/,
  COMMENT: /^\s*#/
};

/**
 * Limits and thresholds
 */
const LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_KEY_LENGTH: 256,
  MAX_VALUE_LENGTH: 65536,
  MAX_PATH_LENGTH: 4096
};

module.exports = {
  APP_INFO,
  FILE_NAMES,
  DIRECTORIES,
  CONFIG_KEYS,
  PLATFORMS,
  ENV_VARS,
  FILE_PERMISSIONS,
  DEFAULT_SENSITIVE_PATTERNS,
  CONFIG_FORMATS,
  STORAGE_TYPES,
  OPERATIONS,
  PATTERNS,
  LIMITS
};
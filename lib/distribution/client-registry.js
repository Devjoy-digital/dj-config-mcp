/**
 * @module ClientRegistry
 * @description Manages MCP client configuration mappings and paths.
 * Handles platform-specific path resolution and client configuration storage.
 * 
 * @example
 * const ClientRegistry = require('./client-registry');
 * const registry = new ClientRegistry('my-mcp-server');
 * 
 * // Get client configuration path
 * const configPath = await registry.getClientConfigPath('vscode', true);
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { ClientError, ConfigurationError, FileSystemError, EnvironmentError } = require('../errors');
const PathUtils = require('../utils/path-utils');

/**
 * Client registry for managing MCP client configurations
 */
class ClientRegistry {
  /**
   * Create a new ClientRegistry instance
   * @param {string|null} serverName - Name of the MCP server for path resolution
   */
  constructor(serverName = null) {
    this.serverName = serverName;
    this.mappings = null;
    // Library's own configuration path
    this.libraryConfigPath = this.getLibraryConfigPath();
  }

  getLibraryConfigPath() {
    const configDir = PathUtils.getConfigDir('devjoy-digital/config-mcp');
    return PathUtils.joinPath(configDir, 'client-mappings.json');
  }

  /**
   * Load client mappings from storage
   * @returns {Promise<Object>} Client mappings object containing global-paths and local-paths
   * @throws {FileSystemError} If config file cannot be read
   * 
   * @example
   * const mappings = await registry.loadMappings();
   * console.log(mappings['global-paths'].vscode);
   */
  async loadMappings() {
    if (!this.mappings) {
      try {
        // Try to load from library config path
        const content = await fs.readFile(this.libraryConfigPath, 'utf8');
        const loadedConfig = JSON.parse(content);
        
        // Check if loaded config has the new structure (global-paths/local-paths)
        if (loadedConfig['global-paths'] && loadedConfig['local-paths']) {
          this.mappings = loadedConfig;
        } else {
          // Invalid/old structure detected - overwrite with defaults
          this.mappings = this.getDefaultMappings();
          await this.saveMappings();
        }
      } catch (error) {
        // Use default mappings if no config file exists
        this.mappings = this.getDefaultMappings();
        // Save defaults to library config
        try {
          await this.saveMappings();
        } catch (saveError) {
          // Ignore save errors during initialization
        }
      }
    }
    return this.mappings || this.getDefaultMappings();
  }

  /**
   * Get default client mappings
   * @private
   * @returns {Object} Default mappings with global-paths, local-paths, and sensitivePatterns
   */
  getDefaultMappings() {
    try {
      // Load from default configuration file
      const { DIRECTORIES } = require('../constants');
      const defaultConfigPath = PathUtils.joinPath(__dirname, DIRECTORIES.DEFAULT_CONFIG_PATH);
      const content = fsSync.readFileSync(defaultConfigPath, 'utf8');
      const config = JSON.parse(content);
      
      return config;
    } catch (error) {
      // Fallback to minimal defaults if file not found
      // Note: Removed console.error to prevent breaking MCP protocol
      // The MCP protocol requires JSON-only communication on stdout
      return {
        "global-paths": {
          "vscode": {
            "name": "Visual Studio Code",
            "config-path": {
              "win32": "${APPDATA}/Code/User/settings.json",
              "darwin": "${HOME}/Library/Application Support/Code/User/settings.json",
              "linux": "${HOME}/.config/Code/User/settings.json"
            },
            "env-path": {
              "win32": "${APPDATA}/Code/User/.${SERVER_NAME}/.env",
              "darwin": "${HOME}/Library/Application Support/Code/User/.${SERVER_NAME}/.env",
              "linux": "${HOME}/.config/Code/User/.${SERVER_NAME}/.env"
            },
            "configKey": "mcp-servers",
            "autoLoadEnv": true,
            "configFormat": "structured"
          }
        },
        "local-paths": {
          "vscode": {
            "name": "Visual Studio Code",
            "config-path": {
              "win32": "./.vscode/settings.json",
              "darwin": "./.vscode/settings.json",
              "linux": "./.vscode/settings.json"
            },
            "env-path": {
              "win32": "./.vscode/.${SERVER_NAME}/.env",
              "darwin": "./.vscode/.${SERVER_NAME}/.env",
              "linux": "./.vscode/.${SERVER_NAME}/.env"
            },
            "configKey": "mcp-servers",
            "autoLoadEnv": true,
            "configFormat": "structured"
          }
        },
        "sensitivePatterns": ["password", "secret", "key", "token", "auth", "credential", "private"]
      };
    }
  }

  /**
   * Get client configuration file path
   * @param {string} clientId - Client identifier (e.g., 'vscode', 'claude-desktop')
   * @param {boolean} [isGlobal=false] - If true, returns global config path; if false, returns local config path
   * @returns {Promise<string>} Resolved absolute path to client configuration file
   * @throws {ClientError} If client is unknown
   * @throws {ConfigurationError} If no config path mapping exists for the platform
   * 
   * @example
   * // Get global VS Code settings path
   * const vscodePath = await registry.getClientConfigPath('vscode', true);
   * // Returns: C:\Users\username\AppData\Roaming\Code\User\settings.json (Windows)
   */
  async getClientConfigPath(clientId, isGlobal = false) {
    const mappings = await this.loadMappings();
    const scopedPaths = isGlobal ? mappings['global-paths'] : mappings['local-paths'];
    const client = scopedPaths[clientId];
    
    if (!client) {
      throw new ClientError(
        `Unknown client: ${clientId}`,
        clientId
      );
    }

    const platform = process.platform;
    const pathTemplate = client['config-path'][platform];
    
    if (!pathTemplate) {
      throw new ConfigurationError(
        `No config path mapping for ${clientId} on ${platform}`,
        'config-path',
        { clientId, platform }
      );
    }

    // Resolve environment variables in path
    return this.resolvePath(pathTemplate);
  }

  /**
   * Get client environment file path
   * @param {string} clientId - Client identifier
   * @param {boolean} [isGlobal=false] - If true, returns global env path; if false, returns local env path
   * @returns {Promise<string>} Resolved absolute path to client .env file
   * @throws {ClientError} If client is unknown
   * @throws {ConfigurationError} If no env-path configured for the client
   */
  async getClientEnvPath(clientId, isGlobal = false) {
    const mappings = await this.loadMappings();
    const scopedPaths = isGlobal ? mappings['global-paths'] : mappings['local-paths'];
    const client = scopedPaths[clientId];
    
    if (!client) {
      throw new ClientError(
        `Unknown client: ${clientId}`,
        clientId
      );
    }

    if (!client['env-path']) {
      throw new ConfigurationError(
        `No env-path configured for client: ${clientId}`,
        'env-path',
        { clientId }
      );
    }

    const platform = process.platform;
    const pathTemplate = client['env-path'][platform];
    
    if (!pathTemplate) {
      throw new ConfigurationError(
        `No env path mapping for ${clientId} on ${platform}`,
        'env-path',
        { clientId, platform }
      );
    }

    // Resolve environment variables in path
    return this.resolvePath(pathTemplate);
  }

  /**
   * Get client configuration path (defaults to global)
   * @deprecated Use getClientConfigPath instead
   * @param {string} clientId - Client ID
   * @param {boolean} [isGlobal=true] - Use global or local paths
   * @returns {Promise<string>} Resolved client config path
   */
  async getClientPath(clientId, isGlobal = true) {
    return await this.getClientConfigPath(clientId, isGlobal);
  }

  /**
   * Get client configuration object
   * @param {string} clientId - Client identifier
   * @param {boolean} [isGlobal=false] - If true, returns global config; if false, returns local config
   * @returns {Promise<Object|null>} Client configuration object or null if not found
   */
  async getClientConfig(clientId, isGlobal = false) {
    const mappings = await this.loadMappings();
    const scopedPaths = isGlobal ? mappings['global-paths'] : mappings['local-paths'];
    return scopedPaths ? scopedPaths[clientId] : null;
  }

  /**
   * Resolve path template with environment variables and server name
   * @private
   * @param {string} pathTemplate - Path template with ${VAR} placeholders
   * @returns {string} Resolved path with all variables replaced
   * 
   * @example
   * // With serverName = 'my-server'
   * resolvePath('${HOME}/.config/${SERVER_NAME}')
   * // Returns: /home/user/.config/my-server
   */
  resolvePath(pathTemplate) {
    // Create additional variables object with SERVER_NAME if available
    const additionalVars = {};
    if (this.serverName) {
      additionalVars.SERVER_NAME = this.serverName;
    }
    
    // Use PathUtils for consistent resolution
    const resolved = PathUtils.resolveEnvVars(pathTemplate, additionalVars);
    return PathUtils.normalizePath(resolved);
  }

  /**
   * Get list of available MCP clients
   * @returns {Promise<Array<Object>>} Array of client information objects
   * @returns {Promise<Array<Object>>} clients - Available clients
   * @returns {string} clients[].id - Client identifier
   * @returns {string} clients[].name - Client display name
   * @returns {boolean} clients[].autoLoadEnv - Whether client auto-loads environment variables
   */
  async getAvailableClients() {
    const mappings = await this.loadMappings();
    const clients = [];
    
    // Get clients from global-paths (these are the available clients)
    if (mappings['global-paths']) {
      for (const [id, config] of Object.entries(mappings['global-paths'])) {
        clients.push({
          id,
          name: config.name,
          autoLoadEnv: config.autoLoadEnv
        });
      }
    }
    
    return clients;
  }

  /**
   * Set the server name for path resolution
   * @param {string} serverName - The MCP server name used in ${SERVER_NAME} placeholders
   */
  setServerName(serverName) {
    this.serverName = serverName;
  }

  /**
   * Get sensitive patterns for security detection
   * @returns {Promise<Array<string>>} Array of sensitive pattern strings (e.g., 'password', 'secret')
   */
  async getSensitivePatterns() {
    const mappings = await this.loadMappings();
    return mappings.sensitivePatterns || [];
  }

  /**
   * Add or update client configuration
   * @param {string} clientId - Client identifier to add/update
   * @param {Object} clientConfig - Client configuration object
   * @param {string} clientConfig.name - Display name for the client
   * @param {Object} clientConfig.config-path - Platform-specific config paths
   * @param {Object} clientConfig.env-path - Platform-specific env paths
   * @param {boolean} [isGlobal=true] - If true, adds to global-paths; if false, adds to local-paths
   * @returns {Promise<void>}
   * @throws {FileSystemError} If configuration cannot be saved
   */
  async addClient(clientId, clientConfig, isGlobal = true) {
    const mappings = await this.loadMappings();
    const scopedPathsKey = isGlobal ? 'global-paths' : 'local-paths';
    
    if (!mappings[scopedPathsKey]) {
      mappings[scopedPathsKey] = {};
    }
    
    mappings[scopedPathsKey][clientId] = clientConfig;
    await this.saveMappings();
  }

  /**
   * Save current mappings to configuration file
   * @private
   * @returns {Promise<void>}
   * @throws {FileSystemError} If file cannot be written
   */
  async saveMappings() {
    if (!this.mappings) return;
    
    const dir = path.dirname(this.libraryConfigPath);
    
    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(this.libraryConfigPath, JSON.stringify(this.mappings, null, 2));
    // Don't clear cache since it causes issues with subsequent calls
  }
}

module.exports = ClientRegistry;

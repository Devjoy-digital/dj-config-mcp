/**
 * Client Registry
 * Manages client configuration mappings
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

class ClientRegistry {
  constructor(serverName = null) {
    // Library's own configuration path
    this.libraryConfigPath = this.getLibraryConfigPath();
    this.mappings = null;
    this.serverName = serverName;
  }

  getLibraryConfigPath() {
    if (process.platform === 'win32') {
      // Windows: %APPDATA%\devjoy-digital\config-mcp\client-mappings.json
      return path.join(process.env.APPDATA, 'devjoy-digital', 'config-mcp', 'client-mappings.json');
    } else if (process.platform === 'darwin') {
      // macOS: ~/Library/Application Support/devjoy-digital/config-mcp/client-mappings.json
      return path.join(process.env.HOME, 'Library', 'Application Support', 'devjoy-digital', 'config-mcp', 'client-mappings.json');
    } else {
      // Linux: ~/.config/devjoy-digital/config-mcp/client-mappings.json
      return path.join(process.env.HOME, '.config', 'devjoy-digital', 'config-mcp', 'client-mappings.json');
    }
  }

  /**
   * Load client mappings
   * @returns {Promise<Object>} Client mappings
   */
  async loadMappings() {
    if (!this.mappings) {
      try {
        // Try to load from library config path
        const content = await fs.readFile(this.libraryConfigPath, 'utf8');
        this.mappings = JSON.parse(content);
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
   * @returns {Object} Default mappings
   */
  getDefaultMappings() {
    try {
      // Load from default configuration file
      const defaultConfigPath = path.join(__dirname, '../../config/default-client-mappings.json');
      const content = fsSync.readFileSync(defaultConfigPath, 'utf8');
      const config = JSON.parse(content);
      
      // Ensure storage config exists
      if (!config.storage) {
        config.storage = this.getDefaultStorageConfig();
      }
      
      return config;
    } catch (error) {
      // Fallback to minimal defaults if file not found
      // Note: Removed console.error to prevent breaking MCP protocol
      // The MCP protocol requires JSON-only communication on stdout
      return {
        "clients": {},
        "storage": this.getDefaultStorageConfig(),
        "sensitivePatterns": ["password", "secret", "key", "token", "auth", "credential", "private"]
      };
    }
  }

  /**
   * Get client path
   * @param {string} clientId - Client ID
   * @returns {Promise<string>} Resolved client path
   */
  async getClientPath(clientId) {
    const mappings = await this.loadMappings();
    const client = mappings.clients[clientId];
    
    if (!client) {
      throw new Error(`Unknown client: ${clientId}`);
    }

    const platform = process.platform;
    const pathTemplate = client.paths[platform];
    
    if (!pathTemplate) {
      throw new Error(`No path mapping for ${clientId} on ${platform}`);
    }

    // Resolve environment variables in path
    return this.resolvePath(pathTemplate);
  }

  /**
   * Get client configuration
   * @param {string} clientId - Client ID
   * @returns {Promise<Object>} Client configuration
   */
  async getClientConfig(clientId) {
    const mappings = await this.loadMappings();
    return mappings.clients[clientId];
  }

  /**
   * Resolve path with environment variables and server name
   * @param {string} pathTemplate - Path template with ${VAR} placeholders
   * @returns {string} Resolved path
   */
  resolvePath(pathTemplate) {
    // First resolve SERVER_NAME if we have it
    let resolved = pathTemplate;
    if (this.serverName) {
      resolved = resolved.replace(/\${SERVER_NAME}/g, this.serverName);
    }
    
    // Then resolve environment variables
    return resolved.replace(/\${(\w+)}/g, (match, envVar) => {
      return process.env[envVar] || match;
    });
  }

  /**
   * Get available clients
   * @returns {Promise<Array>} Array of client info
   */
  async getAvailableClients() {
    const mappings = await this.loadMappings();
    return Object.entries(mappings.clients).map(([id, config]) => ({
      id,
      name: config.name,
      autoLoadEnv: config.autoLoadEnv
    }));
  }

  /**
   * Get storage paths configuration
   * @returns {Promise<Object>} Storage paths configuration
   */
  async getStorageConfig() {
    const mappings = await this.loadMappings();
    if (!mappings || !mappings.storage) {
      return this.getDefaultStorageConfig();
    }
    return mappings.storage;
  }

  /**
   * Get default storage configuration
   * @returns {Object} Default storage configuration
   */
  getDefaultStorageConfig() {
    return {
      "local": {
        "json": "./mcp-servers/default.json",
        "env": "./mcp-servers/.env"
      },
      "global": {
        "json": {
          "win32": "${APPDATA}/mcp-servers/global.json",
          "darwin": "${HOME}/Library/Application Support/mcp-servers/global.json",
          "linux": "${HOME}/.config/mcp-servers/global.json"
        },
        "env": {
          "win32": "${APPDATA}/mcp-servers/.env",
          "darwin": "${HOME}/Library/Application Support/mcp-servers/.env",
          "linux": "${HOME}/.config/mcp-servers/.env"
        }
      }
    };
  }

  /**
   * Set the server name for path resolution
   * @param {string} serverName - The MCP server name
   */
  setServerName(serverName) {
    this.serverName = serverName;
  }

  /**
   * Get storage path for a specific type and scope
   * @param {string} type - Storage type ('json' or 'env')
   * @param {boolean} isGlobal - Whether to get global path
   * @returns {Promise<string>} Resolved storage path
   */
  async getStoragePath(type, isGlobal = false) {
    const storageConfig = await this.getStorageConfig();
    
    if (isGlobal) {
      const globalConfig = storageConfig.global[type];
      if (typeof globalConfig === 'string') {
        return this.resolvePath(globalConfig);
      } else {
        const platform = process.platform;
        const pathTemplate = globalConfig[platform];
        if (!pathTemplate) {
          throw new Error(`No global ${type} storage path for platform ${platform}`);
        }
        return this.resolvePath(pathTemplate);
      }
    } else {
      const localPath = storageConfig.local[type];
      if (!localPath) {
        throw new Error(`No local ${type} storage path configured`);
      }
      return this.resolvePath(localPath);
    }
  }

  /**
   * Get sensitive patterns for security detection
   * @returns {Promise<Array<string>>} Array of sensitive patterns
   */
  async getSensitivePatterns() {
    const mappings = await this.loadMappings();
    return mappings.sensitivePatterns || [];
  }

  /**
   * Add or update client configuration
   * @param {string} clientId - Client ID
   * @param {Object} clientConfig - Client configuration
   * @returns {Promise<void>}
   */
  async addClient(clientId, clientConfig) {
    const mappings = await this.loadMappings();
    mappings.clients[clientId] = clientConfig;
    await this.saveMappings();
  }

  /**
   * Save mappings to file
   * @returns {Promise<void>}
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

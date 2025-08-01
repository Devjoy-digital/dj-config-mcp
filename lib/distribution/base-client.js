/**
 * Base Client
 * Base class for MCP client implementations
 */

const fs = require('fs').promises;
const path = require('path');
const PathUtils = require('../utils/path-utils');

class BaseClient {
  constructor(clientId, registry) {
    this.clientId = clientId;
    this.registry = registry;
    this.clientConfig = null;
  }

  /**
   * Get client name
   * @returns {string} Client name
   */
  get name() {
    return this.clientConfig?.name || this.clientId;
  }

  /**
   * Initialize client configuration
   * @returns {Promise<void>}
   */
  async init() {
    if (!this.clientConfig) {
      this.clientConfig = await this.registry.getClientConfig(this.clientId, true);
    }
  }

  /**
   * Check if client is installed
   * @returns {Promise<boolean>} True if installed
   */
  async isInstalled() {
    try {
      await this.init();
      const configPath = await this.registry.getClientPath(this.clientId);
      
      // For home directory configs (.mcp.json, .claude.json), always return true
      // since we want to create these files regardless
      const parentDir = path.dirname(configPath);
      const homeDir = PathUtils.getHomeDir();
      
      if (parentDir === homeDir) {
        return true;
      }
      
      // For other paths, try to create the directory structure
      try {
        await fs.mkdir(parentDir, { recursive: true });
        return true;
      } catch (createError) {
        // If we can't create the directory, the client is not available
        return false;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Update client configuration
   * @param {Object} config - Configuration data
   * @returns {Promise<void>}
   */
  async updateConfig(config) {
    await this.init();
    const configPath = await this.registry.getClientPath(this.clientId);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    
    // Read existing config
    let existingConfig = {};
    try {
      const content = await fs.readFile(configPath, 'utf8');
      existingConfig = JSON.parse(content);
    } catch (error) {
      // File doesn't exist or is invalid
    }
    
    // Get the appropriate configuration key based on client type
    const configKey = this.getConfigKey();
    
    // Update MCP server configuration
    if (!existingConfig[configKey]) {
      existingConfig[configKey] = {};
    }
    
    // Format configuration for the client
    const formattedConfig = this.formatConfig(config);
    existingConfig[configKey][config.serverName] = formattedConfig;
    
    // Write updated config
    await fs.writeFile(configPath, JSON.stringify(existingConfig, null, 2));
  }

  /**
   * Get the configuration key for this client from configuration
   * @returns {string} Configuration key
   */
  getConfigKey() {
    // Get from client configuration, with fallback to default
    return this.clientConfig?.configKey || 'mcp-servers';
  }

  /**
   * Format configuration for the specific client based on client configuration
   * @param {Object} config - Raw configuration data
   * @returns {Object} Formatted configuration
   */
  formatConfig(config) {
    const formatted = {};
    
    // Handle different configuration formats based on client config
    const configFormat = this.clientConfig?.configFormat || 'default';
    
    if (configFormat === 'structured') {
      // VS Code style - separate command and args from config
      if (config.settings?.command) {
        formatted.command = config.settings.command;
        formatted.args = config.settings.args || [];
        
        // Create config object without command/args
        const configCopy = { ...config.settings };
        delete configCopy.command;
        delete configCopy.args;
        if (Object.keys(configCopy).length > 0) {
          formatted.config = configCopy;
        }
      } else {
        formatted.config = config.settings || {};
      }
    } else {
      // Default format
      formatted.config = config.settings || {};
    }
    
    // Add environment variables if any
    if (config.environment && Object.keys(config.environment).length > 0) {
      formatted.env = {};
      for (const [key, value] of Object.entries(config.environment)) {
        // Use client-specific env var format from configuration
        if (this.clientConfig?.envFormat) {
          // Replace ${VAR} placeholder with actual variable name
          formatted.env[key] = this.clientConfig.envFormat.replace(/\$\{VAR\}/g, key);
        } else {
          // Default format based on autoLoadEnv setting
          formatted.env[key] = this.clientConfig?.autoLoadEnv ? value : `\${env:${key}}`;
        }
      }
    }
    
    return formatted;
  }
}

module.exports = BaseClient;

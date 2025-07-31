/**
 * Base Client
 * Base class for MCP client implementations
 */

const fs = require('fs').promises;
const path = require('path');

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
      this.clientConfig = await this.registry.getClientConfig(this.clientId);
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
      // Check if the parent directory exists (client is installed)
      await fs.access(path.dirname(configPath));
      return true;
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
   * Get the configuration key for this client
   * @returns {string} Configuration key
   */
  getConfigKey() {
    // Default key for most clients
    return 'mcp-servers';
  }

  /**
   * Format configuration for the specific client
   * @param {Object} config - Raw configuration data
   * @returns {Object} Formatted configuration
   */
  formatConfig(config) {
    // Base implementation - override in subclasses
    const formatted = {
      config: config.settings || {}
    };
    
    // Add environment variables if any
    if (config.environment && Object.keys(config.environment).length > 0) {
      formatted.env = {};
      for (const [key, value] of Object.entries(config.environment)) {
        // Use client-specific env var format
        formatted.env[key] = this.clientConfig.autoLoadEnv ? value : `\${env:${key}}`;
      }
    }
    
    return formatted;
  }
}

module.exports = BaseClient;
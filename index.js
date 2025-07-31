/**
 * dj-config-mcp - MCP Configuration Management Library
 * Main entry point
 */

const ConfigurationManager = require('./lib/config/manager');
const dotenv = require('dotenv');

// Create singleton instance
const configManager = new ConfigurationManager();

// Load environment variables on initialization
async function initialize() {
  try {
    await configManager.loadEnvironment();
  } catch (error) {
    // Silent fail - environment loading is optional
  }
}

// Initialize on module load
initialize();

module.exports = {
  /**
   * Interactive configuration wizard
   * @param {Object} options
   * @param {boolean} options.global - Use global configuration
   * @returns {Promise<void>}
   */
  config: async (options = {}) => {
    const configCommand = require('./lib/commands/config');
    return await configCommand(configManager, options);
  },

  /**
   * Set a configuration value
   * @param {string} key - Configuration key (supports dot notation)
   * @param {any} value - Configuration value
   * @param {Object} options
   * @param {boolean} options.global - Use global configuration
   * @returns {Promise<void>}
   */
  configSet: async (key, value, options = {}) => {
    const configSetCommand = require('./lib/commands/config-set');
    return await configSetCommand(configManager, key, value, options);
  },

  /**
   * Get configuration value(s)
   * @param {string} [key] - Optional key to retrieve specific value
   * @returns {Promise<any>} Configuration value(s) with source info
   */
  configGet: async (key) => {
    const configGetCommand = require('./lib/commands/config-get');
    return await configGetCommand(configManager, key);
  },

  /**
   * Delete a configuration value
   * @param {string} key - Configuration key to delete
   * @param {Object} options
   * @param {boolean} options.global - Use global configuration
   * @returns {Promise<void>}
   */
  configDelete: async (key, options = {}) => {
    const configDeleteCommand = require('./lib/commands/config-delete');
    return await configDeleteCommand(configManager, key, options);
  },

  /**
   * Load environment variables from .env files
   * @returns {Promise<void>}
   */
  loadEnv: async () => {
    const configLoadEnvCommand = require('./lib/commands/config-load-env');
    return await configLoadEnvCommand(configManager);
  }
};
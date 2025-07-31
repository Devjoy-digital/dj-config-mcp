/**
 * Set Configuration Command
 * Sets individual configuration values
 */

/**
 * Set configuration value
 * @param {ConfigurationManager} configManager - Configuration manager instance
 * @param {string} key - Configuration key
 * @param {any} value - Configuration value
 * @param {Object} options - Command options
 * @returns {Promise<void>}
 */
async function configSetCommand(configManager, key, value, options = {}) {
  if (!key) {
    throw new Error('Configuration key is required');
  }
  
  if (value === undefined || value === null) {
    throw new Error('Configuration value is required');
  }

  // Set the configuration
  await configManager.setConfig(key, value, options);
  
  // Note: Removed console.log statements to prevent breaking MCP protocol
  // The MCP protocol requires JSON-only communication on stdout
}

module.exports = configSetCommand;

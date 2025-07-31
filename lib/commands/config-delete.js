/**
 * Delete Configuration Command
 * Removes configuration values
 */

/**
 * Delete configuration value
 * @param {ConfigurationManager} configManager - Configuration manager instance
 * @param {string} key - Configuration key
 * @param {Object} options - Command options
 * @returns {Promise<void>}
 */
async function configDeleteCommand(configManager, key, options = {}) {
  if (!key) {
    throw new Error('Configuration key is required');
  }

  // Check if key exists
  const existing = await configManager.getConfig(key);
  
  if (!existing) {
    // Note: Removed console.log to prevent breaking MCP protocol
    // The MCP protocol requires JSON-only communication on stdout
    return false;
  }

  // Delete the configuration
  await configManager.deleteConfig(key, options);
  
  // Note: Removed console.log statements to prevent breaking MCP protocol
  // The MCP protocol requires JSON-only communication on stdout
  
  return true;
}

module.exports = configDeleteCommand;

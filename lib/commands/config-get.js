/**
 * Get Configuration Command
 * Retrieves configuration values
 */

/**
 * Get configuration value(s)
 * @param {ConfigurationManager} configManager - Configuration manager instance
 * @param {string} [key] - Optional configuration key
 * @returns {Promise<any>} Configuration value(s)
 */
async function configGetCommand(configManager, key) {
  if (key) {
    // Get specific key
    const result = await configManager.getConfig(key);
    
    // Note: Removed console.log statements to prevent breaking MCP protocol
    // The MCP protocol requires JSON-only communication on stdout
    
    return result || null;
  } else {
    // Get all configurations
    const results = await configManager.getAllConfig();
    
    // Note: Removed console.log statements to prevent breaking MCP protocol
    // The MCP protocol requires JSON-only communication on stdout
    
    return results;
  }
}

module.exports = configGetCommand;

/**
 * Load Environment Command
 * Loads environment variables from .env files
 */

/**
 * Load environment variables
 * @param {ConfigurationManager} configManager - Configuration manager instance
 * @returns {Promise<void>}
 */
async function configLoadEnvCommand(configManager) {
  // Note: Removed console.log statements to prevent breaking MCP protocol
  // The MCP protocol requires JSON-only communication on stdout
  
  try {
    await configManager.loadEnvironment();
    
    // Count loaded variables
    const storage = configManager.storage;
    const localEnv = await storage.env.getAll(false);
    const globalEnv = await storage.env.getAll(true);
    
    const localCount = Object.keys(localEnv).length;
    const globalCount = Object.keys(globalEnv).length;
    
    // Return result object instead of console output
    return {
      success: true,
      localCount,
      globalCount,
      totalCount: localCount + globalCount
    };
  } catch (error) {
    // Note: Removed console.error to prevent breaking MCP protocol
    // The error is re-thrown for the caller to handle appropriately
    throw error;
  }
}

module.exports = configLoadEnvCommand;

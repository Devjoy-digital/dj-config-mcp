/**
 * VS Code Client
 * Handles VS Code specific configuration
 */

const BaseClient = require('./base-client');

class VSCodeClient extends BaseClient {
  constructor(registry) {
    super('vscode', registry);
  }

  /**
   * Format configuration for VS Code
   * @param {Object} config - Raw configuration data
   * @returns {Object} Formatted configuration
   */
  formatConfig(config) {
    const formatted = super.formatConfig(config);
    
    // VS Code specific formatting
    // Add command and args if available
    if (config.settings.command) {
      formatted.command = config.settings.command;
      delete formatted.config.command;
    }
    
    if (config.settings.args) {
      formatted.args = config.settings.args;
      delete formatted.config.args;
    }
    
    return formatted;
  }
}

module.exports = VSCodeClient;
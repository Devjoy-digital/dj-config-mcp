/**
 * Cursor Client
 * Handles Cursor specific configuration
 */

const BaseClient = require('./base-client');

class CursorClient extends BaseClient {
  constructor(registry) {
    super('cursor', registry);
  }

  /**
   * Format configuration for Cursor
   * @param {Object} config - Raw configuration data
   * @returns {Object} Formatted configuration
   */
  formatConfig(config) {
    const formatted = super.formatConfig(config);
    
    // Cursor specific formatting (similar to VS Code)
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

module.exports = CursorClient;
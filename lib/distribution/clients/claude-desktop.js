/**
 * Claude Desktop Client
 * Handles Claude Desktop specific configuration
 */

const BaseClient = require('./base-client');

class ClaudeDesktopClient extends BaseClient {
  constructor(registry) {
    super('claude-desktop', registry);
  }

  /**
   * Get the configuration key for Claude Desktop
   * @returns {string} Configuration key
   */
  getConfigKey() {
    return 'mcpServers';
  }

  /**
   * Format configuration for Claude Desktop
   * @param {Object} config - Raw configuration data
   * @returns {Object} Formatted configuration
   */
  formatConfig(config) {
    const formatted = super.formatConfig(config);
    
    // Claude Desktop doesn't auto-load .env files
    // Environment variables need to be referenced with ${env:VAR} syntax
    if (formatted.env) {
      for (const key of Object.keys(formatted.env)) {
        formatted.env[key] = `\${env:${key}}`;
      }
    }
    
    return formatted;
  }
}

module.exports = ClaudeDesktopClient;
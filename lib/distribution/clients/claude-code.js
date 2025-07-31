/**
 * Claude Code Client
 * Handles Claude Code specific configuration
 */

const BaseClient = require('./base-client');

class ClaudeCodeClient extends BaseClient {
  constructor(registry) {
    super('claude-code', registry);
  }

  /**
   * Get the configuration key for Claude Code
   * @returns {string} Configuration key
   */
  getConfigKey() {
    return 'projects';
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
    const fs = require('fs').promises;
    const path = require('path');
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    
    // Read existing config
    let existingConfig = {};
    try {
      const content = await fs.readFile(configPath, 'utf8');
      existingConfig = JSON.parse(content);
    } catch (error) {
      // File doesn't exist or is invalid
    }
    
    // Claude Code uses a project-based structure
    if (!existingConfig.projects) {
      existingConfig.projects = {};
    }
    
    // Get current working directory as project path
    const projectPath = process.cwd();
    
    if (!existingConfig.projects[projectPath]) {
      existingConfig.projects[projectPath] = {
        mcpServers: {}
      };
    }
    
    // Format configuration for the client
    const formattedConfig = this.formatConfig(config);
    existingConfig.projects[projectPath].mcpServers[config.serverName] = formattedConfig;
    
    // Write updated config
    await fs.writeFile(configPath, JSON.stringify(existingConfig, null, 2));
  }

  /**
   * Format configuration for Claude Code
   * @param {Object} config - Raw configuration data
   * @returns {Object} Formatted configuration
   */
  formatConfig(config) {
    const formatted = super.formatConfig(config);
    
    // Claude Code doesn't auto-load .env files
    // Environment variables need to be referenced with ${env:VAR} syntax
    if (formatted.env) {
      for (const key of Object.keys(formatted.env)) {
        formatted.env[key] = `\${env:${key}}`;
      }
    }
    
    return formatted;
  }
}

module.exports = ClaudeCodeClient;
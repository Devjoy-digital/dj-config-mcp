/**
 * Gitignore Manager
 * Manages .gitignore to ensure .env files are not committed
 */

const fs = require('fs').promises;
const path = require('path');

class GitignoreManager {
  constructor(clientRegistry = null) {
    this.localGitignore = './.gitignore';
    this.localEnvPath = null;
    this.clientRegistry = clientRegistry;
  }

  /**
   * Ensure .env is in .gitignore
   * @param {boolean} isGlobal - Skip for global configurations
   * @returns {Promise<void>}
   */
  async ensure(isGlobal = false) {
    // Skip gitignore for global configurations
    if (isGlobal) return;

    // Get the local env path if not set
    if (!this.localEnvPath && this.clientRegistry) {
      this.localEnvPath = await this.clientRegistry.getStoragePath('env', false);
    }

    try {
      // Check if .gitignore exists
      let content = '';
      try {
        content = await fs.readFile(this.localGitignore, 'utf8');
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
        // File doesn't exist, we'll create it
      }

      // Check if .env path is already in .gitignore
      const lines = content.split('\n');
      const envPatterns = [
        this.localEnvPath,
        '**/.env',
        '.env'
      ];

      // Check if any pattern already covers our .env file
      const hasEnvPattern = lines.some(line => {
        const trimmed = line.trim();
        return envPatterns.some(pattern => trimmed === pattern || trimmed === `/${pattern}`);
      });

      if (!hasEnvPattern) {
        // Add .env pattern
        const newLines = [...lines];
        
        // Add a newline if file doesn't end with one
        if (content.length > 0 && !content.endsWith('\n')) {
          newLines.push('');
        }

        // Add comment and pattern
        if (content.length > 0) {
          newLines.push('');
        }
        newLines.push('# dj-config-mcp sensitive configuration');
        newLines.push(this.localEnvPath);
        newLines.push('');

        // Write updated .gitignore
        await fs.writeFile(this.localGitignore, newLines.join('\n'));
        
        // Note: Removed console.log to prevent breaking MCP protocol
        // The MCP protocol requires JSON-only communication on stdout
      }
    } catch (error) {
      // Note: Removed console.error to prevent breaking MCP protocol
      // The MCP protocol requires JSON-only communication on stdout
      // Don't throw - this is not a critical error
    }
  }
}

module.exports = GitignoreManager;

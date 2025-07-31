/**
 * Security Detector
 * Detects sensitive configuration keys
 */

const ClientRegistry = require('../distribution/client-registry');

class SecurityDetector {
  constructor() {
    this.clientRegistry = new ClientRegistry();
    this.patterns = null;
  }

  /**
   * Load sensitive patterns from configuration
   * @returns {Promise<Array<string>>} Array of patterns
   */
  async loadPatterns() {
    if (!this.patterns) {
      try {
        this.patterns = await this.clientRegistry.getSensitivePatterns();
        if (!this.patterns || this.patterns.length === 0) {
          this.patterns = this.getDefaultPatterns();
        }
      } catch (error) {
        // Use defaults if config not found
        this.patterns = this.getDefaultPatterns();
      }
    }
    return this.patterns;
  }

  /**
   * Get default sensitive patterns
   * @returns {Array<string>} Default patterns
   */
  getDefaultPatterns() {
    try {
      // Load from default configuration file
      const path = require('path');
      const fs = require('fs');
      const defaultConfigPath = path.join(__dirname, '../../config/default-client-mappings.json');
      const content = fs.readFileSync(defaultConfigPath, 'utf8');
      const config = JSON.parse(content);
      return config.sensitivePatterns || ['password', 'secret', 'key', 'token', 'auth', 'credential', 'private'];
    } catch (error) {
      // Fallback to hardcoded defaults if file not found
      return ['password', 'secret', 'key', 'token', 'auth', 'credential', 'private'];
    }
  }

  /**
   * Check if a key is sensitive
   * @param {string} key - Configuration key
   * @returns {Promise<boolean>} True if sensitive
   */
  async isSensitive(key) {
    const patterns = await this.loadPatterns();
    const lowerKey = key.toLowerCase();
    return patterns.some(pattern => lowerKey.includes(pattern.toLowerCase()));
  }
}

module.exports = SecurityDetector;
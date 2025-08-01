/**
 * Security Detector
 * Detects sensitive configuration keys
 */

const ClientRegistry = require('../distribution/client-registry');

class SecurityDetector {
  constructor(clientRegistry = null) {
    this.clientRegistry = clientRegistry || new ClientRegistry();
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
    const { DEFAULT_SENSITIVE_PATTERNS } = require('../constants');
    return DEFAULT_SENSITIVE_PATTERNS;
  }

  /**
   * Check if a key is sensitive
   * @param {string} key - Configuration key
   * @returns {Promise<boolean>} True if sensitive
   */
  async isSensitive(key) {
    if (!key) {
      return false;
    }
    const patterns = await this.loadPatterns();
    const lowerKey = key.toLowerCase();
    return patterns.some(pattern => lowerKey.includes(pattern.toLowerCase()));
  }
}

module.exports = SecurityDetector;
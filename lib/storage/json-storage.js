/**
 * JSON Storage
 * Handles non-sensitive data storage in JSON files
 */

const fs = require('fs').promises;
const path = require('path');
const ClientRegistry = require('../distribution/client-registry');

class JsonStorage {
  constructor(clientRegistry = null) {
    this.clientRegistry = clientRegistry || new ClientRegistry();
    this.localPath = null;
    this.globalPath = null;
  }

  /**
   * Get local storage path
   * @returns {Promise<string>} Local storage path
   */
  async getLocalPath() {
    if (!this.localPath) {
      this.localPath = await this.clientRegistry.getStoragePath('json', false);
    }
    return this.localPath;
  }

  /**
   * Get global storage path
   * @returns {Promise<string>} Global storage path
   */
  async getGlobalPath() {
    if (!this.globalPath) {
      this.globalPath = await this.clientRegistry.getStoragePath('json', true);
    }
    return this.globalPath;
  }

  /**
   * Read JSON configuration
   * @param {string} configPath - Path to config file
   * @returns {Promise<Object>} Configuration object
   */
  async read(configPath) {
    try {
      const content = await fs.readFile(configPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Write JSON configuration
   * @param {string} configPath - Path to config file
   * @param {Object} config - Configuration object
   * @returns {Promise<void>}
   */
  async write(configPath, config) {
    const dir = path.dirname(configPath);
    
    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });
    
    // Write with proper formatting
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  }

  /**
   * Set a configuration value
   * @param {string} key - Configuration key
   * @param {any} value - Configuration value
   * @param {boolean} isGlobal - Use global configuration
   * @returns {Promise<void>}
   */
  async set(key, value, isGlobal = false) {
    const configPath = isGlobal ? await this.getGlobalPath() : await this.getLocalPath();
    const config = await this.read(configPath) || {};
    
    // Support nested keys (e.g., "api.endpoint")
    this.setNestedValue(config, key, value);
    
    await this.write(configPath, config);
  }

  /**
   * Get a configuration value
   * @param {string} key - Configuration key
   * @param {boolean} isGlobal - Use global configuration
   * @returns {Promise<any>} Configuration value
   */
  async get(key, isGlobal = false) {
    const configPath = isGlobal ? await this.getGlobalPath() : await this.getLocalPath();
    const config = await this.read(configPath) || {};
    
    return this.getNestedValue(config, key);
  }

  /**
   * Delete a configuration value
   * @param {string} key - Configuration key
   * @param {boolean} isGlobal - Use global configuration
   * @returns {Promise<void>}
   */
  async delete(key, isGlobal = false) {
    const configPath = isGlobal ? await this.getGlobalPath() : await this.getLocalPath();
    const config = await this.read(configPath);
    
    if (!config) return;
    
    this.deleteNestedValue(config, key);
    
    await this.write(configPath, config);
  }

  /**
   * Get all configuration keys
   * @param {boolean} isGlobal - Use global configuration
   * @returns {Promise<Array<string>>} Array of keys
   */
  async getAllKeys(isGlobal = false) {
    const configPath = isGlobal ? await this.getGlobalPath() : await this.getLocalPath();
    const config = await this.read(configPath) || {};
    
    return this.extractKeys(config);
  }

  /**
   * Get all configuration
   * @param {boolean} isGlobal - Use global configuration
   * @returns {Promise<Object>} Configuration object
   */
  async getAll(isGlobal = false) {
    const configPath = isGlobal ? await this.getGlobalPath() : await this.getLocalPath();
    return await this.read(configPath) || {};
  }

  /**
   * Set nested value in object
   * @param {Object} obj - Target object
   * @param {string} path - Dot notation path
   * @param {any} value - Value to set
   */
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  /**
   * Get nested value from object
   * @param {Object} obj - Source object
   * @param {string} path - Dot notation path
   * @returns {any} Value at path
   */
  getNestedValue(obj, path) {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  /**
   * Delete nested value from object
   * @param {Object} obj - Target object
   * @param {string} path - Dot notation path
   */
  deleteNestedValue(obj, path) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
        return;
      }
      current = current[keys[i]];
    }
    
    delete current[keys[keys.length - 1]];
  }

  /**
   * Extract all keys from object (including nested)
   * @param {Object} obj - Source object
   * @param {string} prefix - Key prefix
   * @returns {Array<string>} Array of keys
   */
  extractKeys(obj, prefix = '') {
    const keys = [];
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          keys.push(...this.extractKeys(obj[key], fullKey));
        } else {
          keys.push(fullKey);
        }
      }
    }
    
    return keys;
  }
}

module.exports = JsonStorage;
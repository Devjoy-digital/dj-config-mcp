/**
 * Configuration Resolver
 * Resolves configuration values from multiple sources with priority
 */

const path = require('path');
const ClientRegistry = require('../distribution/client-registry');

class ConfigResolver {
  constructor(storageManager, clientRegistry = null) {
    this.storage = storageManager;
    this.clientRegistry = clientRegistry || new ClientRegistry();
  }

  /**
   * Resolve a configuration value
   * Priority: Environment variables > Local config > Global config
   * @param {string} key - Configuration key
   * @returns {Promise<Object>} Configuration value with source info
   */
  async resolve(key) {
    // Check environment variables first
    const envValue = await this.storage.env.get(key, false);
    if (envValue !== undefined) {
      return {
        key,
        value: envValue,
        source: 'Environment Variable',
        path: this.storage.env.getStoragePath(false)
      };
    }

    // Check local configuration
    const localValue = await this.storage.json.get(key, false);
    if (localValue !== undefined) {
      return {
        key,
        value: localValue,
        source: 'Local Config',
        path: this.storage.json.getStoragePath(false)
      };
    }

    // Check global environment variables
    const globalEnvValue = await this.storage.env.get(key, true);
    if (globalEnvValue !== undefined) {
      return {
        key,
        value: globalEnvValue,
        source: 'Global Environment Variable',
        path: this.storage.env.getStoragePath(true)
      };
    }

    // Check global configuration
    const globalValue = await this.storage.json.get(key, true);
    if (globalValue !== undefined) {
      return {
        key,
        value: globalValue,
        source: 'Global Config',
        path: this.storage.json.getStoragePath(true)
      };
    }

    // Not found
    return null;
  }

  /**
   * Resolve all configuration values
   * @returns {Promise<Array>} All configuration values with source info
   */
  async resolveAll() {
    const results = [];
    const processedKeys = new Set();

    // Get all keys from all sources
    const localEnvKeys = await this.storage.env.getAllKeys(false);
    const localJsonKeys = await this.storage.json.getAllKeys(false);
    const globalEnvKeys = await this.storage.env.getAllKeys(true);
    const globalJsonKeys = await this.storage.json.getAllKeys(true);

    // Combine all keys
    const allKeys = new Set([
      ...localEnvKeys,
      ...localJsonKeys,
      ...globalEnvKeys,
      ...globalJsonKeys
    ]);

    // Resolve each key
    for (const key of allKeys) {
      if (!processedKeys.has(key)) {
        const result = await this.resolve(key);
        if (result) {
          results.push(result);
          processedKeys.add(key);
        }
      }
    }

    return results;
  }
}

module.exports = ConfigResolver;

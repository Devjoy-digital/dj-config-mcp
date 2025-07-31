/**
 * Configuration Manager
 * Central orchestrator for all configuration operations
 */

const StorageManager = require('../storage/storage-manager');
const SecurityDetector = require('../security/detector');
const Distributor = require('../distribution/distributor');
const ConfigResolver = require('./resolver');
const ClientRegistry = require('../distribution/client-registry');

class ConfigurationManager {
  constructor(options = {}) {
    // Get server name from package.json or options
    this.serverName = options.serverName || this.getServerName();
    
    // Create shared ClientRegistry instance with server name
    this.clientRegistry = new ClientRegistry(this.serverName);
    
    // Initialize all components with shared registry
    this.storage = new StorageManager(this.clientRegistry);
    this.security = new SecurityDetector();
    this.distributor = new Distributor(this.clientRegistry);
    this.resolver = new ConfigResolver(this.storage, this.clientRegistry);
  }

  /**
   * Get server name from package.json
   * @returns {string} Server name
   */
  getServerName() {
    try {
      const path = require('path');
      const fs = require('fs');
      const packageJsonPath = path.resolve('./package.json');
      const packageContent = fs.readFileSync(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageContent);
      return packageJson.name || 'mcp-server';
    } catch (error) {
      return 'mcp-server';
    }
  }

  /**
   * Set a configuration value
   * @param {string} key - Configuration key
   * @param {any} value - Configuration value
   * @param {Object} options - Options
   * @returns {Promise<void>}
   */
  async setConfig(key, value, options = {}) {
    // Detect if sensitive
    const isSensitive = await this.security.isSensitive(key);
    
    // Route to appropriate storage
    if (isSensitive) {
      await this.storage.env.set(key, value, options.global);
      await this.storage.gitignore.ensure(options.global);
      
      // Note: Removed console.warn to prevent breaking MCP protocol
      // The MCP protocol requires JSON-only communication on stdout
    } else {
      await this.storage.json.set(key, value, options.global);
    }
    
    // Distribute to clients if local
    if (!options.global) {
      await this.distributor.distribute();
    }
  }

  /**
   * Get a configuration value
   * @param {string} key - Configuration key
   * @returns {Promise<any>}
   */
  async getConfig(key) {
    return await this.resolver.resolve(key);
  }

  /**
   * Get all configuration values
   * @returns {Promise<Array>}
   */
  async getAllConfig() {
    return await this.resolver.resolveAll();
  }

  /**
   * Delete a configuration value
   * @param {string} key - Configuration key
   * @param {Object} options - Options
   * @returns {Promise<void>}
   */
  async deleteConfig(key, options = {}) {
    // Check if key exists in env or json
    const envValue = await this.storage.env.get(key, options.global);
    const jsonValue = await this.storage.json.get(key, options.global);
    
    if (envValue !== undefined) {
      await this.storage.env.delete(key, options.global);
    }
    
    if (jsonValue !== undefined) {
      await this.storage.json.delete(key, options.global);
    }
    
    if (!options.global) {
      await this.distributor.distribute();
    }
  }

  /**
   * Load environment variables from .env files
   * @returns {Promise<void>}
   */
  async loadEnvironment() {
    await this.storage.env.load();
  }

  /**
   * Get available clients
   * @returns {Promise<Array>}
   */
  async getAvailableClients() {
    return await this.distributor.getAvailableClients();
  }

  /**
   * Distribute configuration to specific clients
   * @param {Array<string>} clientIds - Client IDs to distribute to
   * @returns {Promise<void>}
   */
  async distributeToClients(clientIds) {
    await this.distributor.distributeToClients(clientIds);
  }
}

module.exports = ConfigurationManager;

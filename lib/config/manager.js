/**
 * @module ConfigurationManager
 * @description Central orchestrator for all configuration operations in DJ Config MCP.
 * Manages configuration storage, security detection, client distribution, and resolution.
 * 
 * @example
 * const ConfigurationManager = require('./lib/config/manager');
 * const manager = new ConfigurationManager({ serverName: 'my-mcp-server' });
 * 
 * // Set a configuration value
 * await manager.setConfig('api.endpoint', 'https://api.example.com');
 * 
 * // Get a configuration value
 * const config = await manager.getConfig('api.endpoint');
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
    this.security = new SecurityDetector(this.clientRegistry);
    this.distributor = new Distributor(this.clientRegistry);
    this.resolver = new ConfigResolver(this.storage, this.clientRegistry);
  }

  /**
   * Get server name from package.json
   * @private
   * @returns {string} Server name from package.json or 'mcp-server' as default
   */
  getServerName() {
    try {
      const path = require('path');
      const fs = require('fs');
      const PathUtils = require('../utils/path-utils');
      const packageJsonPath = PathUtils.ensureAbsolute('./package.json');
      const packageContent = fs.readFileSync(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageContent);
      return packageJson.name || 'mcp-server';
    } catch (error) {
      return 'mcp-server';
    }
  }

  /**
   * Set a configuration value
   * @param {string} key - Configuration key (supports dot notation for nested values)
   * @param {any} value - Configuration value to set
   * @param {Object} options - Configuration options
   * @param {boolean} options.isGlobal - If true, stores in global config; if false, stores in local config
   * @returns {Promise<void>}
   * @throws {StorageError} If storage operation fails
   * @throws {FileSystemError} If file system operation fails
   * 
   * @example
   * // Set a local configuration value
   * await manager.setConfig('database.host', 'localhost');
   * 
   * // Set a global configuration value
   * await manager.setConfig('api.key', 'secret-key', { isGlobal: true });
   */
  async setConfig(key, value, options = {}) {
    // Detect if sensitive
    const isSensitive = await this.security.isSensitive(key);
    
    // Route to appropriate storage
    if (isSensitive) {
      await this.storage.env.set(key, value, options.isGlobal);
      await this.storage.gitignore.ensure(options.isGlobal);
      
      // Note: Removed console.warn to prevent breaking MCP protocol
      // The MCP protocol requires JSON-only communication on stdout
    } else {
      await this.storage.json.set(key, value, options.isGlobal);
    }
    
    // Distribute to clients if local
    if (!options.isGlobal) {
      await this.distributor.distribute();
    }
  }

  /**
   * Get a configuration value with source information
   * @param {string} key - Configuration key to retrieve
   * @returns {Promise<Object>} Configuration object with value and source info
   * @returns {Promise<Object>} result - The configuration result
   * @returns {string} result.key - The configuration key
   * @returns {any} result.value - The configuration value
   * @returns {string} result.source - Where the value was found (e.g., 'Environment Variable', 'Local Config')
   * @returns {string} result.path - Path to the configuration file
   * 
   * @example
   * const config = await manager.getConfig('database.host');
   * console.log(`Value: ${config.value}, Source: ${config.source}`);
   */
  async getConfig(key) {
    return await this.resolver.resolve(key);
  }

  /**
   * Get all configuration values from all sources
   * @returns {Promise<Array<Object>>} Array of configuration objects with value and source info
   * 
   * @example
   * const allConfigs = await manager.getAllConfig();
   * allConfigs.forEach(config => {
   *   console.log(`${config.key}: ${config.value} (${config.source})`);
   * });
   */
  async getAllConfig() {
    return await this.resolver.resolveAll();
  }

  /**
   * Delete a configuration value from storage
   * @param {string} key - Configuration key to delete
   * @param {Object} options - Configuration options
   * @param {boolean} options.isGlobal - If true, deletes from global config; if false, deletes from local config
   * @returns {Promise<void>}
   * @throws {StorageError} If storage operation fails
   * 
   * @example
   * // Delete a local configuration value
   * await manager.deleteConfig('database.host');
   * 
   * // Delete a global configuration value
   * await manager.deleteConfig('api.key', { isGlobal: true });
   */
  async deleteConfig(key, options = {}) {
    // Check if key exists in env or json
    const envValue = await this.storage.env.get(key, options.isGlobal);
    const jsonValue = await this.storage.json.get(key, options.isGlobal);
    
    if (envValue !== undefined) {
      await this.storage.env.delete(key, options.isGlobal);
    }
    
    if (jsonValue !== undefined) {
      await this.storage.json.delete(key, options.isGlobal);
    }
    
    if (!options.isGlobal) {
      await this.distributor.distribute();
    }
  }

  /**
   * Load environment variables from .env files
   * @returns {Promise<void>}
   * @throws {FileSystemError} If .env file cannot be read
   */
  async loadEnvironment() {
    await this.storage.env.load();
  }

  /**
   * Get list of available MCP clients
   * @returns {Promise<Array<Object>>} Array of client information
   * @returns {Promise<Array<Object>>} clients - Available clients
   * @returns {string} clients[].id - Client identifier
   * @returns {string} clients[].name - Client display name
   * @returns {boolean} clients[].autoLoadEnv - Whether client auto-loads env vars
   */
  async getAvailableClients() {
    return await this.distributor.getAvailableClients();
  }

  /**
   * Distribute configuration to specific MCP clients
   * @param {Array<string>} clientIds - Array of client IDs to distribute configuration to
   * @returns {Promise<void>}
   * @throws {ClientError} If any specified client is unknown
   * @throws {DistributionError} If distribution to any client fails
   * 
   * @example
   * await manager.distributeToClients(['vscode', 'claude-desktop']);
   */
  async distributeToClients(clientIds) {
    await this.distributor.distributeToClients(clientIds);
  }
}

module.exports = ConfigurationManager;

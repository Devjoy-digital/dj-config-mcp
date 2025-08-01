/**
 * Distributor
 * Distributes configuration to MCP clients
 */

const fs = require('fs').promises;
const path = require('path');
const ClientRegistry = require('./client-registry');
const BaseClient = require('./base-client');
const { DistributionError, ClientError, FileSystemError } = require('../errors');
const PathUtils = require('../utils/path-utils');

class Distributor {
  constructor(clientRegistry = null) {
    this.registry = clientRegistry || new ClientRegistry();
    this.clients = {};
    this.initialized = false;
  }

  /**
   * Initialize clients dynamically from configuration
   * @returns {Promise<void>}
   */
  async initializeClients() {
    if (this.initialized) return;
    
    const availableClients = await this.registry.getAvailableClients();
    
    for (const clientInfo of availableClients) {
      this.clients[clientInfo.id] = new BaseClient(clientInfo.id, this.registry);
    }
    
    this.initialized = true;
  }

  /**
   * Distribute configuration to all installed clients
   * @returns {Promise<void>}
   */
  async distribute() {
    await this.initializeClients();
    const config = await this.gatherConfiguration();
    const errors = [];
    
    for (const [clientId, client] of Object.entries(this.clients)) {
      try {
        if (await client.isInstalled()) {
          await client.updateConfig(config);
        }
      } catch (error) {
        errors.push({ clientId, error });
      }
    }
    
    if (errors.length > 0) {
      throw new DistributionError(
        `Failed to distribute configuration to ${errors.length} client(s)`,
        errors.map(e => e.clientId),
        'distribute',
        { errors }
      );
    }
  }

  /**
   * Distribute configuration to specific clients
   * @param {Array<string>} clientIds - Client IDs to distribute to
   * @returns {Promise<void>}
   */
  async distributeToClients(clientIds) {
    await this.initializeClients();
    const config = await this.gatherConfiguration();
    const errors = [];
    const unknownClients = [];
    
    for (const clientId of clientIds) {
      const client = this.clients[clientId];
      if (!client) {
        unknownClients.push(clientId);
        continue;
      }
      
      try {
        await client.updateConfig(config);
      } catch (error) {
        errors.push({ clientId, error });
      }
    }
    
    if (unknownClients.length > 0) {
      throw new ClientError(
        `Unknown client(s): ${unknownClients.join(', ')}`,
        unknownClients.join(', ')
      );
    }
    
    if (errors.length > 0) {
      throw new DistributionError(
        `Failed to distribute configuration to ${errors.length} client(s)`,
        errors.map(e => e.clientId),
        'distributeToClients',
        { errors }
      );
    }
  }

  /**
   * Gather all configuration data
   * @returns {Promise<Object>} Combined configuration
   */
  async gatherConfiguration() {
    const StorageManager = require('../storage/storage-manager');
    const storage = new StorageManager();
    
    // Get the name of the MCP server from package.json
    let serverName = 'mcp-server';
    try {
      const packageJsonPath = PathUtils.ensureAbsolute('./package.json');
      const packageContent = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageContent);
      serverName = packageJson.name || 'mcp-server';
    } catch (error) {
      // Use default if package.json not found or invalid
      // This is not a critical error
    }
    
    // Gather both JSON and env configurations
    const jsonConfig = await storage.json.getAll(false);
    const envConfig = await storage.env.getAll(false);
    
    return {
      serverName,
      settings: jsonConfig,
      environment: envConfig
    };
  }

  /**
   * Get available clients
   * @returns {Promise<Array>} Array of client info
   */
  async getAvailableClients() {
    return await this.registry.getAvailableClients();
  }
}

module.exports = Distributor;

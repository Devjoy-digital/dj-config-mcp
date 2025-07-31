/**
 * Distributor
 * Distributes configuration to MCP clients
 */

const fs = require('fs').promises;
const path = require('path');
const ClientRegistry = require('./client-registry');
const VSCodeClient = require('./clients/vscode');
const ClaudeCodeClient = require('./clients/claude-code');
const ClaudeDesktopClient = require('./clients/claude-desktop');
const CursorClient = require('./clients/cursor');

class Distributor {
  constructor(clientRegistry = null) {
    this.registry = clientRegistry || new ClientRegistry();
    this.clients = {
      'vscode': new VSCodeClient(this.registry),
      'claude-code': new ClaudeCodeClient(this.registry),
      'claude-desktop': new ClaudeDesktopClient(this.registry),
      'cursor': new CursorClient(this.registry)
    };
  }

  /**
   * Distribute configuration to all installed clients
   * @returns {Promise<void>}
   */
  async distribute() {
    const config = await this.gatherConfiguration();
    
    for (const [clientId, client] of Object.entries(this.clients)) {
      try {
        if (await client.isInstalled()) {
          await client.updateConfig(config);
          // Note: Removed console.log to prevent breaking MCP protocol
          // The MCP protocol requires JSON-only communication on stdout
        }
      } catch (error) {
        // Note: Removed console.error to prevent breaking MCP protocol
        // The MCP protocol requires JSON-only communication on stdout
        // Error is silently handled to prevent breaking protocol
      }
    }
  }

  /**
   * Distribute configuration to specific clients
   * @param {Array<string>} clientIds - Client IDs to distribute to
   * @returns {Promise<void>}
   */
  async distributeToClients(clientIds) {
    const config = await this.gatherConfiguration();
    
    for (const clientId of clientIds) {
      const client = this.clients[clientId];
      if (!client) {
        // Note: Removed console.error to prevent breaking MCP protocol
        // The MCP protocol requires JSON-only communication on stdout
        continue;
      }
      
      try {
        await client.updateConfig(config);
        // Note: Removed console.log to prevent breaking MCP protocol
        // The MCP protocol requires JSON-only communication on stdout
      } catch (error) {
        // Note: Removed console.error to prevent breaking MCP protocol
        // The MCP protocol requires JSON-only communication on stdout
        // Error is silently handled to prevent breaking protocol
      }
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
      const packageJsonPath = path.resolve('./package.json');
      const packageContent = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageContent);
      serverName = packageJson.name || 'mcp-server';
    } catch (error) {
      // Use default if package.json not found
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

/**
 * Storage Manager
 * Manages all storage operations
 */

const JsonStorage = require('./json-storage');
const EnvStorage = require('./env-storage');
const GitignoreManager = require('./gitignore');
const ClientRegistry = require('../distribution/client-registry');

class StorageManager {
  constructor(clientRegistry = null) {
    this.clientRegistry = clientRegistry || new ClientRegistry();
    
    // Get server name from the client registry for storage paths
    const serverName = this.clientRegistry.serverName;
    
    this.json = new JsonStorage(serverName);
    this.env = new EnvStorage(serverName);
    this.gitignore = new GitignoreManager(serverName);
  }
}

module.exports = StorageManager;

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
    this.json = new JsonStorage(this.clientRegistry);
    this.env = new EnvStorage(this.clientRegistry);
    this.gitignore = new GitignoreManager(this.clientRegistry);
  }
}

module.exports = StorageManager;
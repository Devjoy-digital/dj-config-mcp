const StorageManager = require('../../lib/storage/storage-manager');
const JsonStorage = require('../../lib/storage/json-storage');
const EnvStorage = require('../../lib/storage/env-storage');
const GitignoreManager = require('../../lib/storage/gitignore');
const ClientRegistry = require('../../lib/distribution/client-registry');

// Mock all storage classes
jest.mock('../../lib/storage/json-storage');
jest.mock('../../lib/storage/env-storage');
jest.mock('../../lib/storage/gitignore');
jest.mock('../../lib/distribution/client-registry');

describe('StorageManager', () => {
  let manager;
  let mockRegistry;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock registry
    mockRegistry = {
      serverName: 'test-server'
    };
    
    // Mock constructors
    JsonStorage.mockImplementation(() => ({}));
    EnvStorage.mockImplementation(() => ({}));
    GitignoreManager.mockImplementation(() => ({}));
    
    manager = new StorageManager(mockRegistry);
  });

  describe('constructor', () => {
    test('should initialize all storage types with registry', () => {
      expect(manager.clientRegistry).toBe(mockRegistry);
      expect(JsonStorage).toHaveBeenCalledWith('test-server');
      expect(EnvStorage).toHaveBeenCalledWith('test-server');
      expect(GitignoreManager).toHaveBeenCalledWith('test-server');
      expect(manager.json).toBeDefined();
      expect(manager.env).toBeDefined();
      expect(manager.gitignore).toBeDefined();
    });

    test('should create new registry if none provided', () => {
      ClientRegistry.mockImplementation(() => ({ serverName: 'default' }));
      
      const managerNoRegistry = new StorageManager();
      
      expect(ClientRegistry).toHaveBeenCalled();
      expect(managerNoRegistry.clientRegistry).toBeDefined();
    });

    test('should handle registry without server name', () => {
      const registryNoName = {};
      
      const managerNoName = new StorageManager(registryNoName);
      
      expect(JsonStorage).toHaveBeenCalledWith(undefined);
      expect(EnvStorage).toHaveBeenCalledWith(undefined);
      expect(GitignoreManager).toHaveBeenCalledWith(undefined);
    });
  });
});
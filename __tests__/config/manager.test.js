const ConfigurationManager = require('../../lib/config/manager');
const StorageManager = require('../../lib/storage/storage-manager');
const SecurityDetector = require('../../lib/security/detector');
const Distributor = require('../../lib/distribution/distributor');
const ConfigResolver = require('../../lib/config/resolver');
const ClientRegistry = require('../../lib/distribution/client-registry');
const fs = require('fs');
const path = require('path');

// Mock all dependencies
jest.mock('../../lib/storage/storage-manager');
jest.mock('../../lib/security/detector');
jest.mock('../../lib/distribution/distributor');
jest.mock('../../lib/config/resolver');
jest.mock('../../lib/distribution/client-registry');
jest.mock('fs');

// Mock PathUtils
jest.mock('../../lib/utils/path-utils', () => ({
  ensureAbsolute: jest.fn((p) => require('path').resolve(p))
}));

describe('ConfigurationManager', () => {
  let manager;
  let mockStorage;
  let mockSecurity;
  let mockDistributor;
  let mockResolver;
  let mockRegistry;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mocks
    mockStorage = {
      env: {
        set: jest.fn(),
        get: jest.fn(),
        delete: jest.fn(),
        load: jest.fn()
      },
      json: {
        set: jest.fn(),
        get: jest.fn(),
        delete: jest.fn()
      },
      gitignore: {
        ensure: jest.fn()
      }
    };
    
    mockSecurity = {
      isSensitive: jest.fn()
    };
    
    mockDistributor = {
      distribute: jest.fn(),
      distributeToClients: jest.fn(),
      getAvailableClients: jest.fn()
    };
    
    mockResolver = {
      resolve: jest.fn(),
      resolveAll: jest.fn()
    };
    
    mockRegistry = {};
    
    // Mock constructors
    StorageManager.mockImplementation(() => mockStorage);
    SecurityDetector.mockImplementation(() => mockSecurity);
    Distributor.mockImplementation(() => mockDistributor);
    ConfigResolver.mockImplementation(() => mockResolver);
    ClientRegistry.mockImplementation(() => mockRegistry);
    
    // Mock fs for getServerName
    fs.readFileSync.mockReturnValue(JSON.stringify({ name: 'test-server' }));
    
    manager = new ConfigurationManager();
  });

  describe('constructor', () => {
    test('should initialize with default server name', () => {
      expect(manager.serverName).toBe('test-server');
      expect(ClientRegistry).toHaveBeenCalledWith('test-server');
      expect(StorageManager).toHaveBeenCalledWith(mockRegistry);
      expect(SecurityDetector).toHaveBeenCalledWith(mockRegistry);
      expect(Distributor).toHaveBeenCalledWith(mockRegistry);
      expect(ConfigResolver).toHaveBeenCalledWith(mockStorage, mockRegistry);
    });

    test('should use provided server name', () => {
      const customManager = new ConfigurationManager({ serverName: 'custom-server' });
      expect(customManager.serverName).toBe('custom-server');
    });

    test('should handle missing package.json', () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });
      
      const newManager = new ConfigurationManager();
      expect(newManager.serverName).toBe('mcp-server');
    });

    test('should handle invalid package.json', () => {
      fs.readFileSync.mockReturnValue('invalid json');
      
      const newManager = new ConfigurationManager();
      expect(newManager.serverName).toBe('mcp-server');
    });

    test('should use default if package.json has no name', () => {
      fs.readFileSync.mockReturnValue(JSON.stringify({ version: '1.0.0' }));
      
      const newManager = new ConfigurationManager();
      expect(newManager.serverName).toBe('mcp-server');
    });
  });

  describe('getServerName', () => {
    test('should read server name from package.json', () => {
      fs.readFileSync.mockReturnValue(JSON.stringify({ name: 'my-server' }));
      
      const name = manager.getServerName();
      expect(name).toBe('my-server');
    });

    test('should use PathUtils for path resolution', () => {
      const PathUtils = require('../../lib/utils/path-utils');
      
      manager.getServerName();
      expect(PathUtils.ensureAbsolute).toHaveBeenCalledWith('./package.json');
    });
  });

  describe('setConfig', () => {
    test('should store sensitive values in env storage', async () => {
      mockSecurity.isSensitive.mockResolvedValue(true);
      
      await manager.setConfig('api.key', 'secret-value', { isGlobal: false });
      
      expect(mockSecurity.isSensitive).toHaveBeenCalledWith('api.key');
      expect(mockStorage.env.set).toHaveBeenCalledWith('api.key', 'secret-value', false);
      expect(mockStorage.gitignore.ensure).toHaveBeenCalledWith(false);
      expect(mockStorage.json.set).not.toHaveBeenCalled();
    });

    test('should store non-sensitive values in json storage', async () => {
      mockSecurity.isSensitive.mockResolvedValue(false);
      
      await manager.setConfig('server.port', 3000, { isGlobal: false });
      
      expect(mockStorage.json.set).toHaveBeenCalledWith('server.port', 3000, false);
      expect(mockStorage.env.set).not.toHaveBeenCalled();
    });

    test('should distribute after local config change', async () => {
      mockSecurity.isSensitive.mockResolvedValue(false);
      
      await manager.setConfig('test.key', 'value', { isGlobal: false });
      
      expect(mockDistributor.distribute).toHaveBeenCalled();
    });

    test('should not distribute after global config change', async () => {
      mockSecurity.isSensitive.mockResolvedValue(false);
      
      await manager.setConfig('test.key', 'value', { isGlobal: true });
      
      expect(mockDistributor.distribute).not.toHaveBeenCalled();
    });

    test('should handle undefined options', async () => {
      mockSecurity.isSensitive.mockResolvedValue(false);
      
      await manager.setConfig('test.key', 'value');
      
      expect(mockStorage.json.set).toHaveBeenCalledWith('test.key', 'value', undefined);
      expect(mockDistributor.distribute).toHaveBeenCalled();
    });
  });

  describe('getConfig', () => {
    test('should resolve configuration value', async () => {
      const mockResult = {
        key: 'test.key',
        value: 'test-value',
        source: 'Local Config'
      };
      mockResolver.resolve.mockResolvedValue(mockResult);
      
      const result = await manager.getConfig('test.key');
      
      expect(mockResolver.resolve).toHaveBeenCalledWith('test.key');
      expect(result).toEqual(mockResult);
    });
  });

  describe('getAllConfig', () => {
    test('should resolve all configuration values', async () => {
      const mockResults = [
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2' }
      ];
      mockResolver.resolveAll.mockResolvedValue(mockResults);
      
      const results = await manager.getAllConfig();
      
      expect(mockResolver.resolveAll).toHaveBeenCalled();
      expect(results).toEqual(mockResults);
    });
  });

  describe('deleteConfig', () => {
    test('should delete from env storage if exists', async () => {
      mockStorage.env.get.mockResolvedValue('env-value');
      mockStorage.json.get.mockResolvedValue(undefined);
      
      await manager.deleteConfig('test.key', { isGlobal: false });
      
      expect(mockStorage.env.delete).toHaveBeenCalledWith('test.key', false);
      expect(mockStorage.json.delete).not.toHaveBeenCalled();
    });

    test('should delete from json storage if exists', async () => {
      mockStorage.env.get.mockResolvedValue(undefined);
      mockStorage.json.get.mockResolvedValue('json-value');
      
      await manager.deleteConfig('test.key', { isGlobal: false });
      
      expect(mockStorage.json.delete).toHaveBeenCalledWith('test.key', false);
      expect(mockStorage.env.delete).not.toHaveBeenCalled();
    });

    test('should delete from both storages if exists in both', async () => {
      mockStorage.env.get.mockResolvedValue('env-value');
      mockStorage.json.get.mockResolvedValue('json-value');
      
      await manager.deleteConfig('test.key', { isGlobal: false });
      
      expect(mockStorage.env.delete).toHaveBeenCalledWith('test.key', false);
      expect(mockStorage.json.delete).toHaveBeenCalledWith('test.key', false);
    });

    test('should not delete if key not found', async () => {
      mockStorage.env.get.mockResolvedValue(undefined);
      mockStorage.json.get.mockResolvedValue(undefined);
      
      await manager.deleteConfig('test.key', { isGlobal: false });
      
      expect(mockStorage.env.delete).not.toHaveBeenCalled();
      expect(mockStorage.json.delete).not.toHaveBeenCalled();
    });

    test('should distribute after local deletion', async () => {
      mockStorage.env.get.mockResolvedValue('value');
      
      await manager.deleteConfig('test.key', { isGlobal: false });
      
      expect(mockDistributor.distribute).toHaveBeenCalled();
    });

    test('should not distribute after global deletion', async () => {
      mockStorage.env.get.mockResolvedValue('value');
      
      await manager.deleteConfig('test.key', { isGlobal: true });
      
      expect(mockDistributor.distribute).not.toHaveBeenCalled();
    });

    test('should handle undefined options', async () => {
      mockStorage.json.get.mockResolvedValue('value');
      
      await manager.deleteConfig('test.key');
      
      expect(mockStorage.json.get).toHaveBeenCalledWith('test.key', undefined);
      expect(mockDistributor.distribute).toHaveBeenCalled();
    });
  });

  describe('loadEnvironment', () => {
    test('should load environment variables', async () => {
      await manager.loadEnvironment();
      
      expect(mockStorage.env.load).toHaveBeenCalled();
    });
  });

  describe('getAvailableClients', () => {
    test('should return available clients from distributor', async () => {
      const mockClients = [
        { id: 'client1', name: 'Client 1' },
        { id: 'client2', name: 'Client 2' }
      ];
      mockDistributor.getAvailableClients.mockResolvedValue(mockClients);
      
      const clients = await manager.getAvailableClients();
      
      expect(mockDistributor.getAvailableClients).toHaveBeenCalled();
      expect(clients).toEqual(mockClients);
    });
  });

  describe('distributeToClients', () => {
    test('should distribute to specific clients', async () => {
      const clientIds = ['client1', 'client2'];
      
      await manager.distributeToClients(clientIds);
      
      expect(mockDistributor.distributeToClients).toHaveBeenCalledWith(clientIds);
    });
  });
});
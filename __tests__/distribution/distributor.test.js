const Distributor = require('../../lib/distribution/distributor');
const ClientRegistry = require('../../lib/distribution/client-registry');
const BaseClient = require('../../lib/distribution/base-client');
const { DistributionError, ClientError } = require('../../lib/errors');
const fs = require('fs').promises;
const path = require('path');

// Mock dependencies
jest.mock('../../lib/distribution/base-client');
jest.mock('../../lib/storage/storage-manager');
jest.mock('../../lib/utils/path-utils', () => ({
  ensureAbsolute: jest.fn((p) => require('path').resolve(p)),
  getConfigDir: jest.fn((appName) => `/home/test/.config/${appName}`),
  joinPath: jest.fn((...args) => require('path').join(...args))
}));

describe('Distributor', () => {
  let distributor;
  let mockRegistry;
  let mockClient1;
  let mockClient2;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock registry
    mockRegistry = {
      getAvailableClients: jest.fn().mockResolvedValue([
        { id: 'client1', name: 'Client 1', autoLoadEnv: true },
        { id: 'client2', name: 'Client 2', autoLoadEnv: false }
      ])
    };
    
    // Create mock clients
    mockClient1 = {
      isInstalled: jest.fn().mockResolvedValue(true),
      updateConfig: jest.fn().mockResolvedValue()
    };
    
    mockClient2 = {
      isInstalled: jest.fn().mockResolvedValue(true),
      updateConfig: jest.fn().mockResolvedValue()
    };
    
    // Mock BaseClient constructor
    BaseClient.mockImplementation((clientId) => {
      if (clientId === 'client1') return mockClient1;
      if (clientId === 'client2') return mockClient2;
      return null;
    });
    
    distributor = new Distributor(mockRegistry);
  });

  describe('constructor', () => {
    test('should initialize with provided registry', () => {
      expect(distributor.registry).toBe(mockRegistry);
      expect(distributor.clients).toEqual({});
      expect(distributor.initialized).toBe(false);
    });

    test('should create new registry if none provided', () => {
      const distributorNoRegistry = new Distributor();
      expect(distributorNoRegistry.registry).toBeDefined();
    });
  });

  describe('initializeClients', () => {
    test('should initialize clients from registry', async () => {
      await distributor.initializeClients();
      
      expect(mockRegistry.getAvailableClients).toHaveBeenCalledTimes(1);
      expect(BaseClient).toHaveBeenCalledWith('client1', mockRegistry);
      expect(BaseClient).toHaveBeenCalledWith('client2', mockRegistry);
      expect(distributor.clients).toEqual({
        client1: mockClient1,
        client2: mockClient2
      });
      expect(distributor.initialized).toBe(true);
    });

    test('should only initialize once', async () => {
      await distributor.initializeClients();
      await distributor.initializeClients();
      await distributor.initializeClients();
      
      expect(mockRegistry.getAvailableClients).toHaveBeenCalledTimes(1);
    });
  });

  describe('distribute', () => {
    test('should distribute config to all installed clients', async () => {
      const mockConfig = {
        serverName: 'test-server',
        settings: { port: 3000 },
        environment: { API_KEY: 'test' }
      };
      
      jest.spyOn(distributor, 'gatherConfiguration').mockResolvedValue(mockConfig);
      
      await distributor.distribute();
      
      expect(mockClient1.isInstalled).toHaveBeenCalled();
      expect(mockClient1.updateConfig).toHaveBeenCalledWith(mockConfig);
      expect(mockClient2.isInstalled).toHaveBeenCalled();
      expect(mockClient2.updateConfig).toHaveBeenCalledWith(mockConfig);
    });

    test('should skip uninstalled clients', async () => {
      mockClient1.isInstalled.mockResolvedValue(false);
      
      jest.spyOn(distributor, 'gatherConfiguration').mockResolvedValue({});
      
      await distributor.distribute();
      
      expect(mockClient1.updateConfig).not.toHaveBeenCalled();
      expect(mockClient2.updateConfig).toHaveBeenCalled();
    });

    test('should throw DistributionError if any client fails', async () => {
      mockClient1.updateConfig.mockRejectedValue(new Error('Client 1 error'));
      mockClient2.updateConfig.mockRejectedValue(new Error('Client 2 error'));
      
      jest.spyOn(distributor, 'gatherConfiguration').mockResolvedValue({});
      
      await expect(distributor.distribute()).rejects.toThrow(DistributionError);
    });

    test('should include error details in DistributionError', async () => {
      const error1 = new Error('Client 1 error');
      mockClient1.updateConfig.mockRejectedValue(error1);
      
      jest.spyOn(distributor, 'gatherConfiguration').mockResolvedValue({});
      
      try {
        await distributor.distribute();
      } catch (error) {
        expect(error).toBeInstanceOf(DistributionError);
        expect(error.message).toContain('Failed to distribute configuration to 1 client(s)');
        expect(error.clients).toEqual(['client1']);
        expect(error.details.errors).toHaveLength(1);
        expect(error.details.errors[0]).toEqual({ clientId: 'client1', error: error1 });
      }
    });
  });

  describe('distributeToClients', () => {
    test('should distribute to specific clients', async () => {
      const mockConfig = { serverName: 'test' };
      jest.spyOn(distributor, 'gatherConfiguration').mockResolvedValue(mockConfig);
      
      await distributor.distributeToClients(['client1']);
      
      expect(mockClient1.updateConfig).toHaveBeenCalledWith(mockConfig);
      expect(mockClient2.updateConfig).not.toHaveBeenCalled();
    });

    test('should throw ClientError for unknown clients', async () => {
      jest.spyOn(distributor, 'gatherConfiguration').mockResolvedValue({});
      
      await expect(distributor.distributeToClients(['unknown1', 'unknown2']))
        .rejects.toThrow(ClientError);
    });

    test('should throw ClientError with details for unknown clients', async () => {
      jest.spyOn(distributor, 'gatherConfiguration').mockResolvedValue({});
      
      try {
        await distributor.distributeToClients(['unknown', 'client1']);
      } catch (error) {
        expect(error).toBeInstanceOf(ClientError);
        expect(error.message).toContain('Unknown client(s): unknown');
        expect(error.clientId).toBe('unknown');
      }
    });

    test('should throw DistributionError if distribution fails', async () => {
      mockClient1.updateConfig.mockRejectedValue(new Error('Update failed'));
      jest.spyOn(distributor, 'gatherConfiguration').mockResolvedValue({});
      
      await expect(distributor.distributeToClients(['client1']))
        .rejects.toThrow(DistributionError);
    });

    test('should handle mixed unknown and failed clients', async () => {
      // First ensure clients are initialized
      await distributor.initializeClients();
      
      // Add a third client that will fail
      distributor.clients['client3'] = {
        updateConfig: jest.fn().mockRejectedValue(new Error('Client 3 error'))
      };
      
      jest.spyOn(distributor, 'gatherConfiguration').mockResolvedValue({});
      
      // Should throw ClientError for unknown client first
      await expect(distributor.distributeToClients(['unknown', 'client3']))
        .rejects.toThrow(ClientError);
    });
  });

  describe('gatherConfiguration', () => {
    test('should gather configuration from storage', async () => {
      // Mock fs.readFile for package.json
      jest.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify({
        name: 'test-package-name'
      }));
      
      // Create a new distributor to test storage initialization
      const newDistributor = new Distributor(mockRegistry);
      
      // Mock StorageManager
      const StorageManager = require('../../lib/storage/storage-manager');
      StorageManager.mockImplementation(() => ({
        json: { getAll: jest.fn().mockResolvedValue({ jsonKey: 'jsonValue' }) },
        env: { getAll: jest.fn().mockResolvedValue({ ENV_KEY: 'envValue' }) }
      }));
      
      const config = await newDistributor.gatherConfiguration();
      
      expect(config).toEqual({
        serverName: 'test-package-name',
        settings: { jsonKey: 'jsonValue' },
        environment: { ENV_KEY: 'envValue' }
      });
    });

    test('should use default server name if package.json not found', async () => {
      jest.spyOn(fs, 'readFile').mockRejectedValue(new Error('ENOENT'));
      
      const StorageManager = require('../../lib/storage/storage-manager');
      StorageManager.mockImplementation(() => ({
        json: { getAll: jest.fn().mockResolvedValue({}) },
        env: { getAll: jest.fn().mockResolvedValue({}) }
      }));
      
      const config = await distributor.gatherConfiguration();
      
      expect(config.serverName).toBe('mcp-server');
    });

    test('should handle invalid package.json', async () => {
      jest.spyOn(fs, 'readFile').mockResolvedValue('invalid json');
      
      const StorageManager = require('../../lib/storage/storage-manager');
      StorageManager.mockImplementation(() => ({
        json: { getAll: jest.fn().mockResolvedValue({}) },
        env: { getAll: jest.fn().mockResolvedValue({}) }
      }));
      
      const config = await distributor.gatherConfiguration();
      
      expect(config.serverName).toBe('mcp-server');
    });

    test('should use package name from package.json', async () => {
      jest.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify({
        name: 'my-custom-server',
        version: '1.0.0'
      }));
      
      const StorageManager = require('../../lib/storage/storage-manager');
      StorageManager.mockImplementation(() => ({
        json: { getAll: jest.fn().mockResolvedValue({}) },
        env: { getAll: jest.fn().mockResolvedValue({}) }
      }));
      
      const config = await distributor.gatherConfiguration();
      
      expect(config.serverName).toBe('my-custom-server');
    });
  });

  describe('getAvailableClients', () => {
    test('should return available clients from registry', async () => {
      const clients = await distributor.getAvailableClients();
      
      expect(mockRegistry.getAvailableClients).toHaveBeenCalled();
      expect(clients).toEqual([
        { id: 'client1', name: 'Client 1', autoLoadEnv: true },
        { id: 'client2', name: 'Client 2', autoLoadEnv: false }
      ]);
    });
  });
});
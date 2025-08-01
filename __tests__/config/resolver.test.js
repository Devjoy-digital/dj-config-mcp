const ConfigResolver = require('../../lib/config/resolver');
const StorageManager = require('../../lib/storage/storage-manager');
const ClientRegistry = require('../../lib/distribution/client-registry');

// Mock dependencies
jest.mock('../../lib/storage/storage-manager');
jest.mock('../../lib/distribution/client-registry');

describe('ConfigResolver', () => {
  let resolver;
  let mockStorage;
  let mockRegistry;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock storage
    mockStorage = {
      env: {
        get: jest.fn(),
        getAllKeys: jest.fn(),
        getStoragePath: jest.fn()
      },
      json: {
        get: jest.fn(),
        getAllKeys: jest.fn(),
        getStoragePath: jest.fn()
      }
    };
    
    // Create mock registry
    mockRegistry = {};
    
    resolver = new ConfigResolver(mockStorage, mockRegistry);
  });

  describe('constructor', () => {
    test('should initialize with storage and registry', () => {
      expect(resolver.storage).toBe(mockStorage);
      expect(resolver.clientRegistry).toBe(mockRegistry);
    });

    test('should create new registry if none provided', () => {
      ClientRegistry.mockImplementation(() => ({}));
      
      const resolverNoRegistry = new ConfigResolver(mockStorage);
      expect(resolverNoRegistry.clientRegistry).toBeDefined();
      expect(ClientRegistry).toHaveBeenCalled();
    });
  });

  describe('resolve', () => {
    beforeEach(() => {
      mockStorage.env.getStoragePath.mockReturnValue('/path/to/.env');
      mockStorage.json.getStoragePath.mockReturnValue('/path/to/config.json');
    });

    test('should prioritize local environment variables', async () => {
      mockStorage.env.get.mockImplementation((key, isGlobal) => {
        if (!isGlobal && key === 'test.key') return 'env-value';
        return undefined;
      });
      mockStorage.json.get.mockResolvedValue(undefined);
      
      const result = await resolver.resolve('test.key');
      
      expect(result).toEqual({
        key: 'test.key',
        value: 'env-value',
        source: 'Environment Variable',
        path: '/path/to/.env'
      });
    });

    test('should use local config if no env var', async () => {
      mockStorage.env.get.mockResolvedValue(undefined);
      mockStorage.json.get.mockImplementation((key, isGlobal) => {
        if (!isGlobal && key === 'test.key') return 'json-value';
        return undefined;
      });
      
      const result = await resolver.resolve('test.key');
      
      expect(result).toEqual({
        key: 'test.key',
        value: 'json-value',
        source: 'Local Config',
        path: '/path/to/config.json'
      });
    });

    test('should use global env if no local values', async () => {
      mockStorage.env.get.mockImplementation((key, isGlobal) => {
        if (isGlobal && key === 'test.key') return 'global-env-value';
        return undefined;
      });
      mockStorage.json.get.mockResolvedValue(undefined);
      
      const result = await resolver.resolve('test.key');
      
      expect(result).toEqual({
        key: 'test.key',
        value: 'global-env-value',
        source: 'Global Environment Variable',
        path: '/path/to/.env'
      });
    });

    test('should use global config as last resort', async () => {
      mockStorage.env.get.mockResolvedValue(undefined);
      mockStorage.json.get.mockImplementation((key, isGlobal) => {
        if (isGlobal && key === 'test.key') return 'global-json-value';
        return undefined;
      });
      
      const result = await resolver.resolve('test.key');
      
      expect(result).toEqual({
        key: 'test.key',
        value: 'global-json-value',
        source: 'Global Config',
        path: '/path/to/config.json'
      });
    });

    test('should return null if key not found anywhere', async () => {
      mockStorage.env.get.mockResolvedValue(undefined);
      mockStorage.json.get.mockResolvedValue(undefined);
      
      const result = await resolver.resolve('nonexistent.key');
      
      expect(result).toBeNull();
    });

    test('should check all sources in correct order', async () => {
      await resolver.resolve('test.key');
      
      // Check that all sources were queried in order
      expect(mockStorage.env.get).toHaveBeenCalledWith('test.key', false);
      expect(mockStorage.json.get).toHaveBeenCalledWith('test.key', false);
      expect(mockStorage.env.get).toHaveBeenCalledWith('test.key', true);
      expect(mockStorage.json.get).toHaveBeenCalledWith('test.key', true);
    });
  });

  describe('resolveAll', () => {
    beforeEach(() => {
      mockStorage.env.getStoragePath.mockReturnValue('/path/to/.env');
      mockStorage.json.getStoragePath.mockReturnValue('/path/to/config.json');
    });

    test('should resolve all keys from all sources', async () => {
      // Mock keys
      mockStorage.env.getAllKeys.mockImplementation((isGlobal) => {
        if (isGlobal) return Promise.resolve(['GLOBAL_ENV_KEY']);
        return Promise.resolve(['LOCAL_ENV_KEY']);
      });
      
      mockStorage.json.getAllKeys.mockImplementation((isGlobal) => {
        if (isGlobal) return Promise.resolve(['global.json.key']);
        return Promise.resolve(['local.json.key']);
      });
      
      // Mock values
      mockStorage.env.get.mockImplementation((key, isGlobal) => {
        if (!isGlobal && key === 'LOCAL_ENV_KEY') return 'local-env-value';
        if (isGlobal && key === 'GLOBAL_ENV_KEY') return 'global-env-value';
        return undefined;
      });
      
      mockStorage.json.get.mockImplementation((key, isGlobal) => {
        if (!isGlobal && key === 'local.json.key') return 'local-json-value';
        if (isGlobal && key === 'global.json.key') return 'global-json-value';
        return undefined;
      });
      
      const results = await resolver.resolveAll();
      
      expect(results).toHaveLength(4);
      expect(results).toContainEqual({
        key: 'LOCAL_ENV_KEY',
        value: 'local-env-value',
        source: 'Environment Variable',
        path: '/path/to/.env'
      });
      expect(results).toContainEqual({
        key: 'local.json.key',
        value: 'local-json-value',
        source: 'Local Config',
        path: '/path/to/config.json'
      });
      expect(results).toContainEqual({
        key: 'GLOBAL_ENV_KEY',
        value: 'global-env-value',
        source: 'Global Environment Variable',
        path: '/path/to/.env'
      });
      expect(results).toContainEqual({
        key: 'global.json.key',
        value: 'global-json-value',
        source: 'Global Config',
        path: '/path/to/config.json'
      });
    });

    test('should deduplicate keys across sources', async () => {
      // Same key in multiple sources
      mockStorage.env.getAllKeys.mockResolvedValue(['SHARED_KEY']);
      mockStorage.json.getAllKeys.mockResolvedValue(['SHARED_KEY']);
      
      // Local env takes precedence
      mockStorage.env.get.mockImplementation((key, isGlobal) => {
        if (!isGlobal && key === 'SHARED_KEY') return 'env-value';
        return undefined;
      });
      
      mockStorage.json.get.mockImplementation((key, isGlobal) => {
        if (!isGlobal && key === 'SHARED_KEY') return 'json-value';
        return undefined;
      });
      
      const results = await resolver.resolveAll();
      
      // Should only have one entry for SHARED_KEY
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        key: 'SHARED_KEY',
        value: 'env-value',
        source: 'Environment Variable',
        path: '/path/to/.env'
      });
    });

    test('should handle empty configuration', async () => {
      mockStorage.env.getAllKeys.mockResolvedValue([]);
      mockStorage.json.getAllKeys.mockResolvedValue([]);
      
      const results = await resolver.resolveAll();
      
      expect(results).toEqual([]);
    });

    test('should filter out null results', async () => {
      mockStorage.env.getAllKeys.mockResolvedValue(['KEY1', 'KEY2']);
      mockStorage.json.getAllKeys.mockResolvedValue([]);
      
      // KEY1 has value, KEY2 doesn't
      mockStorage.env.get.mockImplementation((key) => {
        if (key === 'KEY1') return 'value1';
        return undefined;
      });
      mockStorage.json.get.mockResolvedValue(undefined);
      
      const results = await resolver.resolveAll();
      
      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('KEY1');
    });

    test('should combine all sources correctly', async () => {
      // Set up different keys in each source
      mockStorage.env.getAllKeys.mockImplementation((isGlobal) => {
        return isGlobal ? Promise.resolve(['G_ENV1', 'G_ENV2']) : Promise.resolve(['L_ENV1']);
      });
      
      mockStorage.json.getAllKeys.mockImplementation((isGlobal) => {
        return isGlobal ? Promise.resolve(['g.json1']) : Promise.resolve(['l.json1', 'l.json2']);
      });
      
      // Mock all values
      mockStorage.env.get.mockImplementation((key, isGlobal) => {
        const values = {
          'L_ENV1': 'local-env-1',
          'G_ENV1': 'global-env-1',
          'G_ENV2': 'global-env-2'
        };
        if ((isGlobal && key.startsWith('G_')) || (!isGlobal && key.startsWith('L_'))) {
          return values[key];
        }
        return undefined;
      });
      
      mockStorage.json.get.mockImplementation((key, isGlobal) => {
        const values = {
          'l.json1': 'local-json-1',
          'l.json2': 'local-json-2',
          'g.json1': 'global-json-1'
        };
        if ((isGlobal && key.startsWith('g.')) || (!isGlobal && key.startsWith('l.'))) {
          return values[key];
        }
        return undefined;
      });
      
      const results = await resolver.resolveAll();
      
      expect(results).toHaveLength(6);
      
      // Check that all keys are present
      const keys = results.map(r => r.key);
      expect(keys).toContain('L_ENV1');
      expect(keys).toContain('G_ENV1');
      expect(keys).toContain('G_ENV2');
      expect(keys).toContain('l.json1');
      expect(keys).toContain('l.json2');
      expect(keys).toContain('g.json1');
    });
  });
});
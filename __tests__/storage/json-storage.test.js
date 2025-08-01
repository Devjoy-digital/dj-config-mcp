const JsonStorage = require('../../lib/storage/json-storage');
const { StorageError, FileSystemError } = require('../../lib/errors');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Mock PathUtils
jest.mock('../../lib/utils/path-utils', () => ({
  getConfigDir: jest.fn((appName) => `/home/test/.config/${appName}`),
  joinPath: jest.fn((...args) => require('path').join(...args))
}));

describe('JsonStorage', () => {
  let storage;
  let tempDir;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), 'json-storage-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
    process.chdir(tempDir);
    
    storage = new JsonStorage('test-server');
  });

  afterEach(async () => {
    process.chdir(os.tmpdir());
    await fs.rm(tempDir, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with server name', () => {
      expect(storage.serverName).toBe('test-server');
    });

    test('should work without server name', () => {
      const storageNoServer = new JsonStorage();
      expect(storageNoServer.serverName).toBe(null);
    });
  });

  describe('getLibraryConfigDir', () => {
    test('should use PathUtils to get config directory', () => {
      const PathUtils = require('../../lib/utils/path-utils');
      
      const result = storage.getLibraryConfigDir();
      
      expect(PathUtils.getConfigDir).toHaveBeenCalledWith('devjoy-digital/config-mcp');
      expect(result).toBe('/home/test/.config/devjoy-digital/config-mcp');
    });
  });

  describe('getStoragePath', () => {
    test('should return global path when isGlobal is true', () => {
      const PathUtils = require('../../lib/utils/path-utils');
      
      const result = storage.getStoragePath(true);
      
      expect(PathUtils.joinPath).toHaveBeenCalled();
      expect(result).toContain('global.json');
    });

    test('should return local path when isGlobal is false', () => {
      const result = storage.getStoragePath(false);
      
      expect(result).toBe(path.join('.', 'devjoy-digital', 'test-server', 'default.json'));
    });

    test('should use default server name if not provided', () => {
      const storageNoServer = new JsonStorage();
      const result = storageNoServer.getStoragePath(false);
      
      expect(result).toContain('dj-config-mcp');
      expect(result).toContain('default.json');
    });
  });

  describe('read', () => {
    test('should read and parse JSON file', async () => {
      const testData = { key: 'value', nested: { data: 123 } };
      const filePath = path.join(tempDir, 'test.json');
      await fs.writeFile(filePath, JSON.stringify(testData));
      
      const result = await storage.read(filePath);
      
      expect(result).toEqual(testData);
    });

    test('should return null for non-existent file', async () => {
      const result = await storage.read('non-existent.json');
      expect(result).toBe(null);
    });

    test('should throw StorageError for invalid JSON', async () => {
      const filePath = path.join(tempDir, 'invalid.json');
      await fs.writeFile(filePath, 'invalid json {');
      
      await expect(storage.read(filePath))
        .rejects.toThrow(StorageError);
    });

    test('should throw FileSystemError for other read errors', async () => {
      const filePath = path.join(tempDir, 'dir');
      await fs.mkdir(filePath);
      
      await expect(storage.read(filePath))
        .rejects.toThrow(FileSystemError);
    });
  });

  describe('write', () => {
    test('should write JSON with proper formatting', async () => {
      const testData = { key: 'value', nested: { data: 123 } };
      const filePath = path.join(tempDir, 'output.json');
      
      await storage.write(filePath, testData);
      
      const content = await fs.readFile(filePath, 'utf8');
      expect(JSON.parse(content)).toEqual(testData);
      expect(content).toContain('\n'); // Check formatting
    });

    test('should create directory if needed', async () => {
      const filePath = path.join(tempDir, 'subdir', 'output.json');
      
      await storage.write(filePath, { test: true });
      
      const content = await fs.readFile(filePath, 'utf8');
      expect(JSON.parse(content)).toEqual({ test: true });
    });

    test('should throw FileSystemError on write failure', async () => {
      // Create a file and make it read-only
      const filePath = path.join(tempDir, 'readonly.json');
      await fs.writeFile(filePath, '{}');
      
      // Mock writeFile to throw
      jest.spyOn(fs, 'writeFile').mockRejectedValueOnce(new Error('Write failed'));
      
      await expect(storage.write(filePath, {}))
        .rejects.toThrow(FileSystemError);
    });
  });

  describe('set', () => {
    test('should set simple value', async () => {
      await storage.set('key', 'value', false);
      
      const configPath = storage.getStoragePath(false);
      const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
      
      expect(config.key).toBe('value');
    });

    test('should set nested value using dot notation', async () => {
      await storage.set('api.endpoint', 'https://api.example.com', false);
      await storage.set('api.key', 'secret', false);
      
      const configPath = storage.getStoragePath(false);
      const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
      
      expect(config.api.endpoint).toBe('https://api.example.com');
      expect(config.api.key).toBe('secret');
    });

    test('should overwrite existing values', async () => {
      await storage.set('key', 'value1', false);
      await storage.set('key', 'value2', false);
      
      const configPath = storage.getStoragePath(false);
      const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
      
      expect(config.key).toBe('value2');
    });

    test('should handle deeply nested paths', async () => {
      await storage.set('a.b.c.d.e', 'deep', false);
      
      const configPath = storage.getStoragePath(false);
      const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
      
      expect(config.a.b.c.d.e).toBe('deep');
    });
  });

  describe('get', () => {
    beforeEach(async () => {
      const testData = {
        simple: 'value',
        nested: {
          level1: {
            level2: 'deep value'
          }
        },
        array: [1, 2, 3]
      };
      
      const configPath = storage.getStoragePath(false);
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, JSON.stringify(testData));
    });

    test('should get simple value', async () => {
      const value = await storage.get('simple', false);
      expect(value).toBe('value');
    });

    test('should get nested value', async () => {
      const value = await storage.get('nested.level1.level2', false);
      expect(value).toBe('deep value');
    });

    test('should return undefined for non-existent key', async () => {
      const value = await storage.get('nonexistent', false);
      expect(value).toBeUndefined();
    });

    test('should return undefined for non-existent nested key', async () => {
      const value = await storage.get('nested.nonexistent.key', false);
      expect(value).toBeUndefined();
    });

    test('should handle array access', async () => {
      const value = await storage.get('array', false);
      expect(value).toEqual([1, 2, 3]);
    });
  });

  describe('delete', () => {
    beforeEach(async () => {
      const testData = {
        key1: 'value1',
        key2: 'value2',
        nested: {
          key3: 'value3',
          key4: 'value4'
        }
      };
      
      const configPath = storage.getStoragePath(false);
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, JSON.stringify(testData));
    });

    test('should delete simple key', async () => {
      await storage.delete('key1', false);
      
      const configPath = storage.getStoragePath(false);
      const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
      
      expect(config.key1).toBeUndefined();
      expect(config.key2).toBe('value2');
    });

    test('should delete nested key', async () => {
      await storage.delete('nested.key3', false);
      
      const configPath = storage.getStoragePath(false);
      const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
      
      expect(config.nested.key3).toBeUndefined();
      expect(config.nested.key4).toBe('value4');
    });

    test('should handle non-existent file', async () => {
      const emptyStorage = new JsonStorage('empty');
      await expect(emptyStorage.delete('key', false)).resolves.not.toThrow();
    });

    test('should handle non-existent key', async () => {
      await expect(storage.delete('nonexistent', false)).resolves.not.toThrow();
    });
  });

  describe('getAllKeys', () => {
    test('should return all keys including nested', async () => {
      const testData = {
        simple: 'value',
        nested: {
          level1: 'value1',
          deep: {
            level2: 'value2'
          }
        },
        array: [1, 2, 3]
      };
      
      const configPath = storage.getStoragePath(false);
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, JSON.stringify(testData));
      
      const keys = await storage.getAllKeys(false);
      
      expect(keys).toContain('simple');
      expect(keys).toContain('nested.level1');
      expect(keys).toContain('nested.deep.level2');
      expect(keys).toContain('array');
    });

    test('should return empty array for non-existent file', async () => {
      const keys = await storage.getAllKeys(false);
      expect(keys).toEqual([]);
    });
  });

  describe('getAll', () => {
    test('should return all configuration', async () => {
      const testData = {
        key1: 'value1',
        key2: { nested: 'value2' }
      };
      
      const configPath = storage.getStoragePath(false);
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, JSON.stringify(testData));
      
      const all = await storage.getAll(false);
      
      expect(all).toEqual(testData);
    });

    test('should return empty object for non-existent file', async () => {
      const all = await storage.getAll(false);
      expect(all).toEqual({});
    });
  });

  describe('nested value helpers', () => {
    test('setNestedValue should create nested objects', () => {
      const obj = {};
      storage.setNestedValue(obj, 'a.b.c', 'value');
      
      expect(obj).toEqual({
        a: { b: { c: 'value' } }
      });
    });

    test('setNestedValue should overwrite non-object values', () => {
      const obj = { a: 'string' };
      storage.setNestedValue(obj, 'a.b.c', 'value');
      
      expect(obj).toEqual({
        a: { b: { c: 'value' } }
      });
    });

    test('getNestedValue should retrieve nested values', () => {
      const obj = { a: { b: { c: 'value' } } };
      
      expect(storage.getNestedValue(obj, 'a.b.c')).toBe('value');
      expect(storage.getNestedValue(obj, 'a.b')).toEqual({ c: 'value' });
    });

    test('getNestedValue should return undefined for missing paths', () => {
      const obj = { a: { b: 'value' } };
      
      expect(storage.getNestedValue(obj, 'a.b.c')).toBeUndefined();
      expect(storage.getNestedValue(obj, 'x.y.z')).toBeUndefined();
    });

    test('deleteNestedValue should remove nested values', () => {
      const obj = { a: { b: { c: 'value', d: 'keep' } } };
      storage.deleteNestedValue(obj, 'a.b.c');
      
      expect(obj).toEqual({
        a: { b: { d: 'keep' } }
      });
    });

    test('deleteNestedValue should handle missing paths gracefully', () => {
      const obj = { a: 'value' };
      storage.deleteNestedValue(obj, 'a.b.c');
      
      expect(obj).toEqual({ a: 'value' });
    });

    test('extractKeys should handle complex objects', () => {
      const obj = {
        simple: 'value',
        nested: {
          a: 1,
          b: { c: 2 }
        },
        array: [1, 2],
        null: null,
        object: {}
      };
      
      const keys = storage.extractKeys(obj);
      
      expect(keys).toContain('simple');
      expect(keys).toContain('nested.a');
      expect(keys).toContain('nested.b.c');
      expect(keys).toContain('array');
      expect(keys).toContain('null');
      expect(keys.filter(k => k.startsWith('object')).length).toBe(0);
    });
  });
});
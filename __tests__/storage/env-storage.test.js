const EnvStorage = require('../../lib/storage/env-storage');
const { FileSystemError } = require('../../lib/errors');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Mock PathUtils
jest.mock('../../lib/utils/path-utils', () => ({
  getConfigDir: jest.fn((appName) => `/home/test/.config/${appName}`),
  joinPath: jest.fn((...args) => require('path').join(...args))
}));

describe('EnvStorage', () => {
  let storage;
  let tempDir;
  const originalPlatform = process.platform;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), 'env-storage-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
    process.chdir(tempDir);
    
    storage = new EnvStorage('test-server');
    
    // Clear environment
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('TEST_')) {
        delete process.env[key];
      }
    });
  });

  afterEach(async () => {
    process.chdir(os.tmpdir());
    await fs.rm(tempDir, { recursive: true, force: true });
    jest.clearAllMocks();
    
    Object.defineProperty(process, 'platform', {
      value: originalPlatform
    });
  });

  describe('constructor', () => {
    test('should initialize with server name', () => {
      expect(storage.serverName).toBe('test-server');
    });

    test('should work without server name', () => {
      const storageNoServer = new EnvStorage();
      expect(storageNoServer.serverName).toBe(null);
    });
  });

  describe('getStoragePath', () => {
    test('should return global path when isGlobal is true', () => {
      const result = storage.getStoragePath(true);
      expect(result).toContain('.env');
      expect(result).toContain('test-server');
    });

    test('should return local path when isGlobal is false', () => {
      const result = storage.getStoragePath(false);
      expect(result).toBe(path.join('.', 'devjoy-digital', 'test-server', '.env'));
    });
  });

  describe('read', () => {
    test('should read env file content', async () => {
      const envContent = 'KEY1=value1\nKEY2=value2';
      const filePath = path.join(tempDir, '.env');
      await fs.writeFile(filePath, envContent);
      
      const result = await storage.read(filePath);
      expect(result).toBe(envContent);
    });

    test('should return empty string for non-existent file', async () => {
      const result = await storage.read('non-existent.env');
      expect(result).toBe('');
    });

    test('should throw FileSystemError for read errors', async () => {
      const dirPath = path.join(tempDir, 'dir');
      await fs.mkdir(dirPath);
      
      await expect(storage.read(dirPath))
        .rejects.toThrow(FileSystemError);
    });
  });

  describe('write', () => {
    test('should write env file with content', async () => {
      const envContent = 'KEY1=value1\nKEY2=value2';
      const filePath = path.join(tempDir, '.env');
      
      await storage.write(filePath, envContent);
      
      const written = await fs.readFile(filePath, 'utf8');
      expect(written).toBe(envContent);
    });

    test('should create directory if needed', async () => {
      const filePath = path.join(tempDir, 'subdir', '.env');
      
      await storage.write(filePath, 'TEST=value');
      
      const written = await fs.readFile(filePath, 'utf8');
      expect(written).toBe('TEST=value');
    });

    test('should set secure permissions on Unix', async () => {
      // Skip on Windows as permissions work differently
      if (process.platform === 'win32') {
        return;
      }
      
      Object.defineProperty(process, 'platform', {
        value: 'linux'
      });
      
      const filePath = path.join(tempDir, '.env');
      await storage.write(filePath, 'TEST=value');
      
      const stats = await fs.stat(filePath);
      // Check that only owner has read/write permissions (0o600)
      expect(stats.mode & 0o777).toBe(0o600);
    });

    test('should skip chmod on Windows', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32'
      });
      
      jest.spyOn(fs, 'chmod');
      
      const filePath = path.join(tempDir, '.env');
      await storage.write(filePath, 'TEST=value');
      
      expect(fs.chmod).not.toHaveBeenCalled();
    });

    test('should throw FileSystemError on write failure', async () => {
      jest.spyOn(fs, 'writeFile').mockRejectedValueOnce(new Error('Write failed'));
      
      await expect(storage.write('test.env', 'content'))
        .rejects.toThrow(FileSystemError);
    });
  });

  describe('parse', () => {
    test('should parse simple env content', () => {
      const content = 'KEY1=value1\nKEY2=value2\nKEY3=value3';
      const result = storage.parse(content);
      
      expect(result).toEqual({
        KEY1: 'value1',
        KEY2: 'value2',
        KEY3: 'value3'
      });
    });

    test('should handle empty content', () => {
      expect(storage.parse('')).toEqual({});
      expect(storage.parse(Buffer.from(''))).toEqual({});
    });

    test('should handle comments and empty lines', () => {
      const content = `
# This is a comment
KEY1=value1

# Another comment
KEY2=value2
      `.trim();
      
      const result = storage.parse(content);
      expect(result).toEqual({
        KEY1: 'value1',
        KEY2: 'value2'
      });
    });

    test('should handle values with equals signs', () => {
      const content = 'URL=https://example.com?key=value&foo=bar';
      const result = storage.parse(content);
      
      expect(result).toEqual({
        URL: 'https://example.com?key=value&foo=bar'
      });
    });

    test('should handle quoted values', () => {
      const content = 'KEY1="value with spaces"\nKEY2=\'single quotes\'';
      const result = storage.parse(content);
      
      expect(result).toEqual({
        KEY1: 'value with spaces',
        KEY2: 'single quotes'
      });
    });
  });

  describe('stringify', () => {
    test('should format env object to string', () => {
      const env = {
        KEY1: 'value1',
        KEY2: 'value2'
      };
      
      const result = storage.stringify(env);
      expect(result).toContain('KEY1=value1');
      expect(result).toContain('KEY2=value2');
      expect(result).toContain('# Generated by dj-config-mcp');
    });

    test('should handle empty object', () => {
      const result = storage.stringify({});
      expect(result).toContain('# Generated by dj-config-mcp');
      expect(result).toContain('# DO NOT COMMIT THIS FILE TO VERSION CONTROL');
    });

    test('should handle values with spaces', () => {
      const env = {
        KEY1: 'value with spaces'
      };
      
      const result = storage.stringify(env);
      expect(result).toContain('KEY1="value with spaces"');
    });

    test('should convert non-string values', () => {
      const env = {
        STRING: 'text',
        NUMBER: 123,
        BOOLEAN: true
      };
      
      const result = storage.stringify(env);
      expect(result).toContain('STRING=text');
      expect(result).toContain('NUMBER=123');
      expect(result).toContain('BOOLEAN=true');
    });
  });

  describe('set', () => {
    test('should set environment variable', async () => {
      await storage.set('TEST_KEY', 'test value', false);
      
      const envPath = storage.getStoragePath(false);
      const content = await fs.readFile(envPath, 'utf8');
      
      expect(content).toContain('TEST_KEY="test value"');
    });

    test('should convert dot notation to underscore', async () => {
      await storage.set('test.nested.key', 'value', false);
      
      const envPath = storage.getStoragePath(false);
      const content = await fs.readFile(envPath, 'utf8');
      
      expect(content).toContain('TEST_NESTED_KEY=value');
    });

    test('should update existing value', async () => {
      await storage.set('KEY', 'value1', false);
      await storage.set('KEY', 'value2', false);
      
      const envPath = storage.getStoragePath(false);
      const content = await fs.readFile(envPath, 'utf8');
      
      expect(content).toContain('KEY=value2');
      expect(content).not.toContain('KEY=value1');
    });

    test('should preserve other values', async () => {
      await storage.set('KEY1', 'value1', false);
      await storage.set('KEY2', 'value2', false);
      await storage.set('KEY3', 'value3', false);
      
      const envPath = storage.getStoragePath(false);
      const content = await fs.readFile(envPath, 'utf8');
      
      expect(content).toContain('KEY1=value1');
      expect(content).toContain('KEY2=value2');
      expect(content).toContain('KEY3=value3');
    });
  });

  describe('get', () => {
    beforeEach(async () => {
      const envPath = storage.getStoragePath(false);
      await fs.mkdir(path.dirname(envPath), { recursive: true });
      await fs.writeFile(envPath, 'KEY1=value1\nTEST_KEY=test value\nNESTED_KEY=nested');
    });

    test('should get environment variable', async () => {
      const value = await storage.get('KEY1', false);
      expect(value).toBe('value1');
    });

    test('should convert dot notation when getting', async () => {
      const value = await storage.get('test.key', false);
      expect(value).toBe('test value');
    });

    test('should return undefined for non-existent key', async () => {
      const value = await storage.get('NONEXISTENT', false);
      expect(value).toBeUndefined();
    });

    test('should handle nested key format', async () => {
      const value = await storage.get('nested.key', false);
      expect(value).toBe('nested');
    });
  });

  describe('delete', () => {
    beforeEach(async () => {
      const envPath = storage.getStoragePath(false);
      await fs.mkdir(path.dirname(envPath), { recursive: true });
      await fs.writeFile(envPath, 'KEY1=value1\nKEY2=value2\nKEY3=value3');
    });

    test('should delete environment variable', async () => {
      await storage.delete('KEY2', false);
      
      const envPath = storage.getStoragePath(false);
      const content = await fs.readFile(envPath, 'utf8');
      
      expect(content).toContain('KEY1=value1');
      expect(content).not.toContain('KEY2=value2');
      expect(content).toContain('KEY3=value3');
    });

    test('should handle dot notation when deleting', async () => {
      await fs.writeFile(storage.getStoragePath(false), 'TEST_NESTED_KEY=value');
      
      await storage.delete('test.nested.key', false);
      
      const content = await fs.readFile(storage.getStoragePath(false), 'utf8');
      // After deleting the only key, file should contain just the header comments
      expect(content).toContain('# Generated by dj-config-mcp');
      expect(content).not.toContain('TEST_NESTED_KEY=value');
    });

    test('should handle non-existent file', async () => {
      const emptyStorage = new EnvStorage('empty');
      await expect(emptyStorage.delete('KEY', false)).resolves.not.toThrow();
    });
  });

  describe('getAllKeys', () => {
    test('should return all environment variable keys', async () => {
      const envPath = storage.getStoragePath(false);
      await fs.mkdir(path.dirname(envPath), { recursive: true });
      await fs.writeFile(envPath, 'KEY1=value1\nKEY2=value2\nTEST_NESTED_KEY=value3');
      
      const keys = await storage.getAllKeys(false);
      
      // Keys are returned in dot notation (lowercase)
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('test.nested.key');
    });

    test('should return empty array for non-existent file', async () => {
      const keys = await storage.getAllKeys(false);
      expect(keys).toEqual([]);
    });
  });

  describe('getAll', () => {
    test('should return all environment variables', async () => {
      const envPath = storage.getStoragePath(false);
      await fs.mkdir(path.dirname(envPath), { recursive: true });
      await fs.writeFile(envPath, 'KEY1=value1\nKEY2=value2');
      
      const all = await storage.getAll(false);
      
      expect(all).toEqual({
        KEY1: 'value1',
        KEY2: 'value2'
      });
    });

    test('should return empty object for non-existent file', async () => {
      const all = await storage.getAll(false);
      expect(all).toEqual({});
    });
  });

  describe('load', () => {
    test('should load environment variables into process.env', async () => {
      const envPath = storage.getStoragePath(false);
      await fs.mkdir(path.dirname(envPath), { recursive: true });
      await fs.writeFile(envPath, 'TEST_LOAD1=loaded1\nTEST_LOAD2=loaded2');
      
      await storage.load(false);
      
      expect(process.env.TEST_LOAD1).toBe('loaded1');
      expect(process.env.TEST_LOAD2).toBe('loaded2');
    });

    test('should not throw if file does not exist', async () => {
      await expect(storage.load(false)).resolves.not.toThrow();
    });

    test('should load from local storage', async () => {
      // The load() method only loads from the default (local) storage path
      const localPath = storage.getStoragePath(false);
      await fs.mkdir(path.dirname(localPath), { recursive: true });
      await fs.writeFile(localPath, 'TEST_LOCAL=local_value\nTEST_ANOTHER=another_value');
      
      await storage.load();
      
      expect(process.env.TEST_LOCAL).toBe('local_value');
      expect(process.env.TEST_ANOTHER).toBe('another_value');
    });
  });

  describe('toEnvKey', () => {
    test('should convert dot notation to underscore uppercase', () => {
      expect(storage.toEnvKey('simple')).toBe('SIMPLE');
      expect(storage.toEnvKey('nested.key')).toBe('NESTED_KEY');
      expect(storage.toEnvKey('very.nested.key.name')).toBe('VERY_NESTED_KEY_NAME');
    });

    test('should handle already uppercase keys', () => {
      expect(storage.toEnvKey('ALREADY_UPPER')).toBe('ALREADY_UPPER');
    });

    test('should handle mixed case', () => {
      expect(storage.toEnvKey('mixedCase.Key')).toBe('MIXEDCASE_KEY');
    });
  });

  describe('fromEnvKey', () => {
    test('should convert env key to dot notation', () => {
      expect(storage.fromEnvKey('SIMPLE')).toBe('simple');
      expect(storage.fromEnvKey('NESTED_KEY')).toBe('nested.key');
      expect(storage.fromEnvKey('VERY_NESTED_KEY_NAME')).toBe('very.nested.key.name');
    });
  });
});
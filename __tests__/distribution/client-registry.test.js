const ClientRegistry = require('../../lib/distribution/client-registry');
const { ClientError, ConfigurationError, EnvironmentError } = require('../../lib/errors');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');

// Mock the PathUtils module
jest.mock('../../lib/utils/path-utils', () => ({
  getConfigDir: jest.fn((appName) => {
    if (process.platform === 'win32') {
      return `C:\\Users\\test\\AppData\\Roaming\\${appName}`;
    }
    return `/home/test/.config/${appName}`;
  }),
  joinPath: jest.fn((...args) => require('path').join(...args)),
  resolveEnvVars: jest.fn((template, vars) => {
    return template.replace(/\${(\w+)}/g, (match, envVar) => {
      if (vars && vars[envVar]) return vars[envVar];
      if (envVar === 'HOME') return '/home/test';
      if (envVar === 'APPDATA') return 'C:\\Users\\test\\AppData\\Roaming';
      if (envVar === 'SERVER_NAME') return 'test-server';
      return match;
    });
  }),
  normalizePath: jest.fn((p) => p)
}));

describe('ClientRegistry', () => {
  let registry;
  let tempDir;
  const originalPlatform = process.platform;

  beforeEach(async () => {
    // Create temp directory for tests
    tempDir = path.join(os.tmpdir(), 'client-registry-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
    
    registry = new ClientRegistry('test-server');
  });

  afterEach(async () => {
    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });
    
    // Reset platform
    Object.defineProperty(process, 'platform', {
      value: originalPlatform
    });
    
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with server name', () => {
      expect(registry.serverName).toBe('test-server');
      expect(registry.mappings).toBe(null);
      expect(registry.libraryConfigPath).toBeDefined();
    });

    test('should work without server name', () => {
      const registryNoServer = new ClientRegistry();
      expect(registryNoServer.serverName).toBe(null);
    });
  });

  describe('getLibraryConfigPath', () => {
    test('should return correct path based on platform', () => {
      const PathUtils = require('../../lib/utils/path-utils');
      
      const result = registry.getLibraryConfigPath();
      
      expect(PathUtils.getConfigDir).toHaveBeenCalledWith('devjoy-digital/config-mcp');
      expect(PathUtils.joinPath).toHaveBeenCalled();
      expect(result).toContain('client-mappings.json');
    });
  });

  describe('loadMappings', () => {
    test('should load default mappings when file does not exist', async () => {
      // Mock fs.readFile to throw ENOENT
      jest.spyOn(fs, 'readFile').mockRejectedValue({ code: 'ENOENT' });
      jest.spyOn(fs, 'mkdir').mockResolvedValue();
      jest.spyOn(fs, 'writeFile').mockResolvedValue();
      
      const mappings = await registry.loadMappings();
      
      expect(mappings).toHaveProperty('global-paths');
      expect(mappings).toHaveProperty('local-paths');
      expect(mappings).toHaveProperty('sensitivePatterns');
    });

    test('should cache mappings after first load', async () => {
      const mockMappings = {
        'global-paths': { test: {} },
        'local-paths': { test: {} }
      };
      
      jest.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify(mockMappings));
      
      await registry.loadMappings();
      await registry.loadMappings();
      
      expect(fs.readFile).toHaveBeenCalledTimes(1);
    });

    test('should overwrite old format with new format', async () => {
      const oldFormat = {
        clients: { vscode: {} }
      };
      
      jest.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify(oldFormat));
      jest.spyOn(fs, 'mkdir').mockResolvedValue();
      const writeFileSpy = jest.spyOn(fs, 'writeFile').mockResolvedValue();
      
      const mappings = await registry.loadMappings();
      
      // Should have new structure
      expect(mappings).toHaveProperty('global-paths');
      expect(mappings).toHaveProperty('local-paths');
      expect(mappings).not.toHaveProperty('clients');
      
      // Should have saved the new format (overwriting old)
      expect(writeFileSpy).toHaveBeenCalled();
    });
  });

  describe('getDefaultMappings', () => {
    test('should return default mappings structure', () => {
      const defaults = registry.getDefaultMappings();
      
      expect(defaults).toHaveProperty('global-paths');
      expect(defaults).toHaveProperty('local-paths');
      expect(defaults).toHaveProperty('sensitivePatterns');
      expect(Array.isArray(defaults.sensitivePatterns)).toBe(true);
    });

    test('should handle error loading default config file', () => {
      // Mock readFileSync to throw
      jest.spyOn(fsSync, 'readFileSync').mockImplementation(() => {
        throw new Error('File not found');
      });
      
      const defaults = registry.getDefaultMappings();
      
      expect(defaults).toHaveProperty('global-paths');
      expect(defaults['global-paths']).toHaveProperty('vscode');
    });
  });

  describe('getClientConfigPath', () => {
    beforeEach(async () => {
      const mockMappings = {
        'global-paths': {
          'test-client': {
            'config-path': {
              'win32': '${APPDATA}/TestClient/config.json',
              'darwin': '${HOME}/Library/TestClient/config.json',
              'linux': '${HOME}/.config/TestClient/config.json'
            }
          }
        },
        'local-paths': {
          'test-client': {
            'config-path': {
              'win32': './.testclient/config.json',
              'darwin': './.testclient/config.json',
              'linux': './.testclient/config.json'
            }
          }
        }
      };
      
      registry.mappings = mockMappings;
    });

    test('should return global config path', async () => {
      const path = await registry.getClientConfigPath('test-client', true);
      
      expect(path).toContain('config.json');
      if (process.platform === 'win32') {
        expect(path).toContain('AppData');
      } else {
        expect(path).toContain('home/test');
      }
    });

    test('should return local config path', async () => {
      const path = await registry.getClientConfigPath('test-client', false);
      expect(path).toBe('./.testclient/config.json');
    });

    test('should throw ClientError for unknown client', async () => {
      await expect(registry.getClientConfigPath('unknown', true))
        .rejects.toThrow(ClientError);
    });

    test('should throw ConfigurationError for missing platform config', async () => {
      registry.mappings['global-paths']['test-client']['config-path'] = {};
      
      await expect(registry.getClientConfigPath('test-client', true))
        .rejects.toThrow(ConfigurationError);
    });
  });

  describe('getClientEnvPath', () => {
    beforeEach(async () => {
      const mockMappings = {
        'global-paths': {
          'test-client': {
            'env-path': {
              'win32': '${APPDATA}/TestClient/.env',
              'darwin': '${HOME}/Library/TestClient/.env',
              'linux': '${HOME}/.config/TestClient/.env'
            }
          }
        },
        'local-paths': {}
      };
      
      registry.mappings = mockMappings;
    });

    test('should return env path', async () => {
      const path = await registry.getClientEnvPath('test-client', true);
      expect(path).toContain('.env');
    });

    test('should throw ClientError for unknown client', async () => {
      await expect(registry.getClientEnvPath('unknown', true))
        .rejects.toThrow(ClientError);
    });

    test('should throw ConfigurationError for missing env-path', async () => {
      delete registry.mappings['global-paths']['test-client']['env-path'];
      
      await expect(registry.getClientEnvPath('test-client', true))
        .rejects.toThrow(ConfigurationError);
    });
  });

  describe('getClientPath', () => {
    test('should default to global path', async () => {
      registry.mappings = {
        'global-paths': {
          'test': {
            name: 'Test Client',
            'config-path': {
              [process.platform]: '/test/path'
            }
          }
        }
      };
      
      const result = await registry.getClientPath('test');
      expect(result).toBe('/test/path');
    });
  });

  describe('getClientConfig', () => {
    beforeEach(() => {
      registry.mappings = {
        'global-paths': {
          'test-client': { name: 'Test Client' }
        },
        'local-paths': {}
      };
    });

    test('should return client configuration', async () => {
      const config = await registry.getClientConfig('test-client', true);
      expect(config).toEqual({ name: 'Test Client' });
    });

    test('should return null for unknown client', async () => {
      registry.mappings = {
        'global-paths': {},
        'local-paths': {}
      };
      const config = await registry.getClientConfig('unknown', true);
      expect(config).toBeUndefined();
    });
  });

  describe('resolvePath', () => {
    test('should resolve SERVER_NAME', () => {
      const result = registry.resolvePath('${SERVER_NAME}/config');
      expect(result).toBe('test-server/config');
    });

    test('should resolve environment variables', () => {
      const result = registry.resolvePath('${HOME}/.config');
      expect(result).toBe('/home/test/.config');
    });

    test('should handle multiple variables', () => {
      const result = registry.resolvePath('${HOME}/.config/${SERVER_NAME}');
      expect(result).toBe('/home/test/.config/test-server');
    });
  });

  describe('getAvailableClients', () => {
    test('should return list of available clients', async () => {
      registry.mappings = {
        'global-paths': {
          'client1': { name: 'Client 1', autoLoadEnv: true },
          'client2': { name: 'Client 2', autoLoadEnv: false }
        }
      };
      
      const clients = await registry.getAvailableClients();
      
      expect(clients).toHaveLength(2);
      expect(clients[0]).toEqual({
        id: 'client1',
        name: 'Client 1',
        autoLoadEnv: true
      });
      expect(clients[1]).toEqual({
        id: 'client2',
        name: 'Client 2',
        autoLoadEnv: false
      });
    });

    test('should handle missing global-paths', async () => {
      registry.mappings = {};
      
      const clients = await registry.getAvailableClients();
      expect(clients).toEqual([]);
    });
  });

  describe('setServerName', () => {
    test('should update server name', () => {
      registry.setServerName('new-server');
      expect(registry.serverName).toBe('new-server');
    });
  });

  describe('getSensitivePatterns', () => {
    test('should return sensitive patterns', async () => {
      registry.mappings = {
        sensitivePatterns: ['password', 'secret']
      };
      
      const patterns = await registry.getSensitivePatterns();
      expect(patterns).toEqual(['password', 'secret']);
    });

    test('should return empty array if not defined', async () => {
      registry.mappings = {};
      
      const patterns = await registry.getSensitivePatterns();
      expect(patterns).toEqual([]);
    });
  });

  describe('addClient', () => {
    beforeEach(() => {
      registry.mappings = {
        'global-paths': {},
        'local-paths': {}
      };
      jest.spyOn(registry, 'saveMappings').mockResolvedValue();
    });

    test('should add client to global paths', async () => {
      const clientConfig = { name: 'New Client' };
      
      await registry.addClient('new-client', clientConfig, true);
      
      expect(registry.mappings['global-paths']['new-client']).toEqual(clientConfig);
      expect(registry.saveMappings).toHaveBeenCalled();
    });

    test('should add client to local paths', async () => {
      const clientConfig = { name: 'New Client' };
      
      await registry.addClient('new-client', clientConfig, false);
      
      expect(registry.mappings['local-paths']['new-client']).toEqual(clientConfig);
    });

    test('should create paths section if missing', async () => {
      delete registry.mappings['global-paths'];
      
      await registry.addClient('new-client', {}, true);
      
      expect(registry.mappings['global-paths']).toBeDefined();
      expect(registry.mappings['global-paths']['new-client']).toBeDefined();
    });
  });

  describe('saveMappings', () => {
    test('should save mappings to file', async () => {
      // Restore all mocks to clean state before this test
      jest.restoreAllMocks();
      
      // Set a temp path for testing
      registry.libraryConfigPath = path.join(tempDir, 'test-mappings.json');
      
      // Set mappings directly
      const testMappings = {
        'global-paths': { test: 'data' },
        'local-paths': {},
        'sensitivePatterns': ['password', 'secret']
      };
      registry.mappings = testMappings;
      
      // Call saveMappings directly
      await registry.saveMappings();
      
      const saved = JSON.parse(await fs.readFile(registry.libraryConfigPath, 'utf8'));
      
      // Now we only expect the new structure
      expect(saved).toHaveProperty('global-paths');
      expect(saved['global-paths']).toHaveProperty('test', 'data');
      expect(saved).toHaveProperty('sensitivePatterns');
    });

    test('should create directory if needed', async () => {
      // Restore all mocks to clean state before this test
      jest.restoreAllMocks();
      
      registry.libraryConfigPath = path.join(tempDir, 'subdir', 'mappings.json');
      
      // Set mappings directly
      const testMappings = {
        'global-paths': { test: 'data' },
        'local-paths': {},
        'sensitivePatterns': []
      };
      registry.mappings = testMappings;
      
      // Call saveMappings directly
      await registry.saveMappings();
      
      const saved = JSON.parse(await fs.readFile(registry.libraryConfigPath, 'utf8'));
      
      // Now we only expect the new structure
      expect(saved).toHaveProperty('global-paths');
      expect(saved['global-paths']).toHaveProperty('test', 'data');
    });

    test('should do nothing if mappings is null', async () => {
      registry.mappings = null;
      jest.spyOn(fs, 'writeFile');
      
      await registry.saveMappings();
      
      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });
});

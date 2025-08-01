const BaseClient = require('../../lib/distribution/base-client');
const ClientRegistry = require('../../lib/distribution/client-registry');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Mock PathUtils
jest.mock('../../lib/utils/path-utils', () => ({
  getHomeDir: jest.fn(() => '/home/test')
}));

describe('BaseClient', () => {
  let client;
  let mockRegistry;
  let tempDir;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), 'base-client-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
    process.chdir(tempDir);
    
    mockRegistry = {
      getClientConfig: jest.fn(),
      getClientPath: jest.fn()
    };
    
    client = new BaseClient('test-client', mockRegistry);
  });

  afterEach(async () => {
    process.chdir(os.tmpdir());
    await fs.rm(tempDir, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with clientId and registry', () => {
      expect(client.clientId).toBe('test-client');
      expect(client.registry).toBe(mockRegistry);
      expect(client.clientConfig).toBe(null);
    });
  });

  describe('name getter', () => {
    test('should return client name from config', async () => {
      client.clientConfig = { name: 'Test Client' };
      expect(client.name).toBe('Test Client');
    });

    test('should return clientId if no config', () => {
      expect(client.name).toBe('test-client');
    });
  });

  describe('init', () => {
    test('should load client config', async () => {
      const mockConfig = { name: 'Test Client', configKey: 'test-servers' };
      mockRegistry.getClientConfig.mockResolvedValue(mockConfig);
      
      await client.init();
      
      expect(mockRegistry.getClientConfig).toHaveBeenCalledWith('test-client', true);
      expect(client.clientConfig).toEqual(mockConfig);
    });

    test('should only load config once', async () => {
      const mockConfig = { name: 'Test Client' };
      mockRegistry.getClientConfig.mockResolvedValue(mockConfig);
      
      await client.init();
      await client.init();
      await client.init();
      
      expect(mockRegistry.getClientConfig).toHaveBeenCalledTimes(1);
    });
  });

  describe('isInstalled', () => {
    test('should return true for home directory configs', async () => {
      mockRegistry.getClientPath.mockResolvedValue('/home/test/.mcp.json');
      mockRegistry.getClientConfig.mockResolvedValue({});
      
      const result = await client.isInstalled();
      
      expect(result).toBe(true);
    });

    test('should check directory existence for non-home paths', async () => {
      const configPath = path.join(tempDir, 'config', 'settings.json');
      mockRegistry.getClientPath.mockResolvedValue(configPath);
      mockRegistry.getClientConfig.mockResolvedValue({});
      
      const result = await client.isInstalled();
      
      expect(result).toBe(true);
      // Directory should be created
      await expect(fs.access(path.dirname(configPath))).resolves.not.toThrow();
    });

    test('should return false if directory cannot be created', async () => {
      // Mock a path that cannot be created
      mockRegistry.getClientPath.mockResolvedValue('/root/protected/config.json');
      mockRegistry.getClientConfig.mockResolvedValue({});
      
      jest.spyOn(fs, 'mkdir').mockRejectedValueOnce(new Error('Permission denied'));
      
      const result = await client.isInstalled();
      
      expect(result).toBe(false);
    });

    test('should return false on any error', async () => {
      mockRegistry.getClientPath.mockRejectedValue(new Error('Client error'));
      
      const result = await client.isInstalled();
      
      expect(result).toBe(false);
    });
  });

  describe('updateConfig', () => {
    const mockConfig = {
      serverName: 'test-server',
      settings: {
        command: 'node',
        args: ['server.js'],
        port: 3000
      },
      environment: {
        API_KEY: 'test-key',
        DEBUG: 'true'
      }
    };

    beforeEach(() => {
      mockRegistry.getClientConfig.mockResolvedValue({
        configKey: 'mcp-servers',
        configFormat: 'default',
        autoLoadEnv: true
      });
    });

    test('should create config file with proper structure', async () => {
      const configPath = path.join(tempDir, 'config.json');
      mockRegistry.getClientPath.mockResolvedValue(configPath);
      
      await client.updateConfig(mockConfig);
      
      const written = JSON.parse(await fs.readFile(configPath, 'utf8'));
      expect(written['mcp-servers']).toBeDefined();
      expect(written['mcp-servers']['test-server']).toBeDefined();
    });

    test('should preserve existing config', async () => {
      const configPath = path.join(tempDir, 'config.json');
      mockRegistry.getClientPath.mockResolvedValue(configPath);
      
      // Write existing config
      const existing = {
        'mcp-servers': {
          'other-server': { config: { existing: true } }
        },
        'other-setting': 'value'
      };
      await fs.writeFile(configPath, JSON.stringify(existing));
      
      await client.updateConfig(mockConfig);
      
      const written = JSON.parse(await fs.readFile(configPath, 'utf8'));
      expect(written['mcp-servers']['other-server']).toEqual({ config: { existing: true } });
      expect(written['other-setting']).toBe('value');
      expect(written['mcp-servers']['test-server']).toBeDefined();
    });

    test('should handle structured config format', async () => {
      mockRegistry.getClientConfig.mockResolvedValue({
        configKey: 'mcp-servers',
        configFormat: 'structured'
      });
      
      const configPath = path.join(tempDir, 'config.json');
      mockRegistry.getClientPath.mockResolvedValue(configPath);
      
      await client.updateConfig(mockConfig);
      
      const written = JSON.parse(await fs.readFile(configPath, 'utf8'));
      const serverConfig = written['mcp-servers']['test-server'];
      
      expect(serverConfig.command).toBe('node');
      expect(serverConfig.args).toEqual(['server.js']);
      expect(serverConfig.config).toEqual({ port: 3000 });
    });

    test('should handle environment variables with autoLoadEnv', async () => {
      const configPath = path.join(tempDir, 'config.json');
      mockRegistry.getClientPath.mockResolvedValue(configPath);
      
      await client.updateConfig(mockConfig);
      
      const written = JSON.parse(await fs.readFile(configPath, 'utf8'));
      const serverConfig = written['mcp-servers']['test-server'];
      
      expect(serverConfig.env).toEqual({
        API_KEY: 'test-key',
        DEBUG: 'true'
      });
    });

    test('should use env var format when autoLoadEnv is false', async () => {
      mockRegistry.getClientConfig.mockResolvedValue({
        configKey: 'mcp-servers',
        autoLoadEnv: false
      });
      
      const configPath = path.join(tempDir, 'config.json');
      mockRegistry.getClientPath.mockResolvedValue(configPath);
      
      await client.updateConfig(mockConfig);
      
      const written = JSON.parse(await fs.readFile(configPath, 'utf8'));
      const serverConfig = written['mcp-servers']['test-server'];
      
      expect(serverConfig.env).toEqual({
        API_KEY: '${env:API_KEY}',
        DEBUG: '${env:DEBUG}'
      });
    });

    test('should use custom env format if specified', async () => {
      mockRegistry.getClientConfig.mockResolvedValue({
        configKey: 'mcp-servers',
        envFormat: 'process.env.${VAR}'
      });
      
      const configPath = path.join(tempDir, 'config.json');
      mockRegistry.getClientPath.mockResolvedValue(configPath);
      
      await client.updateConfig(mockConfig);
      
      const written = JSON.parse(await fs.readFile(configPath, 'utf8'));
      const serverConfig = written['mcp-servers']['test-server'];
      
      expect(serverConfig.env).toEqual({
        API_KEY: 'process.env.API_KEY',
        DEBUG: 'process.env.DEBUG'
      });
    });

    test('should handle config without environment', async () => {
      const configNoEnv = {
        serverName: 'test-server',
        settings: { port: 3000 }
      };
      
      const configPath = path.join(tempDir, 'config.json');
      mockRegistry.getClientPath.mockResolvedValue(configPath);
      
      await client.updateConfig(configNoEnv);
      
      const written = JSON.parse(await fs.readFile(configPath, 'utf8'));
      const serverConfig = written['mcp-servers']['test-server'];
      
      expect(serverConfig.env).toBeUndefined();
    });

    test('should create directory if needed', async () => {
      const configPath = path.join(tempDir, 'deep', 'nested', 'config.json');
      mockRegistry.getClientPath.mockResolvedValue(configPath);
      
      await client.updateConfig(mockConfig);
      
      await expect(fs.access(configPath)).resolves.not.toThrow();
    });
  });

  describe('getConfigKey', () => {
    test('should return config key from client config', async () => {
      client.clientConfig = { configKey: 'custom-servers' };
      expect(client.getConfigKey()).toBe('custom-servers');
    });

    test('should return default if not specified', () => {
      client.clientConfig = {};
      expect(client.getConfigKey()).toBe('mcp-servers');
    });

    test('should handle null client config', () => {
      client.clientConfig = null;
      expect(client.getConfigKey()).toBe('mcp-servers');
    });
  });

  describe('formatConfig', () => {
    const baseConfig = {
      serverName: 'test',
      settings: {
        command: 'node',
        args: ['server.js'],
        option1: 'value1'
      }
    };

    test('should format with default format', () => {
      client.clientConfig = {};
      
      const result = client.formatConfig(baseConfig);
      
      expect(result).toEqual({
        config: baseConfig.settings
      });
    });

    test('should format with structured format', () => {
      client.clientConfig = { configFormat: 'structured' };
      
      const result = client.formatConfig(baseConfig);
      
      expect(result).toEqual({
        command: 'node',
        args: ['server.js'],
        config: {
          option1: 'value1'
        }
      });
    });

    test('should handle missing command in structured format', () => {
      client.clientConfig = { configFormat: 'structured' };
      
      const configNoCommand = {
        settings: { option1: 'value1' }
      };
      
      const result = client.formatConfig(configNoCommand);
      
      expect(result).toEqual({
        config: { option1: 'value1' }
      });
    });

    test('should handle empty config object in structured format', () => {
      client.clientConfig = { configFormat: 'structured' };
      
      const configOnlyCommand = {
        settings: {
          command: 'node',
          args: ['server.js']
        }
      };
      
      const result = client.formatConfig(configOnlyCommand);
      
      expect(result).toEqual({
        command: 'node',
        args: ['server.js']
      });
      expect(result.config).toBeUndefined();
    });

    test('should handle missing settings', () => {
      const result = client.formatConfig({});
      expect(result).toEqual({ config: {} });
    });
  });
});
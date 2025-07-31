const djConfig = require('../index');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('dj-config-mcp Library', () => {
  const testDir = path.join(os.tmpdir(), 'dj-config-test-' + Date.now());
  const originalCwd = process.cwd();

  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
    process.chdir(testDir);
    
    // Clear any test environment variables
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('TEST_')) {
        delete process.env[key];
      }
    });
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('configSet', () => {
    test('should save non-sensitive values to JSON file', async () => {
      await djConfig.configSet('server.name', 'Test Server');
      
      const configPath = './devjoy-digital/dj-config-mcp/default.json';
      const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
      expect(config.server.name).toBe('Test Server');
    });

    test('should save sensitive values to .env file', async () => {
      await djConfig.configSet('api.secret', 'secret123');
      
      const envPath = './devjoy-digital/dj-config-mcp/.env';
      const envContent = await fs.readFile(envPath, 'utf8');
      expect(envContent).toContain('API_SECRET=secret123');
    });

    test('should handle global configuration', async () => {
      await djConfig.configSet('global.setting', 'value', { global: true });
      
      let globalPath;
      if (process.platform === 'win32') {
        globalPath = path.join(process.env.APPDATA, 'devjoy-digital', 'dj-config-mcp', 'global.json');
      } else if (process.platform === 'darwin') {
        globalPath = path.join(process.env.HOME, 'Library', 'Application Support', 'devjoy-digital', 'dj-config-mcp', 'global.json');
      } else {
        globalPath = path.join(process.env.HOME, '.config', 'devjoy-digital', 'dj-config-mcp', 'global.json');
      }
      
      const config = JSON.parse(await fs.readFile(globalPath, 'utf8'));
      expect(config.global.setting).toBe('value');
      
      // Cleanup
      await fs.rm(path.dirname(globalPath), { recursive: true, force: true });
    });
  });

  describe('configGet', () => {
    test('should retrieve configuration value', async () => {
      await djConfig.configSet('test.value', 'hello');
      
      const result = await djConfig.configGet('test.value');
      expect(result.value).toBe('hello');
      expect(result.source).toBe('Local Config');
    });

    test('should return null for non-existent key', async () => {
      const result = await djConfig.configGet('non.existent');
      expect(result).toBeNull();
    });

    test('should retrieve all configurations', async () => {
      await djConfig.configSet('key1', 'value1');
      await djConfig.configSet('key2.nested', 'value2');
      
      const results = await djConfig.configGet();
      expect(results).toHaveLength(2);
      expect(results.find(r => r.key === 'key1')).toBeDefined();
      expect(results.find(r => r.key === 'key2.nested')).toBeDefined();
    });
  });

  describe('configDelete', () => {
    test('should delete configuration value', async () => {
      await djConfig.configSet('delete.me', 'value');
      
      let result = await djConfig.configGet('delete.me');
      expect(result).not.toBeNull();
      
      await djConfig.configDelete('delete.me');
      
      result = await djConfig.configGet('delete.me');
      expect(result).toBeNull();
    });
  });

  describe('loadEnv', () => {
    test('should load environment variables', async () => {
      await djConfig.configSet('test.env.key', 'loaded');
      
      // Clear from process.env
      delete process.env.TEST_ENV_KEY;
      
      await djConfig.loadEnv();
      
      expect(process.env.TEST_ENV_KEY).toBe('loaded');
    });
  });

  describe('sensitive data detection', () => {
    const sensitiveKeys = [
      'password',
      'api.key',
      'secret_token',
      'auth.credential',
      'private_key'
    ];

    test.each(sensitiveKeys)('should detect %s as sensitive', async (key) => {
      await djConfig.configSet(key, 'sensitive-value');
      
      const envPath = './devjoy-digital/dj-config-mcp/.env';
      const envContent = await fs.readFile(envPath, 'utf8');
      const envKey = key.toUpperCase().replace(/\./g, '_');
      expect(envContent).toContain(`${envKey}=sensitive-value`);
    });
  });
});
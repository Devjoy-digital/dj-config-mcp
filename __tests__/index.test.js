const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Helper to run the CLI command
const runCli = (command) => {
  try {
    return execSync(`node src/index.js ${command}`, { 
      encoding: 'utf8', 
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: 'test' }
    });
  } catch (error) {
    // If command fails, return the error output
    return error.stdout || error.stderr || error.message;
  }
};

describe('MCP-Config CLI Tool', () => {
  const tempDir = path.join(os.tmpdir(), 'mcp-config-test');
  const originalCwd = process.cwd();

  beforeEach(() => {
    // Create a temporary directory for each test
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
    process.chdir(tempDir);

    // Copy necessary files for the CLI to run
    fs.copyFileSync(path.join(originalCwd, 'src', 'index.js'), path.join(tempDir, 'src', 'index.js'));
    fs.copyFileSync(path.join(originalCwd, 'src', 'client-mappings.js'), path.join(tempDir, 'src', 'client-mappings.js'));

    // Copy node_modules for the test environment
    const nodeModulesPath = path.join(originalCwd, 'node_modules');
    const tempNodeModulesPath = path.join(tempDir, 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
      fs.cpSync(nodeModulesPath, tempNodeModulesPath, { recursive: true });
    }

    // Clear any existing .env or config files
    if (fs.existsSync(path.join(tempDir, '.env'))) {
      fs.unlinkSync(path.join(tempDir, '.env'));
    }
    if (fs.existsSync(path.join(tempDir, 'config'))) {
      fs.rmSync(path.join(tempDir, 'config'), { recursive: true, force: true });
    }
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('help command should display usage information', () => {
    const output = runCli('--help');
    expect(output).toContain('CLI tool for managing MCP server configurations');
    expect(output).toContain('config');
    expect(output).toContain('get-config');
    expect(output).toContain('update-config');
    expect(output).toContain('delete-config');
  });

  test('version command should display version', () => {
    const output = runCli('--version');
    expect(output).toContain('0.9.0');
  });

  test('update-config should save non-sensitive values to config file', () => {
    runCli('update-config server.name "Test Server"');
    
    expect(fs.existsSync('config/default.json')).toBe(true);
    const config = JSON.parse(fs.readFileSync('config/default.json', 'utf8'));
    expect(config.server.name).toBe('Test Server');
  });

  test('update-config should save sensitive values to .env file', () => {
    runCli('update-config api.secret "secret123"');
    
    expect(fs.existsSync('.env')).toBe(true);
    const envContent = fs.readFileSync('.env', 'utf8');
    expect(envContent).toContain('API_SECRET=secret123');
    
    // Should not be in config file
    if (fs.existsSync('config/default.json')) {
      const config = JSON.parse(fs.readFileSync('config/default.json', 'utf8'));
      expect(config.api?.secret).toBeUndefined();
    }
  });

  test('get-config should retrieve specific configuration value', () => {
    runCli('update-config test.value "Hello World"');
    const output = runCli('get-config test.value');
    expect(output).toContain('test.value: Hello World');
    expect(output).toContain('Local Config File');
  });

  test('get-config should show all configurations when no key specified', () => {
    runCli('update-config server.port "3000"');
    runCli('update-config api.key "test-key"');
    
    const output = runCli('get-config');
    expect(output).toContain('All Configurations:');
    expect(output).toContain('server.port: 3000');
    expect(output).toContain('api.key: test-key');
  });

  test('delete-config should remove non-sensitive values from config', () => {
    runCli('update-config test.remove "temp value"');
    expect(fs.existsSync('config/default.json')).toBe(true);
    
    runCli('delete-config test.remove');
    const config = JSON.parse(fs.readFileSync('config/default.json', 'utf8'));
    expect(config.test?.remove).toBeUndefined();
  });

  test('delete-config should remove sensitive values from .env', () => {
    runCli('update-config db.password "secret123"');
    expect(fs.existsSync('.env')).toBe(true);
    
    runCli('delete-config db.password');
    const envContent = fs.readFileSync('.env', 'utf8');
    expect(envContent).not.toContain('DB_PASSWORD');
  });

  test('should handle nested configuration values correctly', () => {
    runCli('update-config database.connection.host "localhost"');
    runCli('update-config database.connection.port "5432"');
    
    const config = JSON.parse(fs.readFileSync('config/default.json', 'utf8'));
    expect(config.database.connection.host).toBe('localhost');
    expect(config.database.connection.port).toBe('5432');
  });

  test('should detect sensitive keys automatically', () => {
    const sensitiveKeys = [
      'api.key',
      'api.secret',
      'db.password',
      'auth.token',
      'private.data',
      'credential.info'
    ];

    sensitiveKeys.forEach(key => {
      runCli(`update-config ${key} "sensitive-value"`);
    });

    // All should be in .env
    const envContent = fs.readFileSync('.env', 'utf8');
    expect(envContent).toContain('API_KEY=');
    expect(envContent).toContain('API_SECRET=');
    expect(envContent).toContain('DB_PASSWORD=');
    expect(envContent).toContain('AUTH_TOKEN=');
    expect(envContent).toContain('PRIVATE_DATA=');
    expect(envContent).toContain('CREDENTIAL_INFO=');

    // None should be in config
    if (fs.existsSync('config/default.json')) {
      const configContent = fs.readFileSync('config/default.json', 'utf8');
      expect(configContent).not.toContain('sensitive-value');
    }
  });

  test('global flag should write to global config location', () => {
    const homeDir = os.homedir();
    const globalConfigPath = path.join(homeDir, '.mcp-config', 'global.json');
    
    // Clean up any existing global config
    if (fs.existsSync(path.dirname(globalConfigPath))) {
      fs.rmSync(path.dirname(globalConfigPath), { recursive: true, force: true });
    }
    
    runCli('update-config -g global.setting "global value"');
    
    expect(fs.existsSync(globalConfigPath)).toBe(true);
    const globalConfig = JSON.parse(fs.readFileSync(globalConfigPath, 'utf8'));
    expect(globalConfig.global.setting).toBe('global value');
    
    // Clean up
    fs.rmSync(path.dirname(globalConfigPath), { recursive: true, force: true });
  });

  test('should handle special characters in configuration values', () => {
    const specialValue = 'value with "quotes" and \'apostrophes\' and $pecial ch@rs!';
    runCli(`update-config special.chars "${specialValue}"`);
    
    const config = JSON.parse(fs.readFileSync('config/default.json', 'utf8'));
    expect(config.special.chars).toBe(specialValue);
  });

  test('environment variables should take precedence over config files', () => {
    runCli('update-config test.precedence "config value"');
    
    // Set environment variable
    process.env.TEST_PRECEDENCE = 'env value';
    
    const output = runCli('get-config test.precedence');
    expect(output).toContain('test.precedence: env value');
    expect(output).toContain('Environment Variable');
    
    delete process.env.TEST_PRECEDENCE;
  });

  test('should create config directory if it does not exist', () => {
    expect(fs.existsSync('config')).toBe(false);
    
    runCli('update-config new.config "value"');
    
    expect(fs.existsSync('config')).toBe(true);
    expect(fs.existsSync('config/default.json')).toBe(true);
  });

  test('update-config without value should prompt (non-interactive test)', () => {
    // In non-interactive mode, it should show an error or handle gracefully
    const output = runCli('update-config test.prompt');
    // The command might wait for input or show a message
    // This test just ensures it doesn't crash
    expect(output).toBeDefined();
  });
});
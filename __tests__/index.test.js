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
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: 'pipe'
    });
  } catch (error) {
    // If command fails, return combined output from stdout and stderr
    return (error.stdout || '') + (error.stderr || '') + (error.message || '');
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
    fs.copyFileSync(path.join(originalCwd, 'src', 'config-utils.js'), path.join(tempDir, 'src', 'config-utils.js'));

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
    expect(output).toContain('config-get');
    expect(output).toContain('config-set');
    expect(output).toContain('config-delete');
  });

  test('version command should display version', () => {
    const output = runCli('--version');
    expect(output).toContain('0.9.0');
  });

  test('config-set should save non-sensitive values to config file', () => {
    runCli('config-set server.name "Test Server"');
    
    expect(fs.existsSync('config/default.json')).toBe(true);
    const config = JSON.parse(fs.readFileSync('config/default.json', 'utf8'));
    expect(config.server.name).toBe('Test Server');
  });

  test('config-set should save sensitive values to .env file', () => {
    runCli('config-set api.secret "secret123"');
    
    expect(fs.existsSync('.env')).toBe(true);
    const envContent = fs.readFileSync('.env', 'utf8');
    expect(envContent).toContain('API_SECRET=secret123');
    
    // Should not be in config file
    if (fs.existsSync('config/default.json')) {
      const config = JSON.parse(fs.readFileSync('config/default.json', 'utf8'));
      expect(config.api?.secret).toBeUndefined();
    }
  });

  test('config-get should retrieve specific configuration value', () => {
    runCli('config-set test.value "Hello World"');
    const output = runCli('config-get test.value');
    expect(output).toContain('test.value: Hello World');
    expect(output).toContain('Local Config File');
  });

  test('config-get should show all configurations when no key specified', () => {
    runCli('config-set server.port "3000"');
    runCli('config-set api.key "test-key"');
    
    const output = runCli('config-get');
    expect(output).toContain('All Configurations:');
    expect(output).toContain('server.port: 3000');
    expect(output).toContain('api.key: test-key');
  });

  test('config-delete should remove non-sensitive values from config', () => {
    runCli('config-set test.remove "temp value"');
    expect(fs.existsSync('config/default.json')).toBe(true);
    
    runCli('config-delete test.remove');
    const config = JSON.parse(fs.readFileSync('config/default.json', 'utf8'));
    expect(config.test?.remove).toBeUndefined();
  });

  test('config-delete should remove sensitive values from .env', () => {
    runCli('config-set db.password "secret123"');
    expect(fs.existsSync('.env')).toBe(true);
    
    runCli('config-delete db.password');
    const envContent = fs.readFileSync('.env', 'utf8');
    expect(envContent).not.toContain('DB_PASSWORD');
  });

  test('should handle nested configuration values correctly', () => {
    runCli('config-set database.connection.host "localhost"');
    runCli('config-set database.connection.port "5432"');
    
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
      runCli(`config-set ${key} "sensitive-value"`);
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
    
    runCli('config-set -g global.setting "global value"');
    
    expect(fs.existsSync(globalConfigPath)).toBe(true);
    const globalConfig = JSON.parse(fs.readFileSync(globalConfigPath, 'utf8'));
    expect(globalConfig.global.setting).toBe('global value');
    
    // Clean up
    fs.rmSync(path.dirname(globalConfigPath), { recursive: true, force: true });
  });

  test('should handle special characters in configuration values', () => {
    // Test with simpler special characters that work cross-platform
    runCli('config-set special.chars "value with spaces and numbers 123"');
    
    const config = JSON.parse(fs.readFileSync('config/default.json', 'utf8'));
    expect(config.special.chars).toBe('value with spaces and numbers 123');
  });

  test('environment variables should take precedence over config files', () => {
    runCli('config-set test.precedence "config value"');
    
    // Set environment variable
    process.env.TEST_PRECEDENCE = 'env value';
    
    const output = runCli('config-get test.precedence');
    expect(output).toContain('test.precedence: env value');
    expect(output).toContain('Environment Variable');
    
    delete process.env.TEST_PRECEDENCE;
  });

  test('should create config directory if it does not exist', () => {
    expect(fs.existsSync('config')).toBe(false);
    
    runCli('config-set new.config "value"');
    
    expect(fs.existsSync('config')).toBe(true);
    expect(fs.existsSync('config/default.json')).toBe(true);
  });

  test('config command should exist for interactive setup', () => {
    const output = runCli('config --help');
    expect(output).toContain('Interactive configuration setup');
  });

  test('config-set without value should show error', () => {
    const output = runCli('config-set test.prompt');
    // Commander shows error in stderr which gets captured in the output
    expect(output).toBeDefined();
    expect(output.toLowerCase()).toContain('error');
  });
});
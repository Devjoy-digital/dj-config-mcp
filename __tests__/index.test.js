const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock the readline module for interactive prompts
jest.mock('readline', () => ({
  createInterface: jest.fn(() => ({
    question: jest.fn((prompt, callback) => {
      if (prompt.includes('The application environment')) {
        callback('development');
      } else if (prompt.includes('MCP (Model Context Protocol) server port')) {
        callback('3001');
      } else if (prompt.includes('MCP server host address')) {
        callback('192.168.1.100');
      } else if (prompt.includes('Connection timeout in milliseconds')) {
        callback('30000');
      } else if (prompt.includes('API key for external services')) {
        callback('test_api_key_123');
      } else if (prompt.includes('API secret for external services')) {
        callback('test_api_secret_456');
      } else if (prompt.includes('Base URL for API endpoints')) {
        callback('https://api.test.com');
      } else if (prompt.includes('Select target clients')) {
        callback('VS Code, Cursor');
      } else {
        callback(''); // Default empty answer for other prompts
      }
    }),
    close: jest.fn(),
  })),
}));

// Helper to run the CLI command
const runCli = (command) => {
  try {
    // Use 'node src/index.js' to run the CLI directly
    return execSync(`node src/index.js ${command}`, { encoding: 'utf8', cwd: process.cwd() });
  } catch (error) {
    console.error(`Error running command: ${command}`);
    console.error(error.stdout);
    console.error(error.stderr);
    throw error;
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
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true }); // Create src directory
    process.chdir(tempDir); // Change CWD to the temporary directory

    // Copy necessary files for the CLI to run
    fs.copyFileSync(path.join(originalCwd, 'src', 'index.js'), path.join(tempDir, 'src', 'index.js'));
    fs.copyFileSync(path.join(originalCwd, 'src', 'client-mappings.js'), path.join(tempDir, 'src', 'client-mappings.js'));
    fs.copyFileSync(path.join(originalCwd, 'template-config.json'), path.join(tempDir, 'template-config.json'));

    // Copy node_modules for the test environment
    const nodeModulesPath = path.join(originalCwd, 'node_modules');
    const tempNodeModulesPath = path.join(tempDir, 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
      fs.cpSync(nodeModulesPath, tempNodeModulesPath, { recursive: true });
    }

    // Create a mock package.json for schema discovery tests
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
      name: 'test-mcp-project',
      version: '1.0.0',
      mcpConfig: {
        schema: 'template-config.json' // Point to the copied schema
      }
    }, null, 2));

    // Clear any existing .env or config files in the temp directory
    if (fs.existsSync(path.join(tempDir, '.env'))) {
      fs.unlinkSync(path.join(tempDir, '.env'));
    }
    if (fs.existsSync(path.join(tempDir, 'config', 'default.json'))) {
      fs.rmSync(path.join(tempDir, 'config'), { recursive: true, force: true });
    }
  });

  afterEach(() => {
    process.chdir(originalCwd); // Change CWD back
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('config command should prompt for values and save them correctly', () => {
    const output = runCli('config');
    expect(output).toContain('Starting MCP-Config setup...');
    expect(output).toContain('Configuration process complete.');

    // Verify .env file for sensitive data
    const envContent = fs.readFileSync(path.join(tempDir, '.env'), 'utf8');
    expect(envContent).toContain('API_KEY=test_api_key_123');
    expect(envContent).toContain('API_SECRET=test_api_secret_456');

    // Verify config/default.json for non-sensitive data
    const configContent = JSON.parse(fs.readFileSync(path.join(tempDir, 'config', 'default.json'), 'utf8'));
    expect(configContent.env).toBe('development');
    expect(configContent.mcp.port).toBe(3001);
    expect(configContent.mcp.host).toBe('192.168.1.100');
    expect(configContent.mcp.timeout).toBe(30000);
    expect(configContent.api.baseUrl).toBe('https://api.test.com');
    expect(configContent.clients.selected).toEqual(['VS Code', 'Cursor']);

    // Verify client specific config files are created
    const vsCodeConfigPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'mcp-config.json');
    const cursorConfigPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'mcp-config.json');

    expect(fs.existsSync(vsCodeConfigPath)).toBe(true);
    expect(fs.existsSync(cursorConfigPath)).toBe(true);

    const vsCodeConfig = JSON.parse(fs.readFileSync(vsCodeConfigPath, 'utf8'));
    expect(vsCodeConfig.env).toBe('development');
    expect(vsCodeConfig.mcp.port).toBe(3001);
    expect(vsCodeConfig.mcp.host).toBe('192.168.1.100');
    expect(vsCodeConfig.mcp.timeout).toBe(30000);
    expect(vsCodeConfig.api.key).toBe('${API_KEY}'); // Should be environment variable reference
    expect(vsCodeConfig.api.secret).toBe('${API_SECRET}'); // Should be environment variable reference
    expect(vsCodeConfig.api.baseUrl).toBe('https://api.test.com');

    const cursorConfig = JSON.parse(fs.readFileSync(cursorConfigPath, 'utf8'));
    expect(cursorConfig.env).toBe('development');
    expect(cursorConfig.mcp.port).toBe(3001);
    expect(cursorConfig.mcp.host).toBe('192.168.1.100');
    expect(cursorConfig.mcp.timeout).toBe(30000);
    expect(cursorConfig.api.key).toBe('${API_KEY}'); // Should be environment variable reference
    expect(cursorConfig.api.secret).toBe('${API_SECRET}'); // Should be environment variable reference
    expect(cursorConfig.api.baseUrl).toBe('https://api.test.com');
  });

  test('get-config command should display all configurations', () => {
    // First run config to populate values
    runCli('config');

    const output = runCli('get-config');
    expect(output).toContain('All Configurations:');
    expect(output).toContain('env: development (Source: Config File)');
    expect(output).toContain('mcp.port: 3001 (Source: Config File)');
    expect(output).toContain('mcp.host: 192.168.1.100 (Source: Config File)');
    expect(output).toContain('mcp.timeout: 30000 (Source: Config File)');
    expect(output).toContain('api.key: test_api_key_123 (Source: Environment Variable)');
    expect(output).toContain('api.secret: test_api_secret_456 (Source: Environment Variable)');
    expect(output).toContain('api.baseUrl: https://api.test.com (Source: Config File)');
    expect(output).toContain('clients.selected: VS Code,Cursor (Source: Config File)');
  });

  test('get-config command should display a specific configuration', () => {
    // First run config to populate values
    runCli('config');

    const output = runCli('get-config mcp.port');
    expect(output).toContain('mcp.port: 3001 (Source: Config File)');

    const outputSecret = runCli('get-config api.key');
    expect(outputSecret).toContain('api.key: test_api_key_123 (Source: Environment Variable)');
  });

  test('update-config command should update a specific value and redistribute', () => {
    // Initial config
    runCli('config');

    // Update a value
    const updateOutput = runCli('update-config mcp.port 3002');
    expect(updateOutput).toContain('Non-secret mcp.port saved to config/default.json.');
    expect(updateOutput).toContain('Configuration update complete.');

    // Verify updated value with get-config
    const getOutput = runCli('get-config mcp.port');
    expect(getOutput).toContain('mcp.port: 3002 (Source: Config File)');

    // Verify client specific config files are updated
    const vsCodeConfigPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'mcp-config.json');
    const cursorConfigPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'mcp-config.json');

    const vsCodeConfig = JSON.parse(fs.readFileSync(vsCodeConfigPath, 'utf8'));
    expect(vsCodeConfig.mcp.port).toBe(3002);

    const cursorConfig = JSON.parse(fs.readFileSync(cursorConfigPath, 'utf8'));
    expect(cursorConfig.mcp.port).toBe(3002);
  });

  test('update-config command should prompt for value if not provided', () => {
    // Initial config
    runCli('config');

    // Mock readline again for the update prompt
    jest.mock('readline', () => ({
      createInterface: jest.fn(() => ({
        question: jest.fn((prompt, callback) => {
          if (prompt.includes('MCP server host address')) {
            callback('10.0.0.5');
          } else if (prompt.includes('Select target clients')) {
            callback('VS Code'); // Only select VS Code this time
          } else {
            callback('');
          }
        }),
        close: jest.fn(),
      })),
    }));

    const updateOutput = runCli('update-config mcp.host');
    expect(updateOutput).toContain('Non-secret mcp.host saved to config/default.json.');
    expect(updateOutput).toContain('Configuration update complete.');

    const getOutput = runCli('get-config mcp.host');
    expect(getOutput).toContain('mcp.host: 10.0.0.5 (Source: Config File)');

    // Verify client specific config files are updated and only VS Code is selected
    const vsCodeConfigPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'mcp-config.json');
    const cursorConfigPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'mcp-config.json');

    expect(fs.existsSync(vsCodeConfigPath)).toBe(true);
    expect(fs.existsSync(cursorConfigPath)).toBe(false); // Cursor should no longer have a config

    const vsCodeConfig = JSON.parse(fs.readFileSync(vsCodeConfigPath, 'utf8'));
    expect(vsCodeConfig.mcp.host).toBe('10.0.0.5');
    expect(vsCodeConfig.clients.selected).toEqual(['VS Code']);
  });

  // Security vulnerability tests
  test('should use environment variable references for secrets in client configs', () => {
    runCli('config');

    // Check that client config files contain environment variable references instead of actual secrets
    const vsCodeConfigPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'mcp-config.json');
    const cursorConfigPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'mcp-config.json');

    if (fs.existsSync(vsCodeConfigPath)) {
      const vsCodeConfig = JSON.parse(fs.readFileSync(vsCodeConfigPath, 'utf8'));
      expect(vsCodeConfig.api.key).toBe('${API_KEY}'); // Should contain env var reference
      expect(vsCodeConfig.api.secret).toBe('${API_SECRET}'); // Should contain env var reference
      
      // Verify actual secrets are NOT in the config file
      const configContent = fs.readFileSync(vsCodeConfigPath, 'utf8');
      expect(configContent).not.toContain('test_api_key_123');
      expect(configContent).not.toContain('test_api_secret_456');
    }

    if (fs.existsSync(cursorConfigPath)) {
      const cursorConfig = JSON.parse(fs.readFileSync(cursorConfigPath, 'utf8'));
      expect(cursorConfig.api.key).toBe('${API_KEY}'); // Should contain env var reference
      expect(cursorConfig.api.secret).toBe('${API_SECRET}'); // Should contain env var reference
      
      // Verify actual secrets are NOT in the config file
      const configContent = fs.readFileSync(cursorConfigPath, 'utf8');
      expect(configContent).not.toContain('test_api_key_123');
      expect(configContent).not.toContain('test_api_secret_456');
    }
  });

  // Error handling tests
  test('should handle missing schema file gracefully', () => {
    // Remove schema file
    fs.unlinkSync(path.join(tempDir, 'template-config.json'));

    // Should not crash but show error
    const output = runCli('config');
    expect(output).toContain('Error:');
    expect(output).toContain('Configuration schema file not found');
  });

  test('should handle malformed schema file gracefully', () => {
    // Create malformed schema
    fs.writeFileSync(path.join(tempDir, 'template-config.json'), '{ invalid json }');

    const output = runCli('config');
    expect(output).toContain('Error:');
    expect(output).toContain('Failed to parse configuration schema');
  });

  test('should handle file permission errors gracefully', () => {
    // Create a read-only directory where config should be written
    const configDir = path.join(tempDir, 'config');
    if (fs.existsSync(configDir)) {
      fs.rmSync(configDir, { recursive: true, force: true });
    }
    
    // This test is platform-specific and may not work on all systems
    if (process.platform !== 'win32') {
      fs.mkdirSync(configDir);
      fs.chmodSync(configDir, 0o444); // Read-only

      try {
        const output = runCli('config');
        // Should handle the error gracefully rather than crashing
        expect(output).not.toContain('EACCES');
      } finally {
        // Restore permissions for cleanup
        fs.chmodSync(configDir, 0o755);
      }
    }
  });

  test('should validate configuration keys in update-config', () => {
    runCli('config');

    const output = runCli('update-config invalid.key test_value');
    expect(output).toContain('Configuration key "invalid.key" not found in schema');
  });

  test('should handle special characters in configuration values', () => {
    // Mock readline to provide values with special characters
    jest.mock('readline', () => ({
      createInterface: jest.fn(() => ({
        question: jest.fn((prompt, callback) => {
          if (prompt.includes('API key for external services')) {
            callback('key_with_"quotes"_and_spaces');
          } else if (prompt.includes('Base URL for API endpoints')) {
            callback('host-with-dashes.example.com');
          } else {
            callback('VS Code');
          }
        }),
        close: jest.fn(),
      })),
    }));

    const output = runCli('config');
    expect(output).toContain('Configuration process complete.');

    // Verify the values were saved correctly
    const envContent = fs.readFileSync(path.join(tempDir, '.env'), 'utf8');
    expect(envContent).toContain('API_KEY=key_with_"quotes"_and_spaces');

    const configContent = JSON.parse(fs.readFileSync(path.join(tempDir, 'config', 'default.json'), 'utf8'));
    expect(configContent.api.baseUrl).toBe('host-with-dashes.example.com');
  });
});

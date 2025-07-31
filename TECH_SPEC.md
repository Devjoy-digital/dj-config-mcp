# Technical Specification
## dj-config-mcp: MCP Configuration Management Library

### Document Information
- **Library Name**: dj-config-mcp
- **Version**: 0.9.3
- **Document Version**: 1.2
- **Date**: July 31, 2025
- **Author**: Devjoy Digital

---

## 1. Architecture Overview

### 1.1 Library Architecture
```
dj-config-mcp/
├── index.js                    # Main entry point
├── lib/
│   ├── config/
│   │   ├── manager.js         # Core configuration management
│   │   ├── loader.js          # Configuration loading logic
│   │   └── resolver.js        # Configuration resolution (env > local > global)
│   ├── storage/
│   │   ├── json-storage.js    # JSON file storage for non-sensitive data
│   │   ├── env-storage.js     # .env file storage for sensitive data
│   │   └── gitignore.js       # .gitignore management
│   ├── security/
│   │   ├── detector.js        # Sensitive data detection
│   │   └── patterns.js        # Sensitive term patterns loader
│   ├── distribution/
│   │   ├── distributor.js     # Client distribution orchestrator
│   │   ├── clients/
│   │   │   ├── vscode.js      # VS Code client handler
│   │   │   ├── claude-code.js # Claude Code client handler
│   │   │   ├── claude-desktop.js # Claude Desktop client handler
│   │   │   └── cursor.js      # Cursor client handler
│   │   └── client-registry.js # Client path resolver using client-mappings.json
│   ├── commands/
│   │   ├── config.js          # Interactive configuration command
│   │   ├── config-set.js      # Set configuration command
│   │   ├── config-get.js      # Get configuration command
│   │   ├── config-delete.js   # Delete configuration command
│   │   └── config-load-env.js # Load environment command
│   └── utils/
│       ├── file-system.js     # File system utilities
│       ├── path-resolver.js   # Path resolution utilities
│       └── validation.js      # Input validation
├── test/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
└── package.json
```

### 1.2 Integration Flow
```javascript
// MCP Server Integration Example
const djConfig = require('dj-config-mcp');

// In MCP server's command handler
async function handleCommand(command, args) {
  switch(command) {
    case 'config':
      return await djConfig.config(args);
    case 'config-set':
      return await djConfig.configSet(args.key, args.value, args.options);
    case 'config-get':
      return await djConfig.configGet(args.key);
    case 'config-delete':
      return await djConfig.configDelete(args.key, args.options);
    case 'config-load-env':
      return await djConfig.loadEnv();
    // ... other MCP server commands
  }
}
```

---

## 2. Core Features Implementation

### 2.1 Configuration Manager (`lib/config/manager.js`)

#### Purpose
Central orchestrator for all configuration operations.

#### API
```javascript
class ConfigurationManager {
  constructor(options = {}) {
    this.storage = new StorageManager();
    this.security = new SecurityDetector();
    this.distributor = new Distributor();
  }

  async setConfig(key, value, options = {}) {
    // Detect if sensitive
    const isSensitive = this.security.isSensitive(key);
    
    // Route to appropriate storage
    if (isSensitive) {
      await this.storage.env.set(key, value, options.global);
      await this.storage.gitignore.ensure(options.global);
    } else {
      await this.storage.json.set(key, value, options.global);
    }
    
    // Distribute to clients if local
    if (!options.global) {
      await this.distributor.distribute();
    }
  }

  async getConfig(key) {
    // Implement resolution hierarchy
    return await this.storage.resolve(key);
  }

  async deleteConfig(key, options = {}) {
    await this.storage.delete(key, options.global);
    
    if (!options.global) {
      await this.distributor.distribute();
    }
  }

  async loadEnvironment() {
    await this.storage.env.load();
  }
}
```

### 2.2 Storage System

#### 2.2.1 JSON Storage (`lib/storage/json-storage.js`)
```javascript
class JsonStorage {
  constructor() {
    this.localPath = './mcp-servers/default.json';
    this.globalPath = this.getGlobalPath();
  }

  getGlobalPath() {
    const homeDir = process.platform === 'win32' 
      ? process.env.USERPROFILE 
      : process.env.HOME;
    return path.join(homeDir, '.mcp-servers', 'global.json');
  }

  async set(key, value, isGlobal = false) {
    const configPath = isGlobal ? this.globalPath : this.localPath;
    const config = await this.read(configPath) || {};
    
    // Support nested keys (e.g., "api.endpoint")
    this.setNestedValue(config, key, value);
    
    await this.write(configPath, config);
  }

  async get(key, isGlobal = false) {
    const configPath = isGlobal ? this.globalPath : this.localPath;
    const config = await this.read(configPath) || {};
    
    return this.getNestedValue(config, key);
  }

  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
  }
}
```

#### 2.2.2 Environment Storage (`lib/storage/env-storage.js`)
```javascript
class EnvStorage {
  constructor() {
    this.localPath = './mcp-servers/.env';
    this.globalPath = this.getGlobalPath();
  }

  getGlobalPath() {
    const homeDir = process.platform === 'win32' 
      ? process.env.USERPROFILE 
      : process.env.HOME;
    return path.join(homeDir, '.mcp-servers', '.env');
  }

  async set(key, value, isGlobal = false) {
    const envPath = isGlobal ? this.globalPath : this.localPath;
    
    // Convert dot notation to uppercase env var
    const envKey = this.toEnvKey(key);
    
    // Read existing .env
    const envContent = await this.read(envPath) || '';
    const envVars = this.parse(envContent);
    
    // Update or add
    envVars[envKey] = value;
    
    // Write back
    const newContent = this.stringify(envVars);
    await this.write(envPath, newContent);
  }

  toEnvKey(key) {
    // Convert "api.secret" to "API_SECRET"
    return key.toUpperCase().replace(/\./g, '_');
  }

  async load() {
    // Load local .env first, then global
    const globalEnv = await this.read(this.globalPath);
    const localEnv = await this.read(this.localPath);
    
    if (globalEnv) {
      const vars = this.parse(globalEnv);
      Object.assign(process.env, vars);
    }
    
    if (localEnv) {
      const vars = this.parse(localEnv);
      Object.assign(process.env, vars);
    }
  }
}
```

### 2.3 Security Detection (`lib/security/detector.js`)

```javascript
class SecurityDetector {
  constructor(clientRegistry) {
    this.clientRegistry = clientRegistry;
    this.patterns = null;
  }

  async loadPatterns() {
    if (!this.patterns) {
      const mappings = await this.clientRegistry.loadMappings();
      this.patterns = mappings.sensitivePatterns || [
        'password',
        'secret',
        'key',
        'token',
        'auth',
        'credential',
        'private'
      ];
    }
    return this.patterns;
  }

  async isSensitive(key) {
    const patterns = await this.loadPatterns();
    const lowerKey = key.toLowerCase();
    return patterns.some(pattern => lowerKey.includes(pattern));
  }
}
```

### 2.4 Client Distribution

#### 2.4.1 Distributor (`lib/distribution/distributor.js`)
```javascript
class Distributor {
  constructor() {
    this.clients = [
      new VSCodeClient(),
      new ClaudeCodeClient(),
      new ClaudeDesktopClient(),
      new CursorClient()
    ];
  }

  async distribute() {
    const config = await this.gatherConfiguration();
    
    for (const client of this.clients) {
      if (await client.isInstalled()) {
        await client.updateConfig(config);
      }
    }
  }

  async gatherConfiguration() {
    // Gather both JSON and env configurations
    const jsonConfig = await this.storage.json.getAll();
    const envConfig = await this.storage.env.getAll();
    
    return {
      settings: jsonConfig,
      environment: envConfig
    };
  }
}
```

#### 2.4.2 Client Mappings Configuration (Library Configuration File)
```json
{
  "clients": {
    "vscode": {
      "name": "Visual Studio Code",
      "paths": {
        "win32": "${APPDATA}/Code/User/globalStorage/mcp-servers",
        "darwin": "${HOME}/Library/Application Support/Code/User/globalStorage/mcp-servers",
        "linux": "${HOME}/.config/Code/User/globalStorage/mcp-servers"
      },
      "configFile": "config.json",
      "autoLoadEnv": true
    },
    "claude-code": {
      "name": "Claude Code",
      "paths": {
        "win32": "${APPDATA}/claude-code/mcp-servers",
        "darwin": "${HOME}/Library/Application Support/claude-code/mcp-servers",
        "linux": "${HOME}/.config/claude-code/mcp-servers"
      },
      "configFile": "config.json",
      "autoLoadEnv": false
    },
    "claude-desktop": {
      "name": "Claude Desktop",
      "paths": {
        "win32": "${APPDATA}/Claude/mcp-servers",
        "darwin": "${HOME}/Library/Application Support/Claude/mcp-servers",
        "linux": "${HOME}/.config/Claude/mcp-servers"
      },
      "configFile": "config.json",
      "autoLoadEnv": false
    },
    "cursor": {
      "name": "Cursor",
      "paths": {
        "win32": "${APPDATA}/Cursor/User/globalStorage/mcp-servers",
        "darwin": "${HOME}/Library/Application Support/Cursor/User/globalStorage/mcp-servers",
        "linux": "${HOME}/.config/Cursor/User/globalStorage/mcp-servers"
      },
      "configFile": "config.json",
      "autoLoadEnv": true
    }
  }
}
```

#### 2.4.3 Client Registry Implementation (`lib/distribution/client-registry.js`)
```javascript
const fs = require('fs').promises;
const path = require('path');

class ClientRegistry {
  constructor() {
    // Use standard mcp-servers location
    this.localMappingsPath = './mcp-servers/dj-config-mcp.json';
    this.globalMappingsPath = this.getGlobalMappingsPath();
    this.mappings = null;
  }

  getGlobalMappingsPath() {
    const homeDir = process.platform === 'win32' 
      ? process.env.USERPROFILE 
      : process.env.HOME;
    return path.join(homeDir, '.mcp-servers', 'dj-config-mcp.json');
  }

  async loadMappings() {
    if (!this.mappings) {
      // Try local first, then global, then use defaults
      try {
        const content = await fs.readFile(this.localMappingsPath, 'utf8');
        this.mappings = JSON.parse(content);
      } catch (localError) {
        try {
          const content = await fs.readFile(this.globalMappingsPath, 'utf8');
          this.mappings = JSON.parse(content);
        } catch (globalError) {
          // Use default mappings if no config file exists
          this.mappings = this.getDefaultMappings();
          // Save defaults to local config
          await this.saveMappings(false);
        }
      }
    }
    return this.mappings;
  }

  getDefaultMappings() {
    return {
      "clients": {
        "vscode": {
          "name": "Visual Studio Code",
          "paths": {
            "win32": "${APPDATA}/Code/User/globalStorage/mcp-servers",
            "darwin": "${HOME}/Library/Application Support/Code/User/globalStorage/mcp-servers",
            "linux": "${HOME}/.config/Code/User/globalStorage/mcp-servers"
          },
          "configFile": "config.json",
          "autoLoadEnv": true
        },
        "claude-code": {
          "name": "Claude Code",
          "paths": {
            "win32": "${APPDATA}/claude-code/mcp-servers",
            "darwin": "${HOME}/Library/Application Support/claude-code/mcp-servers",
            "linux": "${HOME}/.config/claude-code/mcp-servers"
          },
          "configFile": "config.json",
          "autoLoadEnv": false
        },
        "claude-desktop": {
          "name": "Claude Desktop",
          "paths": {
            "win32": "${APPDATA}/Claude/mcp-servers",
            "darwin": "${HOME}/Library/Application Support/Claude/mcp-servers",
            "linux": "${HOME}/.config/Claude/mcp-servers"
          },
          "configFile": "config.json",
          "autoLoadEnv": false
        },
        "cursor": {
          "name": "Cursor",
          "paths": {
            "win32": "${APPDATA}/Cursor/User/globalStorage/mcp-servers",
            "darwin": "${HOME}/Library/Application Support/Cursor/User/globalStorage/mcp-servers",
            "linux": "${HOME}/.config/Cursor/User/globalStorage/mcp-servers"
          },
          "configFile": "config.json",
          "autoLoadEnv": true
        }
      },
      "sensitivePatterns": [
        "password",
        "secret",
        "key",
        "token",
        "auth",
        "credential",
        "private"
      ]
    };
  }

  async getClientPath(clientId) {
    const mappings = await this.loadMappings();
    const client = mappings.clients[clientId];
    
    if (!client) {
      throw new Error(`Unknown client: ${clientId}`);
    }

    const platform = process.platform;
    const pathTemplate = client.paths[platform];
    
    if (!pathTemplate) {
      throw new Error(`No path mapping for ${clientId} on ${platform}`);
    }

    // Resolve environment variables in path
    return this.resolvePath(pathTemplate);
  }

  resolvePath(pathTemplate) {
    return pathTemplate.replace(/\${(\w+)}/g, (match, envVar) => {
      return process.env[envVar] || match;
    });
  }

  async getAvailableClients() {
    const mappings = await this.loadMappings();
    return Object.entries(mappings.clients).map(([id, config]) => ({
      id,
      name: config.name,
      autoLoadEnv: config.autoLoadEnv
    }));
  }

  async addClient(clientId, clientConfig, isGlobal = false) {
    const mappings = await this.loadMappings();
    mappings.clients[clientId] = clientConfig;
    await this.saveMappings(isGlobal);
  }

  async saveMappings(isGlobal = false) {
    const targetPath = isGlobal ? this.globalMappingsPath : this.localMappingsPath;
    const dir = path.dirname(targetPath);
    
    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(targetPath, JSON.stringify(this.mappings, null, 2));
    this.mappings = null; // Clear cache
  }
}
```

### 2.5 Commands Implementation

#### 2.5.1 Interactive Config (`lib/commands/config.js`)
```javascript
async function interactiveConfig(options = {}) {
  const prompts = [
    {
      type: 'input',
      name: 'apiEndpoint',
      message: 'API Endpoint:',
      default: await getExistingValue('apiEndpoint')
    },
    {
      type: 'password',
      name: 'apiKey',
      message: 'API Key:',
      default: await getExistingValue('apiKey')
    },
    {
      type: 'checkbox',
      name: 'clients',
      message: 'Select clients to configure:',
      choices: await getAvailableClients()
    }
  ];

  const answers = await inquirer.prompt(prompts);
  
  // Process each answer
  for (const [key, value] of Object.entries(answers)) {
    if (key !== 'clients' && value) {
      await configManager.setConfig(key, value, options);
    }
  }
  
  // Distribute to selected clients
  if (!options.global) {
    await distributor.distributeToClients(answers.clients);
  }
}
```

---

## 3. Configuration Paths

### 3.1 Local Configuration
- **Non-sensitive**: `./mcp-servers/default.json`
- **Sensitive**: `./mcp-servers/.env`

### 3.2 Global Configuration
- **Non-sensitive**:
  - **Windows**: `%APPDATA%\mcp-servers\global.json`
  - **macOS**: `~/Library/Application Support/mcp-servers/global.json`
  - **Linux**: `~/.config/mcp-servers/global.json`
- **Sensitive**:
  - **Windows**: `%APPDATA%\mcp-servers\.env`
  - **macOS**: `~/Library/Application Support/mcp-servers/.env`
  - **Linux**: `~/.config/mcp-servers/.env`

### 3.3 Library Configuration
- **Client mappings**:
  - **Windows**: `%APPDATA%\devjoy-digital\config-mcp\client-mappings.json`
  - **macOS**: `~/Library/Application Support/devjoy-digital/config-mcp/client-mappings.json`
  - **Linux**: `~/.config/devjoy-digital/config-mcp/client-mappings.json`

---

## 4. Data Structures

### 4.1 Configuration File Schema

#### 4.1.1 JSON Configuration (`default.json` / `global.json`)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "apiEndpoint": {
      "type": "string",
      "format": "uri"
    },
    "settings": {
      "type": "object",
      "properties": {
        "timeout": {
          "type": "number"
        },
        "retryAttempts": {
          "type": "number"
        }
      }
    }
  }
}
```

#### 4.1.2 Environment File Format (`.env`)
```
# Generated by dj-config-mcp
# DO NOT COMMIT THIS FILE TO VERSION CONTROL

API_KEY=sk-1234567890abcdef
DATABASE_PASSWORD=secretpassword123
AUTH_TOKEN=bearer-token-xyz
PRIVATE_CERTIFICATE=-----BEGIN PRIVATE KEY-----...
```

### 4.2 Client Configuration Format

Each client receives a combined configuration in their specific format:

```javascript
// VS Code / Cursor format
{
  "mcp-servers": {
    "[server-name]": {
      "command": "node",
      "args": ["path/to/server.js"],
      "env": {
        // Environment variables from .env
        "API_KEY": "${env:API_KEY}",
        "DATABASE_PASSWORD": "${env:DATABASE_PASSWORD}"
      },
      "config": {
        // Non-sensitive configuration from JSON
        "apiEndpoint": "https://api.example.com",
        "settings": {
          "timeout": 5000
        }
      }
    }
  }
}
```

---

## 5. API Reference

### 5.1 Public API

```javascript
module.exports = {
  /**
   * Interactive configuration wizard
   * @param {Object} options
   * @param {boolean} options.global - Use global configuration
   * @returns {Promise<void>}
   */
  config: async (options = {}) => {},

  /**
   * Set a configuration value
   * @param {string} key - Configuration key (supports dot notation)
   * @param {any} value - Configuration value
   * @param {Object} options
   * @param {boolean} options.global - Use global configuration
   * @returns {Promise<void>}
   */
  configSet: async (key, value, options = {}) => {},

  /**
   * Get configuration value(s)
   * @param {string} [key] - Optional key to retrieve specific value
   * @returns {Promise<any>} Configuration value(s) with source info
   */
  configGet: async (key) => {},

  /**
   * Delete a configuration value
   * @param {string} key - Configuration key to delete
   * @param {Object} options
   * @param {boolean} options.global - Use global configuration
   * @returns {Promise<void>}
   */
  configDelete: async (key, options = {}) => {},

  /**
   * Load environment variables from .env files
   * @returns {Promise<void>}
   */
  loadEnv: async () => {}
};
```

### 5.2 Response Formats

#### configGet Response
```javascript
// Single key
{
  key: "apiKey",
  value: "sk-1234567890abcdef",
  source: "Environment Variable",
  path: "./mcp-servers/.env"
}

// All configurations
[
  {
    key: "apiEndpoint",
    value: "https://api.example.com",
    source: "Local Config",
    path: "./mcp-servers/default.json"
  },
  {
    key: "apiKey",
    value: "sk-1234567890abcdef",
    source: "Environment Variable",
    path: "./mcp-servers/.env"
  }
]
```

---

## 6. Error Handling

### 6.1 Error Codes

```javascript
const ErrorCodes = {
  // File system errors
  PERMISSION_DENIED: 'E_PERMISSION_DENIED',
  FILE_NOT_FOUND: 'E_FILE_NOT_FOUND',
  DIRECTORY_NOT_FOUND: 'E_DIRECTORY_NOT_FOUND',
  
  // Configuration errors
  INVALID_KEY: 'E_INVALID_KEY',
  INVALID_VALUE: 'E_INVALID_VALUE',
  CONFIG_NOT_FOUND: 'E_CONFIG_NOT_FOUND',
  
  // Client errors
  CLIENT_NOT_FOUND: 'E_CLIENT_NOT_FOUND',
  CLIENT_CONFIG_ERROR: 'E_CLIENT_CONFIG_ERROR',
  
  // Security errors
  GITIGNORE_UPDATE_FAILED: 'E_GITIGNORE_UPDATE_FAILED'
};
```

### 6.2 Error Handling Pattern

```javascript
class ConfigError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

// Usage
try {
  await storage.write(path, data);
} catch (error) {
  if (error.code === 'EACCES') {
    throw new ConfigError(
      ErrorCodes.PERMISSION_DENIED,
      `Permission denied writing to ${path}`,
      { path, originalError: error }
    );
  }
  throw error;
}
```

---

## 7. Security Implementation

### 7.1 Sensitive Data Handling

1. **Detection**: Automatic pattern matching for sensitive terms
2. **Storage**: Always route to .env files
3. **Warnings**: User notifications when sensitive data detected
4. **Git Safety**: Automatic .gitignore updates

### 7.2 File Permissions

```javascript
// Set appropriate permissions for sensitive files
async function setSecurePermissions(filePath) {
  if (process.platform !== 'win32') {
    await fs.chmod(filePath, 0o600); // Read/write for owner only
  }
}
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

```javascript
// Example test for sensitive detection
describe('SecurityDetector', () => {
  test('detects sensitive keys', () => {
    const detector = new SecurityDetector();
    
    expect(detector.isSensitive('apiKey')).toBe(true);
    expect(detector.isSensitive('api.secret')).toBe(true);
    expect(detector.isSensitive('password123')).toBe(true);
    expect(detector.isSensitive('endpoint')).toBe(false);
  });
});
```

### 8.2 Integration Tests

```javascript
// Example integration test
describe('ConfigurationManager', () => {
  test('routes sensitive data to env storage', async () => {
    const manager = new ConfigurationManager();
    
    await manager.setConfig('apiKey', 'secret123');
    
    // Verify it's in .env, not JSON
    const envContent = await fs.readFile('./mcp-servers/.env', 'utf8');
    expect(envContent).toContain('API_KEY=secret123');
    
    const jsonContent = await fs.readFile('./mcp-servers/default.json', 'utf8');
    const json = JSON.parse(jsonContent);
    expect(json.apiKey).toBeUndefined();
  });
});
```

---

## 9. Migration Guide

### 9.1 For MCP Server Developers

```javascript
// 1. Install the library
npm install dj-config-mcp

// 2. Import in your MCP server
const djConfig = require('dj-config-mcp');

// 3. Load environment on startup
await djConfig.loadEnv();

// 4. Register commands with your command handler
const commands = {
  'config': (args) => djConfig.config(args),
  'config-set': (args) => djConfig.configSet(args.key, args.value, args.options),
  'config-get': (args) => djConfig.configGet(args.key),
  'config-delete': (args) => djConfig.configDelete(args.key, args.options),
  'config-load-env': () => djConfig.loadEnv()
};

// 5. Use configuration values in your server
const apiKey = process.env.API_KEY || djConfig.configGet('apiKey');
```

---

## 10. Performance Considerations

### 10.1 Caching
- Cache configuration values in memory after first read
- Invalidate cache on configuration changes
- Separate caches for local and global configurations

### 10.2 File I/O Optimization
- Batch write operations when possible
- Use async I/O throughout
- Implement file locking for concurrent access

---

## 11. Compatibility Matrix

| Feature | VS Code | Claude Code | Claude Desktop | Cursor |
|---------|---------|-------------|----------------|---------|
| JSON Config | ✓ | ✓ | ✓ | ✓ |
| Auto .env Load | ✓ | ✗ | ✗ | ✓ |
| Manual .env Load | ✓ | ✓ | ✓ | ✓ |
| Config Distribution | ✓ | ✓ | ✓ | ✓ |

---

*This technical specification provides implementation details for the dj-config-mcp library, complementing the PRD with concrete technical guidance.*
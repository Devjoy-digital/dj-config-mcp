# dj-config-mcp

A configuration management library for MCP (Model Context Protocol) servers. This library provides MCP servers with configuration management capabilities, including automatic sensitive data detection, dual storage system, and client distribution.

## Features

- **Library for MCP Servers**: Import into your MCP server to add configuration management capabilities
- **Automatic Sensitive Data Detection**: Automatically detects and secures values containing terms like "password", "secret", "key", "token", "auth", "credential", or "private"
- **Dual Storage System**: 
  - Sensitive values → `.env` file (as environment variables)
  - Non-sensitive values → `mcp-servers/default.json`
- **Environment Loading**: Built-in support for loading .env files for clients that don't auto-load them
- **Local and Global Configs**: Support for both project-local and system-wide global configurations
- **Client Distribution**: Automatically distribute configurations to supported MCP clients (VS Code, Claude Code, Claude Desktop, Cursor)

## Installation

MCP server developers install this library as a dependency:

```bash
npm install dj-config-mcp
```

## Usage in MCP Servers

### Integration Example

```javascript
// In your MCP server code
const djConfig = require('dj-config-mcp');

// Load environment variables on startup
await djConfig.loadEnv();

// In your command handler
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
    
    // ... your other MCP server commands
  }
}
```

### API Methods

#### `djConfig.config(options)`
Interactive configuration wizard for setting up common values.

```javascript
// Run interactive configuration
await djConfig.config({ global: false });
```

#### `djConfig.configSet(key, value, options)`
Set a configuration value.

```javascript
// Set a non-sensitive value
await djConfig.configSet('server.port', 3000);

// Set a sensitive value (automatically saved to .env)
await djConfig.configSet('api.secret', 'my-secret-key');

// Set global config
await djConfig.configSet('global.setting', 'value', { global: true });
```

#### `djConfig.configGet(key)`
Retrieve configuration values.

```javascript
// Get a specific value
const result = await djConfig.configGet('server.port');
console.log(result); // { key: 'server.port', value: 3000, source: 'Local Config', path: './mcp-servers/default.json' }

// Get all configuration values
const allConfigs = await djConfig.configGet();
```

#### `djConfig.configDelete(key, options)`
Remove a configuration value.

```javascript
// Delete a configuration value
await djConfig.configDelete('server.port');

// Delete from global config
await djConfig.configDelete('global.setting', { global: true });
```

#### `djConfig.loadEnv()`
Load environment variables from .env files. This is called automatically on initialization but can be called manually for clients that don't auto-load .env files.

```javascript
// Load environment variables
await djConfig.loadEnv();
```

## Configuration Storage

### Local Configuration
- **Non-sensitive values**: `./mcp-servers/default.json`
- **Sensitive values**: `./mcp-servers/.env`

### Global Configuration
- **Windows**: `%APPDATA%\mcp-servers\` (global.json, .env)
- **macOS**: `~/Library/Application Support/mcp-servers/` (global.json, .env)
- **Linux**: `~/.config/mcp-servers/` (global.json, .env)

### Library Configuration
- **Windows**: `%APPDATA%\devjoy-digital\config-mcp\client-mappings.json`
- **macOS**: `~/Library/Application Support/devjoy-digital/config-mcp/client-mappings.json`
- **Linux**: `~/.config/devjoy-digital/config-mcp/client-mappings.json`

### Configuration Hierarchy
Values are resolved in this order (first found wins):
1. Environment variables
2. Local config file
3. Global config file

## Sensitive Data Handling

The following keys are automatically detected as sensitive:
- Any key containing: `password`, `secret`, `key`, `token`, `auth`, `credential`, or `private`

Sensitive values are:
- Stored in `.env` file as uppercase environment variables
- Never stored in JSON config files
- Automatically converted (e.g., `api.secret` → `API_SECRET`)
- Protected with appropriate file permissions
- Automatically added to .gitignore

## Client Distribution

When using local configuration, changes are automatically distributed to configured MCP clients:
- **VS Code**: Auto-loads .env files
- **Claude Code**: Requires manual env loading
- **Claude Desktop**: Requires manual env loading
- **Cursor**: Auto-loads .env files

## Client Mappings Configuration

The library stores its own configuration (client path mappings) in a platform-specific location. The default mappings are defined in `config/default-client-mappings.json`. When the library runs for the first time, it copies these defaults to the user's configuration directory where they can be customized.

The configuration uses a client-first structure where each client has both global and local path configurations:

```json
{
  "vscode": {
    "name": "Visual Studio Code",
    "configKey": "mcp-servers",
    "autoLoadEnv": true,
    "configFormat": "structured",
    "global": {
      "config-path": {
        "win32": "${APPDATA}/Code/User/settings.json",
        "darwin": "${HOME}/Library/Application Support/Code/User/settings.json",
        "linux": "${HOME}/.config/Code/User/settings.json"
      },
      "env-path": {
        "win32": "${APPDATA}/Code/User/.${SERVER_NAME}/.env",
        "darwin": "${HOME}/Library/Application Support/Code/User/.${SERVER_NAME}/.env",
        "linux": "${HOME}/.config/Code/User/.${SERVER_NAME}/.env"
      }
    },
    "local": {
      "config-path": {
        "win32": "./.vscode/settings.json",
        "darwin": "./.vscode/settings.json",
        "linux": "./.vscode/settings.json"
      },
      "env-path": {
        "win32": "./.vscode/.${SERVER_NAME}/.env",
        "darwin": "./.vscode/.${SERVER_NAME}/.env",
        "linux": "./.vscode/.${SERVER_NAME}/.env"
      }
    }
  },
  "claude-desktop": {
    "name": "Claude",
    "configKey": "mcp-servers",
    "autoLoadEnv": false,
    "envFormat": "${env:${VAR}}",
    "global": {
      "config-path": {
        "win32": "${APPDATA}/Claude/claude_desktop_config.json",
        "darwin": "${HOME}/Library/Application Support/Claude/claude_desktop_config.json",
        "linux": "${HOME}/.config/Claude/claude_desktop_config.json"
      },
      "env-path": {
        "win32": "${APPDATA}/Claude/.${SERVER_NAME}/.env",
        "darwin": "${HOME}/Library/Application Support/Claude/.${SERVER_NAME}/.env",
        "linux": "${HOME}/.config/Claude/.${SERVER_NAME}/.env"
      }
    },
    "local": {
      "config-path": {
        "win32": "${APPDATA}/Claude/claude_desktop_config.json",
        "darwin": "${HOME}/Library/Application Support/Claude/claude_desktop_config.json",
        "linux": "${HOME}/.config/Claude/claude_desktop_config.json"
      },
      "env-path": {
        "win32": "${APPDATA}/Claude/.${SERVER_NAME}/.env",
        "darwin": "${HOME}/Library/Application Support/Claude/.${SERVER_NAME}/.env",
        "linux": "${HOME}/.config/Claude/.${SERVER_NAME}/.env"
      }
    }
  },
  "sensitivePatterns": ["password", "secret", "key", "token", "auth", "credential", "private"]
}
```

### Client Configuration Properties

- **name**: Display name for the client
- **configKey**: Key used in the client's configuration file (usually "mcp-servers")
- **autoLoadEnv**: Whether the client automatically loads .env files
- **configFormat**: Configuration format ("structured" for VS Code/Cursor, "default" for others)
- **envFormat**: Environment variable reference format (e.g., "${env:${VAR}}" for Claude)
- **global**: Global (system-wide) configuration paths
- **local**: Local (project-specific) configuration paths

### Path Templates

Path templates support environment variable substitution:
- **${HOME}**: User's home directory
- **${APPDATA}**: Windows AppData/Roaming directory
- **${SERVER_NAME}**: Name of the MCP server (for env file paths)

## Example MCP Server Implementation

```javascript
const djConfig = require('dj-config-mcp');

// MCP server initialization
async function initialize() {
  // Load environment variables
  await djConfig.loadEnv();
  
  // Use configuration values
  const apiKey = process.env.API_KEY;
  const serverConfig = await djConfig.configGet('server');
}

// Command handler
async function handleUserCommand(command, args) {
  // Expose configuration commands to users
  if (command.startsWith('config')) {
    switch(command) {
      case 'config':
        return await djConfig.config(args);
      case 'config-set':
        return await djConfig.configSet(args.key, args.value, args.options);
      // ... other config commands
    }
  }
  
  // Your other MCP server commands
}
```

## License

ISC

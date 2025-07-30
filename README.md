# dj-mcp-config

A simple configuration management utility for MCP (Model Context Protocol) servers. This package provides an easy way to manage configuration values, automatically handling sensitive data securely.

## Features

- **Automatic Sensitive Data Detection**: Automatically detects and secures values containing terms like "password", "secret", "key", "token", "auth", "credential", or "private"
- **Dual Storage**: 
  - Sensitive values → `.env` file (as environment variables)
  - Non-sensitive values → `config/default.json`
- **Local and Global Configs**: Support for both project-local and system-wide global configurations
- **Client Distribution**: Automatically distribute configurations to supported MCP clients (VS Code, Claude Code, Claude Desktop, Cursor)
- **Simple CLI**: Easy-to-use command-line interface

## Installation

```bash
npm install dj-mcp-config
```

## Usage

### Commands

#### `mcp-config config`
Interactive configuration setup wizard. Prompts for common configuration values.

```bash
npx mcp-config config
```

Use the `-g` flag to modify global configuration:
```bash
npx mcp-config config -g
```

#### `mcp-config config-set <key> <value>`
Set a specific configuration value.

```bash
# Set a non-sensitive value
npx mcp-config config-set server.port 3000

# Set a sensitive value (automatically saved to .env)
npx mcp-config config-set api.secret "my-secret-key"

# Set global config
npx mcp-config config-set -g global.setting "value"
```

#### `mcp-config config-get [key]`
Retrieve configuration values.

```bash
# Get a specific value
npx mcp-config config-get server.port

# Get all configuration values
npx mcp-config config-get
```

#### `mcp-config config-delete <key>`
Remove a configuration value.

```bash
# Delete a configuration value
npx mcp-config config-delete server.port

# Delete from global config
npx mcp-config config-delete -g global.setting
```

#### `mcp-config config-ui`
Launch a web-based configuration interface with error handling and real-time updates.

```bash
# Launch on default port (3456)
npx mcp-config config-ui

# Launch on custom port
npx mcp-config config-ui -p 8080
```

Features:
- Visual configuration management
- Error message panel for validation feedback
- Real-time updates via WebSocket
- Import/Export functionality
- Grouped configuration display
- Sensitive value protection

## Configuration Storage

### Local Configuration
- **Non-sensitive values**: `./config/default.json`
- **Sensitive values**: `./.env`

### Global Configuration
- **Windows**: `%USERPROFILE%\.mcp-config\global.json`
- **macOS/Linux**: `~/.mcp-config/global.json`

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

## Client Distribution

When using local configuration, changes are automatically distributed to configured MCP clients:
- **VS Code**: Application-specific config directory
- **Claude Code**: Application-specific config directory  
- **Claude Desktop**: Application-specific config directory
- **Cursor**: Application-specific config directory

## Example

```bash
# Set up a new MCP server configuration
npx mcp-config config-set server.name "My MCP Server"
npx mcp-config config-set server.port 3000
npx mcp-config config-set api.key "sk-1234567890"  # Automatically saved to .env

# Check configuration
npx mcp-config config-get

# Output:
# All Configurations:
#   server.name: My MCP Server (Source: Local Config File)
#   server.port: 3000 (Source: Local Config File)
#   api.key: sk-1234567890 (Source: Environment Variable)
```

## Use in MCP Servers

This package is designed to be embedded in other MCP servers. You can use it programmatically:

```javascript
const { execSync } = require('child_process');

// Set a configuration value
execSync('npx mcp-config config-set myserver.setting "value"');

// Retrieve a configuration value
const output = execSync('npx mcp-config config-get myserver.setting', { encoding: 'utf8' });
```

## License

ISC
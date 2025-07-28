# Example Output with Environment Variable References

## What the user sees when running `mcp-config config`:

```
Starting MCP-Config setup...

The application environment. (env) [Current: Not set]: development
The MCP (Model Context Protocol) server port. (mcp.port) [Current: Not set]: 3000
The MCP server host address. (mcp.host) [Current: Not set]: 127.0.0.1
Connection timeout in milliseconds. (mcp.timeout) [Current: Not set]: 30000
The API key for external services. (api.key) [Current: Not set]: sk-1234567890abcdef
🔐 Secret API_KEY saved to .env file as environment variable.
The API secret for external services. (api.secret) [Current: Not set]: secret_xyz123
🔐 Secret API_SECRET saved to .env file as environment variable.

Select target clients (comma-separated, e.g., VS Code, Cursor) [Available: VS Code, Claude Code, Claude Desktop, Cursor] [Current: ]: VS Code, Cursor

Distributing configurations to selected clients...
Created directory for VS Code: C:\Users\User\AppData\Roaming\Code\User
✅ Successfully wrote configuration for VS Code to C:\Users\User\AppData\Roaming\Code\User\mcp-config.json
   (Secrets referenced as environment variables: ${VARIABLE_NAME})
Created directory for Cursor: C:\Users\User\AppData\Roaming\Cursor\User
✅ Successfully wrote configuration for Cursor to C:\Users\User\AppData\Roaming\Cursor\User\mcp-config.json
   (Secrets referenced as environment variables: ${VARIABLE_NAME})

Configuration process complete.

📋 Environment Variables Information:
──────────────────────────────────────────────────

🔐 Sensitive configuration stored as environment variables:
  • api.key → API_KEY
  • api.secret → API_SECRET

💡 How to update environment variables:

🪟 Windows (Command Prompt):
  set API_KEY=your_value_here
  set API_SECRET=your_value_here

🪟 Windows (PowerShell):
  $env:API_KEY="your_value_here"
  $env:API_SECRET="your_value_here"

🐧 Linux/macOS:
  export API_KEY="your_value_here"
  export API_SECRET="your_value_here"

📄 Or add to your .env file (recommended):
  API_KEY=your_value_here
  API_SECRET=your_value_here

⚠️  Note: Client applications will use ${VARIABLE_NAME} references
   Make sure your clients support environment variable expansion.
──────────────────────────────────────────────────
```

## What gets created:

### .env file:
```
API_KEY=sk-1234567890abcdef
API_SECRET=secret_xyz123
```

### config/default.json:
```json
{
  "env": "development",
  "mcp": {
    "port": 3000,
    "host": "127.0.0.1",
    "timeout": 30000
  },
  "api": {
    "baseUrl": "https://api.example.com"
  },
  "clients": {
    "selected": ["VS Code", "Cursor"]
  }
}
```

### VS Code config (C:\Users\User\AppData\Roaming\Code\User\mcp-config.json):
```json
{
  "env": "development",
  "mcp": {
    "port": 3000,
    "host": "127.0.0.1",
    "timeout": 30000
  },
  "api": {
    "key": "${API_KEY}",
    "secret": "${API_SECRET}",
    "baseUrl": "https://api.example.com"
  },
  "clients": {
    "selected": ["VS Code", "Cursor"]
  }
}
```

### Cursor config (C:\Users\User\AppData\Roaming\Cursor\User\mcp-config.json):
```json
{
  "env": "development",
  "mcp": {
    "port": 3000,
    "host": "127.0.0.1",
    "timeout": 30000
  },
  "api": {
    "key": "${API_KEY}",
    "secret": "${API_SECRET}",
    "baseUrl": "https://api.example.com"
  },
  "clients": {
    "selected": ["VS Code", "Cursor"]
  }
}
```

## Security Benefits:

1. **Secrets are NOT in client config files** - only environment variable references
2. **Client applications get the config they need** with references they can expand
3. **Secrets remain in the .env file** which should be .gitignored
4. **Clear instructions** on how to update environment variables
5. **Cross-platform support** with instructions for all operating systems
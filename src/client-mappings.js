const path = require('path');
const os = require('os');

// Helper function to get platform-specific config paths
function getConfigPath(client) {
  const platform = os.platform();
  const home = os.homedir();
  
  switch (client) {
    case 'VS Code':
      if (platform === 'win32') {
        return path.join(home, 'AppData', 'Roaming', 'Code', 'User', 'mcp-config.json');
      } else if (platform === 'darwin') {
        return path.join(home, 'Library', 'Application Support', 'Code', 'User', 'mcp-config.json');
      } else {
        return path.join(home, '.config', 'Code', 'User', 'mcp-config.json');
      }
    case 'Claude Code':
      if (platform === 'win32') {
        return path.join(home, 'AppData', 'Roaming', 'Claude Code', 'mcp-config.json');
      } else if (platform === 'darwin') {
        return path.join(home, 'Library', 'Application Support', 'Claude Code', 'mcp-config.json');
      } else {
        return path.join(home, '.config', 'claude-code', 'mcp-config.json');
      }
    case 'Claude Desktop':
      if (platform === 'win32') {
        return path.join(home, 'AppData', 'Roaming', 'Claude', 'mcp-config.json');
      } else if (platform === 'darwin') {
        return path.join(home, 'Library', 'Application Support', 'Claude', 'mcp-config.json');
      } else {
        return path.join(home, '.config', 'claude', 'mcp-config.json');
      }
    case 'Cursor':
      if (platform === 'win32') {
        return path.join(home, 'AppData', 'Roaming', 'Cursor', 'User', 'mcp-config.json');
      } else if (platform === 'darwin') {
        return path.join(home, 'Library', 'Application Support', 'Cursor', 'User', 'mcp-config.json');
      } else {
        return path.join(home, '.config', 'Cursor', 'User', 'mcp-config.json');
      }
    default:
      // Fallback for unknown clients
      return path.join(home, '.config', client.toLowerCase().replace(/\s+/g, '-'), 'mcp-config.json');
  }
}

const clientMappings = {
  'VS Code': {
    get configPath() { return getConfigPath('VS Code'); },
    format: 'json',
    description: 'Visual Studio Code MCP configuration.'
  },
  'Claude Code': {
    get configPath() { return getConfigPath('Claude Code'); },
    format: 'json',
    description: 'Claude Code MCP configuration.'
  },
  'Claude Desktop': {
    get configPath() { return getConfigPath('Claude Desktop'); },
    format: 'json',
    description: 'Claude Desktop MCP configuration.'
  },
  'Cursor': {
    get configPath() { return getConfigPath('Cursor'); },
    format: 'json',
    description: 'Cursor IDE MCP configuration.'
  }
};

module.exports = clientMappings;

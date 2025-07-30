const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const clientMappings = require('./client-mappings');

// Load environment variables
dotenv.config();

// Function to automatically detect if a key contains sensitive terms
function isSensitiveKey(key) {
  const sensitiveTerms = ['password', 'secret', 'key', 'token', 'auth', 'credential', 'private'];
  const keyLower = key.toLowerCase();
  return sensitiveTerms.some(term => keyLower.includes(term));
}

// Function to save sensitive data to .env
function saveSecretToEnv(key, value) {
  const envPath = path.resolve(process.cwd(), '.env');
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  const envKey = key.toUpperCase().replace(/\./g, '_');
  const regex = new RegExp(`^${envKey}=.*`, 'm');
  if (envContent.match(regex)) {
    envContent = envContent.replace(regex, `${envKey}=${value}`);
  } else {
    envContent += `\n${envKey}=${value}`;
  }
  fs.writeFileSync(envPath, envContent.trim() + '\n');
  console.log(`Secret ${key} saved to .env file.`);
}

// Helper function to get nested value from object
function getNestedValue(obj, key) {
  const keyParts = key.split('.');
  let value = obj;
  for (const part of keyParts) {
    if (value && typeof value === 'object' && part in value) {
      value = value[part];
    } else {
      return undefined;
    }
  }
  return value;
}

// Function to get configuration value and its source
function getConfigValue(key) {
  // Check environment variables first
  const envKey = key.toUpperCase().replace(/\./g, '_');
  if (process.env[envKey]) {
    return { value: process.env[envKey], source: 'Environment Variable' };
  }

  // Check local config
  const localConfigPath = path.resolve(process.cwd(), 'config/default.json');
  if (fs.existsSync(localConfigPath)) {
    try {
      const localConfig = JSON.parse(fs.readFileSync(localConfigPath, 'utf8'));
      const value = getNestedValue(localConfig, key);
      if (value !== undefined) {
        return { value, source: 'Local Config File' };
      }
    } catch (e) {
      console.error(`Error parsing local config file: ${e.message}`);
    }
  }

  // Check global config
  const globalConfigPath = path.resolve(require('os').homedir(), '.mcp-config', 'global.json');
  if (fs.existsSync(globalConfigPath)) {
    try {
      const globalConfig = JSON.parse(fs.readFileSync(globalConfigPath, 'utf8'));
      const value = getNestedValue(globalConfig, key);
      if (value !== undefined) {
        return { value, source: 'Global Config File' };
      }
    } catch (e) {
      console.error(`Error parsing global config file: ${e.message}`);
    }
  }

  return { value: undefined, source: 'Not Found' };
}

// Function to save non-sensitive data to config file
function saveNonSecretToConfig(key, value, isGlobal = false) {
  let configDir, configPath;
  
  if (isGlobal) {
    // Write to global config location
    const homeDir = require('os').homedir();
    configDir = path.resolve(homeDir, '.mcp-config');
    configPath = path.resolve(configDir, 'global.json');
    console.log(`Writing to global configuration: ${configPath}`);
  } else {
    // Write to local config (default behavior)
    configDir = path.resolve(process.cwd(), 'config');
    configPath = path.resolve(configDir, 'default.json');
  }

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  let configData = {};
  if (fs.existsSync(configPath)) {
    try {
      configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
      console.error(`Error parsing config file ${configPath}:`, e.message);
      configData = {};
    }
  }

  // Helper to set nested property
  const setNested = (obj, pathArr, val) => {
    let current = obj;
    for (let i = 0; i < pathArr.length - 1; i++) {
      if (!current[pathArr[i]]) {
        current[pathArr[i]] = {};
      }
      current = current[pathArr[i]];
    }
    current[pathArr[pathArr.length - 1]] = val;
  };

  const keyParts = key.split('.');
  setNested(configData, keyParts, value);

  fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
  console.log(`Non-secret ${key} saved to ${isGlobal ? 'global' : 'local'} config.`);
  
  // If not global, distribute to configured clients
  if (!isGlobal) {
    const currentClients = getConfigValue('clients.selected').value || [];
    if (currentClients.length > 0) {
      distributeConfigToClients(currentClients);
    }
  }
}

// Function to get all config keys from config file
function getAllConfigKeys() {
  const configPath = path.resolve(process.cwd(), 'config/default.json');
  if (!fs.existsSync(configPath)) {
    return [];
  }

  try {
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const keys = [];
    
    const extractKeys = (obj, prefix = '') => {
      for (const key in obj) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          extractKeys(obj[key], fullKey);
        } else {
          keys.push(fullKey);
        }
      }
    };
    
    extractKeys(configData);
    return keys;
  } catch (e) {
    console.error(`Error reading config file: ${e.message}`);
    return [];
  }
}

// Function to distribute configurations to selected clients
function distributeConfigToClients(selectedClients) {
  if (!selectedClients || selectedClients.length === 0) {
    console.log('No clients selected for configuration sharing.');
    return;
  }

  console.log('Distributing configurations to selected clients...');
  
  // Get all current config values
  const configPath = path.resolve(process.cwd(), 'config/default.json');
  let allConfig = {};
  if (fs.existsSync(configPath)) {
    try {
      allConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
      console.error(`Error reading config: ${e.message}`);
      return;
    }
  }

  selectedClients.forEach(clientName => {
    const clientInfo = clientMappings[clientName];
    if (clientInfo) {
      const clientConfigPath = clientInfo.configPath;
      const clientConfigDir = path.dirname(clientConfigPath);

      try {
        if (!fs.existsSync(clientConfigDir)) {
          fs.mkdirSync(clientConfigDir, { recursive: true });
          console.log(`Created directory for ${clientName}: ${clientConfigDir}`);
        }

        fs.writeFileSync(clientConfigPath, JSON.stringify(allConfig, null, 2));
        console.log(`Successfully wrote configuration for ${clientName} to ${clientConfigPath}`);
      } catch (e) {
        console.error(`Error writing configuration for ${clientName}: ${e.message}`);
      }
    } else {
      console.warn(`Warning: No mapping found for client "${clientName}". Skipping.`);
    }
  });
}

module.exports = {
  isSensitiveKey,
  saveSecretToEnv,
  getConfigValue,
  saveNonSecretToConfig,
  getAllConfigKeys,
  distributeConfigToClients
};
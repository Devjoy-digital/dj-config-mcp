#!/usr/bin/env node

const { Command } = require('commander');
const dotenv = require('dotenv');
const convict = require('convict');
const path = require('path');
const fs = require('fs');
const clientMappings = require('./client-mappings'); // Import client mappings

// Load environment variables from .env file
dotenv.config();

const program = new Command();

program
  .name('mcp-config')
  .description('CLI tool for managing MCP server configurations')
  .version('1.3.0');

// --- Schema Discovery and Loading ---
let configSchema;
let loadedSchemaPath;

function loadConfigSchema() {
  const defaultSchemaFileName = 'template-config.json';
  let schemaFilePath;

  try {
    const packageJsonPath = path.resolve(process.cwd(), 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (packageJson.mcpConfig && packageJson.mcpConfig.schema) {
        schemaFilePath = path.resolve(process.cwd(), packageJson.mcpConfig.schema);
        console.log(`Using schema file specified in package.json: ${packageJson.mcpConfig.schema}`);
      }
    }
  } catch (e) {
    console.warn(`Warning: Could not read or parse package.json for schema path: ${e.message}`);
  }

  if (!schemaFilePath) {
    schemaFilePath = path.resolve(process.cwd(), defaultSchemaFileName);
    console.log(`No schema specified in package.json or package.json not found. Defaulting to: ${defaultSchemaFileName}`);
  }

  if (!fs.existsSync(schemaFilePath)) {
    console.error(`Error: Configuration schema file not found at ${schemaFilePath}.`);
    console.error('Please create a schema file (e.g., template-config.json) or specify its path in package.json under "mcpConfig.schema".');
    process.exit(1);
  }

  try {
    const schemaContent = JSON.parse(fs.readFileSync(schemaFilePath, 'utf8'));
    configSchema = convict(schemaContent);
    loadedSchemaPath = schemaFilePath;
    console.log(`Successfully loaded configuration schema from: ${loadedSchemaPath}`);
  } catch (e) {
    console.error(`Error: Failed to parse configuration schema file at ${schemaFilePath}: ${e.message}`);
    process.exit(1);
  }
}

// Load the schema when the script starts
loadConfigSchema();

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

  const regex = new RegExp(`^${key}=.*`, 'm');
  if (envContent.match(regex)) {
    envContent = envContent.replace(regex, `${key}=${value}`);
  } else {
    envContent += `\n${key}=${value}`;
  }
  fs.writeFileSync(envPath, envContent.trim() + '\n');
  console.log(`Secret ${key} saved to .env file.`);
}

// Function to get configuration value and its source
function getConfigValue(key) {
  const configPath = path.resolve(process.cwd(), 'config/default.json');
  let configData = {};
  if (fs.existsSync(configPath)) {
    configData = require(configPath);
  }

  // Check environment variables first
  if (process.env[key]) {
    return { value: process.env[key], source: 'Environment Variable' };
  }

  // Check convict config (which also loads from config files)
  try {
    const value = configSchema.get(key);
    // Determine if the key is marked as sensitive in the schema
    const schemaDefinition = configSchema.getSchema();
    let currentLevel = schemaDefinition.properties;
    let isSensitive = false;
    const parts = key.split('.');
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!currentLevel || !currentLevel[part]) {
        isSensitive = false; // Path not found in schema, assume not sensitive
        break;
      }
      if (i === parts.length - 1) {
        isSensitive = currentLevel[part].sensitive || false;
      } else {
        currentLevel = currentLevel[part].properties;
      }
    }

    if (isSensitive) {
      // If it's sensitive and found via config.get, it means it was loaded from a config file,
      // which is potentially incorrect if it should only be from env.
      return { value: value, source: 'Config File (Potentially Incorrect - Should be Env)' };
    }
    return { value: value, source: 'Config File' };
  } catch (e) {
    // If convict.get throws, it means the key is not defined in the schema
    return { value: undefined, source: 'Not Found' };
  }
}

// Function to check if global config exists
function hasGlobalConfig() {
  const globalConfigPaths = [
    path.resolve(require('os').homedir(), '.mcp-config', 'global.json'),
    path.resolve(require('os').homedir(), '.config', 'mcp-config', 'global.json'),
    '/etc/mcp-config/global.json'
  ];
  
  return globalConfigPaths.some(configPath => fs.existsSync(configPath));
}

// Function to save non-sensitive data to config file
function saveNonSecretToConfig(key, value, allowGlobalOverride = false) {
  // Check for global config protection
  if (hasGlobalConfig() && !allowGlobalOverride) {
    console.log(`⚠️  Global configuration detected. Skipping update of ${key}. Use -g flag to override global configuration.`);
    return;
  }

  const configDir = path.resolve(process.cwd(), 'config');
  const configPath = path.resolve(configDir, 'default.json');

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  let configData = {};
  if (fs.existsSync(configPath)) {
    try {
      configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
      console.error(`Error parsing config file ${configPath}:`, e.message);
      // If parsing fails, initialize with empty object to prevent crash
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
  console.log(`Non-secret ${key} saved to config/default.json.`);
}

// Helper to get all paths from a convict schema
function getAllSchemaPaths(schema, currentPath = '') {
  let paths = [];
  for (const key in schema.properties) {
    const newPath = currentPath ? `${currentPath}.${key}` : key;
    if (schema.properties[key].properties) {
      paths = paths.concat(getAllSchemaPaths(schema.properties[key].properties, newPath));
    } else {
      paths.push(newPath);
    }
  }
  return paths;
}

// Function to distribute configurations to selected clients
function distributeConfigToClients(selectedClients) {
  if (!selectedClients || selectedClients.length === 0) {
    console.log('No clients selected for configuration sharing.');
    return;
  }

  console.log('Distributing configurations to selected clients...');
  const allConfig = configSchema.getProperties(); // Get all current config values

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

        // For now, we'll write the entire current config to the client's config file.
        // In a more advanced scenario, we might filter or transform this based on client needs.
        fs.writeFileSync(clientConfigPath, JSON.stringify(allConfig, null, 2));
        console.log(`Successfully wrote configuration for ${clientName} to ${clientConfigPath}`);
      } catch (e) {
        console.error(`Error writing configuration for ${clientName} to ${clientConfigPath}: ${e.message}`);
      }
    } else {
      console.warn(`Warning: No mapping found for client "${clientName}". Skipping.`);
    }
  });
}


// Helper function to check for missing sensitive values
function getMissingSensitiveValues() {
  const schemaPaths = getAllSchemaPaths(configSchema.getSchema());
  const missing = [];

  for (const keyPath of schemaPaths) {
    const schemaDefinition = configSchema.getSchema();
    let currentLevel = schemaDefinition.properties;
    let isSensitive = false;
    let doc = '';

    const parts = keyPath.split('.');
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!currentLevel || !currentLevel[part]) {
        currentLevel = undefined;
        break;
      }

      if (i === parts.length - 1) {
        isSensitive = currentLevel[part].sensitive || isSensitiveKey(keyPath);
        doc = currentLevel[part].doc || '';
      } else {
        if (currentLevel[part].properties) {
          currentLevel = currentLevel[part].properties;
        } else {
          currentLevel = undefined;
          break;
        }
      }
    }

    if (currentLevel !== undefined && isSensitive) {
      const currentValue = getConfigValue(keyPath).value;
      if (!currentValue || currentValue === '') {
        missing.push({ keyPath, doc });
      }
    }
  }

  return missing;
}

// Config Secrets command - specifically for handling missing sensitive values
program
  .command('config-secrets')
  .description('Configure missing sensitive values only.')
  .action(async () => {
    console.log('Checking for missing sensitive configuration values...');

    const missingSensitive = getMissingSensitiveValues();
    
    if (missingSensitive.length === 0) {
      console.log('✅ All sensitive values are already configured.');
      return;
    }

    console.log('\n🔒 Missing sensitive configuration values detected:');
    console.log('These values will be stored securely in your .env file.\n');
    
    for (const { keyPath, doc } of missingSensitive) {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const promptMessage = `${doc} (${keyPath}): `;
      const answer = await new Promise(resolve => {
        readline.question(promptMessage, input => {
          readline.close();
          resolve(input);
        });
      });

      if (answer && answer.trim() !== '') {
        saveSecretToEnv(keyPath.toUpperCase().replace(/\./g, '_'), answer.trim());
      }
    }
    
    console.log('\n✅ Sensitive values configured securely.');
  });

// Config command
program
  .command('config')
  .option('-g, --global', 'Allow modification of global configuration')
  .description('Guides users through the configuration process.')
  .action(async (options) => {
    console.log('Starting MCP-Config setup...');

    // First, check for missing sensitive values
    const missingSensitive = getMissingSensitiveValues();
    
    if (missingSensitive.length > 0) {
      console.log('\n🔒 Missing sensitive configuration values detected:');
      console.log('These values will be stored securely in your .env file.\n');
      
      for (const { keyPath, doc } of missingSensitive) {
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout
        });

        const promptMessage = `${doc} (${keyPath}): `;
        const answer = await new Promise(resolve => {
          readline.question(promptMessage, input => {
            readline.close();
            resolve(input);
          });
        });

        if (answer && answer.trim() !== '') {
          saveSecretToEnv(keyPath.toUpperCase().replace(/\./g, '_'), answer.trim());
        }
      }
      
      console.log('\n✅ Sensitive values configured securely.\n');
    }

    // Now proceed with the full configuration for all values (including non-sensitive)
    console.log('Configuring all remaining values...\n');
    const schemaPaths = getAllSchemaPaths(configSchema.getSchema());

    for (const keyPath of schemaPaths) {
      const schemaDefinition = configSchema.getSchema(); // Get the full schema definition
      let currentLevel = schemaDefinition.properties; // Start at the top-level properties
      let isSensitive = false;
      let doc = '';
      let defaultValue = '';

      const parts = keyPath.split('.');
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!currentLevel || !currentLevel[part]) {
          currentLevel = undefined; // Path not found
          break;
        }

        if (i === parts.length - 1) { // This is the leaf node
          isSensitive = currentLevel[part].sensitive || isSensitiveKey(keyPath);
          doc = currentLevel[part].doc || '';
          defaultValue = currentLevel[part].default !== undefined ? currentLevel[part].default : '';
        } else { // This is an intermediate node
          if (currentLevel[part].properties) {
            currentLevel = currentLevel[part].properties;
          } else {
            currentLevel = undefined; // Intermediate node does not have further properties
            break;
          }
        }
      }
      if (currentLevel === undefined) { // If path was not fully resolved, skip this iteration
        continue;
      }

      const currentValue = getConfigValue(keyPath).value;
      
      // Skip sensitive values that were already handled above
      if (isSensitive && currentValue && currentValue !== '') {
        continue;
      }
      
      const promptMessage = `${doc} (${keyPath}) [Current: ${currentValue !== undefined ? currentValue : 'Not set'}]: `;

      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise(resolve => {
        readline.question(promptMessage, input => {
          readline.close();
          resolve(input);
        });
      });

      const valueToSave = answer || defaultValue;

      if (valueToSave !== '') {
        if (isSensitive) {
          saveSecretToEnv(keyPath.toUpperCase().replace(/\./g, '_'), valueToSave);
        } else {
          saveNonSecretToConfig(keyPath, valueToSave, options.global);
        }
      }
    }

    // Handle client selection
    const supportedClients = Object.keys(clientMappings);
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    let currentClients = getConfigValue('clients.selected').value || [];
    const clientPrompt = `Select target clients (comma-separated, e.g., VS Code, Cursor) [Available: ${supportedClients.join(', ')}] [Current: ${currentClients.join(', ')}]: `;

    const clientAnswer = await new Promise(resolve => {
      readline.question(clientPrompt, input => {
        readline.close();
        resolve(input);
      });
    });

    let finalSelectedClients = currentClients;
    if (clientAnswer) {
      const newSelectedClients = clientAnswer.split(',').map(c => c.trim()).filter(c => supportedClients.includes(c));
      saveNonSecretToConfig('clients.selected', newSelectedClients, options.global);
      finalSelectedClients = newSelectedClients;
    }

    distributeConfigToClients(finalSelectedClients);
    console.log('Configuration process complete.');
  });

// Get Config command
program
  .command('get-config [key]')
  .description('Retrieves and inspects server configurations.')
  .action((key) => {
    if (key) {
      const { value, source } = getConfigValue(key);
      if (value !== undefined) {
        console.log(`${key}: ${value} (Source: ${source})`);
      } else {
        console.log(`Configuration item "${key}" not found.`);
      }
    } else {
      console.log('All Configurations:');
      const schemaPaths = getAllSchemaPaths(configSchema.getSchema());
      schemaPaths.forEach(keyPath => {
        const { value, source } = getConfigValue(keyPath);
        if (value !== undefined) {
          console.log(`  ${keyPath}: ${value} (Source: ${source})`);
        }
      });
    }
  });

// Update Config command
program
  .command('update-config [key] [value]')
  .option('-g, --global', 'Allow modification of global configuration')
  .description('Modifies existing configuration values.')
  .action(async (key, value, options) => {
    if (!key) {
      console.error('Please provide a configuration key to update.');
      return;
    }

    const schemaDefinition = configSchema.getSchema();
    let currentLevel = schemaDefinition.properties;
    let isSensitive = false;
    let doc = '';
    let defaultValue = '';

    const parts = key.split('.');
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!currentLevel || !currentLevel[part]) {
        console.error(`Configuration key "${key}" not found in schema.`);
        return;
      }
      if (i === parts.length - 1) { // Last part of the path
        isSensitive = currentLevel[part].sensitive || isSensitiveKey(key);
        doc = currentLevel[part].doc || '';
        defaultValue = currentLevel[part].default !== undefined ? currentLevel[part].default : '';
      } else {
        if (currentLevel[part].properties) { // Only move deeper if the current part is an object with properties
          currentLevel = currentLevel[part].properties;
        } else {
          console.error(`Configuration key "${key}" not found in schema (intermediate part is not an object).`);
          return;
        }
      }
    }

    let valueToSave = value;
    if (value === undefined) { // If value not provided as argument, prompt user
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      const promptMessage = `${doc} (${key}) [Current: ${getConfigValue(key).value !== undefined ? getConfigValue(key).value : 'Not set'}]: `;
      valueToSave = await new Promise(resolve => {
        readline.question(promptMessage, input => {
          readline.close();
          resolve(input || defaultValue);
        });
      });
    }

    if (valueToSave !== '') {
      if (isSensitive) {
        saveSecretToEnv(key.toUpperCase().replace(/\./g, '_'), valueToSave);
      } else {
        saveNonSecretToConfig(key, valueToSave, options.global);
      }
    }

    // Re-check and prompt for client selection if needed (as per PRD/Tech Spec)
    const supportedClients = Object.keys(clientMappings);
    const readline = require('readline').create('input', process.stdin, 'output', process.stdout);

    let currentClients = getConfigValue('clients.selected').value || [];
    const clientPrompt = `Select target clients (comma-separated, e.g., VS Code, Cursor) [Available: ${supportedClients.join(', ')}] [Current: ${currentClients.join(', ')}]: `;

    const clientAnswer = await new Promise(resolve => {
      readline.question(clientPrompt, input => {
        readline.close();
        resolve(input);
      });
    });

    let finalSelectedClients = currentClients;
    if (clientAnswer) {
      const newSelectedClients = clientAnswer.split(',').map(c => c.trim()).filter(c => supportedClients.includes(c));
      saveNonSecretToConfig('clients.selected', newSelectedClients);
      finalSelectedClients = newSelectedClients;
    }

    distributeConfigToClients(finalSelectedClients);
    console.log('Configuration update complete.');
  });

program.parse(process.argv);

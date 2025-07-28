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
  .version('1.0.0');

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
    throw new Error(`Configuration schema file not found at ${schemaFilePath}. Please create a schema file (e.g., template-config.json) or specify its path in package.json under "mcpConfig.schema".`);
  }

  try {
    const schemaContent = JSON.parse(fs.readFileSync(schemaFilePath, 'utf8'));
    configSchema = convict(schemaContent);
    loadedSchemaPath = schemaFilePath;
    console.log(`Successfully loaded configuration schema from: ${loadedSchemaPath}`);
  } catch (e) {
    throw new Error(`Failed to parse configuration schema file at ${schemaFilePath}: ${e.message}`);
  }
}

// Load the schema when the script starts
try {
  loadConfigSchema();
} catch (error) {
  console.error(`Error: ${error.message}`);
  console.error('Please fix the schema configuration before running commands.');
  // Set a flag to prevent command execution
  configSchema = null;
}

// Helper function to check if schema is loaded
function ensureSchemaLoaded() {
  if (!configSchema) {
    console.error('Error: Configuration schema not loaded. Please fix schema issues before running commands.');
    return false;
  }
  return true;
}

// Utility function for prompting user input with proper cleanup
async function promptUser(message) {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    return await new Promise(resolve => {
      readline.question(message, input => {
        resolve(input);
      });
    });
  } finally {
    readline.close();
  }
}

// Helper function to get schema property information (moved up to be available early)
function getSchemaPropertyInfo(keyPath) {
  if (!configSchema) {
    return null;
  }
  
  const schemaDefinition = configSchema.getSchema();
  let currentLevel = schemaDefinition._cvtProperties || schemaDefinition.properties;
  let isSensitive = false;
  let doc = '';
  let defaultValue = '';

  const parts = keyPath.split('.');
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!currentLevel || !currentLevel[part]) {
      return null; // Path not found
    }

    if (i === parts.length - 1) { // This is the leaf node
      isSensitive = currentLevel[part].sensitive || false;
      doc = currentLevel[part].doc || '';
      defaultValue = currentLevel[part].default !== undefined ? currentLevel[part].default : '';
    } else { // This is an intermediate node
      // Handle convict nested structure
      if (currentLevel[part]._cvtProperties && currentLevel[part]._cvtProperties.properties) {
        currentLevel = currentLevel[part]._cvtProperties.properties._cvtProperties;
      } else if (currentLevel[part].properties) {
        currentLevel = currentLevel[part].properties;
      } else {
        return null; // Intermediate node does not have further properties
      }
    }
  }

  return { isSensitive, doc, defaultValue };
}

// Function to save sensitive data to .env
function saveSecretToEnv(key, value) {
  const envPath = path.resolve(process.cwd(), '.env');
  let envContent = '';
  
  try {
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Escape special regex characters in the key
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^${escapedKey}=.*`, 'm');
    
    if (envContent.match(regex)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
    
    fs.writeFileSync(envPath, envContent.trim() + '\n');
    console.log(`🔐 Secret ${key} saved to .env file as environment variable.`);
  } catch (error) {
    console.error(`Error saving secret to .env file: ${error.message}`);
    throw new Error(`Failed to save secret ${key} to environment file`);
  }
}

// Function to get configuration value and its source
function getConfigValue(key) {
  // Check environment variables first
  const envKey = key.toUpperCase().replace(/\./g, '_');
  if (process.env[envKey]) {
    return { value: process.env[envKey], source: 'Environment Variable' };
  }

  // Check convict config (which also loads from config files)
  try {
    const value = configSchema.get(key);
    
    // Determine if the key is marked as sensitive in the schema
    const propertyInfo = getSchemaPropertyInfo(key);
    const isSensitive = propertyInfo ? propertyInfo.isSensitive : false;

    if (isSensitive) {
      // If it's sensitive and found via config.get, it means it was loaded from a config file,
      // which is potentially incorrect if it should only be from env.
      return { value: value, source: 'Config File (Potentially Incorrect - Should be Env)' };
    }
    return { value: value, source: 'Config File' };
  } catch (e) {
    // If convict.get throws, it means the key is not defined in the schema or not configured
    return { value: undefined, source: 'Not Found' };
  }
}

// Function to save non-sensitive data to config file
function saveNonSecretToConfig(key, value) {
  const configDir = path.resolve(process.cwd(), 'config');
  const configPath = path.resolve(configDir, 'default.json');

  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    let configData = {};
    if (fs.existsSync(configPath)) {
      try {
        configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch (e) {
        console.warn(`Warning: Error parsing existing config file ${configPath}: ${e.message}`);
        console.warn('Starting with empty configuration object.');
        configData = {};
      }
    }

    // Helper to set nested property
    const setNested = (obj, pathArr, val) => {
      let current = obj;
      for (let i = 0; i < pathArr.length - 1; i++) {
        if (!current[pathArr[i]] || typeof current[pathArr[i]] !== 'object') {
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
  } catch (error) {
    console.error(`Error saving configuration: ${error.message}`);
    throw new Error(`Failed to save configuration ${key} to config file`);
  }
}

// Helper to get all paths from a convict schema
function getAllSchemaPaths(schema, currentPath = '') {
  let paths = [];
  
  // Handle convict's _cvtProperties wrapper
  const properties = schema._cvtProperties || schema.properties || schema;
  
  for (const key in properties) {
    // Skip convict internal properties
    if (key.startsWith('_')) {
      continue;
    }
    
    const newPath = currentPath ? `${currentPath}.${key}` : key;
    const property = properties[key];
    
    // Check if this is a nested object with properties
    const hasNestedProps = (property._cvtProperties && property._cvtProperties.properties && property._cvtProperties.properties._cvtProperties) ||
                          (property.properties && Object.keys(property.properties).length > 0);
    
    if (hasNestedProps) {
      // Handle convict nested structure
      if (property._cvtProperties && property._cvtProperties.properties) {
        paths = paths.concat(getAllSchemaPaths(property._cvtProperties.properties, newPath));
      } else {
        paths = paths.concat(getAllSchemaPaths(property, newPath));
      }
    } else {
      // This is a leaf node, add it to paths
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
  
  try {
    const allConfig = configSchema.getProperties(); // Get all current config values

    selectedClients.forEach(clientName => {
      const clientInfo = clientMappings[clientName];
      if (!clientInfo) {
        console.warn(`Warning: No mapping found for client "${clientName}". Skipping.`);
        return;
      }

      try {
        const clientConfigPath = clientInfo.configPath;
        const clientConfigDir = path.dirname(clientConfigPath);

        // Ensure client config directory exists
        if (!fs.existsSync(clientConfigDir)) {
          fs.mkdirSync(clientConfigDir, { recursive: true });
          console.log(`Created directory for ${clientName}: ${clientConfigDir}`);
        }

        // Replace sensitive data with environment variable references
        const filteredConfig = replaceSensitiveDataWithEnvRefs(allConfig);
        
        fs.writeFileSync(clientConfigPath, JSON.stringify(filteredConfig, null, 2));
        console.log(`✅ Successfully wrote configuration for ${clientName} to ${clientConfigPath}`);
        console.log(`   (Secrets referenced as environment variables: \${VARIABLE_NAME})`);
      } catch (error) {
        console.error(`Error writing configuration for ${clientName}: ${error.message}`);
        console.warn(`Skipping client ${clientName} due to configuration error.`);
      }
    });
  } catch (error) {
    console.error(`Error distributing configurations: ${error.message}`);
    throw new Error('Failed to distribute configurations to clients');
  }
}

// Helper function to replace sensitive data with environment variable references
function replaceSensitiveDataWithEnvRefs(config) {
  const filtered = JSON.parse(JSON.stringify(config)); // Deep clone
  
  try {
    const schema = configSchema.getSchema();
    const sensitivePaths = getSensitivePaths(schema);
    
    // Replace sensitive values with environment variable references
    sensitivePaths.forEach(path => {
      const pathParts = path.split('.');
      let current = filtered;
      
      for (let i = 0; i < pathParts.length - 1; i++) {
        if (!current[pathParts[i]]) return;
        current = current[pathParts[i]];
      }
      
      const lastPart = pathParts[pathParts.length - 1];
      if (current && current.hasOwnProperty(lastPart)) {
        const envVar = path.toUpperCase().replace(/\./g, '_');
        current[lastPart] = `\${${envVar}}`;
      }
    });
  } catch (error) {
    console.warn('Warning: Could not replace sensitive data with environment variable references');
  }
  
  return filtered;
}

// Helper function to get all sensitive paths from schema
function getSensitivePaths(schema, currentPath = '') {
  let sensitivePaths = [];
  
  // Handle convict's _cvtProperties wrapper
  const properties = schema._cvtProperties || schema.properties || schema;
  
  for (const key in properties) {
    // Skip convict internal properties
    if (key.startsWith('_')) {
      continue;
    }
    
    const newPath = currentPath ? `${currentPath}.${key}` : key;
    const property = properties[key];
    
    if (property.sensitive === true) {
      sensitivePaths.push(newPath);
    }
    
    // Check if this is a nested object with properties
    const hasNestedProps = (property._cvtProperties && property._cvtProperties.properties && property._cvtProperties.properties._cvtProperties) ||
                          (property.properties && Object.keys(property.properties).length > 0);
    
    if (hasNestedProps) {
      // Handle convict nested structure
      if (property._cvtProperties && property._cvtProperties.properties) {
        sensitivePaths = sensitivePaths.concat(getSensitivePaths(property._cvtProperties.properties, newPath));
      } else {
        sensitivePaths = sensitivePaths.concat(getSensitivePaths(property, newPath));
      }
    }
  }
  
  return sensitivePaths;
}

// Helper function to display environment variable information
function displayEnvironmentVariableInfo() {
  const schema = configSchema.getSchema();
  const sensitivePaths = getSensitivePaths(schema);
  
  if (sensitivePaths.length === 0) {
    return;
  }
  
  console.log('\n📋 Environment Variables Information:');
  console.log('─'.repeat(50));
  
  console.log('\n🔐 Sensitive configuration stored as environment variables:');
  sensitivePaths.forEach(path => {
    const envVar = path.toUpperCase().replace(/\./g, '_');
    console.log(`  • ${path} → ${envVar}`);
  });
  
  console.log('\n💡 How to update environment variables:');
  console.log('\n🪟 Windows (Command Prompt):');
  sensitivePaths.forEach(path => {
    const envVar = path.toUpperCase().replace(/\./g, '_');
    console.log(`  set ${envVar}=your_value_here`);
  });
  
  console.log('\n🪟 Windows (PowerShell):');
  sensitivePaths.forEach(path => {
    const envVar = path.toUpperCase().replace(/\./g, '_');
    console.log(`  $env:${envVar}="your_value_here"`);
  });
  
  console.log('\n🐧 Linux/macOS:');
  sensitivePaths.forEach(path => {
    const envVar = path.toUpperCase().replace(/\./g, '_');
    console.log(`  export ${envVar}="your_value_here"`);
  });
  
  console.log('\n📄 Or add to your .env file (recommended):');
  sensitivePaths.forEach(path => {
    const envVar = path.toUpperCase().replace(/\./g, '_');
    console.log(`  ${envVar}=your_value_here`);
  });
  
  console.log('\n⚠️  Note: Client applications will use ${VARIABLE_NAME} references');
  console.log('   Make sure your clients support environment variable expansion.');
  console.log('─'.repeat(50));
}


// Helper function to process and save configuration value
async function processConfigValue(keyPath) {
  const propertyInfo = getSchemaPropertyInfo(keyPath);
  if (!propertyInfo) {
    return; // Skip invalid paths
  }

  const { isSensitive, doc, defaultValue } = propertyInfo;
  const currentValue = getConfigValue(keyPath).value;
  const promptMessage = `${doc} (${keyPath}) [Current: ${currentValue !== undefined ? currentValue : 'Not set'}]: `;

  const answer = await promptUser(promptMessage);
  const valueToSave = answer || defaultValue;

  if (valueToSave !== '') {
    try {
      if (isSensitive) {
        saveSecretToEnv(keyPath.toUpperCase().replace(/\./g, '_'), valueToSave);
      } else {
        saveNonSecretToConfig(keyPath, valueToSave);
      }
    } catch (error) {
      console.error(`Failed to save ${keyPath}: ${error.message}`);
      throw error;
    }
  }
}

// Helper function to handle client selection
async function handleClientSelection() {
  const supportedClients = Object.keys(clientMappings);
  
  let currentClients = [];
  try {
    currentClients = configSchema.get('clients.selected') || [];
  } catch (e) {
    // If clients.selected is not set yet, use empty array
    currentClients = [];
  }
  
  const clientPrompt = `Select target clients (comma-separated, e.g., VS Code, Cursor) [Available: ${supportedClients.join(', ')}] [Current: ${currentClients.join(', ')}]: `;

  const clientAnswer = await promptUser(clientPrompt);

  let finalSelectedClients = currentClients;
  if (clientAnswer) {
    const newSelectedClients = clientAnswer.split(',')
      .map(c => c.trim())
      .filter(c => {
        if (!supportedClients.includes(c)) {
          console.warn(`Warning: Unknown client "${c}" ignored. Supported clients: ${supportedClients.join(', ')}`);
          return false;
        }
        return true;
      });
    
    if (newSelectedClients.length > 0) {
      saveNonSecretToConfig('clients.selected', newSelectedClients);
      finalSelectedClients = newSelectedClients;
    } else {
      console.warn('No valid clients selected. Keeping current client selection.');
    }
  }

  return finalSelectedClients;
}


// Config command
program
  .command('config')
  .description('Guides users through the configuration process.')
  .action(async () => {
    if (!ensureSchemaLoaded()) {
      return;
    }
    
    console.log('Starting MCP-Config setup...');

    try {
      const schemaPaths = getAllSchemaPaths(configSchema.getSchema());

      // Process each configuration item
      for (const keyPath of schemaPaths) {
        await processConfigValue(keyPath);
      }

      // Handle client selection
      const finalSelectedClients = await handleClientSelection();

      // Distribute configurations to selected clients
      try {
        distributeConfigToClients(finalSelectedClients);
        console.log('Configuration process complete.');
        
        // Display environment variable information
        displayEnvironmentVariableInfo();
      } catch (error) {
        console.error('Configuration completed but failed to distribute to some clients.');
        console.error('You can manually run the command again to retry distribution.');
        
        // Still show environment variable info even if distribution failed
        displayEnvironmentVariableInfo();
      }
    } catch (error) {
      console.error(`Configuration failed: ${error.message}`);
    }
  });

// Get Config command
program
  .command('get-config [key]')
  .description('Retrieves and inspects server configurations.')
  .action((key) => {
    if (!ensureSchemaLoaded()) {
      return;
    }
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
  .description('Modifies existing configuration values.')
  .action(async (key, value) => {
    if (!ensureSchemaLoaded()) {
      return;
    }
    
    if (!key) {
      console.error('Please provide a configuration key to update.');
      return;
    }

    try {
      // Validate the key exists in schema
      const propertyInfo = getSchemaPropertyInfo(key);
      if (!propertyInfo) {
        console.error(`Configuration key "${key}" not found in schema.`);
        return;
      }

      const { isSensitive, doc, defaultValue } = propertyInfo;

      let valueToSave = value;
      if (value === undefined) { // If value not provided as argument, prompt user
        const currentValue = getConfigValue(key).value;
        const promptMessage = `${doc} (${key}) [Current: ${currentValue !== undefined ? currentValue : 'Not set'}]: `;
        const input = await promptUser(promptMessage);
        valueToSave = input || defaultValue;
      }

      if (valueToSave !== '') {
        if (isSensitive) {
          saveSecretToEnv(key.toUpperCase().replace(/\./g, '_'), valueToSave);
        } else {
          saveNonSecretToConfig(key, valueToSave);
        }
      }

      // Handle client selection
      const finalSelectedClients = await handleClientSelection();

      // Distribute configurations
      try {
        distributeConfigToClients(finalSelectedClients);
        console.log('Configuration update complete.');
        
        // Display environment variable information if we updated a sensitive value
        const updatedPropertyInfo = getSchemaPropertyInfo(key);
        if (updatedPropertyInfo && updatedPropertyInfo.isSensitive) {
          displayEnvironmentVariableInfo();
        }
      } catch (error) {
        console.error('Configuration updated but failed to distribute to some clients.');
        console.error('You can manually run the command again to retry distribution.');
        
        // Still show environment variable info for sensitive updates
        const updatedPropertyInfo = getSchemaPropertyInfo(key);
        if (updatedPropertyInfo && updatedPropertyInfo.isSensitive) {
          displayEnvironmentVariableInfo();
        }
      }
    } catch (error) {
      console.error(`Configuration update failed: ${error.message}`);
    }
  });

program.parse(process.argv);

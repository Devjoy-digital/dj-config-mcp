#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const {
  isSensitiveKey,
  saveSecretToEnv,
  getConfigValue,
  saveNonSecretToConfig,
  getAllConfigKeys,
  distributeConfigToClients
} = require('./config-utils');
const clientMappings = require('./client-mappings');

// Config utilities are already loaded with dotenv

const program = new Command();

program
  .name('mcp-config')
  .description('CLI tool for managing MCP server configurations')
  .version('0.9.0');

// Functions are imported from config-utils.js

// Function to check if global config exists
function hasGlobalConfig() {
  const globalConfigPaths = [
    path.resolve(require('os').homedir(), '.mcp-config', 'global.json'),
    path.resolve(require('os').homedir(), '.config', 'mcp-config', 'global.json'),
    '/etc/mcp-config/global.json'
  ];
  
  return globalConfigPaths.some(configPath => fs.existsSync(configPath));
}

// Duplicate functions removed - using imports from config-utils.js

// Config command - Interactive setup
program
  .command('config')
  .option('-g, --global', 'Allow modification of global configuration')
  .description('Interactive configuration setup')
  .action(async (options) => {
    console.log('Starting MCP-Config setup...');
    console.log('Enter configuration values (press Enter to skip):');

    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const askQuestion = (prompt) => new Promise(resolve => {
      readline.question(prompt, resolve);
    });

    // Simple interactive loop for common config keys
    const commonKeys = [
      'server.name',
      'server.port',
      'server.host',
      'api.key',
      'api.secret',
      'database.url',
      'database.password',
      'auth.token'
    ];

    for (const key of commonKeys) {
      const current = getConfigValue(key);
      const currentValue = current.value !== undefined ? current.value : 'Not set';
      const answer = await askQuestion(`${key} [${currentValue}]: `);
      
      if (answer.trim()) {
        if (isSensitiveKey(key)) {
          saveSecretToEnv(key, answer.trim());
        } else {
          saveNonSecretToConfig(key, answer.trim(), options.global || false);
        }
      }
    }

    // Ask for additional keys
    let addMore = true;
    while (addMore) {
      const newKey = await askQuestion('\nAdd another config key (or press Enter to finish): ');
      if (!newKey.trim()) {
        addMore = false;
        break;
      }

      const newValue = await askQuestion(`Value for ${newKey}: `);
      if (newValue.trim()) {
        if (isSensitiveKey(newKey)) {
          saveSecretToEnv(newKey, newValue.trim());
        } else {
          saveNonSecretToConfig(newKey, newValue.trim(), options.global || false);
        }
      }
    }

    // Handle client selection
    const supportedClients = Object.keys(clientMappings);
    const currentClients = getConfigValue('clients.selected').value || [];
    const clientPrompt = `\nSelect target clients (comma-separated) [${supportedClients.join(', ')}]\nCurrent: ${currentClients.join(', ')}: `;
    
    const clientAnswer = await askQuestion(clientPrompt);
    if (clientAnswer) {
      const selectedClients = clientAnswer.split(',').map(c => c.trim()).filter(c => supportedClients.includes(c));
      saveNonSecretToConfig('clients.selected', selectedClients, options.global || false);
      // Distribution happens automatically in saveNonSecretToConfig when not global
    }

    readline.close();
    console.log('\nConfiguration complete.');
  });

// Config Get command
program
  .command('config-get [key]')
  .description('Retrieve configuration values')
  .action((key) => {
    if (key) {
      const { value, source } = getConfigValue(key);
      if (value !== undefined) {
        console.log(`${key}: ${value} (Source: ${source})`);
      } else {
        console.log(`Configuration key "${key}" not found.`);
      }
    } else {
      console.log('All Configurations:');
      const keys = getAllConfigKeys();
      
      // Also check for relevant env variables from .env file
      if (fs.existsSync('.env')) {
        const envContent = fs.readFileSync('.env', 'utf8');
        const envLines = envContent.split('\n').filter(line => line.includes('='));
        envLines.forEach(line => {
          const [envKey] = line.split('=');
          if (envKey) {
            const configKey = envKey.toLowerCase().replace(/_/g, '.');
            if (!keys.includes(configKey)) {
              keys.push(configKey);
            }
          }
        });
      }

      keys.forEach(key => {
        const { value, source } = getConfigValue(key);
        if (value !== undefined) {
          console.log(`  ${key}: ${value} (Source: ${source})`);
        }
      });
    }
  });

// Config Set command
program
  .command('config-set <key> <value>')
  .option('-g, --global', 'Allow modification of global configuration')
  .description('Set a configuration value')
  .action((key, value, options) => {
    if (isSensitiveKey(key)) {
      saveSecretToEnv(key, value);
    } else {
      saveNonSecretToConfig(key, value, options.global || false);
    }
    console.log(`Configuration set: ${key}`);
  });

// Config Delete command
program
  .command('config-delete <key>')
  .option('-g, --global', 'Allow modification of global configuration')
  .description('Delete a configuration value')
  .action((key, options) => {
    if (isSensitiveKey(key)) {
      // Remove from .env file
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        const envKey = key.toUpperCase().replace(/\./g, '_');
        const regex = new RegExp(`^${envKey}=.*\n?`, 'gm');
        envContent = envContent.replace(regex, '');
        fs.writeFileSync(envPath, envContent.trim() + '\n');
        console.log(`Removed ${key} from .env file.`);
      }
    } else {
      // Remove from config file
      let configPath;
      if (options.global) {
        const homeDir = require('os').homedir();
        configPath = path.resolve(homeDir, '.mcp-config', 'global.json');
      } else {
        configPath = path.resolve(process.cwd(), 'config/default.json');
      }
      if (fs.existsSync(configPath)) {
        try {
          let configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          
          // Delete nested property
          const keyParts = key.split('.');
          let current = configData;
          for (let i = 0; i < keyParts.length - 1; i++) {
            if (current[keyParts[i]]) {
              current = current[keyParts[i]];
            } else {
              console.log(`Configuration key "${key}" not found.`);
              return;
            }
          }
          
          delete current[keyParts[keyParts.length - 1]];
          fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
          console.log(`Removed ${key} from ${options.global ? 'global' : 'local'} config file.`);
          
          // If not global, distribute to configured clients
          if (!options.global) {
            const currentClients = getConfigValue('clients.selected').value || [];
            if (currentClients.length > 0) {
              distributeConfigToClients(currentClients);
            }
          }
        } catch (e) {
          console.error(`Error updating config file: ${e.message}`);
        }
      }
    }
  });

// Config UI command
program
  .command('config-ui')
  .option('-p, --port <port>', 'Port for web UI', '3456')
  .description('Launch web configuration interface')
  .action((options) => {
    const configUI = require('./config-ui-server');
    configUI.start(options.port);
  });

program.parse(process.argv);
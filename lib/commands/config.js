/**
 * Interactive Configuration Command
 * Provides a guided setup wizard
 */

const readline = require('readline');

/**
 * Interactive configuration command
 * @param {ConfigurationManager} configManager - Configuration manager instance
 * @param {Object} options - Command options
 * @returns {Promise<void>}
 */
async function configCommand(configManager, options = {}) {
  console.log('dj-config-mcp Configuration Wizard');
  console.log('==================================');
  console.log('');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const prompt = (question) => new Promise((resolve) => {
    rl.question(question, resolve);
  });

  try {
    // Common configuration prompts
    const configs = [
      {
        key: 'apiEndpoint',
        prompt: 'API Endpoint',
        type: 'url'
      },
      {
        key: 'apiKey',
        prompt: 'API Key',
        type: 'password'
      },
      {
        key: 'database.host',
        prompt: 'Database Host',
        type: 'text'
      },
      {
        key: 'database.port',
        prompt: 'Database Port',
        type: 'number',
        default: '5432'
      },
      {
        key: 'database.name',
        prompt: 'Database Name',
        type: 'text'
      },
      {
        key: 'database.user',
        prompt: 'Database User',
        type: 'text'
      },
      {
        key: 'database.password',
        prompt: 'Database Password',
        type: 'password'
      }
    ];

    // Process each configuration
    for (const config of configs) {
      // Get current value
      const current = await configManager.getConfig(config.key);
      const currentValue = current?.value || '';
      
      // Build prompt message
      let promptMsg = `${config.prompt}`;
      if (currentValue && config.type !== 'password') {
        promptMsg += ` [${currentValue}]`;
      } else if (currentValue && config.type === 'password') {
        promptMsg += ' [****]';
      } else if (config.default) {
        promptMsg += ` [${config.default}]`;
      }
      promptMsg += ': ';

      // Get user input
      const input = await prompt(promptMsg);
      
      // Process input
      let value = input.trim();
      if (!value && currentValue) {
        // Keep current value
        continue;
      } else if (!value && config.default) {
        value = config.default;
      }

      if (value) {
        // Validate based on type
        if (config.type === 'number' && isNaN(value)) {
          console.log(`Invalid number: ${value}`);
          continue;
        }

        // Set configuration
        await configManager.setConfig(config.key, value, options);
      }
    }

    // Ask about custom configurations
    console.log('\nWould you like to add custom configuration values?');
    const addCustom = await prompt('Add custom values? (y/N): ');
    
    if (addCustom.toLowerCase() === 'y') {
      while (true) {
        const key = await prompt('Configuration key (or press Enter to finish): ');
        if (!key.trim()) break;
        
        const value = await prompt('Value: ');
        if (value.trim()) {
          await configManager.setConfig(key.trim(), value.trim(), options);
        }
      }
    }

    // Client selection (local only)
    if (!options.global) {
      console.log('\nSelect clients to configure:');
      const clients = await configManager.getAvailableClients();
      
      for (let i = 0; i < clients.length; i++) {
        console.log(`${i + 1}. ${clients[i].name}${clients[i].autoLoadEnv ? '' : ' (requires manual env loading)'}`);
      }
      
      const clientSelection = await prompt('Enter client numbers separated by commas (e.g., 1,3) or "all": ');
      
      let selectedClients = [];
      if (clientSelection.trim().toLowerCase() === 'all') {
        selectedClients = clients.map(c => c.id);
      } else {
        const indices = clientSelection.split(',').map(s => parseInt(s.trim()) - 1);
        selectedClients = indices
          .filter(i => i >= 0 && i < clients.length)
          .map(i => clients[i].id);
      }

      if (selectedClients.length > 0) {
        console.log('\nDistributing configuration to selected clients...');
        await configManager.distributeToClients(selectedClients);
      }
    }

    console.log('\nConfiguration complete!');
    
  } finally {
    rl.close();
  }
}

module.exports = configCommand;
const express = require('express');
const open = require('open');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

// Import functions from index.js
const { 
  getConfigValue, 
  saveNonSecretToConfig, 
  saveSecretToEnv, 
  isSensitiveKey, 
  getAllConfigKeys,
  distributeConfigToClients 
} = require('./config-utils');

function start(port = 3456) {
  const app = express();
  
  // Middleware
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../ui')));
  
  // WebSocket server for real-time updates
  const server = app.listen(port, () => {
    console.log(`\n🌐 Config UI running at http://localhost:${port}`);
    console.log('Press Ctrl+C to stop the server\n');
    open(`http://localhost:${port}`);
  });
  
  const wss = new WebSocket.Server({ server });
  
  // Broadcast updates to all connected clients
  function broadcast(data) {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }
  
  // API Routes
  
  // Get all configurations
  app.get('/api/config', (req, res) => {
    try {
      const configs = {};
      const keys = getAllConfigKeys();
      
      // Also check .env file for sensitive values
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
      
      // Get all config values with their sources
      keys.forEach(key => {
        const { value, source } = getConfigValue(key);
        if (value !== undefined) {
          const parts = key.split('.');
          let current = configs;
          
          // Build nested structure
          for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) {
              current[parts[i]] = {};
            }
            current = current[parts[i]];
          }
          
          current[parts[parts.length - 1]] = {
            value,
            source,
            sensitive: isSensitiveKey(key),
            key: key
          };
        }
      });
      
      res.json({ configs, error: null });
    } catch (error) {
      console.error('Error getting configs:', error);
      res.status(500).json({ 
        configs: {}, 
        error: `Failed to load configurations: ${error.message}` 
      });
    }
  });
  
  // Set a configuration value
  app.post('/api/config/:key', (req, res) => {
    try {
      const { key } = req.params;
      const { value, isGlobal } = req.body;
      
      if (!key) {
        return res.status(400).json({ 
          success: false, 
          error: 'Configuration key is required' 
        });
      }
      
      if (value === undefined || value === null) {
        return res.status(400).json({ 
          success: false, 
          error: 'Configuration value is required' 
        });
      }
      
      // Save the configuration
      if (isSensitiveKey(key)) {
        saveSecretToEnv(key, value.toString());
      } else {
        saveNonSecretToConfig(key, value.toString(), isGlobal || false);
      }
      
      // Broadcast update to all clients
      broadcast({
        type: 'update',
        key,
        value,
        source: isSensitiveKey(key) ? 'Environment Variable' : 
                (isGlobal ? 'Global Config File' : 'Local Config File')
      });
      
      res.json({ 
        success: true, 
        message: `Configuration '${key}' updated successfully` 
      });
    } catch (error) {
      console.error('Error setting config:', error);
      res.status(500).json({ 
        success: false, 
        error: `Failed to update configuration: ${error.message}` 
      });
    }
  });
  
  // Delete a configuration value
  app.delete('/api/config/:key', (req, res) => {
    try {
      const { key } = req.params;
      const { isGlobal } = req.query;
      
      if (!key) {
        return res.status(400).json({ 
          success: false, 
          error: 'Configuration key is required' 
        });
      }
      
      // Import delete logic from index.js or implement here
      if (isSensitiveKey(key)) {
        const envPath = path.resolve(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
          let envContent = fs.readFileSync(envPath, 'utf8');
          const envKey = key.toUpperCase().replace(/\./g, '_');
          const regex = new RegExp(`^${envKey}=.*\n?`, 'gm');
          envContent = envContent.replace(regex, '');
          fs.writeFileSync(envPath, envContent.trim() + '\n');
        }
      } else {
        let configPath;
        if (isGlobal === 'true') {
          const homeDir = require('os').homedir();
          configPath = path.resolve(homeDir, '.mcp-config', 'global.json');
        } else {
          configPath = path.resolve(process.cwd(), 'config/default.json');
        }
        
        if (fs.existsSync(configPath)) {
          let configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          
          // Delete nested property
          const keyParts = key.split('.');
          let current = configData;
          for (let i = 0; i < keyParts.length - 1; i++) {
            if (current[keyParts[i]]) {
              current = current[keyParts[i]];
            } else {
              return res.status(404).json({ 
                success: false, 
                error: `Configuration '${key}' not found` 
              });
            }
          }
          
          delete current[keyParts[keyParts.length - 1]];
          fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
          
          // Distribute to clients if not global
          if (isGlobal !== 'true') {
            const currentClients = getConfigValue('clients.selected').value || [];
            if (currentClients.length > 0) {
              distributeConfigToClients(currentClients);
            }
          }
        }
      }
      
      // Broadcast deletion to all clients
      broadcast({
        type: 'delete',
        key
      });
      
      res.json({ 
        success: true, 
        message: `Configuration '${key}' deleted successfully` 
      });
    } catch (error) {
      console.error('Error deleting config:', error);
      res.status(500).json({ 
        success: false, 
        error: `Failed to delete configuration: ${error.message}` 
      });
    }
  });
  
  // Validate configuration value
  app.post('/api/validate/:key', (req, res) => {
    try {
      const { key } = req.params;
      const { value } = req.body;
      
      // Basic validation rules
      const validations = [];
      
      // Check if it's a port number
      if (key.includes('port')) {
        const port = parseInt(value);
        if (isNaN(port) || port < 1 || port > 65535) {
          validations.push('Port must be a number between 1 and 65535');
        }
      }
      
      // Check if it's a URL
      if (key.includes('url') || key.includes('endpoint')) {
        try {
          new URL(value);
        } catch {
          validations.push('Must be a valid URL');
        }
      }
      
      // Check if it's an email
      if (key.includes('email')) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          validations.push('Must be a valid email address');
        }
      }
      
      res.json({ 
        valid: validations.length === 0,
        errors: validations 
      });
    } catch (error) {
      res.status(500).json({ 
        valid: false, 
        errors: [`Validation error: ${error.message}`] 
      });
    }
  });
  
  // Export configuration
  app.get('/api/export', (req, res) => {
    try {
      const configs = {};
      const keys = getAllConfigKeys();
      
      keys.forEach(key => {
        const { value } = getConfigValue(key);
        if (value !== undefined) {
          const parts = key.split('.');
          let current = configs;
          
          for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) {
              current[parts[i]] = {};
            }
            current = current[parts[i]];
          }
          
          current[parts[parts.length - 1]] = value;
        }
      });
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="mcp-config-export.json"');
      res.send(JSON.stringify(configs, null, 2));
    } catch (error) {
      res.status(500).json({ 
        error: `Export failed: ${error.message}` 
      });
    }
  });
  
  // Import configuration
  app.post('/api/import', express.raw({ type: 'application/json' }), (req, res) => {
    try {
      const configs = JSON.parse(req.body);
      let imported = 0;
      let errors = [];
      
      function processConfig(obj, prefix = '') {
        for (const key in obj) {
          const fullKey = prefix ? `${prefix}.${key}` : key;
          
          if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            processConfig(obj[key], fullKey);
          } else {
            try {
              if (isSensitiveKey(fullKey)) {
                saveSecretToEnv(fullKey, obj[key].toString());
              } else {
                saveNonSecretToConfig(fullKey, obj[key].toString());
              }
              imported++;
            } catch (error) {
              errors.push(`Failed to import ${fullKey}: ${error.message}`);
            }
          }
        }
      }
      
      processConfig(configs);
      
      broadcast({ type: 'refresh' });
      
      res.json({ 
        success: errors.length === 0,
        imported,
        errors,
        message: `Imported ${imported} configuration values${errors.length > 0 ? ` with ${errors.length} errors` : ' successfully'}` 
      });
    } catch (error) {
      res.status(400).json({ 
        success: false,
        error: `Import failed: ${error.message}` 
      });
    }
  });
  
  // Handle WebSocket connections
  wss.on('connection', (ws) => {
    console.log('New client connected to Config UI');
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
    
    ws.on('close', () => {
      console.log('Client disconnected from Config UI');
    });
  });
  
  return server;
}

module.exports = { start };
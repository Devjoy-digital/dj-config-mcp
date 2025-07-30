// Global state
let configs = {};
let ws = null;
let deleteKey = null;
let editingKey = null;
const errors = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadConfigs();
  setupWebSocket();
  setupSearch();
  setupKeyboardShortcuts();
});

// Error handling
function showError(message) {
  errors.push({
    id: Date.now(),
    message,
    timestamp: new Date().toLocaleTimeString()
  });
  renderErrors();
}

function renderErrors() {
  const errorPanel = document.getElementById('error-panel');
  const errorList = document.getElementById('error-list');
  
  if (errors.length === 0) {
    errorPanel.style.display = 'none';
    return;
  }
  
  errorPanel.style.display = 'block';
  errorList.innerHTML = errors.map(error => `
    <div class="error-item">
      <span>${error.timestamp} - ${error.message}</span>
    </div>
  `).join('');
}

function clearErrors() {
  errors.length = 0;
  renderErrors();
}

// Success messages
function showSuccess(message) {
  const successPanel = document.getElementById('success-panel');
  const successMessage = document.getElementById('success-message');
  
  successMessage.textContent = message;
  successPanel.style.display = 'block';
  
  setTimeout(() => {
    hideSuccess();
  }, 5000);
}

function hideSuccess() {
  document.getElementById('success-panel').style.display = 'none';
}

// Loading
function showLoading() {
  document.getElementById('loading').style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loading').style.display = 'none';
}

// WebSocket connection
function setupWebSocket() {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${wsProtocol}//${window.location.host}`);
  
  ws.onopen = () => {
    console.log('Connected to Config UI server');
    clearErrors();
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  };
  
  ws.onerror = (error) => {
    showError('WebSocket connection error. Some features may not work in real-time.');
    console.error('WebSocket error:', error);
  };
  
  ws.onclose = () => {
    showError('Lost connection to server. Please refresh the page.');
    setTimeout(setupWebSocket, 5000); // Reconnect after 5 seconds
  };
}

function handleWebSocketMessage(data) {
  switch (data.type) {
    case 'update':
      // Update the specific config value
      updateConfigValue(data.key, data.value, data.source);
      showSuccess(`Configuration '${data.key}' updated by another user`);
      break;
    case 'delete':
      // Remove the config value
      removeConfigValue(data.key);
      showSuccess(`Configuration '${data.key}' deleted by another user`);
      break;
    case 'refresh':
      // Reload all configs
      loadConfigs();
      break;
  }
}

// Load configurations
async function loadConfigs() {
  showLoading();
  try {
    const response = await fetch('/api/config');
    const data = await response.json();
    
    if (data.error) {
      showError(data.error);
    } else {
      configs = data.configs;
      renderConfigs();
    }
  } catch (error) {
    showError(`Failed to load configurations: ${error.message}`);
  } finally {
    hideLoading();
  }
}

// Render configurations
function renderConfigs() {
  const container = document.getElementById('config-container');
  const searchTerm = document.getElementById('search').value.toLowerCase();
  
  // Group configs by top-level key
  const groups = {};
  
  function processConfig(obj, prefix = '', group = '') {
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const currentGroup = group || key;
      
      if (typeof obj[key] === 'object' && obj[key] !== null && !obj[key].hasOwnProperty('value')) {
        processConfig(obj[key], fullKey, currentGroup);
      } else {
        if (!searchTerm || fullKey.toLowerCase().includes(searchTerm)) {
          if (!groups[currentGroup]) {
            groups[currentGroup] = [];
          }
          groups[currentGroup].push({
            key: obj[key].key || fullKey,
            ...obj[key]
          });
        }
      }
    }
  }
  
  processConfig(configs);
  
  // Render groups
  container.innerHTML = Object.entries(groups).map(([groupName, items]) => `
    <div class="config-group">
      <div class="config-group-header" onclick="toggleGroup('${groupName}')">
        <span>${groupName.charAt(0).toUpperCase() + groupName.slice(1)} Configuration</span>
        <span class="chevron" id="chevron-${groupName}">▼</span>
      </div>
      <div class="config-group-content" id="group-${groupName}">
        ${items.map(item => renderConfigItem(item)).join('')}
      </div>
    </div>
  `).join('');
  
  // Add uncategorized configs
  const uncategorized = [];
  
  function findUncategorized(obj, prefix = '') {
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (obj[key] && obj[key].hasOwnProperty('value') && !key.includes('.')) {
        if (!searchTerm || fullKey.toLowerCase().includes(searchTerm)) {
          uncategorized.push({
            key: obj[key].key || fullKey,
            ...obj[key]
          });
        }
      }
    }
  }
  
  findUncategorized(configs);
  
  if (uncategorized.length > 0) {
    container.innerHTML += `
      <div class="config-group">
        <div class="config-group-header" onclick="toggleGroup('other')">
          <span>Other Configuration</span>
          <span class="chevron" id="chevron-other">▼</span>
        </div>
        <div class="config-group-content" id="group-other">
          ${uncategorized.map(item => renderConfigItem(item)).join('')}
        </div>
      </div>
    `;
  }
}

function renderConfigItem(item) {
  const inputType = item.sensitive ? 'password' : 'text';
  const sensitiveClass = item.sensitive ? 'sensitive' : '';
  const lockIcon = item.sensitive ? '<span class="lock-icon">🔒</span>' : '';
  
  return `
    <div class="config-item" data-key="${item.key}">
      <div class="config-key">${item.key}</div>
      <div class="config-value-wrapper">
        <input type="${inputType}" 
               class="config-value ${sensitiveClass}" 
               value="${escapeHtml(item.value)}" 
               data-original="${escapeHtml(item.value)}"
               onchange="updateConfig('${item.key}', this.value)"
               onblur="validateAndUpdate('${item.key}', this)">
        <span class="config-source">${item.source}</span>
        ${lockIcon}
        <div class="config-actions">
          <button class="btn btn-icon" onclick="editConfig('${item.key}')" title="Edit">✏️</button>
          <button class="btn btn-icon" onclick="deleteConfig('${item.key}')" title="Delete">🗑️</button>
        </div>
      </div>
    </div>
  `;
}

// Toggle group visibility
function toggleGroup(groupName) {
  const content = document.getElementById(`group-${groupName}`);
  const chevron = document.getElementById(`chevron-${groupName}`);
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    chevron.classList.remove('rotated');
  } else {
    content.style.display = 'none';
    chevron.classList.add('rotated');
  }
}

// Update configuration
async function updateConfig(key, value) {
  try {
    const response = await fetch(`/api/config/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showSuccess(result.message);
    } else {
      showError(result.error);
      // Revert the value
      const input = document.querySelector(`[data-key="${key}"] input`);
      if (input) {
        input.value = input.getAttribute('data-original');
      }
    }
  } catch (error) {
    showError(`Failed to update configuration: ${error.message}`);
  }
}

// Validate and update
async function validateAndUpdate(key, input) {
  const value = input.value;
  const original = input.getAttribute('data-original');
  
  if (value === original) return;
  
  // Validate first
  try {
    const response = await fetch(`/api/validate/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value })
    });
    
    const result = await response.json();
    
    if (!result.valid) {
      showError(`Validation failed for ${key}: ${result.errors.join(', ')}`);
      input.value = original;
      return;
    }
    
    // If valid, update
    await updateConfig(key, value);
    input.setAttribute('data-original', value);
  } catch (error) {
    showError(`Validation error: ${error.message}`);
    input.value = original;
  }
}

// Delete configuration
function deleteConfig(key) {
  deleteKey = key;
  document.getElementById('delete-key-name').textContent = key;
  document.getElementById('delete-dialog').style.display = 'flex';
}

function hideDeleteDialog() {
  document.getElementById('delete-dialog').style.display = 'none';
  deleteKey = null;
}

async function confirmDelete() {
  if (!deleteKey) return;
  
  try {
    const response = await fetch(`/api/config/${deleteKey}`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (result.success) {
      showSuccess(result.message);
      removeConfigValue(deleteKey);
    } else {
      showError(result.error);
    }
  } catch (error) {
    showError(`Failed to delete configuration: ${error.message}`);
  } finally {
    hideDeleteDialog();
  }
}

// Add/Edit configuration
function showAddDialog() {
  editingKey = null;
  document.getElementById('dialog-title').textContent = 'Add Configuration';
  document.getElementById('config-key').value = '';
  document.getElementById('config-value').value = '';
  document.getElementById('config-global').checked = false;
  document.getElementById('config-key').disabled = false;
  document.getElementById('dialog-overlay').style.display = 'flex';
}

function editConfig(key) {
  editingKey = key;
  const item = findConfigItem(key);
  
  document.getElementById('dialog-title').textContent = 'Edit Configuration';
  document.getElementById('config-key').value = key;
  document.getElementById('config-key').disabled = true;
  document.getElementById('config-value').value = item.value;
  document.getElementById('config-global').checked = item.source === 'Global Config File';
  document.getElementById('dialog-overlay').style.display = 'flex';
}

function hideDialog() {
  document.getElementById('dialog-overlay').style.display = 'none';
  document.getElementById('value-error').textContent = '';
}

async function saveConfig(event) {
  event.preventDefault();
  
  const key = document.getElementById('config-key').value;
  const value = document.getElementById('config-value').value;
  const isGlobal = document.getElementById('config-global').checked;
  
  // Validate first
  try {
    const response = await fetch(`/api/validate/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value })
    });
    
    const result = await response.json();
    
    if (!result.valid) {
      document.getElementById('value-error').textContent = result.errors.join(', ');
      return;
    }
  } catch (error) {
    document.getElementById('value-error').textContent = 'Validation failed';
    return;
  }
  
  // Save
  try {
    const response = await fetch(`/api/config/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value, isGlobal })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showSuccess(result.message);
      hideDialog();
      if (!editingKey) {
        // If adding new, reload to show it
        loadConfigs();
      }
    } else {
      showError(result.error);
    }
  } catch (error) {
    showError(`Failed to save configuration: ${error.message}`);
  }
}

// Export/Import
async function exportConfig() {
  try {
    const response = await fetch('/api/export');
    const blob = await response.blob();
    
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mcp-config-export.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showSuccess('Configuration exported successfully');
  } catch (error) {
    showError(`Export failed: ${error.message}`);
  }
}

async function importConfig(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const response = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: text
    });
    
    const result = await response.json();
    
    if (result.success) {
      showSuccess(result.message);
      loadConfigs();
    } else {
      showError(result.error || 'Import failed');
      if (result.errors && result.errors.length > 0) {
        result.errors.forEach(err => showError(err));
      }
    }
  } catch (error) {
    showError(`Import failed: ${error.message}`);
  }
  
  // Reset file input
  event.target.value = '';
}

// Refresh
function refreshConfigs() {
  clearErrors();
  loadConfigs();
}

// Search
function setupSearch() {
  const searchInput = document.getElementById('search');
  let searchTimeout;
  
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      renderConfigs();
    }, 300);
  });
}

// Keyboard shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K for search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('search').focus();
    }
    
    // Ctrl/Cmd + N for new config
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      showAddDialog();
    }
    
    // Escape to close dialogs
    if (e.key === 'Escape') {
      hideDialog();
      hideDeleteDialog();
      hideSuccess();
    }
  });
}

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function findConfigItem(key) {
  function search(obj) {
    for (const k in obj) {
      if (obj[k] && obj[k].key === key) {
        return obj[k];
      }
      if (typeof obj[k] === 'object' && !obj[k].hasOwnProperty('value')) {
        const result = search(obj[k]);
        if (result) return result;
      }
    }
  }
  return search(configs);
}

function updateConfigValue(key, value, source) {
  function update(obj) {
    for (const k in obj) {
      if (obj[k] && obj[k].key === key) {
        obj[k].value = value;
        obj[k].source = source;
        return true;
      }
      if (typeof obj[k] === 'object' && !obj[k].hasOwnProperty('value')) {
        if (update(obj[k])) return true;
      }
    }
  }
  update(configs);
  renderConfigs();
}

function removeConfigValue(key) {
  function remove(obj, parent, parentKey) {
    for (const k in obj) {
      if (obj[k] && obj[k].key === key) {
        delete obj[k];
        // If parent is now empty, remove it too
        if (parent && Object.keys(obj).length === 0) {
          delete parent[parentKey];
        }
        return true;
      }
      if (typeof obj[k] === 'object' && !obj[k].hasOwnProperty('value')) {
        if (remove(obj[k], obj, k)) return true;
      }
    }
  }
  remove(configs);
  renderConfigs();
}
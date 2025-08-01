const configSet = require('../../lib/commands/config-set');
const ConfigurationManager = require('../../lib/config/manager');

// Mock ConfigurationManager
jest.mock('../../lib/config/manager');

describe('config-set command', () => {
  let mockManager;
  let consoleLog;
  let consoleError;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock console
    consoleLog = jest.spyOn(console, 'log').mockImplementation();
    consoleError = jest.spyOn(console, 'error').mockImplementation();
    
    // Create mock manager
    mockManager = {
      setConfig: jest.fn()
    };
  });

  afterEach(() => {
    consoleLog.mockRestore();
    consoleError.mockRestore();
  });

  test('should set configuration value', async () => {
    await configSet(mockManager, 'test.key', 'test-value', {});
    
    expect(mockManager.setConfig).toHaveBeenCalledWith('test.key', 'test-value', {});
    // Console output was removed for MCP protocol compliance
    expect(consoleLog).not.toHaveBeenCalled();
  });

  test('should handle numeric values', async () => {
    await configSet(mockManager, 'port', 3000, {});
    
    expect(mockManager.setConfig).toHaveBeenCalledWith('port', 3000, {});
  });

  test('should handle boolean values', async () => {
    await configSet(mockManager, 'enabled', true, {});
    
    expect(mockManager.setConfig).toHaveBeenCalledWith('enabled', true, {});
  });

  test('should handle global option', async () => {
    await configSet(mockManager, 'test.key', 'value', { isGlobal: true });
    
    expect(mockManager.setConfig).toHaveBeenCalledWith('test.key', 'value', { isGlobal: true });
  });

  test('should handle errors', async () => {
    const error = new Error('Set failed');
    mockManager.setConfig.mockRejectedValue(error);
    
    // Should throw the error instead of logging it
    await expect(configSet(mockManager, 'test.key', 'value', {}))
      .rejects.toThrow('Set failed');
  });

  test('should validate key parameter', async () => {
    await expect(configSet(mockManager, '', 'value', {}))
      .rejects.toThrow('Configuration key is required');
    
    expect(mockManager.setConfig).not.toHaveBeenCalled();
  });

  test('should validate value parameter', async () => {
    await expect(configSet(mockManager, 'test.key', undefined, {}))
      .rejects.toThrow('Configuration value is required');
    
    expect(mockManager.setConfig).not.toHaveBeenCalled();
  });
});
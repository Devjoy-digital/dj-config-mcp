const configDelete = require('../../lib/commands/config-delete');
const ConfigurationManager = require('../../lib/config/manager');

// Mock ConfigurationManager
jest.mock('../../lib/config/manager');

describe('config-delete command', () => {
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
      getConfig: jest.fn(),
      deleteConfig: jest.fn()
    };
  });

  afterEach(() => {
    consoleLog.mockRestore();
    consoleError.mockRestore();
  });

  test('should delete configuration value', async () => {
    mockManager.getConfig.mockResolvedValue({ value: 'test' });
    const result = await configDelete(mockManager, 'test.key', {});
    
    expect(mockManager.getConfig).toHaveBeenCalledWith('test.key');
    expect(mockManager.deleteConfig).toHaveBeenCalledWith('test.key', {});
    expect(result).toBe(true);
    // Console output was removed for MCP protocol compliance
    expect(consoleLog).not.toHaveBeenCalled();
  });

  test('should handle global option', async () => {
    mockManager.getConfig.mockResolvedValue({ value: 'test' });
    await configDelete(mockManager, 'test.key', { isGlobal: true });
    
    expect(mockManager.deleteConfig).toHaveBeenCalledWith('test.key', { isGlobal: true });
  });

  test('should handle errors', async () => {
    mockManager.getConfig.mockResolvedValue({ value: 'test' });
    const error = new Error('Delete failed');
    mockManager.deleteConfig.mockRejectedValue(error);
    
    // Should throw the error
    await expect(configDelete(mockManager, 'test.key', {}))
      .rejects.toThrow('Delete failed');
  });

  test('should validate key parameter', async () => {
    await expect(configDelete(mockManager, '', {}))
      .rejects.toThrow('Configuration key is required');
    
    expect(mockManager.deleteConfig).not.toHaveBeenCalled();
  });

  test('should handle null key', async () => {
    await expect(configDelete(mockManager, null, {}))
      .rejects.toThrow('Configuration key is required');
    
    expect(mockManager.deleteConfig).not.toHaveBeenCalled();
  });

  test('should handle undefined key', async () => {
    await expect(configDelete(mockManager, undefined, {}))
      .rejects.toThrow('Configuration key is required');
    
    expect(mockManager.deleteConfig).not.toHaveBeenCalled();
  });

  test('should return false for non-existent key', async () => {
    mockManager.getConfig.mockResolvedValue(null);
    const result = await configDelete(mockManager, 'non.existent.key', {});
    
    expect(mockManager.getConfig).toHaveBeenCalledWith('non.existent.key');
    expect(mockManager.deleteConfig).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });
});
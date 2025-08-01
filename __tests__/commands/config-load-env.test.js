const configLoadEnv = require('../../lib/commands/config-load-env');
const ConfigurationManager = require('../../lib/config/manager');

// Mock ConfigurationManager
jest.mock('../../lib/config/manager');

describe('config-load-env command', () => {
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
      loadEnvironment: jest.fn(),
      storage: {
        env: {
          getAll: jest.fn()
        }
      }
    };
  });

  afterEach(() => {
    consoleLog.mockRestore();
    consoleError.mockRestore();
  });

  test('should load environment variables', async () => {
    mockManager.storage.env.getAll.mockImplementation((isGlobal) => {
      if (isGlobal) {
        return Promise.resolve({ GLOBAL_KEY: 'global_value' });
      }
      return Promise.resolve({ LOCAL_KEY: 'local_value', ANOTHER_KEY: 'another_value' });
    });
    
    const result = await configLoadEnv(mockManager);
    
    expect(mockManager.loadEnvironment).toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      localCount: 2,
      globalCount: 1,
      totalCount: 3
    });
    // Console output was removed for MCP protocol compliance
    expect(consoleLog).not.toHaveBeenCalled();
  });

  test('should count environment variables correctly', async () => {
    mockManager.storage.env.getAll.mockImplementation((isGlobal) => {
      if (isGlobal) {
        return Promise.resolve({});
      }
      return Promise.resolve({ TEST_KEY: 'test-value' });
    });
    
    const result = await configLoadEnv(mockManager);
    
    expect(result).toEqual({
      success: true,
      localCount: 1,
      globalCount: 0,
      totalCount: 1
    });
  });

  test('should handle no configuration', async () => {
    mockManager.storage.env.getAll.mockResolvedValue({});
    
    const result = await configLoadEnv(mockManager);
    
    expect(result).toEqual({
      success: true,
      localCount: 0,
      globalCount: 0,
      totalCount: 0
    });
  });

  test('should handle errors', async () => {
    const error = new Error('Load failed');
    mockManager.loadEnvironment.mockRejectedValue(error);
    
    // Should throw the error
    await expect(configLoadEnv(mockManager))
      .rejects.toThrow('Load failed');
  });

  test('should handle mixed local and global variables', async () => {
    mockManager.storage.env.getAll.mockImplementation((isGlobal) => {
      if (isGlobal) {
        return Promise.resolve({ 
          GLOBAL_VAR1: 'global1',
          GLOBAL_VAR2: 'global2' 
        });
      }
      return Promise.resolve({ 
        LOCAL_VAR1: 'local1',
        LOCAL_VAR2: 'local2',
        LOCAL_VAR3: 'local3'
      });
    });
    
    const result = await configLoadEnv(mockManager);
    
    expect(result).toEqual({
      success: true,
      localCount: 3,
      globalCount: 2,
      totalCount: 5
    });
  });
});
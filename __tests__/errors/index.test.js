const {
  ConfigError,
  ClientError,
  ConfigurationError,
  FileSystemError,
  EnvironmentError,
  ValidationError,
  StorageError,
  DistributionError
} = require('../../lib/errors');

describe('Error Classes', () => {
  describe('ConfigError', () => {
    test('should create error with message, code, and details', () => {
      const error = new ConfigError('Test error', 'TEST_ERROR', { foo: 'bar' });
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ConfigError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.details).toEqual({ foo: 'bar' });
      expect(error.name).toBe('ConfigError');
    });

    test('should have default empty details', () => {
      const error = new ConfigError('Test error', 'TEST_ERROR');
      expect(error.details).toEqual({});
    });

    test('should serialize to JSON', () => {
      const error = new ConfigError('Test error', 'TEST_ERROR', { foo: 'bar' });
      const json = error.toJSON();
      
      expect(json).toEqual({
        name: 'ConfigError',
        code: 'TEST_ERROR',
        message: 'Test error',
        details: { foo: 'bar' }
      });
    });

    test('should capture stack trace', () => {
      const error = new ConfigError('Test error', 'TEST_ERROR');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ConfigError');
    });
  });

  describe('ClientError', () => {
    test('should create error with clientId', () => {
      const error = new ClientError('Unknown client', 'vscode', { extra: 'info' });
      
      expect(error).toBeInstanceOf(ConfigError);
      expect(error.message).toBe('Unknown client');
      expect(error.code).toBe('CLIENT_ERROR');
      expect(error.clientId).toBe('vscode');
      expect(error.details).toEqual({ clientId: 'vscode', extra: 'info' });
      expect(error.name).toBe('ClientError');
    });

    test('should include clientId in details', () => {
      const error = new ClientError('Test', 'test-client');
      expect(error.details.clientId).toBe('test-client');
    });
  });

  describe('ConfigurationError', () => {
    test('should create error with configPath', () => {
      const error = new ConfigurationError('Config not found', '/path/to/config', { line: 10 });
      
      expect(error).toBeInstanceOf(ConfigError);
      expect(error.message).toBe('Config not found');
      expect(error.code).toBe('CONFIGURATION_ERROR');
      expect(error.configPath).toBe('/path/to/config');
      expect(error.details).toEqual({ configPath: '/path/to/config', line: 10 });
      expect(error.name).toBe('ConfigurationError');
    });
  });

  describe('FileSystemError', () => {
    test('should create error with path and operation', () => {
      const error = new FileSystemError('Read failed', '/file.txt', 'read', { errno: -2 });
      
      expect(error).toBeInstanceOf(ConfigError);
      expect(error.message).toBe('Read failed');
      expect(error.code).toBe('FILESYSTEM_ERROR');
      expect(error.path).toBe('/file.txt');
      expect(error.operation).toBe('read');
      expect(error.details).toEqual({ path: '/file.txt', operation: 'read', errno: -2 });
      expect(error.name).toBe('FileSystemError');
    });

    test('should include path and operation in details', () => {
      const error = new FileSystemError('Test', '/test', 'write');
      expect(error.details.path).toBe('/test');
      expect(error.details.operation).toBe('write');
    });
  });

  describe('EnvironmentError', () => {
    test('should create error with variable name', () => {
      const error = new EnvironmentError('Variable not found', 'HOME', { platform: 'linux' });
      
      expect(error).toBeInstanceOf(ConfigError);
      expect(error.message).toBe('Variable not found');
      expect(error.code).toBe('ENVIRONMENT_ERROR');
      expect(error.variable).toBe('HOME');
      expect(error.details).toEqual({ variable: 'HOME', platform: 'linux' });
      expect(error.name).toBe('EnvironmentError');
    });
  });

  describe('ValidationError', () => {
    test('should create error with field and value', () => {
      const error = new ValidationError('Invalid type', 'age', 'abc', { expected: 'number' });
      
      expect(error).toBeInstanceOf(ConfigError);
      expect(error.message).toBe('Invalid type');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.field).toBe('age');
      expect(error.value).toBe('abc');
      expect(error.details).toEqual({ field: 'age', value: 'abc', expected: 'number' });
      expect(error.name).toBe('ValidationError');
    });

    test('should handle null/undefined values', () => {
      const error = new ValidationError('Required field', 'name', null);
      expect(error.value).toBe(null);
      expect(error.details.value).toBe(null);
    });
  });

  describe('StorageError', () => {
    test('should create error with storage type and operation', () => {
      const error = new StorageError('Write failed', 'json', 'write', { file: 'config.json' });
      
      expect(error).toBeInstanceOf(ConfigError);
      expect(error.message).toBe('Write failed');
      expect(error.code).toBe('STORAGE_ERROR');
      expect(error.storageType).toBe('json');
      expect(error.operation).toBe('write');
      expect(error.details).toEqual({ storageType: 'json', operation: 'write', file: 'config.json' });
      expect(error.name).toBe('StorageError');
    });
  });

  describe('DistributionError', () => {
    test('should create error with clients and operation', () => {
      const clients = ['vscode', 'cursor'];
      const error = new DistributionError('Distribution failed', clients, 'distribute', { errors: [] });
      
      expect(error).toBeInstanceOf(ConfigError);
      expect(error.message).toBe('Distribution failed');
      expect(error.code).toBe('DISTRIBUTION_ERROR');
      expect(error.clients).toEqual(clients);
      expect(error.operation).toBe('distribute');
      expect(error.details).toEqual({ clients, operation: 'distribute', errors: [] });
      expect(error.name).toBe('DistributionError');
    });

    test('should handle empty clients array', () => {
      const error = new DistributionError('No clients', [], 'distribute');
      expect(error.clients).toEqual([]);
      expect(error.details.clients).toEqual([]);
    });
  });

  describe('Error inheritance', () => {
    test('all errors should be instanceof Error', () => {
      const errors = [
        new ConfigError('test', 'TEST'),
        new ClientError('test', 'client'),
        new ConfigurationError('test', '/path'),
        new FileSystemError('test', '/path', 'read'),
        new EnvironmentError('test', 'VAR'),
        new ValidationError('test', 'field', 'value'),
        new StorageError('test', 'json', 'read'),
        new DistributionError('test', [], 'dist')
      ];

      errors.forEach(error => {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(ConfigError);
      });
    });
  });
});
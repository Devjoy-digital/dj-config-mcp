const SecurityDetector = require('../../lib/security/detector');
const ClientRegistry = require('../../lib/distribution/client-registry');
const { DEFAULT_SENSITIVE_PATTERNS } = require('../../lib/constants');

jest.mock('../../lib/distribution/client-registry');

describe('SecurityDetector', () => {
  let detector;
  let mockRegistry;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock registry
    mockRegistry = {
      getSensitivePatterns: jest.fn()
    };
    
    detector = new SecurityDetector(mockRegistry);
  });

  describe('constructor', () => {
    test('should use provided client registry', () => {
      expect(detector.clientRegistry).toBe(mockRegistry);
      expect(detector.patterns).toBe(null);
    });

    test('should create new registry if none provided', () => {
      ClientRegistry.mockImplementation(() => ({
        getSensitivePatterns: jest.fn()
      }));
      
      const detectorWithoutRegistry = new SecurityDetector();
      expect(detectorWithoutRegistry.clientRegistry).toBeDefined();
      expect(ClientRegistry).toHaveBeenCalledTimes(1);
    });
  });

  describe('loadPatterns', () => {
    test('should load patterns from registry', async () => {
      const customPatterns = ['custom1', 'custom2'];
      mockRegistry.getSensitivePatterns.mockResolvedValue(customPatterns);
      
      const patterns = await detector.loadPatterns();
      
      expect(mockRegistry.getSensitivePatterns).toHaveBeenCalledTimes(1);
      expect(patterns).toEqual(customPatterns);
      expect(detector.patterns).toEqual(customPatterns);
    });

    test('should use cached patterns on subsequent calls', async () => {
      const customPatterns = ['custom1', 'custom2'];
      mockRegistry.getSensitivePatterns.mockResolvedValue(customPatterns);
      
      await detector.loadPatterns();
      await detector.loadPatterns();
      await detector.loadPatterns();
      
      expect(mockRegistry.getSensitivePatterns).toHaveBeenCalledTimes(1);
    });

    test('should use default patterns if registry returns empty array', async () => {
      mockRegistry.getSensitivePatterns.mockResolvedValue([]);
      
      const patterns = await detector.loadPatterns();
      
      expect(patterns).toEqual(DEFAULT_SENSITIVE_PATTERNS);
      expect(detector.patterns).toEqual(DEFAULT_SENSITIVE_PATTERNS);
    });

    test('should use default patterns if registry returns null', async () => {
      mockRegistry.getSensitivePatterns.mockResolvedValue(null);
      
      const patterns = await detector.loadPatterns();
      
      expect(patterns).toEqual(DEFAULT_SENSITIVE_PATTERNS);
    });

    test('should use default patterns if registry throws error', async () => {
      mockRegistry.getSensitivePatterns.mockRejectedValue(new Error('Registry error'));
      
      const patterns = await detector.loadPatterns();
      
      expect(patterns).toEqual(DEFAULT_SENSITIVE_PATTERNS);
      expect(detector.patterns).toEqual(DEFAULT_SENSITIVE_PATTERNS);
    });
  });

  describe('getDefaultPatterns', () => {
    test('should return default sensitive patterns from constants', () => {
      const patterns = detector.getDefaultPatterns();
      expect(patterns).toEqual(DEFAULT_SENSITIVE_PATTERNS);
    });
  });

  describe('isSensitive', () => {
    beforeEach(() => {
      mockRegistry.getSensitivePatterns.mockResolvedValue([
        'password',
        'secret',
        'key',
        'token',
        'auth',
        'credential',
        'private'
      ]);
    });

    test('should detect exact pattern matches', async () => {
      expect(await detector.isSensitive('password')).toBe(true);
      expect(await detector.isSensitive('secret')).toBe(true);
      expect(await detector.isSensitive('key')).toBe(true);
    });

    test('should detect patterns within keys', async () => {
      expect(await detector.isSensitive('user.password')).toBe(true);
      expect(await detector.isSensitive('api_secret_key')).toBe(true);
      expect(await detector.isSensitive('privateKey')).toBe(true);
      expect(await detector.isSensitive('auth.token')).toBe(true);
    });

    test('should be case insensitive', async () => {
      expect(await detector.isSensitive('PASSWORD')).toBe(true);
      expect(await detector.isSensitive('Secret')).toBe(true);
      expect(await detector.isSensitive('PRIVATE_KEY')).toBe(true);
      expect(await detector.isSensitive('Auth_Token')).toBe(true);
    });

    test('should not detect non-sensitive keys', async () => {
      expect(await detector.isSensitive('username')).toBe(false);
      expect(await detector.isSensitive('email')).toBe(false);
      expect(await detector.isSensitive('config.setting')).toBe(false);
      expect(await detector.isSensitive('public_data')).toBe(false);
    });

    test('should handle keys with special characters', async () => {
      expect(await detector.isSensitive('my-password-field')).toBe(true);
      expect(await detector.isSensitive('secret_key_123')).toBe(true);
      expect(await detector.isSensitive('auth[token]')).toBe(true);
    });

    test('should handle empty or null keys', async () => {
      expect(await detector.isSensitive('')).toBe(false);
      expect(await detector.isSensitive(null)).toBe(false);
      expect(await detector.isSensitive(undefined)).toBe(false);
    });

    test('should use loaded patterns', async () => {
      // First call loads patterns
      await detector.isSensitive('test');
      
      // Change mock response - should not affect result since patterns are cached
      mockRegistry.getSensitivePatterns.mockResolvedValue(['different']);
      
      expect(await detector.isSensitive('password')).toBe(true);
      expect(await detector.isSensitive('different')).toBe(false);
    });
  });

  describe('integration with real patterns', () => {
    test('should detect all default sensitive patterns', async () => {
      const realDetector = new SecurityDetector();
      
      for (const pattern of DEFAULT_SENSITIVE_PATTERNS) {
        expect(await realDetector.isSensitive(pattern)).toBe(true);
        expect(await realDetector.isSensitive(`my_${pattern}`)).toBe(true);
        expect(await realDetector.isSensitive(`${pattern}_value`)).toBe(true);
      }
    });
  });
});
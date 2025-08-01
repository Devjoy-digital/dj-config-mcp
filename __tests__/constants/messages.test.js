const MESSAGES = require('../../lib/constants/messages');

describe('Message Constants', () => {
  describe('ERROR_MESSAGES', () => {
    test('should have all required error messages', () => {
      expect(MESSAGES.ERROR_MESSAGES).toHaveProperty('ENV_VAR_NOT_FOUND');
      expect(MESSAGES.ERROR_MESSAGES).toHaveProperty('HOME_DIR_NOT_FOUND');
      expect(MESSAGES.ERROR_MESSAGES).toHaveProperty('UNKNOWN_CLIENT');
      expect(MESSAGES.ERROR_MESSAGES).toHaveProperty('CLIENT_NOT_INSTALLED');
      expect(MESSAGES.ERROR_MESSAGES).toHaveProperty('NO_CONFIG_PATH');
      expect(MESSAGES.ERROR_MESSAGES).toHaveProperty('NO_ENV_PATH');
      expect(MESSAGES.ERROR_MESSAGES).toHaveProperty('INVALID_JSON');
      expect(MESSAGES.ERROR_MESSAGES).toHaveProperty('FILE_READ_FAILED');
      expect(MESSAGES.ERROR_MESSAGES).toHaveProperty('FILE_WRITE_FAILED');
    });

    test('should have function or string values for all error messages', () => {
      Object.values(MESSAGES.ERROR_MESSAGES).forEach(message => {
        expect(['string', 'function']).toContain(typeof message);
      });
    });
  });

  describe('SUCCESS_MESSAGES', () => {
    test('should have all required success messages', () => {
      expect(MESSAGES.SUCCESS_MESSAGES).toHaveProperty('CONFIG_SET');
      expect(MESSAGES.SUCCESS_MESSAGES).toHaveProperty('CONFIG_DELETED');
      expect(MESSAGES.SUCCESS_MESSAGES).toHaveProperty('ENV_LOADED');
      expect(MESSAGES.SUCCESS_MESSAGES).toHaveProperty('DISTRIBUTION_COMPLETE');
      expect(MESSAGES.SUCCESS_MESSAGES).toHaveProperty('CLIENT_ADDED');
      expect(MESSAGES.SUCCESS_MESSAGES).toHaveProperty('MAPPINGS_SAVED');
    });

    test('should have function or string values for all success messages', () => {
      Object.values(MESSAGES.SUCCESS_MESSAGES).forEach(message => {
        expect(['string', 'function']).toContain(typeof message);
      });
    });
  });

  describe('WARNING_MESSAGES', () => {
    test('should have all required warning messages', () => {
      expect(MESSAGES.WARNING_MESSAGES).toHaveProperty('SENSITIVE_KEY_DETECTED');
      expect(MESSAGES.WARNING_MESSAGES).toHaveProperty('NO_CLIENTS_FOUND');
      expect(MESSAGES.WARNING_MESSAGES).toHaveProperty('CONFIG_ALREADY_EXISTS');
      expect(MESSAGES.WARNING_MESSAGES).toHaveProperty('ENV_FILE_NOT_FOUND');
      expect(MESSAGES.WARNING_MESSAGES).toHaveProperty('OLD_CONFIG_FORMAT');
    });
  });

  describe('INFO_MESSAGES', () => {
    test('should have all required info messages', () => {
      expect(MESSAGES.INFO_MESSAGES).toHaveProperty('USING_DEFAULT_CONFIG');
      expect(MESSAGES.INFO_MESSAGES).toHaveProperty('CONFIG_SOURCE');
      expect(MESSAGES.INFO_MESSAGES).toHaveProperty('NO_CONFIG_FOUND');
      expect(MESSAGES.INFO_MESSAGES).toHaveProperty('AVAILABLE_CLIENTS');
      expect(MESSAGES.INFO_MESSAGES).toHaveProperty('LOADING_FROM');
    });
  });

  describe('PROMPT_MESSAGES', () => {
    test('should have all required prompt messages', () => {
      expect(MESSAGES.PROMPT_MESSAGES).toHaveProperty('CONFIRM_DELETE');
      expect(MESSAGES.PROMPT_MESSAGES).toHaveProperty('CONFIRM_OVERWRITE');
      expect(MESSAGES.PROMPT_MESSAGES).toHaveProperty('SELECT_CLIENTS');
      expect(MESSAGES.PROMPT_MESSAGES).toHaveProperty('ENTER_VALUE');
      expect(MESSAGES.PROMPT_MESSAGES).toHaveProperty('SELECT_STORAGE');
    });
  });

  describe('message consistency', () => {
    test('all message categories should be objects', () => {
      expect(typeof MESSAGES.ERROR_MESSAGES).toBe('object');
      expect(typeof MESSAGES.SUCCESS_MESSAGES).toBe('object');
      expect(typeof MESSAGES.WARNING_MESSAGES).toBe('object');
      expect(typeof MESSAGES.INFO_MESSAGES).toBe('object');
      expect(typeof MESSAGES.PROMPT_MESSAGES).toBe('object');
    });

    test('no message should be undefined or null', () => {
      const allMessages = [
        ...Object.values(MESSAGES.ERROR_MESSAGES),
        ...Object.values(MESSAGES.SUCCESS_MESSAGES),
        ...Object.values(MESSAGES.WARNING_MESSAGES),
        ...Object.values(MESSAGES.INFO_MESSAGES),
        ...Object.values(MESSAGES.PROMPT_MESSAGES)
      ];

      allMessages.forEach(message => {
        expect(message).not.toBeUndefined();
        expect(message).not.toBeNull();
      });
    });
  });
});
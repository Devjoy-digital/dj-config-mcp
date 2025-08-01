/**
 * @module PathUtils
 * @description Provides platform-aware path resolution and manipulation utilities.
 * Ensures consistent path handling across Windows, macOS, and Linux.
 * 
 * @example
 * const PathUtils = require('./utils/path-utils');
 * 
 * // Normalize path for current platform
 * const normalized = PathUtils.normalizePath('/home/user\\config');
 * 
 * // Resolve environment variables
 * const resolved = PathUtils.resolveEnvVars('${HOME}/.config/${SERVER_NAME}');
 */

const path = require('path');
const os = require('os');
const { EnvironmentError } = require('../errors');

/**
 * Platform-aware path utilities
 * @class
 */
class PathUtils {
  /**
   * Normalize path separators for the current platform
   * @static
   * @param {string} inputPath - Path to normalize
   * @returns {string} Normalized path with correct separators for the platform
   * 
   * @example
   * // On Windows
   * PathUtils.normalizePath('/home/user/config');
   * // Returns: '\\home\\user\\config'
   * 
   * // On Unix
   * PathUtils.normalizePath('C:\\Users\\config');
   * // Returns: 'C:/Users/config'
   */
  static normalizePath(inputPath) {
    if (!inputPath) return inputPath;
    
    // Replace all backslashes with forward slashes first
    let normalized = inputPath.replace(/\\/g, '/');
    
    // Then convert to platform-specific separator
    if (path.sep === '\\') {
      // Windows: convert forward slashes to backslashes
      normalized = normalized.replace(/\//g, '\\');
    }
    
    return normalized;
  }

  /**
   * Join paths with consistent separators
   * @static
   * @param {...string} paths - Path segments to join
   * @returns {string} Joined path with proper separators
   * 
   * @example
   * PathUtils.joinPath('/home', 'user', 'config.json');
   * // Returns: '/home/user/config.json' (Unix) or '\\home\\user\\config.json' (Windows)
   */
  static joinPath(...paths) {
    // Filter out empty segments
    const segments = paths.filter(p => p && p.length > 0);
    if (segments.length === 0) return '';
    
    // Join paths and normalize
    const joined = path.join(...segments);
    return this.normalizePath(joined);
  }

  /**
   * Resolve environment variables in path templates
   * @static
   * @param {string} pathTemplate - Path template with ${VAR} placeholders
   * @param {Object} [additionalVars={}] - Additional variables to resolve
   * @returns {string} Resolved path with all variables replaced
   * 
   * @example
   * PathUtils.resolveEnvVars('${HOME}/.config/${APP_NAME}', { APP_NAME: 'myapp' });
   * // Returns: '/home/user/.config/myapp'
   */
  static resolveEnvVars(pathTemplate, additionalVars = {}) {
    if (!pathTemplate) return pathTemplate;
    
    return pathTemplate.replace(/\${(\w+)}/g, (match, envVar) => {
      // Check additional vars first
      if (additionalVars[envVar] !== undefined) {
        return additionalVars[envVar];
      }
      
      // Then check environment variables
      const value = process.env[envVar];
      if (value !== undefined) {
        return value;
      }
      
      // Special handling for common variables
      if (envVar === 'HOME' && process.platform === 'win32') {
        // On Windows, HOME might not be set, use USERPROFILE
        const userProfile = process.env.USERPROFILE;
        if (userProfile) return userProfile;
      }
      
      // Return the original placeholder if not found
      return match;
    });
  }

  /**
   * Get platform-specific config directory
   * @static
   * @param {string} appName - Application name for the config directory
   * @returns {string} Platform-appropriate config directory path
   * @throws {EnvironmentError} If required environment variables are not found
   * 
   * @example
   * PathUtils.getConfigDir('my-app');
   * // Windows: 'C:\\Users\\username\\AppData\\Roaming\\my-app'
   * // macOS: '/Users/username/Library/Application Support/my-app'
   * // Linux: '/home/username/.config/my-app'
   */
  static getConfigDir(appName) {
    switch (process.platform) {
      case 'win32': {
        const appData = process.env.APPDATA;
        if (!appData) {
          throw new EnvironmentError(
            'APPDATA environment variable not found on Windows',
            'APPDATA'
          );
        }
        return this.joinPath(appData, appName);
      }
      
      case 'darwin': {
        const home = process.env.HOME || os.homedir();
        if (!home) {
          throw new EnvironmentError(
            'HOME environment variable not found on macOS',
            'HOME'
          );
        }
        return this.joinPath(home, 'Library', 'Application Support', appName);
      }
      
      default: {
        // Linux and other Unix-like systems
        const home = process.env.HOME || os.homedir();
        if (!home) {
          throw new EnvironmentError(
            'HOME environment variable not found on Linux',
            'HOME'
          );
        }
        // Check for XDG_CONFIG_HOME first
        const xdgConfig = process.env.XDG_CONFIG_HOME;
        if (xdgConfig) {
          return this.joinPath(xdgConfig, appName);
        }
        return this.joinPath(home, '.config', appName);
      }
    }
  }

  /**
   * Ensure a path is absolute
   * @static
   * @param {string} inputPath - Path to check and convert if needed
   * @param {string} [basePath=process.cwd()] - Base path to resolve relative paths against
   * @returns {string} Absolute path with normalized separators
   * 
   * @example
   * PathUtils.ensureAbsolute('./config.json', '/home/user');
   * // Returns: '/home/user/config.json'
   */
  static ensureAbsolute(inputPath, basePath = process.cwd()) {
    if (!inputPath) return inputPath;
    
    if (path.isAbsolute(inputPath)) {
      return this.normalizePath(inputPath);
    }
    
    return this.normalizePath(path.resolve(basePath, inputPath));
  }

  /**
   * Get the home directory reliably across platforms
   * @static
   * @returns {string} Home directory path
   * @throws {EnvironmentError} If home directory cannot be determined
   * 
   * @example
   * const home = PathUtils.getHomeDir();
   * // Returns: 'C:\\Users\\username' (Windows) or '/home/username' (Unix)
   */
  static getHomeDir() {
    const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
    if (!home) {
      throw new EnvironmentError(
        'Unable to determine home directory',
        'HOME/USERPROFILE'
      );
    }
    return this.normalizePath(home);
  }

  /**
   * Check if a path is safe (not escaping to parent directories excessively)
   * @static
   * @param {string} inputPath - Path to check for safety
   * @param {string} basePath - Base path to check against
   * @returns {boolean} True if path is safe and within basePath
   * 
   * @example
   * PathUtils.isPathSafe('../config.json', '/home/user/app');
   * // Returns: true (resolves to /home/user/config.json)
   * 
   * PathUtils.isPathSafe('../../etc/passwd', '/home/user/app');
   * // Returns: false (escapes basePath)
   */
  static isPathSafe(inputPath, basePath) {
    const resolvedPath = path.resolve(basePath, inputPath);
    const resolvedBase = path.resolve(basePath);
    
    // Normalize both paths for comparison
    const normalizedPath = this.normalizePath(resolvedPath);
    const normalizedBase = this.normalizePath(resolvedBase);
    
    // Check if the resolved path starts with the base path
    return normalizedPath.startsWith(normalizedBase);
  }
}

module.exports = PathUtils;
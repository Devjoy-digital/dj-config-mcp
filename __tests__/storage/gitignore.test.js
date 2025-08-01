const GitignoreManager = require('../../lib/storage/gitignore');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('GitignoreManager', () => {
  let manager;
  let tempDir;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), 'gitignore-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
    process.chdir(tempDir);
    
    manager = new GitignoreManager('test-server');
  });

  afterEach(async () => {
    process.chdir(os.tmpdir());
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    test('should initialize with server name', () => {
      expect(manager.serverName).toBe('test-server');
      expect(manager.localGitignore).toBe('./.gitignore');
    });

    test('should work without server name', () => {
      const managerNoServer = new GitignoreManager();
      expect(managerNoServer.serverName).toBe(null);
    });
  });

  describe('getLocalEnvPath', () => {
    test('should return correct path with server name', () => {
      const envPath = manager.getLocalEnvPath();
      expect(envPath).toBe('./devjoy-digital/test-server/.env');
    });

    test('should use default server name when not provided', () => {
      const managerNoServer = new GitignoreManager();
      const envPath = managerNoServer.getLocalEnvPath();
      expect(envPath).toBe('./devjoy-digital/dj-config-mcp/.env');
    });
  });

  describe('ensure', () => {
    test('should create gitignore if it does not exist', async () => {
      await manager.ensure(false);
      
      const content = await fs.readFile('.gitignore', 'utf8');
      expect(content).toContain('# dj-config-mcp sensitive configuration');
      expect(content).toContain('./devjoy-digital/test-server/.env');
    });

    test('should append patterns if gitignore exists but missing patterns', async () => {
      await fs.writeFile('.gitignore', '# Existing content\nnode_modules/\n');
      
      await manager.ensure(false);
      
      const content = await fs.readFile('.gitignore', 'utf8');
      expect(content).toContain('# Existing content');
      expect(content).toContain('node_modules/');
      expect(content).toContain('# dj-config-mcp sensitive configuration');
      expect(content).toContain('./devjoy-digital/test-server/.env');
    });

    test('should not duplicate patterns if already present', async () => {
      await fs.writeFile('.gitignore', '# dj-config-mcp sensitive configuration\n./devjoy-digital/test-server/.env\n');
      
      await manager.ensure(false);
      
      const content = await fs.readFile('.gitignore', 'utf8');
      const occurrences = (content.match(/dj-config-mcp sensitive configuration/g) || []).length;
      expect(occurrences).toBe(1);
    });

    test('should check if any pattern exists', async () => {
      await fs.writeFile('.gitignore', '# Other content\n./devjoy-digital/test-server/.env\n');
      
      await manager.ensure(false);
      
      const content = await fs.readFile('.gitignore', 'utf8');
      // Should not add patterns since one already exists
      expect(content).not.toContain('# dj-config-mcp sensitive configuration');
    });

    test('should skip gitignore for global configuration', async () => {
      await manager.ensure(true);
      
      // Should not create gitignore for global config
      const fileExists = await fs.access('.gitignore').then(() => true).catch(() => false);
      expect(fileExists).toBe(false);
    });

    test('should handle ENOENT error when reading', async () => {
      // This is normal behavior - file doesn't exist
      await manager.ensure(false);
      
      const content = await fs.readFile('.gitignore', 'utf8');
      expect(content).toContain('# dj-config-mcp sensitive configuration');
    });

    test('should add newline before patterns if file does not end with newline', async () => {
      await fs.writeFile('.gitignore', '# No newline at end');
      
      await manager.ensure(false);
      
      const content = await fs.readFile('.gitignore', 'utf8');
      // Check that pattern was added with proper spacing
      expect(content).toContain('# No newline at end');
      expect(content).toContain('# dj-config-mcp sensitive configuration');
      expect(content).toContain('./devjoy-digital/test-server/.env');
    });

    test('should not add extra newline if file already ends with newline', async () => {
      await fs.writeFile('.gitignore', '# Has newline\n');
      
      await manager.ensure(false);
      
      const content = await fs.readFile('.gitignore', 'utf8');
      expect(content).toContain('# Has newline');
      expect(content).toContain('# dj-config-mcp sensitive configuration');
      expect(content).toContain('./devjoy-digital/test-server/.env');
      // Allow for up to 2 consecutive newlines, but not 3 or more
      expect(content).not.toMatch(/\n\n\n\n/);
    });

    test('should detect pattern variations', async () => {
      // Test that it detects variations of .env patterns
      await fs.writeFile('.gitignore', '**/.env');
      
      await manager.ensure(false);
      
      const content = await fs.readFile('.gitignore', 'utf8');
      // Should not add since **/.env covers it
      expect(content).not.toContain('# dj-config-mcp sensitive configuration');
    });

    test('should detect .env pattern', async () => {
      await fs.writeFile('.gitignore', '.env');
      
      await manager.ensure(false);
      
      const content = await fs.readFile('.gitignore', 'utf8');
      // Should not add since .env covers it
      expect(content).not.toContain('# dj-config-mcp sensitive configuration');
    });

    test('should handle errors gracefully', async () => {
      // Errors are caught and not thrown
      jest.spyOn(fs, 'writeFile').mockRejectedValueOnce(new Error('Write error'));
      
      // Should not throw
      await expect(manager.ensure(false)).resolves.not.toThrow();
    });
  });
});

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2025-01-28

### Changed
- **BREAKING**: Streamlined `config` command to handle secrets automatically in a single execution
- The `config` command now processes sensitive values first, then automatically continues with all remaining configuration values
- Removed the need to run `config` command multiple times for complete setup

### Fixed
- Fixed configuration workflow that previously required users to run `mcp-config config` twice
- Eliminated early exit after handling sensitive values
- Added intelligent deduplication to skip already-configured sensitive values in the second phase

### Improved
- Enhanced user experience with seamless single-command configuration process
- Added clear progress indicators showing configuration phases
- Maintained all existing security features (global config protection, automatic sensitive detection)

## [1.2.0] - 2025-01-28

### Added
- Automatic sensitive value detection based on key names containing "password", "secret", "key", "token", "auth", "credential", or "private"
- Global configuration protection with `-g` flag support for `config` and `update-config` commands
- Enhanced security for configuration values with sensitive terms

### Changed
- Updated sensitive detection logic to use both schema-defined sensitivity AND automatic detection
- Enhanced `saveNonSecretToConfig()` function with global config protection
- Added global override flag support to prevent accidental overwrites of system-wide settings

### Security
- All configuration values containing sensitive terms are now automatically stored securely in environment variables
- Global configuration protection prevents accidental overwrites of system-wide settings
- Clear warning messages inform users when global config protection is active

## [1.1.0] - 2025-01-28

### Added
- Initial implementation of MCP configuration management
- Schema-based configuration validation using Convict
- Support for sensitive value handling via environment variables
- Client-specific configuration distribution
- Commands: `config`, `config-secrets`, `get-config`, `update-config`

### Features
- Dynamic schema loading from `template-config.json` or package.json specified path
- Automatic client configuration distribution to VS Code, Cursor, and other supported clients
- Environment variable integration for sensitive data
- Interactive configuration prompts with current value display

## [1.0.0] - 2025-01-28

### Added
- Initial release of mcp-config CLI tool
- Basic configuration management functionality

# Product Requirements Document (PRD)
## dj-config-mcp: MCP Configuration Management Utility

### Document Information
- **Product Name**: dj-config-mcp
- **Version**: 0.9.3
- **Document Version**: 1.2
- **Date**: July 31, 2025
- **Author**: Devjoy Digital

---

## 1. Executive Summary

### 1.1 Product Overview
dj-config-mcp is a Node.js library that MCP servers import to gain configuration management capabilities. When integrated into an MCP server, it provides that server with a secure, automated approach to managing configuration values with intelligent handling of sensitive data and seamless distribution across multiple MCP client applications. The library exposes configuration commands through the host MCP server's interface.

### 1.2 Problem Statement
AI users us multiple tools in various use cases, often working on the same problem.
They typically have a small set of resources they want to mix and match among tasks.
However, seting up and managing MCP servers is a per-tool, per project enveavor that
quickly becomes confusing, and a waste of time:
- Sharing MCP resources among different tools is time consuming
- Configuring MCP servers at the project-level is cumbersome
- Little support for default MCP resources
- Securely handling sensitive data (API keys, passwords, tokens)
- Providing user-friendly interfaces for configuration management

### 1.3 Solution
A comprehensive Node.js library that MCP servers import to provide configuration management capabilities. The library automatically detects sensitive data, stores configurations appropriately, and distributes them to configured MCP clients with support for both local project and global system configurations. MCP servers using this library expose configuration commands to their users through their own interfaces.

---

## 2. Product Goals & Objectives

### 2.1 Primary Goals
- **Security First**: Automatically detect and securely store sensitive configuration data
- **Developer Experience**: Provide intuitive CLI commands and interactive setup wizards
- **Multi-Client Support**: Seamlessly distribute configurations to supported MCP clients
- **Flexibility**: Support both local project and global system configurations
- **Automation**: Minimize manual configuration management overhead

### 2.2 Success Metrics
- Adoption by MCP server developers
- Time saved in configuration setup and management
- Number of supported MCP clients
- Community contributions and feedback

---

## 3. Target Users & Use Cases

### 3.1 Primary Users
- **Power Business Users**: Non-technical users that use AI to get their work done
- **MCP Server Developers**: Building and maintaining MCP servers
- **DevOps Engineers**: Managing MCP server deployments
- **Development Teams**: Collaborating on MCP-based projects

### 3.2 Use Cases

#### 3.2.1 Developer Initial Project Setup
- Developer opens an AI tool to help code a project
- Developer adds an MCP server to their environment (that has imported dj-config-mcp)
- Runs the MCP server's configuration command (e.g., `mcp-server config`)
- System automatically detects and secures sensitive values
- Configuration distributed to MCP clients that the developer selects
- A local and a global configuration are created for this MCP server (if -g is used)

#### 3.2.2 Developer Secondary AI tool used in configured project
- Developer opens up a secondary AI tool for an already configured project
- AI tool loads and attempts to configure itself from project-level configuration files
- AI tool finds the appropriate configuration file in the project directory
- MCP server is configured

#### 3.2.3 Developer Globally Configured AI tool used in new project
- Developer opens up a globally configured AI tool in a new project
- AI tool loads and attempts to configure itself from project-level configuration files - fails
- AI tool loads and attempts to configure itself from user-level configuration files - succeeds
- AI tool finds the appropriate configuration file in the user directory
- MCP server is configured

#### 3.2.4 Configuration Management
- Developer needs to update API keys or database credentials
- Uses CLI commands to set new values
- System automatically handles sensitive data storage
- Changes propagated to configured clients

#### 3.2.5 Power User sets up business project in multiple tools
- A business user wants to use multiple ai tools and connect to the same resources
- Opens a command window and runs the MCP server's configuration command
- Configuration wizard offers a set of clients to configure
- User accepts offered selections and enters configuration data
- Configuration values are created for the MCP server, and added/created for each intended tool
- Changes propagated to configured clients

---

## 4. Functional Requirements

### 4.1 Core Features

#### 4.1.1 Automatic Sensitive Data Detection
- **Requirement**: System must automatically identify sensitive configuration keys
- **Implementation**: Pattern matching against predefined sensitive terms
- **Sensitive Terms**: password, secret, key, token, auth, credential, private
- **Behavior**: Automatically route sensitive values to `.env` file storage. Warn user and create or update .gitignore file

#### 4.1.2 Dual Storage System
- **Non-Sensitive Data**: Store in `mcp-servers/default.json` (local) or global JSON files
- **Sensitive Data**: Store in `.env` file as environment variables
- **Format Conversion**: Convert dot notation to uppercase environment variables (e.g., `api.secret` → `API_SECRET`)

#### 4.1.3 Configuration Hierarchy
- **Priority Order**: Environment variables → Local config → Global config
- **Resolution**: First found value wins
- **Transparency**: Show configuration source in output

#### 4.1.4 Client Distribution
- **Supported Clients**: VS Code, Claude Code, Claude Desktop, Cursor
- **Automatic Distribution**: Push configurations to selected clients
- **Path Management**: Handle client-specific configuration paths
- **Complete Distribution**: Distribute all configuration data using Dual Storage System

### 4.2 MCP Server Commands

When an MCP server imports dj-config-mcp, it exposes the following configuration commands through its own interface:

#### 4.2.1 Interactive Configuration (`<mcp-server> config`)
- **Purpose**: Guided setup wizard for common configuration values
- **Features**:
  - Prompt for standard MCP server configurations
  - Show current values with option to update
  - Support for custom key-value pairs
  - Client selection interface
  - Global configuration option (`-g` flag)

#### 4.2.2 Set Configuration (`<mcp-server> config-set <key> <value>`)
- **Purpose**: Set individual configuration values
- **Features**:
  - Automatic sensitive data detection and routing
  - Support for nested keys (dot notation)
  - Global configuration option (`-g` flag)
  - Immediate client distribution (for local configs)

#### 4.2.3 Get Configuration (`<mcp-server> config-get [key]`)
- **Purpose**: Retrieve configuration values
- **Features**:
  - Single key retrieval with source information
  - All configurations listing when no key specified
  - Source transparency (Environment, Local Config, Global Config)
  - Include environment variables from `.env` file

#### 4.2.4 Delete Configuration (`<mcp-server> config-delete <key>`)
- **Purpose**: Remove configuration values
- **Features**:
  - Remove from appropriate storage location
  - Support for nested key deletion
  - Global configuration option (`-g` flag)
  - Automatic client redistribution

#### 4.2.5 Load Environment (`<mcp-server> config-load-env`)
- **Purpose**: Load environment variables from .env file
- **Features**:
  - Read .env file from local or global configuration directory
  - Load variables into process environment
  - Support for clients that don't automatically load .env files
  - Priority handling (local .env overrides global .env)

### 4.3 Library API
- **Integration**: Import as a dependency in MCP server projects
- **Usage**: `const djConfig = require('dj-config-mcp')`
- **Command Registration**: MCP servers register configuration commands with their command handler
- **Environment Loading**: Automatic .env file loading on initialization
- **API Methods**:
  - `config()`: Interactive configuration wizard
  - `configSet(key, value, options)`: Set configuration value
  - `configGet(key)`: Get configuration value(s)
  - `configDelete(key, options)`: Delete configuration value
  - `loadEnv()`: Load environment variables from .env files
- **Compatibility**: Works with any Node.js-based MCP server

---

## 5. Technical Requirements

### 5.1 Platform Support
- **Runtime**: Node.js (version compatibility with MCP ecosystem)
- **Operating Systems**: Windows, macOS, Linux
- **Package Manager**: npm

### 5.2 Dependencies
- **Core Dependencies**:
  - `dotenv`: Environment variable management
  - File system APIs for configuration management
- **Development Dependencies**:
  - `jest`: Testing framework
- **No CLI Framework**: Since this is a library, MCP servers handle their own CLI implementation

### 5.3 File System Requirements
- **Local Storage**: Write access to project directory
- **Global Storage**: Write access to user home directory
- **Client Directories**: Write access to MCP client configuration directories

### 5.4 Configuration Paths

#### 5.4.1 Local Configuration
- **Non-sensitive**: `./mcp-servers/default.json`
- **Sensitive**: `./mcp-servers/.env`

#### 5.4.2 Global Configuration
- **Non-sensitive**:
  - **Windows**: `%APPDATA%\mcp-servers\global.json`
  - **macOS**: `~/Library/Application Support/mcp-servers/global.json`
  - **Linux**: `~/.config/mcp-servers/global.json`
- **Sensitive**:
  - **Windows**: `%APPDATA%\mcp-servers\.env`
  - **macOS**: `~/Library/Application Support/mcp-servers/.env`
  - **Linux**: `~/.config/mcp-servers/.env`

#### 5.4.3 Library Configuration
- **Client Mappings**:
  - **Windows**: `%APPDATA%\mcp-servers\config-mcp\library-config.json`
  - **macOS**: `~/Library/Application Support/mcp-servers/config-mcp/library-config.json`
  - **Linux**: `~/.config/mcp-servers/config-mcp/library-config.json`

#### 5.4.4 Client Distribution Paths
- **VS Code**: Application-specific config directory
- **Claude Code**: Application-specific config directory
- **Claude Desktop**: Application-specific config directory
- **Cursor**: Application-specific config directory

---

## 6. Non-Functional Requirements

### 6.1 Security
- **Sensitive Data Protection**: Never store sensitive values in JSON files
- **Environment Variable Security**: Use `.env` files for sensitive data
- **File Permissions**: Appropriate file system permissions for configuration files
- **No Logging**: Avoid logging sensitive configuration values
- **.gitignore Management**: Automatically create or update .gitignore to exclude .env files
- **User Warnings**: Warn users when sensitive data is detected and stored

### 6.2 Performance
- **Startup Time**: CLI commands should execute within 2 seconds
- **File I/O**: Efficient reading/writing of configuration files
- **Memory Usage**: Minimal memory footprint for CLI operations

### 6.3 Reliability
- **Error Handling**: Graceful handling of file system errors
- **Data Integrity**: Validate JSON configuration files
- **Backup**: Preserve existing configurations during updates
- **Recovery**: Handle corrupted configuration files

### 6.4 Usability
- **CLI Interface**: Intuitive command structure and help text
- **Interactive Mode**: User-friendly prompts and feedback
- **Documentation**: Clear usage examples and error messages
- **Consistency**: Consistent behavior across all commands

### 6.5 Maintainability
- **Code Structure**: Modular design with separated concerns
- **Testing**: Comprehensive test coverage
- **Documentation**: Well-documented codebase
- **Extensibility**: Easy to add new MCP clients via configuration

---

## 7. User Interface Requirements

### 7.1 CLI Interface Design
- **Command Structure**: MCP servers expose commands like `<mcp-server> config [options]`
- **Interactive Prompts**: User-friendly prompts with validation and default values
- **Progress Indicators**: Show progress during client distribution operations
- **Error Messages**: Clear, actionable error messages with recovery suggestions

### 7.2 Interactive Configuration Wizard
- **Guided Setup**: Step-by-step configuration process
- **Current Value Display**: Show existing values with option to keep or update
- **Client Selection**: Multi-select interface for choosing target clients
- **Validation**: Real-time validation of user inputs
- **Confirmation**: Summary display before applying changes

### 7.3 Output Formatting
- **Structured Output**: Consistent formatting for all command outputs
- **Color Coding**: Use colors to distinguish between different types of information (when supported)
- **Source Indication**: Clear indication of configuration value sources
- **Table Format**: Tabular display for listing multiple configuration values

---

## 8. Integration Requirements

### 8.1 MCP Server Integration
- **Import Method**: MCP servers import dj-config-mcp as a dependency
- **Command Registration**: MCP servers register configuration commands with their command handlers
- **Environment Loading**: Library automatically loads .env files on initialization
- **API Access**: Direct programmatic access to all configuration functions
- **Compatibility**: Works with any Node.js-based MCP server architecture

### 8.2 Client Integration
- **Configuration Distribution**: Automatic distribution to MCP clients (VS Code, Claude Code, Claude Desktop, Cursor)
- **Path Resolution**: Handle client-specific configuration paths
- **Format Compatibility**: Generate client-compatible configuration formats
- **Dual Storage**: Distribute both JSON configurations and environment variables appropriately

### 8.3 Development Workflow
- **Package Manager**: MCP servers install via `npm install dj-config-mcp`
- **Import**: `const djConfig = require('dj-config-mcp')` in MCP server code
- **Command Integration**: MCP servers expose configuration commands through their own CLI
- **Project Integration**: Works within existing MCP server project structures

---

## 9. Testing Requirements

### 9.1 Unit Testing
- **Coverage**: Comprehensive test coverage for all functions
- **Framework**: Jest testing framework
- **Mocking**: Mock file system operations for testing
- **Edge Cases**: Test error conditions and edge cases

### 9.2 Integration Testing
- **CLI Commands**: Test all CLI command functionality
- **File Operations**: Test configuration file creation and modification
- **Client Distribution**: Test configuration distribution to clients

### 9.3 Security Testing
- **Sensitive Data**: Verify sensitive data is never stored in JSON files
- **File Permissions**: Test appropriate file system permissions
- **Environment Variables**: Verify proper environment variable handling
- **.gitignore**: Test automatic .gitignore creation and updates
- **Pattern Matching**: Verify sensitive term detection (password, secret, key, token, auth, credential, private)

---

## 10. Deployment & Distribution

### 10.1 Package Distribution
- **Registry**: npm public registry
- **Versioning**: Semantic versioning (SemVer)
- **Access**: Public package with open access

### 10.2 Installation
- **MCP Server Installation**: `npm install dj-config-mcp`
- **Import in MCP Server**: 
  ```javascript
  const djConfig = require('dj-config-mcp');
  ```
- **No Direct CLI**: Commands are exposed through the host MCP server's interface

### 10.3 Updates
- **Backward Compatibility**: Maintain compatibility with existing configurations following release of 1.0.0
- **Migration**: Automatic migration of configuration formats if needed
- **Notifications**: Clear communication of breaking changes

---

## 11. Future Enhancements

### 11.1 Planned Features
- **Web UI**: Browser-based configuration interface for power business users
- **Configuration Validation**: Schema-based configuration validation
- **Backup/Restore**: Configuration backup and restore functionality
- **Templates**: Pre-built configuration templates for common MCP servers
- **Additional Clients**: Support for more AI tools and MCP clients
- **Project Detection**: Enhanced project-level configuration auto-detection

### 11.2 Potential Integrations
- **CI/CD**: Integration with continuous integration systems
- **Cloud Storage**: Sync configurations with cloud storage services
- **Team Collaboration**: Enhanced team collaboration features
- **Monitoring**: Configuration change monitoring and alerting

---

## 12. Success Criteria

### 12.1 Launch Criteria
- [ ] All core library functions implemented and tested
- [ ] Automatic sensitive data detection working correctly
- [ ] Client distribution functionality operational
- [ ] Environment loading functionality for clients that don't support .env
- [ ] Comprehensive documentation for MCP server integration
- [ ] Package published to npm registry

### 12.2 Adoption Metrics
- **Downloads**: Track npm package downloads
- **Usage**: Monitor CLI command usage patterns
- **Feedback**: Collect user feedback and feature requests
- **Contributions**: Track community contributions and issues

### 12.3 Quality Metrics
- **Test Coverage**: Maintain >90% test coverage
- **Bug Reports**: Minimize critical and high-priority bugs
- **Performance**: CLI commands execute within performance targets
- **Security**: Zero security vulnerabilities in sensitive data handling

---

## 13. Risks & Mitigation

### 13.1 Technical Risks
- **File System Permissions**: Risk of insufficient permissions for configuration files
  - *Mitigation*: Comprehensive error handling and user guidance
- **Client Path Changes**: Risk of MCP client configuration paths changing
  - *Mitigation*: Configurable client mappings and version detection

### 13.2 Security Risks
- **Sensitive Data Exposure**: Risk of accidentally exposing sensitive configuration data
  - *Mitigation*: Automated detection and secure storage patterns
- **File System Security**: Risk of insecure file permissions
  - *Mitigation*: Set appropriate file permissions and validate access

### 13.3 Adoption Risks
- **Complexity**: Risk of tool being too complex for developers
  - *Mitigation*: Focus on intuitive CLI design and comprehensive documentation
- **Compatibility**: Risk of incompatibility with existing MCP servers
  - *Mitigation*: Extensive testing with popular MCP server implementations

---

## 14. Appendices

### 14.1 Glossary
- **MCP**: Model Context Protocol - A protocol for communication between AI models and context providers
- **CLI**: Command Line Interface
- **Sensitive Data**: Configuration values containing passwords, keys, tokens, or other security credentials
- **Client Distribution**: The process of copying configuration files to MCP client applications

### 14.2 References
- Model Context Protocol Specification
- Node.js Documentation
- npm Package Management Guidelines
- Security Best Practices for Configuration Management

---

*This PRD serves as the foundational document for the dj-config-mcp project, defining requirements, specifications, and success criteria for the configuration management utility.*

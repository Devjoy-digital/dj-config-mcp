# DJ Config MCP - Naming Conventions

This document outlines the naming conventions used throughout the DJ Config MCP codebase.

## General Rules

### JavaScript/Node.js Conventions

1. **Files and Directories**
   - Use kebab-case for file names: `client-registry.js`, `path-utils.js`
   - Use lowercase for directory names: `lib`, `storage`, `utils`

2. **Classes**
   - Use PascalCase: `ClientRegistry`, `StorageManager`, `BaseClient`
   - Should be nouns that describe what they manage

3. **Methods and Functions**
   - Use camelCase: `getClientPath`, `loadMappings`, `isInstalled`
   - Should start with verbs: `get`, `set`, `load`, `save`, `is`, `has`, `can`
   - Boolean methods should start with `is`, `has`, or `can`

4. **Variables and Properties**
   - Use camelCase: `serverName`, `clientConfig`, `isGlobal`
   - Boolean variables should start with `is`, `has`, or similar
   - Collections should be plural: `mappings`, `clients`, `errors`

5. **Constants**
   - Use UPPER_SNAKE_CASE: `DEFAULT_TIMEOUT`, `MAX_RETRIES`
   - Group related constants in objects

6. **Parameters**
   - Use camelCase: `clientId`, `isGlobal`, `configPath`
   - Be consistent across similar methods

## Specific Conventions

### Method Naming Patterns

| Pattern | Example | Usage |
|---------|---------|-------|
| `get*` | `getClientPath` | Retrieve a value |
| `set*` | `setServerName` | Set a value |
| `load*` | `loadMappings` | Load data from storage |
| `save*` | `saveMappings` | Save data to storage |
| `is*` | `isInstalled` | Check boolean condition |
| `has*` | `hasClient` | Check existence |
| `can*` | `canDistribute` | Check capability |
| `init*` | `initializeClients` | Initialize components |
| `update*` | `updateConfig` | Modify existing data |
| `delete*` | `deleteConfig` | Remove data |
| `add*` | `addClient` | Add new data |
| `remove*` | `removeClient` | Remove from collection |

### Parameter Consistency

- `isGlobal`: Boolean flag for global vs local scope (not `global`)
- `clientId`: String identifier for a client (not `client` or `id`)
- `configPath`: Full path to configuration file
- `pathTemplate`: Path with placeholders to resolve
- `serverName`: Name of the MCP server

### Error Handling

- Custom error classes end with `Error`: `ClientError`, `StorageError`
- Error messages should be descriptive and include context
- Error codes should be UPPER_SNAKE_CASE

### Storage Paths

- Configuration paths should be consistent:
  - Global: Platform-specific config directories
  - Local: `./devjoy-digital/{serverName}/`
- Use forward slashes in path templates: `${HOME}/.config/`

## Refactoring Checklist

When refactoring for consistency:

1. ✅ Rename `pathsSection` to `scopedPaths` for clarity
2. ✅ Standardize boolean parameters to `isGlobal` (not `global`)
3. ✅ Ensure all async methods follow async/await pattern
4. ✅ Use consistent error handling with custom error classes
5. ✅ Apply verb-first naming to all methods
6. ✅ Use PathUtils for all path operations
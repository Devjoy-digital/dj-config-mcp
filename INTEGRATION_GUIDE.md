# dj-postgres-mcp Integration Guide

## Overview

The `dj-postgres-mcp` is a Model Context Protocol (MCP) server that provides PostgreSQL database connectivity for AI assistants. This server integrates seamlessly with [`dj-config-mcp`](https://github.com/devjoy-digital/dj-config-mcp) for centralized configuration management, ensuring consistency across multiple MCP servers and clients.

## What is dj-postgres-mcp?

This MCP server enables AI assistants to:
- **Connect to PostgreSQL databases** (local, Azure, AWS RDS, Google Cloud SQL)
- **Execute SQL queries safely** with parameterized query support
- **Explore database schemas** with table listing and structure description
- **Manage configurations centrally** through dj-config-mcp integration
- **Distribute settings automatically** across multiple MCP clients

## Architecture & Dependencies

### Core Dependencies
- **dj-config-mcp**: Handles all configuration management and client distribution
- **@modelcontextprotocol/sdk**: Provides MCP protocol implementation
- **pg**: PostgreSQL client library for Node.js

### Configuration Flow
```
AI Assistant → dj-postgres-mcp → dj-config-mcp → Configuration Storage
                                              ↓
                               Client Distribution (Claude, VSCode, Cline)
```

## Installation

### Prerequisites
- Node.js 18+ installed
- Access to a PostgreSQL database
- An MCP-compatible client (Claude Desktop, VS Code MCP extension, Cline, etc.)

### Step 1: Install the MCP Server

```bash
# Install globally (recommended)
npm install -g dj-postgres-mcp

# Or install locally in your project
npm install dj-postgres-mcp
```

### Step 2: Install dj-config-mcp (if not already installed)

```bash
# dj-config-mcp is automatically installed as a dependency
# but you can install it globally for standalone use
npm install -g dj-config-mcp
```

## Client Configuration

### Claude Desktop

Add the server to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "dj-postgres-mcp": {
      "command": "dj-postgres-mcp",
      "args": [],
      "env": {}
    }
  }
}
```

**Configuration file locations:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

### VS Code MCP Extension

Add to your VS Code MCP settings:

```json
{
  "mcp.servers": {
    "dj-postgres-mcp": {
      "command": "dj-postgres-mcp",
      "args": [],
      "env": {}
    }
  }
}
```

### Cline Configuration

Configure in Cline's MCP server settings:

```json
{
  "servers": {
    "dj-postgres-mcp": {
      "command": "dj-postgres-mcp",
      "args": [],
      "env": {}
    }
  }
}
```

## Database Connection Setup

### Step 1: Configure Your Database Connection

Use the `configure_connection` tool to set up your database connection. This will automatically store your configuration using dj-config-mcp:

```javascript
// Local PostgreSQL
await use_mcp_tool('dj-postgres-mcp', 'configure_connection', {
  host: 'localhost',
  port: 5432,
  database: 'myapp',
  user: 'postgres',
  password: 'mypassword',
  ssl: false,
  clients: ['claude-desktop', 'vscode-mcp', 'cline']  // optional
});

// Azure Database for PostgreSQL
await use_mcp_tool('dj-postgres-mcp', 'configure_connection', {
  host: 'myserver.postgres.database.azure.com',
  port: 5432,
  database: 'production',
  user: 'myadmin@myserver',
  password: 'SecurePass123!',
  ssl: true  // Required for Azure
});
```

### Step 2: Test Your Connection

```javascript
await use_mcp_tool('dj-postgres-mcp', 'test_connection', {});
```

### Step 3: Verify Configuration

```javascript
await use_mcp_tool('dj-postgres-mcp', 'get_connection_info', {});
```

## Available Tools

### Configuration Management Tools

#### `configure_connection`
Sets up PostgreSQL database connection parameters and stores them via dj-config-mcp.

**Parameters:**
- `host` (required): Database hostname
- `port` (optional): Database port (default: 5432)
- `database` (required): Database name
- `user` (required): Username
- `password` (required): Password
- `ssl` (optional): Enable SSL (default: true for security)
- `clients` (optional): Array of client names for configuration distribution

**Features:**
- Passwords automatically stored securely in `.env` files by dj-config-mcp
- Non-sensitive settings stored in configuration files
- Automatic distribution to specified MCP clients

#### `get_connection_info`
Retrieves current connection configuration (passwords are masked for security).

#### `test_connection`
Tests the current database connection and returns server information.

#### `list_available_clients`
Lists MCP clients that can receive PostgreSQL configuration distribution.

### Database Operation Tools

#### `execute_query`
Executes SQL queries with optional parameterization for safety.

**Parameters:**
- `query` (required): SQL query string
- `params` (optional): Array of parameters for parameterized queries

**Supported Operations:**
- SELECT queries with full result sets
- INSERT/UPDATE/DELETE with affected row counts
- DDL statements (CREATE, ALTER, DROP)
- Multi-statement transactions
- Complex queries with JOINs and aggregations

#### `list_tables`
Lists all tables in the database or a specific schema.

**Parameters:**
- `schema` (optional): Schema name to filter by

#### `describe_table`
Gets detailed information about a table structure.

**Parameters:**
- `table` (required): Table name
- `schema` (optional): Schema name (default: "public")

## Configuration Storage with dj-config-mcp

### How Configuration is Stored

dj-config-mcp automatically manages configuration storage:

```
Configuration Keys:
├── postgres.host          → Configuration file
├── postgres.port          → Configuration file  
├── postgres.database      → Configuration file
├── postgres.user          → Configuration file
├── postgres.password      → .env file (secure)
├── postgres.ssl           → Configuration file
└── postgres.clients       → Configuration file
```

### Sensitive Data Handling

- **Passwords**: Automatically detected and stored in `.env` files
- **Connection strings**: Kept secure and not logged
- **Configuration files**: Non-sensitive settings stored in JSON format
- **Client distribution**: Handled automatically by dj-config-mcp

### Environment Variable Support

You can also configure the server using environment variables:

```bash
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_DATABASE=mydb
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=mypassword
export POSTGRES_SSL=true
```

## Usage Examples

### Basic Database Operations

```javascript
// Create a table
await use_mcp_tool('dj-postgres-mcp', 'execute_query', {
  query: `
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      metadata JSONB
    )
  `
});

// Insert data with parameters (prevents SQL injection)
await use_mcp_tool('dj-postgres-mcp', 'execute_query', {
  query: 'INSERT INTO users (name, email) VALUES ($1, $2), ($3, $4)',
  params: ['John Doe', 'john@example.com', 'Jane Smith', 'jane@example.com']
});

// Query data
await use_mcp_tool('dj-postgres-mcp', 'execute_query', {
  query: 'SELECT * FROM users WHERE created_at >= $1 ORDER BY name',
  params: ['2024-01-01']
});
```

### Schema Exploration

```javascript
// List all tables
await use_mcp_tool('dj-postgres-mcp', 'list_tables', {});

// List tables in specific schema
await use_mcp_tool('dj-postgres-mcp', 'list_tables', {
  schema: 'public'
});

// Examine table structure
await use_mcp_tool('dj-postgres-mcp', 'describe_table', {
  table: 'users',
  schema: 'public'
});
```

### Advanced Queries

```javascript
// Complex query with JOINs
await use_mcp_tool('dj-postgres-mcp', 'execute_query', {
  query: `
    SELECT 
      u.name,
      u.email,
      COUNT(o.id) as order_count,
      SUM(o.total_amount) as total_spent
    FROM users u
    LEFT JOIN orders o ON u.id = o.user_id
    WHERE u.created_at >= $1
    GROUP BY u.id, u.name, u.email
    HAVING COUNT(o.id) > $2
    ORDER BY total_spent DESC
  `,
  params: ['2024-01-01', 0]
});

// Transaction example
await use_mcp_tool('dj-postgres-mcp', 'execute_query', {
  query: `
    BEGIN;
    UPDATE accounts SET balance = balance - $1 WHERE id = $2;
    UPDATE accounts SET balance = balance + $1 WHERE id = $3;
    INSERT INTO transactions (from_account, to_account, amount) VALUES ($2, $3, $1);
    COMMIT;
  `,
  params: [100.00, 1, 2]
});
```

## Cloud Database Integration

### Azure Database for PostgreSQL

```javascript
await use_mcp_tool('dj-postgres-mcp', 'configure_connection', {
  host: 'myserver.postgres.database.azure.com',
  port: 5432,
  database: 'production',
  user: 'myadmin@myserver',  // Note: username@servername format
  password: 'your_secure_password',
  ssl: true  // Required for Azure
});
```

### AWS RDS PostgreSQL

```javascript
await use_mcp_tool('dj-postgres-mcp', 'configure_connection', {
  host: 'mydb.cluster-abc123.us-east-1.rds.amazonaws.com',
  port: 5432,
  database: 'myapp',
  user: 'postgres',
  password: 'your_rds_password',
  ssl: true  // Recommended for RDS
});
```

### Google Cloud SQL

```javascript
await use_mcp_tool('dj-postgres-mcp', 'configure_connection', {
  host: 'project-id:region:instance-name',  // Cloud SQL connection format
  port: 5432,
  database: 'myapp',
  user: 'postgres',
  password: 'your_cloud_sql_password',
  ssl: true  // Required for Cloud SQL
});
```

## Client Distribution & Multi-Client Setup

### Understanding Client Distribution

When you configure the database connection, dj-config-mcp can automatically distribute the configuration to multiple MCP clients:

```javascript
await use_mcp_tool('dj-postgres-mcp', 'configure_connection', {
  host: 'localhost',
  port: 5432,
  database: 'shared_db',
  user: 'postgres',
  password: 'password',
  ssl: false,
  clients: ['claude-desktop', 'vscode-mcp', 'cline']
});
```

### List Available Clients

```javascript
await use_mcp_tool('dj-postgres-mcp', 'list_available_clients', {});
```

### Benefits of Centralized Configuration

1. **Single Source of Truth**: Configure once, use everywhere
2. **Consistency**: Same database settings across all AI assistants
3. **Security**: Passwords stored securely and distributed safely
4. **Maintenance**: Update configuration in one place

## Security Best Practices

### Connection Security

1. **Always use SSL** for cloud databases
2. **Use strong passwords** with mixed characters
3. **Rotate credentials regularly**
4. **Use read-only users** when possible for analytical queries
5. **Enable connection timeouts** to prevent hanging connections

### Query Safety

1. **Always use parameterized queries** for user input:
   ```javascript
   // Good - parameterized
   query: 'SELECT * FROM users WHERE id = $1',
   params: [userId]
   
   // Bad - SQL injection risk
   query: `SELECT * FROM users WHERE id = ${userId}`
   ```

2. **Limit result sets** for large tables:
   ```javascript
   query: 'SELECT * FROM large_table LIMIT 1000'
   ```

3. **Validate input** before executing queries
4. **Use transactions** for multi-step operations
5. **Monitor query execution times**

### Configuration Security

1. **Passwords are automatically secured** by dj-config-mcp in `.env` files
2. **Keep `.env` files in `.gitignore`**
3. **Use environment-specific configurations**
4. **Limit configuration access** to authorized users only

## Troubleshooting

### Common Connection Issues

#### "Connection failed: getaddrinfo ENOTFOUND"
```javascript
// Check your host configuration
await use_mcp_tool('dj-postgres-mcp', 'get_connection_info', {});
```
**Solutions:**
- Verify the hostname is correct
- Check network connectivity
- Ensure PostgreSQL server is running

#### "SSL connection required"
```javascript
// Enable SSL in your configuration
await use_mcp_tool('dj-postgres-mcp', 'configure_connection', {
  // ... other config
  ssl: true
});
```

#### "password authentication failed"
```javascript
// Test your credentials
await use_mcp_tool('dj-postgres-mcp', 'test_connection', {});
```
**Solutions:**
- Verify username and password
- Check if user exists in PostgreSQL
- Ensure user has database access permissions

### Query Troubleshooting

#### "relation does not exist"
```javascript
// Check available tables
await use_mcp_tool('dj-postgres-mcp', 'list_tables', {});

// Verify table structure
await use_mcp_tool('dj-postgres-mcp', 'describe_table', {
  table: 'your_table_name'
});
```

#### "column does not exist"
```javascript
// Examine table structure
await use_mcp_tool('dj-postgres-mcp', 'describe_table', {
  table: 'your_table_name'
});
```

### Configuration Issues

#### "dj-config-mcp not found"
```bash
# Install the dependency
npm install -g dj-config-mcp
```

#### Configuration not persisting
```javascript
// Check current configuration
await use_mcp_tool('dj-postgres-mcp', 'get_connection_info', {});
```

### Debug Mode

Enable debug logging by setting environment variable:
```bash
export MCP_DEBUG=true
```

## Integration Patterns

### Development Workflow

1. **Setup**: Configure local development database
2. **Explore**: Use `list_tables` and `describe_table` to understand schema
3. **Develop**: Write and test queries using `execute_query`
4. **Deploy**: Update configuration for production database

### Data Analysis Workflow

1. **Connect**: Configure read-only database connection
2. **Explore**: Examine table structures and relationships
3. **Query**: Run analytical queries with proper LIMIT clauses
4. **Iterate**: Refine queries based on results

### Reporting Workflow

1. **Configure**: Set up production database (read-only user)
2. **Extract**: Run reporting queries with appropriate filters
3. **Aggregate**: Use GROUP BY and aggregate functions
4. **Schedule**: Set up regular data extraction patterns

### Multi-Environment Setup

```javascript
// Development
await use_mcp_tool('dj-postgres-mcp', 'configure_connection', {
  host: 'localhost',
  database: 'myapp_dev',
  user: 'dev_user',
  password: 'dev_password',
  ssl: false
});

// Production (later)
await use_mcp_tool('dj-postgres-mcp', 'configure_connection', {
  host: 'prod-db.company.com',
  database: 'myapp_prod',
  user: 'readonly_user',
  password: 'secure_prod_password',
  ssl: true
});
```

## Performance Considerations

### Query Optimization

1. **Use indexes** for frequently queried columns
2. **Limit result sets** with LIMIT and WHERE clauses
3. **Use EXPLAIN** to analyze query performance:
   ```javascript
   await use_mcp_tool('dj-postgres-mcp', 'execute_query', {
     query: 'EXPLAIN ANALYZE SELECT * FROM users WHERE email = $1',
     params: ['user@example.com']
   });
   ```

### Connection Management

1. **Connection pooling** is handled automatically
2. **Connection timeouts** prevent hanging connections
3. **Query timeouts** prevent long-running queries

### Best Practices

1. **Batch operations** when possible
2. **Use transactions** for related operations
3. **Monitor database performance** regularly
4. **Index frequently queried columns**

## Advanced Features

### Working with JSON Data

```javascript
// Insert JSON data
await use_mcp_tool('dj-postgres-mcp', 'execute_query', {
  query: 'INSERT INTO users (name, metadata) VALUES ($1, $2)',
  params: ['John', JSON.stringify({ age: 30, city: 'New York' })]
});

// Query JSON data
await use_mcp_tool('dj-postgres-mcp', 'execute_query', {
  query: "SELECT name, metadata->>'age' as age FROM users WHERE metadata->>'city' = $1",
  params: ['New York']
});
```

### Working with Arrays

```javascript
// Insert array data
await use_mcp_tool('dj-postgres-mcp', 'execute_query', {
  query: 'INSERT INTO products (name, tags) VALUES ($1, $2)',
  params: ['Laptop', ['electronics', 'computers', 'tech']]
});

// Query array data
await use_mcp_tool('dj-postgres-mcp', 'execute_query', {
  query: 'SELECT * FROM products WHERE $1 = ANY(tags)',
  params: ['electronics']
});
```

### Full-Text Search

```javascript
// Create full-text search index
await use_mcp_tool('dj-postgres-mcp', 'execute_query', {
  query: `
    ALTER TABLE articles 
    ADD COLUMN search_vector tsvector 
    GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || content)) STORED
  `
});

// Perform full-text search
await use_mcp_tool('dj-postgres-mcp', 'execute_query', {
  query: 'SELECT * FROM articles WHERE search_vector @@ plainto_tsquery($1)',
  params: ['postgresql database']
});
```

## Support and Resources

### Documentation
- **API Reference**: See [API.md](./API.md) for detailed API documentation
- **Quick Start**: See [QUICK_START.md](./QUICK_START.md) for rapid setup
- **Testing Guide**: See [tests/TESTING.md](./tests/TESTING.md) for testing documentation

### Community & Support
- **GitHub Repository**: https://github.com/Devjoy-digital/dj-postgres-mcp
- **Issues & Bug Reports**: GitHub Issues
- **Feature Requests**: GitHub Discussions
- **dj-config-mcp Documentation**: https://github.com/devjoy-digital/dj-config-mcp

### Version Information
- **Current Version**: 0.9.1
- **Node.js**: 18+ required
- **PostgreSQL**: 12+ supported
- **MCP Protocol**: Compatible with MCP specification v0.1.0+

### Related Projects
- **dj-config-mcp**: Centralized configuration management for MCP servers
- **Model Context Protocol**: https://modelcontextprotocol.io/

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) file for details.

## Contributing

Contributions are welcome! Please read the contributing guidelines and submit pull requests to the main repository.

---

**💡 Pro Tip**: Start with the Quick Start guide, then refer to this comprehensive integration guide for advanced configuration and usage patterns. The combination of dj-postgres-mcp with dj-config-mcp provides a powerful, secure, and centralized way to manage PostgreSQL connections across all your AI assistants.

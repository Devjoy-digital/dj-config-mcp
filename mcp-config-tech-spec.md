# Technical Specification: MCP Server Configuration Tool

**Product Name:** MCP-Config

**Version:** 0.1 (Initial Draft)

---

## 1. Core Technologies & Dependencies

* **Language:** Node.js
* **Deployment:** Client-side script, deployable and installable via npm.
* **Key npm Packages:**
    * `dotenv`: For loading environment variables from `.env` files.
    * `config`: For managing standard configuration files (e.g., development, production environments, handling file-based configurations).
    * `convict`: For defining and validating configuration schemas.

---

## 2. Architecture

* The tool will operate as a standalone Node.js script.
* It will expose a Command Line Interface (CLI) for user interaction.
* Config data will be managed across two primary locations:
    * **Environment Variables:** For sensitive information (secrets like API keys).
    * **Standard Config Files:** For non-sensitive settings (managed by the `config` package).
* The tool will interact with the file system to place configs in client-specific directories.

---

## 3. Config Management

**Important Note:** Commands from this package will not be visible to the end user because the referencing component will mask them, providing a seamless integration experience.

* **Schema Definition:**
    * Each MCP project consuming this package will define its specific config schema.
    * This schema will be stored in a JSON file, typically named `template-config.json`, located within the consuming project's directory.
    * The `convict` package will be used to load and validate this schema, ensuring config integrity.
* **Secret Handling:**
    * The tool will intelligently identify sensitive data (e.g., based on key names or explicit tagging in the schema, TBD).
    * Any config values containing the terms "password", "secret", "key", or similar will be stored securely automatically.
    * Sensitive data will be prompted for and stored as environment variables.
    * Persistence of environment variables will be managed by writing to `.env` files in appropriate locations (e.g., user's home directory, or specific project locations, with `.gitignore` recommendations).
    * **Security Note:** While storing in `.env` files is better than hardcoding, the inherent security limitations of client-side secret storage (as discussed) persist. Users will be advised on best practices or the need for a backend proxy for true security.
* **Standard Config:**
    * Non-secret config items will be stored in JSON files, managed by the `config` package.
    * The `config` package's hierarchical capabilities will be leveraged for environment-specific settings (e.g., `default.json`, `development.json`).

---

## 4. Commands & Functionality

* ### `config` Command
    * **User Prompting:** Interactively prompt the user for config values based on the loaded schema (`template-config.json`).
    * **Smart Placement:** Based on the schema definition or internal logic, differentiate between secrets and standard settings.
    * **Secret Storage:** Write identified secrets to environment variables (persisted via `.env` files).
    * **Standard Config Storage:** Write non-secret settings to standard config files (managed by `config`).
    * **Global Config Protection:** If there is a global config already present, the command will not change it unless there is a `-g` flag provided with the command.
    * **Target Client Detection/Prompting:**
        * Upon execution, check if target clients (where configs should be placed) are already defined.
        * If no target clients are specified, prompt the user to select from a predefined list.
        * Initially Supported Target Clients: VS Code, VS Code Desktop, ChatGPT, Cursor, Blotatoad.

* ### `get config` Command
    * **All Configs:** If called without arguments, display all loaded config items.
    * **Location Indicator:** For each item, clearly indicate its source (e.g., "Environment Variable", "config.json", "user home directory").
    * **Specific Config:** If called with a key name (e.g., `get config API_KEY`), display only the value and source for that specific item.

* ### `update config` Command
    * **Interactive Update:** Allow users to modify existing config values.
    * **Smart Placement:** Adhere to the same secret/standard differentiation and storage logic as the `config` command.
    * **Secure Storage:** Any config values containing the terms "password", "secret", "key", or similar will be stored securely automatically.
    * **Global Config Protection:** If there is a global config already present, the command will not modify it unless the `-g` flag is specified.
    * **Target Client Check:** Re-prompt for target clients if none are defined, ensuring config is updated for relevant applications.

* ### Client Config Sharing / Smart Config Placement
    * The tool will integrate with the file system to place generated config artifacts (e.g., specific JSON files, snippets for environment variables) into the expected directories of the selected target clients.
    * This will require mapping specific client types (VS Code, ChatGPT, etc.) to their respective config file paths and formats.

---

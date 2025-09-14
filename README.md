# Data Agent Builder

An LLM-driven tool for analyzing Excel files and importing their data into SQLite databases. The AI agent handles all analysis, decision-making, and data processing while TypeScript provides simple execution tools.

## Features

- **LLM-Driven Architecture**: AI agent makes all decisions about parsing, data types, and import strategy
- **Smart Column Naming**: AI proposes meaningful SQL column names that preserve original meaning
- **Excel Analysis**: Examine file structure, sheets, headers, and data patterns
- **Automatic Database Creation**: Generate SQLite tables with appropriate data types
- **Data Import**: Import Excel data with intelligent column mapping
- **Interactive Chat Interface**: Natural language interaction with the AI agent

## Usage

### Basic Usage

```bash
# Interactive mode - start a chat session
tsx src/analyzeFile.ts <excel-file-path> <workspace-directory>

# With initial prompt for direct testing
tsx src/analyzeFile.ts <excel-file-path> <workspace-directory> "your prompt here"
```

### Example

```bash
# Interactive analysis
tsx src/analyzeFile.ts "data/social-media-data.xlsx" "output"

# Direct workflow with prompt
tsx src/analyzeFile.ts "data/social-media-data.xlsx" "output" "Analyze this file and import all data into SQLite"
```

## How it Works

1. **AI Agent Initialization**: The LLM agent starts with access to simple TypeScript tools
2. **File Analysis**: The AI examines Excel files using tools to:
   - Get sheet information and structure
   - View raw data to understand layouts
   - Analyze headers and propose meaningful SQL column names
   - Determine appropriate data types and import strategies
3. **Database Creation**: The AI creates SQLite tables with intelligent column mappings
4. **Data Import**: The AI imports Excel data using the proposed column mappings

## Output Files

The tool creates the following files in the workspace directory:

- `parserConfig.json` - Parser configuration for the Excel file
- `dataLoaderMetadata.json` - Table configuration with column mappings
- `data.db` - SQLite database with the imported data

## Tools Available

The AI assistant has access to these simple tools:

- `getSheetsTool` - Get list of sheets in the Excel file
- `getRawDataTool` - Get raw data from a specific sheet
- `getParsedHeadersTool` - Get parsed headers and propose meaningful SQL column names
- `writeConfigTool` - Save parser and table configuration
- `createTableTool` - Create SQLite table with column mappings
- `importDataTool` - Import Excel data into SQLite table

## Requirements

- Node.js with TypeScript support
- SQLite3
- Excel files (.xlsx format)

## Installation

### Option 1: Dev Container (Recommended)

1. Open the project in VS Code
2. When prompted, click "Reopen in Container" or use Command Palette: "Dev Containers: Reopen in Container"
3. The container will automatically set up mise and install all dependencies

### Option 2: Local Installation

```bash
# Install mise (if not already installed)
curl https://mise.run | sh

# Install tools specified in mise.toml
mise install

# Install project dependencies
pnpm install
```

## Dependencies

- `xlsx` - Excel file reading
- `sqlite3` - SQLite database operations
- `umwelten` - AI framework for agent interactions
- `zod` - Schema validation for tool inputs

## Architecture

This tool follows an **LLM-driven architecture** where:
- The AI agent makes all complex decisions (parsing, data types, column naming)
- TypeScript provides simple, focused tools for execution
- The LLM analyzes Excel structure and proposes meaningful SQL column names
- All analysis logic is handled by the AI, not hardcoded TypeScript

## Development Environment

The project includes a **Dev Container** configuration that provides:
- **Consistent Environment**: Same Node.js and tool versions across all machines
- **mise Integration**: Automatic tool installation and management via mise
- **VS Code Integration**: Pre-configured extensions and settings
- **GitHub Copilot Ready**: Optimized for AI-assisted development

The dev container ensures that GitHub Copilot and other AI tools have access to the correct mise-managed environment.

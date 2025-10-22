# Data Agent Builder

An LLM-driven tool for analyzing data files (Excel/CSV), importing them into SQLite databases, and **automatically generating MCP (Model Context Protocol) servers** for future data querying. The AI agent handles all analysis, decision-making, and data processing while TypeScript provides simple execution tools.

## Features

- **LLM-Driven Architecture**: AI agent makes all decisions about parsing, data types, and import strategy
- **Smart Column Naming**: AI proposes meaningful SQL column names that preserve original meaning
- **Excel Analysis**: Examine file structure, sheets, headers, and data patterns
- **Automatic Database Creation**: Generate SQLite tables with appropriate data types
- **Data Import**: Import Excel data with intelligent column mapping
- **Interactive Chat Interface**: Natural language interaction with the AI agent
- **🆕 MCP Server Generation**: Automatically generate complete MCP servers from learned schemas
- **🆕 Intelligent Tool Suggestion**: AI suggests appropriate query tools based on data types
- **🆕 Future Data Querying**: Use generated servers to query new data files with the same structure

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

### Phase 1: Data Analysis & Import

1. **AI Agent Initialization**: The LLM agent starts with access to simple TypeScript tools
2. **File Analysis**: The AI examines Excel files using tools to:
   - Get sheet information and structure
   - View raw data to understand layouts
   - Analyze headers and propose meaningful SQL column names
   - Determine appropriate data types and import strategies
3. **Database Creation**: The AI creates SQLite tables with intelligent column mappings
4. **Data Import**: The AI imports Excel data using the proposed column mappings

### Phase 2: MCP Server Generation (NEW!)

5. **Schema Analysis**: The AI analyzes the learned data schema
6. **Tool Suggestion**: Based on data types, the AI suggests appropriate query tools:
   - **Numeric columns** → Aggregation tools (sum, avg, count, min, max)
   - **Categorical columns** → Grouping tools (group by categories)
   - **Date columns** → Time-series analysis tools
   - **All schemas** → Query and data loading tools
7. **Server Generation**: A complete, production-ready MCP server is generated with:
   - All suggested tools implemented
   - Type-safe schemas using Zod
   - SQLite query capabilities
   - CSV data loading for new files
8. **Ready to Use**: The generated server can be connected to Claude Desktop or any MCP client

### Phase 3: Future Usage

9. **Connect to LLM**: Configure the generated MCP server in Claude Desktop
10. **Natural Language Queries**: Ask questions about your data in plain English
11. **Load New Data**: Use the `load_data` tool to import new CSV files with the same structure
12. **Reusable**: The same server works for all future data files matching the learned schema

## Output Files

The tool creates the following files in the workspace directory:

### Phase 1 Output (Data Import)
- `parserConfig.json` - Parser configuration for the Excel file
- `dataLoaderMetadata.json` - Table configuration with column mappings
- `data.db` - SQLite database with the imported data

### Phase 2 Output (MCP Server)
- `mcp-server/` - Complete MCP server package
  - `package.json` - Dependencies and metadata
  - `tsconfig.json` - TypeScript configuration
  - `README.md` - Server usage instructions
  - `src/index.ts` - MCP server implementation

## Tools Available

The AI assistant has access to these simple tools:

### Phase 1 Tools (Data Analysis & Import)
- `getSheetsTool` - Get list of sheets in the Excel file
- `getRawDataTool` - Get raw data from a specific sheet
- `getParsedHeadersTool` - Get parsed headers and propose meaningful SQL column names
- `writeConfigTool` - Save parser and table configuration
- `createTableTool` - Create SQLite table with column mappings
- `importDataTool` - Import Excel data into SQLite table

### Phase 2 Tools (MCP Server Generation)
- `generateMCPServerTool` - Generate a complete MCP server from the learned schema

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

## MCP Server Generation

See [docs/mcp-server-generation.md](docs/mcp-server-generation.md) for comprehensive documentation on:
- What MCP servers are and how they work
- How tools are automatically suggested based on your data
- How to install and configure generated servers
- Example usage with Claude Desktop
- Advanced customization options

## Example

For a CSV with quarterly sales data (Quarter, Year, Region, Sales, Product Category):

1. **Run the tool**: `pnpm exec tsx src/analyzeFile.ts sales.csv workspace`
2. **Phase 1 completes**: Data imported into SQLite with meaningful column names
3. **Phase 2 completes**: MCP server generated with these tools:
   - `query_data` - Query sales with filters
   - `aggregate_data` - Calculate total sales, averages, etc.
   - `group_by` - Sales by region or product category
   - `load_data` - Import new quarterly data files
4. **Install and configure**: `cd workspace/mcp-server && npm install && npm run build`
5. **Use with Claude**: Ask "What were the total sales in Q1 2024 for the North region?"

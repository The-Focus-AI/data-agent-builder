# Data Agent Builder

A tool for analyzing Excel files and importing their data into SQLite databases.

## Features

- Analyze Excel file structure and extract sheet information
- Configure parsers to handle complex Excel layouts with metadata, headers, and data
- Generate SQL table definitions based on Excel data structure
- Create SQLite databases and populate them with Excel data
- Interactive AI assistant to guide through the process

## Usage

### Basic Usage

```bash
# Using pnpm script
pnpm analyze <excel-file-path> <workspace-directory>

# Using tsx directly
tsx src/analyzeFile.ts <excel-file-path> <workspace-directory>
```

### Example

```bash
# Create a workspace directory
mkdir my-workspace

# Analyze an Excel file
pnpm analyze "data/my-excel-file.xlsx" "my-workspace"
```

## How it Works

1. **Load Excel File**: The tool loads and validates the specified Excel file
2. **Interactive Analysis**: An AI assistant helps you:
   - Examine the file structure and available sheets
   - View raw data to understand the layout
   - Configure a parser to handle metadata, headers, and data rows
   - Generate appropriate SQL table definitions
   - Create and populate SQLite tables

## Output Files

The tool creates the following files in the workspace directory:

- `parserConfig.json` - Parser configuration for the Excel file
- `createTableSql.sql` - SQL CREATE TABLE statement
- `importData.ts` - TypeScript method for data import (optional)
- `data.db` - SQLite database with the imported data

## Tools Available

The AI assistant has access to these tools:

- `sheetsTool` - Get list of sheets in the Excel file
- `rawDataTool` - Get raw data from a specific sheet
- `writeParserTool` - Configure and save parser settings
- `writeTableDefinitionTool` - Generate and create SQL table
- `writeImportDataTool` - Generate TypeScript import method
- `populateTableTool` - Import Excel data into SQLite table

## Requirements

- Node.js with TypeScript support
- SQLite3
- Excel files (.xlsx format)

## Installation

```bash
pnpm install
```

## Dependencies

- `xlsx` - Excel file reading
- `sqlite3` - SQLite database operations
- `umwelten` - AI framework
- `ai` - AI tool definitions
- `zod` - Schema validation

# MCP Server Generation

## Overview

The Data Agent Builder now includes automatic **MCP (Model Context Protocol) Server Generation**. After analyzing and importing your data, the tool can generate a complete, production-ready MCP server that provides intelligent query capabilities for your data schema.

## What is an MCP Server?

An MCP server is a standardized interface that allows LLMs (like Claude) to interact with your data. Once generated and configured, you can ask natural language questions about your data in any MCP-compatible client (like Claude Desktop).

## The Complete Workflow

```
┌─────────────────────────────────────────────────────────┐
│ Phase 1: Data Analysis & Import                        │
│ ─────────────────────────────────────────────────────── │
│ 1. Analyze sample data file (Excel/CSV)                │
│ 2. Learn the schema conversationally with LLM          │
│ 3. Generate config files and SQLite database           │
│ 4. Output: parserConfig.json, dataLoaderMetadata.json  │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Phase 2: MCP Server Generation (NEW!)                  │
│ ─────────────────────────────────────────────────────── │
│ 5. Analyze learned schema                              │
│ 6. Suggest appropriate tools based on data types       │
│ 7. Generate complete MCP server with tools             │
│ 8. Output: Ready-to-use MCP server package             │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Phase 3: Usage in Future Conversations                 │
│ ─────────────────────────────────────────────────────── │
│ 9. Install and configure MCP server                    │
│ 10. Connect to Claude Desktop or other LLM client      │
│ 11. Ask natural language questions about new data      │
│ 12. Load new data files with same structure            │
└─────────────────────────────────────────────────────────┘
```

## Generated Tools

The MCP server generator automatically creates tools based on your data schema:

### Core Tools (Always Included)

1. **query_data**
   - Query data with optional filters on any column
   - Supports pagination with limit/offset
   - Returns results in JSON format

2. **load_data**
   - Load new CSV files with the same structure
   - Validates schema compatibility
   - Optional: clear existing data before loading

### Conditional Tools (Based on Data Types)

3. **aggregate_data** (if numeric columns exist)
   - Calculate sum, avg, count, min, max
   - Apply filters before aggregation
   - Works on INTEGER and REAL columns

4. **group_by** (if categorical columns exist)
   - Group data by categories
   - Calculate aggregations per group
   - Useful for TEXT columns with distinct values

5. **time_series_analysis** (if date columns exist)
   - Analyze data over time periods
   - Filter by date ranges
   - Aggregate values by date
   - Works on DATE and DATETIME columns

## Usage

### Automatic Generation (Recommended)

The LLM workflow automatically generates the MCP server after importing data:

```bash
pnpm exec tsx src/analyzeFile.ts "data.xlsx" "workspace"
```

The LLM will:
1. Complete Phase 1 (analyze and import)
2. Automatically proceed to Phase 2 (generate MCP server)
3. Output the server to `workspace/mcp-server/`

### Manual Generation

You can also generate an MCP server programmatically:

```typescript
import { MCPServerGenerator } from './src/generation/MCPServerGenerator.js';
import fs from 'fs';

// Read the learned schema
const tableConfig = JSON.parse(
  fs.readFileSync('workspace/dataLoaderMetadata.json', 'utf-8')
);

// Create MCP server config
const config = MCPServerGenerator.fromTableConfig(
  tableConfig,
  'my-data-server',
  'Query and analyze my data'
);

// Generate the server
const generator = new MCPServerGenerator(config);
generator.generate('output/mcp-server');
```

### Example Generation Script

See `demo/generate-example-mcp-server.ts` for a complete example.

## Generated Server Structure

```
mcp-server/
├── package.json           # MCP server dependencies
├── tsconfig.json         # TypeScript configuration
├── README.md             # Usage instructions
└── src/
    └── index.ts          # MCP server implementation
```

## Installing the Generated Server

After generation:

```bash
cd workspace/mcp-server
npm install
npm run build
```

## Configuring with Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "my-data-server": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/dist/index.js"],
      "env": {
        "DATA_PATH": "/absolute/path/to/data.db"
      }
    }
  }
}
```

## Using the MCP Server

Once configured, you can ask Claude questions like:

- "What are the total sales for Q1 2024?"
- "Show me sales grouped by region"
- "What's the average sales per quarter?"
- "Load the new quarterly data from sales-2024-Q4.csv"

Claude will use the generated tools to query your data and provide answers.

## Example: Quarterly Sales Data

For a CSV with columns: Quarter, Year, Region, Sales, Product Category

**Generated Tools:**
- `query_data` - Query with filters on any column
- `aggregate_data` - Calculate sales totals, averages, etc.
- `group_by` - Group sales by region or category
- `load_data` - Load new quarterly data files

**Sample Queries:**
```typescript
// Query all sales for a specific region
query_data({ region: "North", limit: 100 })

// Get total sales
aggregate_data({ column: "sales", operation: "sum" })

// Sales by region
group_by({ groupBy: "region", aggregateColumn: "sales", aggregateOperation: "sum" })

// Load new data
load_data({ csvPath: "/path/to/new-data.csv", clearExisting: false })
```

## Architecture

### Tool Suggestion Engine

The `ToolSuggester` class analyzes your schema and automatically suggests appropriate tools:

- Detects numeric columns → suggests aggregation tools
- Detects categorical columns → suggests grouping tools
- Detects date columns → suggests time-series tools
- Always includes query and data loading tools

### Template System

The generator uses templates in `src/generation/templates/`:
- `base-server.ts.template` - MCP server structure
- `package.json.template` - Dependencies and metadata
- `tsconfig.json.template` - TypeScript configuration
- `README.md.template` - Usage documentation

### Code Generation

For each tool, the generator creates:
1. Tool definition (name, description, input schema)
2. Zod schema for input validation
3. Implementation code for the tool
4. SQL query generation
5. Result formatting

## Benefits

1. **Instant Querying** - Ask natural language questions about your data
2. **Schema Validation** - Automatically validates new data files
3. **Type Safety** - Full TypeScript typing for all operations
4. **Reusable** - Use the same server for multiple data files with the same structure
5. **Extensible** - Generated code is readable and modifiable
6. **Standard Protocol** - Works with any MCP-compatible client

## Next Steps

After generating your MCP server:

1. **Install dependencies**: `npm install` in the generated directory
2. **Build**: `npm run build`
3. **Configure**: Add to Claude Desktop config
4. **Test**: Restart Claude Desktop and ask questions
5. **Customize**: Modify generated code to add custom tools or logic

## Troubleshooting

### Server not appearing in Claude Desktop
- Check that the path in the config is absolute, not relative
- Verify the server builds without errors (`npm run build`)
- Restart Claude Desktop after configuration changes

### "Database not initialized" error
- Ensure DATA_PATH environment variable points to valid SQLite database
- Check that the database file exists and is readable

### Schema mismatch when loading new data
- Ensure new CSV files have the exact same columns as the original
- Column order doesn't matter, but names must match
- Use the same data types (numbers, text, dates)

## Advanced Usage

### Custom Tool Development

The generated server code is readable TypeScript. You can add custom tools by:

1. Adding tool definitions to the `tools` array
2. Implementing the tool handler in `CallToolRequestSchema`
3. Rebuilding with `npm run build`

### Multiple Data Sources

Generate separate MCP servers for different data schemas:

```bash
# Sales data
tsx src/analyzeFile.ts sales.xlsx workspace-sales

# User analytics
tsx src/analyzeFile.ts analytics.xlsx workspace-analytics
```

Configure both in Claude Desktop to query multiple datasets.

### Production Deployment

The generated MCP servers can be:
- Deployed as standalone services
- Containerized with Docker
- Published to npm for team sharing
- Modified for cloud database connections (instead of SQLite)

## Related Documentation

- [MCP Specification](https://modelcontextprotocol.io)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Claude Desktop MCP Configuration](https://docs.anthropic.com/claude/docs/model-context-protocol)

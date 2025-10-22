/**
 * Test MCP Server Generation
 */

import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { MCPServerGenerator, ToolSuggester } from '../src/generation/MCPServerGenerator.js';
import { TableConfig } from '../src/types.js';

test('ToolSuggester generates appropriate tools for numeric columns', () => {
  const schema: TableConfig = {
    tableName: 'sales_data',
    importStrategy: 'single_table',
    columns: [
      { name: 'id', dataType: 'INTEGER', nullable: false },
      { name: 'product_name', dataType: 'TEXT', nullable: false },
      { name: 'quantity', dataType: 'INTEGER', nullable: false },
      { name: 'price', dataType: 'REAL', nullable: false },
      { name: 'region', dataType: 'TEXT', nullable: true }
    ],
    columnMappings: [
      { originalHeader: 'ID', sqlColumnName: 'id', dataType: 'INTEGER', nullable: false },
      { originalHeader: 'Product Name', sqlColumnName: 'product_name', dataType: 'TEXT', nullable: false },
      { originalHeader: 'Quantity', sqlColumnName: 'quantity', dataType: 'INTEGER', nullable: false },
      { originalHeader: 'Price', sqlColumnName: 'price', dataType: 'REAL', nullable: false },
      { originalHeader: 'Region', sqlColumnName: 'region', dataType: 'TEXT', nullable: true }
    ]
  };

  const suggester = new ToolSuggester(schema);
  const tools = suggester.suggestTools();

  // Should have basic tools
  const toolNames = tools.map(t => t.name);
  assert(toolNames.includes('query_data'), 'Should have query_data tool');
  assert(toolNames.includes('aggregate_data'), 'Should have aggregate_data tool');
  assert(toolNames.includes('group_by'), 'Should have group_by tool');
  assert(toolNames.includes('load_data'), 'Should have load_data tool');

  // Should NOT have time series tool (no date columns)
  assert(!toolNames.includes('time_series_analysis'), 'Should not have time_series_analysis without date columns');

  console.log(`✓ Generated ${tools.length} tools for numeric data`);
});

test('ToolSuggester generates time series tools for date columns', () => {
  const schema: TableConfig = {
    tableName: 'quarterly_sales',
    importStrategy: 'single_table',
    columns: [
      { name: 'date', dataType: 'DATE', nullable: false },
      { name: 'sales', dataType: 'REAL', nullable: false },
      { name: 'region', dataType: 'TEXT', nullable: false }
    ],
    columnMappings: [
      { originalHeader: 'Date', sqlColumnName: 'date', dataType: 'DATE', nullable: false },
      { originalHeader: 'Sales', sqlColumnName: 'sales', dataType: 'REAL', nullable: false },
      { originalHeader: 'Region', sqlColumnName: 'region', dataType: 'TEXT', nullable: false }
    ]
  };

  const suggester = new ToolSuggester(schema);
  const tools = suggester.suggestTools();

  const toolNames = tools.map(t => t.name);
  assert(toolNames.includes('time_series_analysis'), 'Should have time_series_analysis tool with date columns');

  console.log(`✓ Generated ${tools.length} tools for time series data`);
});

test('MCPServerGenerator creates all required files', () => {
  const schema: TableConfig = {
    tableName: 'test_data',
    importStrategy: 'single_table',
    columns: [
      { name: 'id', dataType: 'INTEGER', nullable: false },
      { name: 'value', dataType: 'REAL', nullable: false }
    ],
    columnMappings: [
      { originalHeader: 'ID', sqlColumnName: 'id', dataType: 'INTEGER', nullable: false },
      { originalHeader: 'Value', sqlColumnName: 'value', dataType: 'REAL', nullable: false }
    ]
  };

  const config = MCPServerGenerator.fromTableConfig(schema, 'test-server', 'Test MCP Server');

  // Create temp output directory
  const tempDir = path.join(process.cwd(), 'test-output-mcp');
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
  }

  try {
    const generator = new MCPServerGenerator(config);
    generator.generate(tempDir);

    // Verify files were created
    assert(fs.existsSync(path.join(tempDir, 'package.json')), 'package.json should exist');
    assert(fs.existsSync(path.join(tempDir, 'tsconfig.json')), 'tsconfig.json should exist');
    assert(fs.existsSync(path.join(tempDir, 'README.md')), 'README.md should exist');
    assert(fs.existsSync(path.join(tempDir, 'src', 'index.ts')), 'src/index.ts should exist');

    // Verify package.json content
    const packageJson = JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf-8'));
    assert.strictEqual(packageJson.name, 'mcp-test-server-server', 'Package name should match');
    assert(packageJson.dependencies['@modelcontextprotocol/sdk'], 'Should have MCP SDK dependency');
    assert(packageJson.dependencies['better-sqlite3'], 'Should have better-sqlite3 dependency');
    assert(packageJson.dependencies['zod'], 'Should have zod dependency');

    // Verify server code contains tool definitions
    const serverCode = fs.readFileSync(path.join(tempDir, 'src', 'index.ts'), 'utf-8');
    assert(serverCode.includes('query_data'), 'Server should include query_data tool');
    assert(serverCode.includes('@modelcontextprotocol/sdk'), 'Server should import MCP SDK');
    assert(serverCode.includes('better-sqlite3'), 'Server should import database');

    console.log(`✓ Generated complete MCP server in ${tempDir}`);
    console.log(`✓ All required files created`);
  } finally {
    // Cleanup
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  }
});

test('MCPServerGenerator.fromTableConfig creates valid configuration', () => {
  const schema: TableConfig = {
    tableName: 'user_analytics',
    importStrategy: 'single_table',
    columns: [
      { name: 'user_id', dataType: 'INTEGER', nullable: false },
      { name: 'event_date', dataType: 'DATE', nullable: false },
      { name: 'event_count', dataType: 'INTEGER', nullable: false }
    ],
    columnMappings: [
      { originalHeader: 'User ID', sqlColumnName: 'user_id', dataType: 'INTEGER', nullable: false },
      { originalHeader: 'Event Date', sqlColumnName: 'event_date', dataType: 'DATE', nullable: false },
      { originalHeader: 'Event Count', sqlColumnName: 'event_count', dataType: 'INTEGER', nullable: false }
    ]
  };

  const config = MCPServerGenerator.fromTableConfig(schema);

  assert.strictEqual(config.serverName, 'user-analytics', 'Server name should be derived from table name');
  assert.strictEqual(config.packageName, 'mcp-user-analytics-server', 'Package name should follow convention');
  assert(config.description.includes('user_analytics'), 'Description should mention table name');
  assert(config.tools.length > 0, 'Should have generated tools');
  assert.strictEqual(config.schema.tableName, 'user_analytics', 'Schema should be preserved');

  console.log(`✓ Created config with ${config.tools.length} tools`);
});

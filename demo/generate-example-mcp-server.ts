import { MCPServerGenerator } from '../src/generation/MCPServerGenerator.js';
import { TableConfig } from '../src/types.js';

/**
 * Example: Generate an MCP server for quarterly sales data
 */

const exampleSchema: TableConfig = {
  tableName: 'quarterly_sales',
  importStrategy: 'single_table',
  columns: [
    { name: 'quarter', dataType: 'TEXT', nullable: false },
    { name: 'year', dataType: 'INTEGER', nullable: false },
    { name: 'region', dataType: 'TEXT', nullable: false },
    { name: 'sales', dataType: 'REAL', nullable: false },
    { name: 'product_category', dataType: 'TEXT', nullable: false }
  ],
  columnMappings: [
    { originalHeader: 'Quarter', sqlColumnName: 'quarter', dataType: 'TEXT', nullable: false },
    { originalHeader: 'Year', sqlColumnName: 'year', dataType: 'INTEGER', nullable: false },
    { originalHeader: 'Region', sqlColumnName: 'region', dataType: 'TEXT', nullable: false },
    { originalHeader: 'Sales', sqlColumnName: 'sales', dataType: 'REAL', nullable: false },
    { originalHeader: 'Product Category', sqlColumnName: 'product_category', dataType: 'TEXT', nullable: false }
  ]
};

// Create MCP server configuration
const config = MCPServerGenerator.fromTableConfig(
  exampleSchema,
  'quarterly-sales',
  'Query and analyze quarterly sales data'
);

console.log('Generating example MCP server...');
console.log(`Server Name: ${config.serverName}`);
console.log(`Package Name: ${config.packageName}`);
console.log(`\nTools to be generated:`);
config.tools.forEach((tool, idx) => {
  console.log(`  ${idx + 1}. ${tool.name} - ${tool.description}`);
});

// Generate the MCP server
const outputDir = 'example-output/mcp-server';
const generator = new MCPServerGenerator(config);
generator.generate(outputDir);

console.log(`\n✓ Example MCP server generated successfully!`);
console.log(`Location: ${outputDir}`);
console.log(`\nNext steps:`);
console.log(`  1. cd ${outputDir}`);
console.log(`  2. npm install`);
console.log(`  3. npm run build`);
console.log(`  4. See README.md for configuration instructions`);

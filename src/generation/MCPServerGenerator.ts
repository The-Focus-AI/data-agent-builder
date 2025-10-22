import fs from "fs";
import path from "path";
import { TableConfig, ColumnMapping } from "../types.js";

/**
 * Tool definition for MCP server
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  implementation: string; // TypeScript code for the tool
}

/**
 * MCP Server Generation Configuration
 */
export interface MCPServerConfig {
  serverName: string;
  packageName: string;
  description: string;
  tools: MCPTool[];
  schema: TableConfig;
}

/**
 * Analyzes the table schema and suggests appropriate MCP tools
 */
export class ToolSuggester {
  private schema: TableConfig;

  constructor(schema: TableConfig) {
    this.schema = schema;
  }

  /**
   * Analyze schema and suggest tools based on column types and data patterns
   */
  suggestTools(): MCPTool[] {
    const tools: MCPTool[] = [];

    // Always include a basic query tool
    tools.push(this.createQueryTool());

    // Add aggregation tools if numeric columns exist
    const numericColumns = this.getNumericColumns();
    if (numericColumns.length > 0) {
      tools.push(this.createAggregationTool(numericColumns));
    }

    // Add grouping tools if categorical columns exist
    const categoricalColumns = this.getCategoricalColumns();
    if (categoricalColumns.length > 0) {
      tools.push(this.createGroupByTool(categoricalColumns, numericColumns));
    }

    // Add time-series tools if date columns exist
    const dateColumns = this.getDateColumns();
    if (dateColumns.length > 0) {
      tools.push(this.createTimeSeriesTool(dateColumns, numericColumns));
    }

    // Add data loading tool
    tools.push(this.createLoadDataTool());

    return tools;
  }

  private getNumericColumns(): ColumnMapping[] {
    return (this.schema.columnMappings || []).filter(
      col => col.dataType === 'INTEGER' || col.dataType === 'REAL'
    );
  }

  private getCategoricalColumns(): ColumnMapping[] {
    return (this.schema.columnMappings || []).filter(
      col => col.dataType === 'TEXT'
    );
  }

  private getDateColumns(): ColumnMapping[] {
    return (this.schema.columnMappings || []).filter(
      col => col.dataType === 'DATE' || col.dataType === 'DATETIME'
    );
  }

  private createQueryTool(): MCPTool {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    // Add optional filters for each column
    (this.schema.columnMappings || []).forEach(col => {
      properties[col.sqlColumnName] = {
        type: this.zodTypeFromSQL(col.dataType),
        description: `Filter by ${col.originalHeader}`
      };
    });

    properties.limit = {
      type: "number",
      description: "Maximum number of rows to return (default: 100)"
    };

    properties.offset = {
      type: "number",
      description: "Number of rows to skip (for pagination)"
    };

    return {
      name: "query_data",
      description: `Query ${this.schema.tableName} with optional filters`,
      inputSchema: {
        type: "object",
        properties,
        required: []
      },
      implementation: this.generateQueryImplementation()
    };
  }

  private createAggregationTool(numericColumns: ColumnMapping[]): MCPTool {
    return {
      name: "aggregate_data",
      description: `Calculate aggregations (sum, avg, count, min, max) for numeric columns`,
      inputSchema: {
        type: "object",
        properties: {
          column: {
            type: "string",
            enum: numericColumns.map(col => col.sqlColumnName),
            description: "Column to aggregate"
          },
          operation: {
            type: "string",
            enum: ["sum", "avg", "count", "min", "max"],
            description: "Aggregation operation"
          },
          filters: {
            type: "object",
            description: "Optional filters to apply before aggregation"
          }
        },
        required: ["column", "operation"]
      },
      implementation: this.generateAggregationImplementation()
    };
  }

  private createGroupByTool(categoricalColumns: ColumnMapping[], numericColumns: ColumnMapping[]): MCPTool {
    return {
      name: "group_by",
      description: `Group data by categories and calculate aggregations`,
      inputSchema: {
        type: "object",
        properties: {
          groupBy: {
            type: "string",
            enum: categoricalColumns.map(col => col.sqlColumnName),
            description: "Column to group by"
          },
          aggregateColumn: {
            type: "string",
            enum: numericColumns.length > 0 ? numericColumns.map(col => col.sqlColumnName) : undefined,
            description: "Column to aggregate (for numeric columns)"
          },
          aggregateOperation: {
            type: "string",
            enum: ["sum", "avg", "count", "min", "max"],
            description: "Aggregation operation"
          }
        },
        required: ["groupBy"]
      },
      implementation: this.generateGroupByImplementation()
    };
  }

  private createTimeSeriesTool(dateColumns: ColumnMapping[], numericColumns: ColumnMapping[]): MCPTool {
    return {
      name: "time_series_analysis",
      description: `Analyze data over time periods`,
      inputSchema: {
        type: "object",
        properties: {
          dateColumn: {
            type: "string",
            enum: dateColumns.map(col => col.sqlColumnName),
            description: "Date column to analyze"
          },
          valueColumn: {
            type: "string",
            enum: numericColumns.map(col => col.sqlColumnName),
            description: "Value column to analyze over time"
          },
          startDate: {
            type: "string",
            description: "Start date (YYYY-MM-DD)"
          },
          endDate: {
            type: "string",
            description: "End date (YYYY-MM-DD)"
          },
          operation: {
            type: "string",
            enum: ["sum", "avg", "count", "min", "max"],
            description: "Aggregation operation"
          }
        },
        required: ["dateColumn", "valueColumn"]
      },
      implementation: this.generateTimeSeriesImplementation()
    };
  }

  private createLoadDataTool(): MCPTool {
    return {
      name: "load_data",
      description: `Load new data from a CSV file with the expected schema`,
      inputSchema: {
        type: "object",
        properties: {
          csvPath: {
            type: "string",
            description: "Path to CSV file to load"
          },
          clearExisting: {
            type: "boolean",
            description: "Whether to clear existing data before loading (default: false)"
          }
        },
        required: ["csvPath"]
      },
      implementation: this.generateLoadDataImplementation()
    };
  }

  private zodTypeFromSQL(sqlType: string): string {
    switch (sqlType) {
      case 'INTEGER':
        return 'number';
      case 'REAL':
        return 'number';
      case 'TEXT':
        return 'string';
      case 'DATE':
      case 'DATETIME':
        return 'string';
      default:
        return 'string';
    }
  }

  // Implementation generators
  private generateQueryImplementation(): string {
    return `
    if (!db) throw new Error("Database not initialized");

    const filters = Object.entries(args)
      .filter(([key]) => key !== 'limit' && key !== 'offset')
      .filter(([_, value]) => value !== undefined);

    let query = \`SELECT * FROM ${this.schema.tableName}\`;
    const params: any[] = [];

    if (filters.length > 0) {
      const whereClauses = filters.map(([key]) => \`\${key} = ?\`);
      query += \` WHERE \${whereClauses.join(' AND ')}\`;
      params.push(...filters.map(([_, value]) => value));
    }

    query += \` LIMIT \${args.limit || 100}\`;
    if (args.offset) {
      query += \` OFFSET \${args.offset}\`;
    }

    const rows = db.prepare(query).all(...params);

    return {
      content: [{
        type: "text",
        text: JSON.stringify(rows, null, 2)
      }]
    };`;
  }

  private generateAggregationImplementation(): string {
    return `
    if (!db) throw new Error("Database not initialized");

    const { column, operation, filters } = args;
    let query = \`SELECT \${operation.toUpperCase()}(\${column}) as result FROM ${this.schema.tableName}\`;
    const params: any[] = [];

    if (filters && typeof filters === 'object') {
      const whereClauses = Object.entries(filters).map(([key]) => \`\${key} = ?\`);
      if (whereClauses.length > 0) {
        query += \` WHERE \${whereClauses.join(' AND ')}\`;
        params.push(...Object.values(filters));
      }
    }

    const result = db.prepare(query).get(...params);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({ operation, column, result: result.result }, null, 2)
      }]
    };`;
  }

  private generateGroupByImplementation(): string {
    return `
    if (!db) throw new Error("Database not initialized");

    const { groupBy, aggregateColumn, aggregateOperation } = args;

    let query = \`SELECT \${groupBy}\`;
    if (aggregateColumn && aggregateOperation) {
      query += \`, \${aggregateOperation.toUpperCase()}(\${aggregateColumn}) as aggregate_value\`;
    } else {
      query += \`, COUNT(*) as count\`;
    }
    query += \` FROM ${this.schema.tableName} GROUP BY \${groupBy} ORDER BY \${groupBy}\`;

    const rows = db.prepare(query).all();

    return {
      content: [{
        type: "text",
        text: JSON.stringify(rows, null, 2)
      }]
    };`;
  }

  private generateTimeSeriesImplementation(): string {
    return `
    if (!db) throw new Error("Database not initialized");

    const { dateColumn, valueColumn, startDate, endDate, operation } = args;

    let query = \`SELECT \${dateColumn}, \${operation.toUpperCase()}(\${valueColumn}) as value FROM ${this.schema.tableName}\`;
    const params: any[] = [];

    const whereClauses: string[] = [];
    if (startDate) {
      whereClauses.push(\`\${dateColumn} >= ?\`);
      params.push(startDate);
    }
    if (endDate) {
      whereClauses.push(\`\${dateColumn} <= ?\`);
      params.push(endDate);
    }

    if (whereClauses.length > 0) {
      query += \` WHERE \${whereClauses.join(' AND ')}\`;
    }

    query += \` GROUP BY \${dateColumn} ORDER BY \${dateColumn}\`;

    const rows = db.prepare(query).all(...params);

    return {
      content: [{
        type: "text",
        text: JSON.stringify(rows, null, 2)
      }]
    };`;
  }

  private generateLoadDataImplementation(): string {
    return `
    const { csvPath, clearExisting } = args;

    if (!fs.existsSync(csvPath)) {
      throw new Error(\`CSV file not found: \${csvPath}\`);
    }

    if (clearExisting) {
      if (db) {
        db.prepare(\`DELETE FROM ${this.schema.tableName}\`).run();
      }
    }

    const result = loadCSVData(csvPath);

    return {
      content: [{
        type: "text",
        text: \`Successfully loaded \${result.rowsLoaded} rows from \${csvPath}\`
      }]
    };`;
  }
}

/**
 * Generates a complete MCP server from a schema configuration
 */
export class MCPServerGenerator {
  private config: MCPServerConfig;
  private templatesDir: string;

  constructor(config: MCPServerConfig, templatesDir?: string) {
    this.config = config;
    this.templatesDir = templatesDir || MCPServerGenerator.getDefaultTemplatesDir();
  }

  /**
   * Generate the complete MCP server in the specified output directory
   */
  generate(outputDir: string): void {
    // Create directory structure
    const srcDir = path.join(outputDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });

    // Generate files
    this.generatePackageJson(outputDir);
    this.generateTsConfig(outputDir);
    this.generateServerCode(srcDir);
    this.generateReadme(outputDir);

    console.log(`MCP server generated successfully in: ${outputDir}`);
  }

  private generatePackageJson(outputDir: string): void {
    const template = fs.readFileSync(
      path.join(this.templatesDir, 'package.json.template'),
      'utf-8'
    );

    const content = template
      .replace(/{{PACKAGE_NAME}}/g, this.config.packageName)
      .replace(/{{DESCRIPTION}}/g, this.config.description)
      .replace(/{{BIN_NAME}}/g, this.config.packageName)
      .replace(/{{DATA_TYPE}}/g, this.config.schema.tableName);

    fs.writeFileSync(path.join(outputDir, 'package.json'), content);
  }

  private generateTsConfig(outputDir: string): void {
    const template = fs.readFileSync(
      path.join(this.templatesDir, 'tsconfig.json.template'),
      'utf-8'
    );

    fs.writeFileSync(path.join(outputDir, 'tsconfig.json'), template);
  }

  private generateServerCode(srcDir: string): void {
    const template = fs.readFileSync(
      path.join(this.templatesDir, 'base-server.ts.template'),
      'utf-8'
    );

    // Generate tool definitions
    const toolDefinitions = this.config.tools.map(tool =>
      `// Tool: ${tool.name}\n// ${tool.description}`
    ).join('\n\n');

    // Generate tool list for ListToolsRequestSchema
    const toolList = this.config.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));

    // Generate tool handlers
    const toolHandlers = this.config.tools.map(tool => `
    if (name === "${tool.name}") {
      ${tool.implementation}
    }
    `).join('\n');

    const content = template
      .replace(/{{SERVER_NAME}}/g, this.config.serverName)
      .replace(/{{SCHEMA_JSON}}/g, JSON.stringify(this.config.schema, null, 2))
      .replace(/{{TOOL_DEFINITIONS}}/g, toolDefinitions)
      .replace(/{{TOOL_LIST}}/g, JSON.stringify(toolList, null, 6).slice(1, -1))
      .replace(/{{TOOL_HANDLERS}}/g, toolHandlers);

    fs.writeFileSync(path.join(srcDir, 'index.ts'), content);
  }

  private generateReadme(outputDir: string): void {
    const template = fs.readFileSync(
      path.join(this.templatesDir, 'README.md.template'),
      'utf-8'
    );

    // Generate features list
    const features = this.config.tools.map(tool => `- ${tool.description}`).join('\n');

    // Generate tool documentation
    const toolDocs = this.config.tools.map(tool => `
### ${tool.name}

${tool.description}

**Parameters:**
${JSON.stringify(tool.inputSchema.properties, null, 2)}

${tool.inputSchema.required ? `**Required:** ${tool.inputSchema.required.join(', ')}` : ''}
    `).join('\n');

    // Generate schema documentation
    const schemaDocs = `
**Table:** ${this.config.schema.tableName}

**Columns:**
${(this.config.schema.columnMappings || []).map(col =>
  `- \`${col.sqlColumnName}\` (${col.dataType}) - ${col.originalHeader}`
).join('\n')}
    `;

    const content = template
      .replace(/{{SERVER_NAME}}/g, this.config.serverName)
      .replace(/{{DESCRIPTION}}/g, this.config.description)
      .replace(/{{PACKAGE_NAME}}/g, this.config.packageName)
      .replace(/{{CONFIG_NAME}}/g, this.config.packageName.replace(/^mcp-/, ''))
      .replace(/{{FEATURES}}/g, features)
      .replace(/{{TOOL_DOCUMENTATION}}/g, toolDocs)
      .replace(/{{SCHEMA_DOCUMENTATION}}/g, schemaDocs);

    fs.writeFileSync(path.join(outputDir, 'README.md'), content);
  }

  /**
   * Create an MCP server configuration from a table schema
   */
  static fromTableConfig(
    tableConfig: TableConfig,
    serverName?: string,
    description?: string
  ): MCPServerConfig {
    const name = serverName || tableConfig.tableName.replace(/_/g, '-');
    const desc = description || `Query and analyze ${tableConfig.tableName} data`;

    // Generate tools based on schema
    const suggester = new ToolSuggester(tableConfig);
    const tools = suggester.suggestTools();

    return {
      serverName: name,
      packageName: `mcp-${name}-server`,
      description: desc,
      tools,
      schema: tableConfig
    };
  }

  /**
   * Get the default templates directory
   * Works with ES modules by using import.meta.url
   */
  static getDefaultTemplatesDir(): string {
    // This will be resolved at runtime from the calling location
    return path.join(path.dirname(new URL(import.meta.url).pathname), 'templates');
  }
}

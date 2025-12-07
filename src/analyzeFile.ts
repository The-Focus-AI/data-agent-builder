import { Interaction, CLIInterface, getChatCommands } from "umwelten/dist/ui/index.js";
import { Stimulus } from "umwelten/dist/stimulus/stimulus.js";
import { ExcelReader } from "./ExcelReader.js";
import { tool } from "ai";
import { z } from "zod";
import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import { createTable, importData } from "./simpleDataLoader.js";
import { ColumnMapping, TableConfig } from "./types.js";

/**
 * Normalize Excel header names to valid SQL column names
 * (Same logic as in simpleDataLoader.ts to ensure consistency)
 */
function normalizeColumnName(header: string, index: number): string {
    const cleaned = header.trim();
    if (cleaned.length === 0) {
        return `col_${index}`;
    }
    
    let normalized = cleaned
        .toLowerCase()
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/^(\d)/, 'col_$1')
        .substring(0, 50);
    
    if (normalized.length === 0 || !/^[a-zA-Z_]/.test(normalized)) {
        normalized = `col_${index}`;
    }
    
    const sqlReservedWords = new Set([
        'select', 'from', 'where', 'insert', 'update', 'delete', 'create', 'drop', 
        'alter', 'table', 'index', 'view', 'database', 'schema', 'user', 'order',
        'group', 'having', 'limit', 'offset', 'join', 'inner', 'left', 'right',
        'outer', 'union', 'distinct', 'count', 'sum', 'avg', 'min', 'max',
        'as', 'and', 'or', 'not', 'in', 'exists', 'between', 'like', 'is', 'null'
    ]);
    
    if (sqlReservedWords.has(normalized)) {
        normalized = `${normalized}_col`;
    }
    
    return normalized;
}

// let modelDetails = {
//     name: "qwen3:latest",
//     provider: "ollama"
// }

const modelDetails = {
    name: "openai/gpt-4.1",
provider: "openrouter"
}


// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
    console.error("Usage: tsx src/analyzeFile.ts <excel-file-path> <workspace-dir> [initial-prompt]");
    process.exit(1);
}

const excelFilePath = args[0];
const workspaceDir = args[1];
const initialPrompt = args[2]; // Optional initial prompt for testing

// Validate inputs
if (!fs.existsSync(excelFilePath)) {
    console.error(`Excel file not found: ${excelFilePath}`);
    process.exit(1);
}

if (!fs.existsSync(workspaceDir)) {
    console.error(`Workspace directory not found: ${workspaceDir}`);
    process.exit(1);
}

// Ensure workspace directory is writable
try {
    fs.accessSync(workspaceDir, fs.constants.W_OK);
} catch (error) {
    console.error(`Workspace directory is not writable: ${workspaceDir}`);
    process.exit(1);
}

// Initialize Excel reader
const excelReader = new ExcelReader(excelFilePath);
await excelReader.load();
console.log(`Loaded Excel file: ${excelFilePath}`);
console.log(`Available sheets: ${excelReader.getSheets().join(', ')}`);

// Initialize SQLite database in workspace
const dbPath = path.join(workspaceDir, "data.db");

// Tool 1: Get sheets (no analysis)
const getSheetsTool = tool({
    description: "Get list of all sheets in the Excel file",
inputSchema: z.object({}),
execute: async () => {
    return excelReader.getSheets();
}
});

// Tool 2: Get raw data (no analysis)
const getRawDataTool = tool({
    description: "Get raw data from a specific sheet to examine its structure",
    inputSchema: z.object({
        sheetName: z.string().describe("The sheet to get raw data from"),
        maxRows: z.number().optional().default(50).describe("Maximum number of rows to return")
    }),
    execute: async ({ sheetName, maxRows }) => {
        return excelReader.getRawData(sheetName, maxRows);
    }
});

// Tool 2.5: Get parsed headers (for LLM to propose meaningful mappings)
const getParsedHeadersTool = tool({
    description: "Get the parsed headers from a sheet using the current parser configuration. The LLM should analyze these headers and propose meaningful SQL column names that preserve the meaning while being SQL-compatible.",
    inputSchema: z.object({
        sheetName: z.string().describe("The sheet to get parsed headers from"),
        parserConfig: z.object({
            metadataRows: z.number().optional(),
            headerRow: z.number(),
            dataStartRow: z.number(),
            hasDataAboveHeader: z.boolean().optional()
        }).describe("Parser configuration to use for extracting headers")
    }),
    execute: async ({ sheetName, parserConfig }) => {
        excelReader.configureParser(parserConfig);
        const parsedData = excelReader.getParsedData(sheetName);
        
        return {
            originalHeaders: parsedData.headers,
            headerCount: parsedData.headers.length,
            sampleData: parsedData.data.slice(0, 3),
            instructions: [
                "Analyze these headers and propose meaningful SQL column names",
                "Preserve the meaning while making them SQL-compatible (lowercase, underscores, no special chars)",
                "Avoid SQL reserved words (select, from, where, order, group, etc.)",
                "Keep names descriptive and readable",
                "Examples: 'Overall Rank' → 'overall_rank', 'Brand Name' → 'brand_name'"
            ]
        };
    }
});

// Tool 3: Write final config (LLM decides everything)
const writeConfigTool = tool({
    description: "Write the complete configuration that drives the data loader. The LLM should analyze the data and decide on parser config, table structure, import strategy, and column types.",
    inputSchema: z.object({
        parserConfig: z.object({
            metadataRows: z.number().optional().describe("Number of metadata rows at the top"),
            headerRow: z.number().describe("Row number containing headers (1-based)"),
            dataStartRow: z.number().describe("Row number where data starts (1-based)"),
            hasDataAboveHeader: z.boolean().optional().describe("Whether there is data above the header row")
        }).describe("Configuration for parsing the Excel sheet structure"),
        tableConfig: z.object({
            tableName: z.string().describe("Name of the SQLite table to create"),
            importStrategy: z.enum(['single_table', 'separate_tables']).describe("How to handle multiple sheets"),
            sheetColumnName: z.string().optional().describe("Column name to store sheet name (for single_table strategy)"),
            columnMappings: z.array(z.object({
                originalHeader: z.string().describe("Original Excel header name"),
                sqlColumnName: z.string().describe("Meaningful SQL column name (lowercase, underscores, no special chars)"),
                dataType: z.enum(['TEXT', 'INTEGER', 'REAL', 'DATE', 'DATETIME']).describe("SQL data type"),
                nullable: z.boolean().describe("Whether the column allows null values")
            })).describe("Mapping from original headers to meaningful SQL column names"),
            columns: z.array(z.object({
                name: z.string().describe("Column name"),
                dataType: z.enum(['TEXT', 'INTEGER', 'REAL', 'DATE', 'DATETIME']).describe("SQL data type"),
                nullable: z.boolean().describe("Whether the column allows null values")
            })).describe("Column definitions for the table")
        }).describe("Configuration for creating the SQLite table")
    }),
    execute: async ({ parserConfig, tableConfig }) => {
        // Write parser config
        const parserConfigPath = path.join(workspaceDir, "parserConfig.json");
        fs.writeFileSync(parserConfigPath, JSON.stringify(parserConfig, null, 2));
        console.log(`Parser config written to: ${parserConfigPath}`);

        // Write table config
        const tableConfigPath = path.join(workspaceDir, "dataLoaderMetadata.json");
        fs.writeFileSync(tableConfigPath, JSON.stringify(tableConfig, null, 2));
        console.log(`Table config written to: ${tableConfigPath}`);

        return {
            message: "Configuration written successfully",
            parserConfigPath,
            tableConfigPath,
            config: { parserConfig, tableConfig }
        };
    }
});

// Tool 4: Create table (simple SQL execution)
const createTableTool = tool({
    description: "Create SQLite table using the configuration from dataLoaderMetadata.json",
    inputSchema: z.object({}),
    execute: async () => {
        try {
            // Read the metadata configuration
            const metadataPath = path.join(workspaceDir, "dataLoaderMetadata.json");
            if (!fs.existsSync(metadataPath)) {
                throw new Error("dataLoaderMetadata.json not found. Please run writeConfigTool first.");
            }
            
            const tableConfig: TableConfig = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            
            // Create the table using the column definitions
            await createTable(dbPath, tableConfig.tableName, tableConfig.columns);
            console.log(`Table '${tableConfig.tableName}' created successfully with ${tableConfig.columns.length} columns`);
            
            // Log the column mappings if available
            if (tableConfig.columnMappings && tableConfig.columnMappings.length > 0) {
                console.log("Column mappings:");
                tableConfig.columnMappings.forEach(mapping => {
                    console.log(`  "${mapping.originalHeader}" → "${mapping.sqlColumnName}" (${mapping.dataType})`);
                });
            }
            
            return {
                message: `Table '${tableConfig.tableName}' created successfully`,
                tableName: tableConfig.tableName,
                columnCount: tableConfig.columns.length,
                columnMappings: tableConfig.columnMappings || []
            };
        } catch (error) {
            console.error(`Error creating table: ${error}`);
            throw error;
        }
    }
});

// Tool 5: Import data (simple data loading)
const importDataTool = tool({
    description: "Import Excel data into the created SQLite table using column mappings from metadata",
    inputSchema: z.object({
        sheetName: z.string().describe("Name of the sheet to import data from")
    }),
    execute: async ({ sheetName }) => {
        try {
            // Read the metadata configuration
            const metadataPath = path.join(workspaceDir, "dataLoaderMetadata.json");
            const parserConfigPath = path.join(workspaceDir, "parserConfig.json");
            
            if (!fs.existsSync(metadataPath)) {
                throw new Error("dataLoaderMetadata.json not found. Please run writeConfigTool first.");
            }
            if (!fs.existsSync(parserConfigPath)) {
                throw new Error("parserConfig.json not found. Please run writeConfigTool first.");
            }
            
            const tableConfig: TableConfig = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            const parserConfig = JSON.parse(fs.readFileSync(parserConfigPath, 'utf8'));
            
            // Configure the parser
            excelReader.configureParser(parserConfig);
            
            // Get parsed data
            const parsedData = excelReader.getParsedData(sheetName);
            console.log(`Retrieved ${parsedData.data.length} rows of data from sheet '${sheetName}'`);

            // Create mapping from original headers to SQL column names
            const headerToSqlMap = new Map<string, string>();
            
            // Use stored column mappings if available
            if (tableConfig.columnMappings && tableConfig.columnMappings.length > 0) {
                console.log("Using stored column mappings from metadata");
                tableConfig.columnMappings.forEach(mapping => {
                    headerToSqlMap.set(mapping.originalHeader, mapping.sqlColumnName);
                });
            }
            
            // Map the headers to SQL column names with fallback to normalization
            const sqlHeaders = parsedData.headers.map((header, index) => {
                const mappedName = headerToSqlMap.get(header);
                if (mappedName) {
                    return mappedName;
                } else {
                    console.log(`No mapping found for header "${header}", using normalized name`);
                    return normalizeColumnName(header, index);
                }
            });

            // Import data using the mapped headers
            const result = await importData(dbPath, tableConfig.tableName, parsedData.data, sqlHeaders);

            return {
                message: `Successfully imported ${result.rowsImported} rows into table '${tableConfig.tableName}'`,
                sheetName,
                tableName: tableConfig.tableName,
                rowsImported: result.rowsImported,
                totalRows: parsedData.data.length,
                originalHeaders: parsedData.headers,
                sqlHeaders: sqlHeaders,
                mappingsUsed: tableConfig.columnMappings ? tableConfig.columnMappings.length : 0,
                fallbackMappings: sqlHeaders.length - (tableConfig.columnMappings ? tableConfig.columnMappings.length : 0)
            };
        } catch (error) {
            console.error(`Error importing data: ${error}`);
            throw error;
        }
    }
});

// Tool 6: Generate MCP server scaffold and config
const generateMcpServerTool = tool({
    description: "Generate an MCP server scaffold that understands the analyzed schema and connects to the SQLite DB",
    inputSchema: z.object({
        outputDir: z.string().optional().describe("Target directory for server source (defaults to src/mcp)"),
        docsDir: z.string().optional().describe("Target directory for usage docs (defaults to docs)"),
        emitSchemaSql: z.boolean().optional().default(true).describe("Whether to write schema.sql into the workspaceDir"),
    }),
    execute: async ({ outputDir, docsDir, emitSchemaSql }) => {
        const metadataPath = path.join(workspaceDir, "dataLoaderMetadata.json");
        const parserConfigPath = path.join(workspaceDir, "parserConfig.json");

        if (!fs.existsSync(metadataPath) || !fs.existsSync(parserConfigPath)) {
            throw new Error("Required configs not found. Ensure parserConfig.json and dataLoaderMetadata.json exist (run writeConfigTool first).");
        }

        const tableConfig: TableConfig = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

        // Determine destinations
        const serverSrcDir = path.resolve(process.cwd(), outputDir || 'src/mcp');
        const docsOutputDir = path.resolve(process.cwd(), docsDir || 'docs');

        // Ensure directories
        fs.mkdirSync(serverSrcDir, { recursive: true });
        fs.mkdirSync(docsOutputDir, { recursive: true });

        // Write server-config.json to workspaceDir
        const serverConfig = {
            databasePath: path.join(workspaceDir, "data.db"),
            metadataPath,
            parserConfigPath,
            defaultTableName: tableConfig.tableName
        };
        const serverConfigPath = path.join(workspaceDir, 'server-config.json');
        fs.writeFileSync(serverConfigPath, JSON.stringify(serverConfig, null, 2));

        // Optionally emit schema.sql derived from metadata
        if (emitSchemaSql) {
            const cols = tableConfig.columns.map(c => {
                const nullable = c.nullable ? '' : ' NOT NULL';
                return `  "${c.name}" ${c.dataType}${nullable}`;
            }).join(',\n');
            const schemaSql = `CREATE TABLE IF NOT EXISTS "${tableConfig.tableName}" (\n${cols}\n);\n`;
            fs.writeFileSync(path.join(workspaceDir, 'schema.sql'), schemaSql);
        }

        // Write server source
        const serverTsPath = path.join(serverSrcDir, 'server.ts');
        const serverSourceLines = [
          "import fs from 'fs';",
          "import path from 'path';",
          "import sqlite3 from 'sqlite3';",
          "import { ExcelReader } from '../ExcelReader.js';",
          "import { importData, createTable } from '../simpleDataLoader.js';",
          "",
          "type Json = any;",
          "",
          "interface RpcRequest { id: string | number; method: string; params?: Json; }",
          "interface RpcResponse { id: string | number; result?: Json; error?: { message: string }; }",
          "",
          "function loadConfig() {",
          "  const configPath = process.env.MCP_SERVER_CONFIG || path.resolve(process.cwd(), 'server-config.json');",
          "  const raw = fs.readFileSync(configPath, 'utf8');",
          "  return JSON.parse(raw) as { databasePath: string; metadataPath: string; parserConfigPath: string; defaultTableName?: string };",
          "}",
          "",
          "function withDb<T>(dbPath: string, fn: (db: sqlite3.Database) => Promise<T>): Promise<T> {",
          "  return new Promise((resolve, reject) => {",
          "    const db = new sqlite3.Database(dbPath);",
          "    fn(db).then((res) => { db.close(); resolve(res); }).catch((e) => { db.close(); reject(e); });",
          "  });",
          "}",
          "",
          "async function listTables(dbPath: string): Promise<string[]> {",
          "  return withDb(dbPath, (db) => new Promise((resolve, reject) => {",
          "    db.all(\"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name\", (err, rows) => {",
          "      if (err) return reject(err);",
          "      resolve(rows.map((r: any) => r.name));",
          "    });",
          "  }));",
          "}",
          "",
          "async function listColumns(dbPath: string, tableName: string): Promise<any[]> {",
          "  return withDb(dbPath, (db) => new Promise((resolve, reject) => {",
          "    db.all('PRAGMA table_info(\"' + tableName + '\")', (err, rows) => {",
          "      if (err) return reject(err);",
          "      resolve(rows);",
          "    });",
          "  }));",
          "}",
          "",
          "async function describeSchema(dbPath: string) {",
          "  const tables = await listTables(dbPath);",
          "  const schema: Record<string, any[]> = {};",
          "  for (const t of tables) {",
          "    schema[t] = await listColumns(dbPath, t);",
          "  }",
          "  return schema;",
          "}",
          "",
          "function ensureSelectOnly(sql: string) {",
          "  const s = sql.trim().toLowerCase();",
          "  if (!(s.startsWith('select') || s.startsWith('with '))) {",
          "    throw new Error('Only SELECT queries are allowed');",
          "  }",
          "  if (s.includes(';')) {",
          "    throw new Error('Semicolons are not allowed');",
          "  }",
          "}",
          "",
          "async function runQuery(dbPath: string, sql: string, params: any[] = []) {",
          "  ensureSelectOnly(sql);",
          "  return withDb(dbPath, (db) => new Promise((resolve, reject) => {",
          "    db.all(sql, params, (err, rows) => {",
          "      if (err) return reject(err);",
          "      resolve(rows);",
          "    });",
          "  }));",
          "}",
          "",
          "async function ingestFile(dbPath: string, metadataPath: string, parserConfigPath: string, filePath: string, sheetName?: string) {",
          "  const tableConfig = JSON.parse(fs.readFileSync(metadataPath, 'utf8')) as { tableName: string; columns: Array<{ name: string; dataType: string; nullable: boolean }>; columnMappings?: Array<{ originalHeader: string; sqlColumnName: string }>; };",
          "  const parserConfig = JSON.parse(fs.readFileSync(parserConfigPath, 'utf8'));",
          "",
          "  const reader = new ExcelReader(filePath);",
          "  await reader.load();",
          "  reader.configureParser(parserConfig);",
          "  const sheets = reader.getSheets();",
          "  const chosenSheet = sheetName && sheets.includes(sheetName) ? sheetName : sheets[0];",
          "  const parsed = reader.getParsedData(chosenSheet);",
          "",
          "  // Ensure table exists",
          "  await createTable(dbPath, tableConfig.tableName, tableConfig.columns.map(c => ({ name: c.name, dataType: c.dataType, nullable: c.nullable })));",
          "",
          "  // Map headers via metadata mappings when available",
          "  const headerMap = new Map<string, string>();",
          "  if (tableConfig.columnMappings) {",
          "    for (const m of tableConfig.columnMappings) headerMap.set(m.originalHeader, m.sqlColumnName);",
          "  }",
          "  const sqlHeaders = parsed.headers.map((h: string, i: number) => headerMap.get(h) || h || ('col_' + i));",
          "",
          "  return await importData(dbPath, tableConfig.tableName, parsed.data, sqlHeaders);",
          "}",
          "",
          "async function handle(method: string, params: any) {",
          "  const cfg = loadConfig();",
          "  switch (method) {",
          "    case 'list_tables':",
          "      return await listTables(cfg.databasePath);",
          "    case 'list_columns':",
          "      return await listColumns(cfg.databasePath, params?.tableName);",
          "    case 'describe_schema':",
          "      return await describeSchema(cfg.databasePath);",
          "    case 'run_query':",
          "      return await runQuery(cfg.databasePath, params?.sql, params?.params || []);",
          "    case 'ingest_file':",
          "      return await ingestFile(cfg.databasePath, cfg.metadataPath, cfg.parserConfigPath, params?.filePath, params?.sheetName);",
          "    default:",
          "      throw new Error('Unknown method: ' + method);",
          "  }",
          "}",
          "",
          "function send(resp: RpcResponse) {",
          "  process.stdout.write(JSON.stringify(resp) + '\n');",
          "}",
          "",
          "let buffer = '';",
          "process.stdin.setEncoding('utf8');",
          "process.stdin.on('data', (chunk) => {",
          "  buffer += chunk;",
          "  let idx;",
          "  while ((idx = buffer.indexOf('\n')) >= 0) {",
          "    const line = buffer.slice(0, idx);",
          "    buffer = buffer.slice(idx + 1);",
          "    if (!line.trim()) continue;",
          "    try {",
          "      const req = JSON.parse(line) as RpcRequest;",
          "      Promise.resolve(handle(req.method, req.params)).then((result) => send({ id: req.id, result })).catch((e) => send({ id: req.id, error: { message: e.message } }));",
          "    } catch (e: any) {",
          "      send({ id: 'unknown', error: { message: e?.message || 'Invalid JSON' } });",
          "    }",
          "  }",
          "});",
          "",
          "console.log('[MCP] Server ready. Set MCP_SERVER_CONFIG or place server-config.json in CWD.');",
        ];
        const serverSource = serverSourceLines.join('\n');
        fs.writeFileSync(serverTsPath, serverSource);

        // Write usage docs (avoid code fences to keep generation simple)
        const usageDocPath = path.join(docsOutputDir, 'mcp-server-usage.md');
        const usageDocLines = [
          '### MCP Server Usage',
          '',
          '- Generate with the analysis flow\'s generate tool; then run:',
          '',
          '$ pnpm run mcp:dev',
          '',
          '- Send JSON-RPC requests over stdin (newline-delimited). Examples:',
          '',
          `$ printf '{"id":1,"method":"list_tables"}\n' | pnpm run mcp:dev`,
          `$ printf '{"id":2,"method":"describe_schema"}\n' | pnpm run mcp:dev`,
          `$ printf '{"id":3,"method":"run_query","params":{"sql":"select * from ${tableConfig.tableName} limit 5"}}\n' | pnpm run mcp:dev`,
          '',
          '- Configure via',
          '  - env:',
          '    - `MCP_SERVER_CONFIG` → absolute path to a server-config.json',
          '  - file:',
          '    - `server-config.json` in current working directory',
          '',
          'Artifacts emitted at generation time into the workspace:',
          '- `server-config.json` with database and config paths',
          '- `schema.sql` derived from `dataLoaderMetadata.json`',
        ];
        const usageDoc = usageDocLines.join('\n');
        fs.writeFileSync(usageDocPath, usageDoc);

        return {
            message: "MCP server scaffold generated",
            serverSource: serverTsPath,
            docsPath: usageDocPath,
            serverConfigPath,
            schemaSqlPath: emitSchemaSql ? path.join(workspaceDir, 'schema.sql') : undefined
        };
    }
});

const excelTool = new Stimulus({
    role: "Excel Analysis and Import Assistant",
    objective: "Analyze Excel files and import them into SQLite databases",
    instructions: [
        "You are an Excel file expert that analyzes files and imports them into databases",
        "Use the available tools to examine the file structure and data",
        "Make all decisions about parsing, data types, and import strategies",
        "Follow this workflow:",
        "1. Get the list of sheets using getSheetsTool",
        "2. Examine each sheet's raw data using getRawDataTool",
        "3. Analyze the data structure and determine the best parsing configuration",
        "4. Use getParsedHeadersTool to get the original headers and propose MEANINGFUL SQL column names",
        "5. IMPORTANT: Propose meaningful column names that preserve the meaning while being SQL-compatible",
        "6. Column names should be: lowercase, use underscores, avoid special characters, avoid SQL reserved words",
        "7. Examples: 'Overall Rank' → 'overall_rank', 'Brand Name' → 'brand_name', 'Total Followers' → 'total_followers'",
        "8. Decide on appropriate SQL data types for each column",
        "9. Choose import strategy (single_table for similar sheets, separate_tables for different sheets)",
        "10. Write the configuration using writeConfigTool - this now includes columnMappings that will be stored in metadata",
        "11. Create the SQLite table using createTableTool (reads from metadata automatically)",
        "12. Import the data using importDataTool (reads mappings from metadata automatically)",
        "CRITICAL: You must propose meaningful column names that preserve the original meaning",
        "The column mappings are now stored in dataLoaderMetadata.json for persistence and reusability",
        "Provide clear feedback about your analysis and decisions"
    ],
    tools: { 
        getSheetsTool, 
        getRawDataTool, 
        getParsedHeadersTool,
        writeConfigTool, 
        createTableTool, 
        importDataTool,
        generateMcpServerTool 
    },
    maxToolSteps: 15
  });
  
  const interaction = new Interaction(modelDetails, excelTool);
if(initialPrompt) {
    interaction.addMessage({role:"user", content: initialPrompt});
    await interaction.streamText();
}
  const cli = new CLIInterface();

  cli.addCommands(getChatCommands());
  cli.setShowStatsAfterResponse(true);
  // Cleanup function to close database connection
  process.on('SIGINT', () => {
    console.log('Shutting down...');
    process.exit(0);
  });
  
  cli.startChat(interaction);

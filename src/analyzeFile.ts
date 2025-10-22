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
import { MCPServerGenerator } from "./generation/MCPServerGenerator.js";

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

let modelDetails = {
    name: "qwen3:latest",
    provider: "ollama"
}

// modelDetails = {
//     name: "openai/gpt-4o",
//     provider: "github-models"
// }


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

// Tool 6: Generate MCP Server (NEW - Phase 2)
const generateMCPServerTool = tool({
    description: "Generate a complete MCP (Model Context Protocol) server from the analyzed data schema. This creates a standalone server that can be used with Claude or other LLM clients to query future data files with the same structure.",
    inputSchema: z.object({
        serverName: z.string().optional().describe("Name for the MCP server (defaults to table name)"),
        description: z.string().optional().describe("Description of what the server does"),
        outputDir: z.string().optional().describe("Output directory for the MCP server (defaults to workspace/mcp-server)")
    }),
    execute: async ({ serverName, description, outputDir }) => {
        try {
            // Read the metadata configuration
            const metadataPath = path.join(workspaceDir, "dataLoaderMetadata.json");

            if (!fs.existsSync(metadataPath)) {
                throw new Error("dataLoaderMetadata.json not found. Please complete the data import workflow first.");
            }

            const tableConfig: TableConfig = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

            // Create MCP server configuration
            const mcpConfig = MCPServerGenerator.fromTableConfig(
                tableConfig,
                serverName,
                description
            );

            // Determine output directory
            const mcpOutputDir = outputDir || path.join(workspaceDir, "mcp-server");

            // Generate the MCP server
            const generator = new MCPServerGenerator(mcpConfig);
            generator.generate(mcpOutputDir);

            console.log(`\n${'='.repeat(60)}`);
            console.log(`MCP SERVER GENERATED SUCCESSFULLY!`);
            console.log(`${'='.repeat(60)}`);
            console.log(`Location: ${mcpOutputDir}`);
            console.log(`Server Name: ${mcpConfig.serverName}`);
            console.log(`Package: ${mcpConfig.packageName}`);
            console.log(`\nGenerated ${mcpConfig.tools.length} tools:`);
            mcpConfig.tools.forEach((tool, idx) => {
                console.log(`  ${idx + 1}. ${tool.name} - ${tool.description}`);
            });
            console.log(`\nNext steps:`);
            console.log(`  1. cd ${mcpOutputDir}`);
            console.log(`  2. npm install`);
            console.log(`  3. npm run build`);
            console.log(`  4. Configure in Claude Desktop (see README.md)`);
            console.log(`${'='.repeat(60)}\n`);

            return {
                message: "MCP server generated successfully!",
                serverName: mcpConfig.serverName,
                packageName: mcpConfig.packageName,
                outputDirectory: mcpOutputDir,
                toolsGenerated: mcpConfig.tools.length,
                tools: mcpConfig.tools.map(t => ({
                    name: t.name,
                    description: t.description
                })),
                nextSteps: [
                    `cd ${mcpOutputDir}`,
                    "npm install",
                    "npm run build",
                    "Configure in Claude Desktop (see README.md in the generated directory)"
                ]
            };
        } catch (error) {
            console.error(`Error generating MCP server: ${error}`);
            throw error;
        }
    }
});

const excelTool = new Stimulus({
    role: "Excel Analysis and Import Assistant with MCP Server Generation",
    objective: "Analyze Excel files, import them into SQLite databases, and generate MCP servers for future data querying",
    instructions: [
        "You are an Excel file expert that analyzes files, imports them into databases, and generates MCP servers",
        "Use the available tools to examine the file structure and data",
        "Make all decisions about parsing, data types, and import strategies",
        "",
        "PHASE 1: DATA ANALYSIS AND IMPORT",
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
        "10. Write the configuration using writeConfigTool - this includes columnMappings stored in metadata",
        "11. Create the SQLite table using createTableTool (reads from metadata automatically)",
        "12. Import the data using importDataTool (reads mappings from metadata automatically)",
        "",
        "PHASE 2: MCP SERVER GENERATION",
        "After successfully importing the data:",
        "13. Generate an MCP server using generateMCPServerTool",
        "14. The MCP server will include automatically generated tools based on the data schema:",
        "    - query_data: Query with filters on any column",
        "    - aggregate_data: Calculate sum, avg, count, min, max on numeric columns",
        "    - group_by: Group data by categories with aggregations",
        "    - time_series_analysis: Analyze data over time (if date columns exist)",
        "    - load_data: Load new CSV files with the same structure",
        "15. The generated MCP server can be used in future conversations to query new data files",
        "",
        "CRITICAL: You must propose meaningful column names that preserve the original meaning",
        "The column mappings are stored in dataLoaderMetadata.json for persistence and reusability",
        "Provide clear feedback about your analysis, decisions, and the generated MCP server capabilities"
    ],
    tools: {
        getSheetsTool,
        getRawDataTool,
        getParsedHeadersTool,
        writeConfigTool,
        createTableTool,
        importDataTool,
        generateMCPServerTool
    },
    maxToolSteps: 20
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

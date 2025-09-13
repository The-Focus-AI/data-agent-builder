import { Interaction, CLIInterface, getChatCommands } from "umwelten/dist/ui/index.js";
import { Stimulus } from "umwelten/dist/stimulus/stimulus.js";
import { ExcelReader } from "./ExcelReader.js";
import { tool } from "ai";
import { z } from "zod";
import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import { createTable, importData } from "./simpleDataLoader.js";

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
    description: "Create SQLite table using meaningful column names proposed by the LLM",
    inputSchema: z.object({
        tableName: z.string().describe("Name of the table to create"),
        columnMappings: z.array(z.object({
            originalHeader: z.string().describe("Original Excel header name"),
            sqlColumnName: z.string().describe("Meaningful SQL column name (lowercase, underscores, no special chars)"),
            dataType: z.string().describe("SQL data type (TEXT, INTEGER, REAL, DATE, DATETIME)"),
            nullable: z.boolean().describe("Whether the column allows null values")
        })).describe("Mapping from original headers to meaningful SQL column names")
    }),
    execute: async ({ tableName, columnMappings }) => {
        try {
            // Convert mappings to column definitions
            const columns = columnMappings.map(mapping => ({
                name: mapping.sqlColumnName,
                dataType: mapping.dataType,
                nullable: mapping.nullable
            }));
            
            await createTable(dbPath, tableName, columns);
            console.log(`Table '${tableName}' created successfully with ${columns.length} columns`);
            
            // Log the mapping for clarity
            console.log("Column mappings:");
            columnMappings.forEach(mapping => {
                console.log(`  "${mapping.originalHeader}" → "${mapping.sqlColumnName}" (${mapping.dataType})`);
            });
            
            return {
                message: `Table '${tableName}' created successfully`,
                tableName,
                columnCount: columns.length,
                columnMappings
            };
            } catch (error) {
            console.error(`Error creating table: ${error}`);
            throw error;
            }
    }
});

// Tool 5: Import data (simple data loading)
const importDataTool = tool({
    description: "Import Excel data into the created SQLite table using the column mappings",
    inputSchema: z.object({
        sheetName: z.string().describe("Name of the sheet to import data from"),
        tableName: z.string().describe("Name of the SQLite table to import data into"),
        parserConfig: z.object({
                metadataRows: z.number().optional(),
            headerRow: z.number(),
            dataStartRow: z.number(),
            hasDataAboveHeader: z.boolean().optional()
        }).describe("Parser configuration for extracting data from the sheet"),
        columnMappings: z.array(z.object({
            originalHeader: z.string().describe("Original Excel header name"),
            sqlColumnName: z.string().describe("SQL column name in the table")
        })).describe("Mapping from original headers to SQL column names")
    }),
    execute: async ({ sheetName, tableName, parserConfig, columnMappings }) => {
        try {
            // Configure the parser
            excelReader.configureParser(parserConfig);
            
            // Get parsed data
            const parsedData = excelReader.getParsedData(sheetName);
            console.log(`Retrieved ${parsedData.data.length} rows of data from sheet '${sheetName}'`);

            // Create mapping from original headers to SQL column names
            const headerToSqlMap = new Map<string, string>();
            columnMappings.forEach(mapping => {
                headerToSqlMap.set(mapping.originalHeader, mapping.sqlColumnName);
            });
            
            // Map the headers to SQL column names
            const sqlHeaders = parsedData.headers.map(header => 
                headerToSqlMap.get(header) || normalizeColumnName(header, parsedData.headers.indexOf(header))
            );

            // Import data using the mapped headers
            const result = await importData(dbPath, tableName, parsedData.data, sqlHeaders);

            return {
                message: `Successfully imported ${result.rowsImported} rows into table '${tableName}'`,
                sheetName,
                tableName,
                rowsImported: result.rowsImported,
                totalRows: parsedData.data.length,
                originalHeaders: parsedData.headers,
                sqlHeaders: sqlHeaders
            };
        } catch (error) {
            console.error(`Error importing data: ${error}`);
            throw error;
        }
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
        "10. Write the configuration using writeConfigTool",
        "11. Create the SQLite table using createTableTool with your proposed meaningful column names",
        "12. Import the data using importDataTool with the column mappings",
        "CRITICAL: You must propose meaningful column names that preserve the original meaning",
        "Provide clear feedback about your analysis and decisions"
    ],
    tools: { 
        getSheetsTool, 
        getRawDataTool, 
        getParsedHeadersTool,
        writeConfigTool, 
        createTableTool, 
        importDataTool 
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

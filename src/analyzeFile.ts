import { Interaction, CLIInterface } from "umwelten/dist/ui/index.js";
import { Stimulus } from "umwelten/dist/stimulus/stimulus.js";
import { ExcelReader } from "./ExcelReader.js";
import {tool} from "ai"
import { z } from "zod";
import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";

let modelDetails = {
    name: "qwen3:latest",
    provider: "ollama"
}

// let modelDetails = {
//     name: "openai/gpt-5",
//     provider: "github-models"
// }

//  modelDetails = {
//     name: "gpt-5",
// provider: "openai"
//  }  

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
    console.error("Usage: tsx src/analyzeFile.ts <excel-file-path> <workspace-dir>");
    process.exit(1);
}

const excelFilePath = args[0];
const workspaceDir = args[1];

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
let db: sqlite3.Database | null = null;

const sheetsTool = tool({
description: "Gets the list of sheets for the given excel file",
inputSchema: z.object({}),
execute: async () => {
    return excelReader.getSheets();
}
});

const rawDataTool = tool({
    description: "Gets the raw data for the given sheet",
    inputSchema: z.object({
        sheet: z.string().describe("The sheet to get the raw data for"),
        rowCount: z.number().describe("The number of rows to get the raw data for").default(20)
    }),
    execute: async ({sheet,rowCount}) => {
        return excelReader.getRawData(sheet,rowCount);
    }
});

const writeParserTool = tool({
    description: "Writes out the parser configuration for the given sheet",
    inputSchema: z.object({
        sheet: z.string().describe("The sheet to get the parsed data for"),
        parserConfig: z.object({
            metadataRows: z.number().describe("The number of metadata rows"),
            headerRow: z.number().describe("The number of header rows"),
            dataStartRow: z.number().describe("The number of data start rows"),
            hasDataAboveHeader: z.boolean().describe("Whether there are data above the header"),
            dataAboveHeaderRow: z.number().describe("The row number where the data above the header starts")
        })
    }),
    execute: async ({sheet,parserConfig}) => {
        const configPath = path.join(workspaceDir, "parserConfig.json");
        fs.writeFileSync(configPath, JSON.stringify(parserConfig,null,2));
        console.log(`Parser config written to: ${configPath}`);
        console.log(parserConfig);
        excelReader.configureParser(parserConfig);
        return excelReader.getParsedData(sheet);
    }
});

const writeTableDefinitionTool = tool({
    description: "Writes out the table definition for the given sheet and creates the table in SQLite",
    inputSchema: z.object({
        createTableSql: z.string().describe("The create table sql for the given sheet"),
        tableName: z.string().describe("The name of the table to create")
    }),
    execute: async ({createTableSql, tableName}) => {
        const sqlPath = path.join(workspaceDir, "createTableSql.sql");
        fs.writeFileSync(sqlPath, createTableSql);
        console.log(`Table SQL written to: ${sqlPath}`);
        console.log(createTableSql);
        
        // Create the table in SQLite database
        return new Promise((resolve, reject) => {
            try {
                if (!db) {
                    db = new sqlite3.Database(dbPath);
                    console.log(`Connected to SQLite database: ${dbPath}`);
                }
                
                // Execute the CREATE TABLE statement
                db.exec(createTableSql, (err) => {
                    if (err) {
                        console.error(`Error creating table: ${err}`);
                        reject(err);
                    } else {
                        console.log(`Table '${tableName}' created successfully in SQLite database`);
                        resolve({
                            message: `Table '${tableName}' created successfully`,
                            sqlPath,
                            dbPath
                        });
                    }
                });
            } catch (error) {
                console.error(`Error creating table: ${error}`);
                reject(error);
            }
        });
    }
});

const writeImportDataTool = tool({
    description: "Writes out a complete TypeScript import method for the given sheet",
    inputSchema: z.object({
        typescriptMethod: z.string().describe("A complete TypeScript function that imports data from the Excel sheet into the SQLite table. Should include imports, function definition, and proper error handling.")
    }),
    execute: async ({typescriptMethod}) => {
        const importPath = path.join(workspaceDir, "importData.ts");
        
        // Validate that the method looks like a proper TypeScript function
        if (!typescriptMethod.includes('function') && !typescriptMethod.includes('const') && !typescriptMethod.includes('import')) {
            throw new Error("Invalid TypeScript method provided. Please provide a complete TypeScript function with imports and proper syntax.");
        }
        
        fs.writeFileSync(importPath, typescriptMethod);
        console.log(`Import method written to: ${importPath}`);
        console.log("Generated TypeScript method:");
        console.log("=".repeat(50));
        console.log(typescriptMethod);
        console.log("=".repeat(50));
        return {
            message: "TypeScript import method written successfully",
            filePath: importPath,
            methodPreview: typescriptMethod.substring(0, 200) + "..."
        };
    }
});

const populateTableTool = tool({
    description: "Populates the SQLite table with data from the Excel sheet using the parser configuration",
    inputSchema: z.object({
        sheet: z.string().describe("The sheet to import data from"),
        tableName: z.string().describe("The name of the table to populate")
    }),
    execute: async ({sheet, tableName}) => {
        return new Promise((resolve, reject) => {
            try {
                if (!db) {
                    db = new sqlite3.Database(dbPath);
                    console.log(`Connected to SQLite database: ${dbPath}`);
                }
                
                // Load parser config if it exists
                const configPath = path.join(workspaceDir, "parserConfig.json");
                if (fs.existsSync(configPath)) {
                    const configData = fs.readFileSync(configPath, 'utf-8');
                    const parserConfig = JSON.parse(configData);
                    excelReader.configureParser(parserConfig);
                    console.log("Loaded parser configuration");
                } else {
                    console.log("No parser configuration found, using default settings");
                }
                
                // Get parsed data
                const parsedData = excelReader.getParsedData(sheet);
                console.log(`Retrieved ${parsedData.data.length} rows of data`);
                
                if (parsedData.headers.length === 0) {
                    reject(new Error("No headers found in parsed data"));
                    return;
                }
                
                // Clean headers - remove empty or invalid column names
                const cleanHeaders = parsedData.headers
                    .map(header => header.trim())
                    .filter(header => header.length > 0)
                    .map(header => `"${header.replace(/"/g, '""')}"`); // Escape quotes and wrap in quotes
                
                if (cleanHeaders.length === 0) {
                    reject(new Error("No valid headers found after cleaning"));
                    return;
                }
                
                // Create INSERT statement with properly escaped column names
                const placeholders = cleanHeaders.map(() => '?').join(', ');
                const insertSql = `INSERT INTO ${tableName} (${cleanHeaders.join(', ')}) VALUES (${placeholders})`;
                
                console.log(`Insert SQL: ${insertSql}`);
                
                // Prepare statement
                const stmt = db.prepare(insertSql);
                
                // Insert data
                let insertedCount = 0;
                let errorCount = 0;
                
                const insertNext = (index: number) => {
                    if (index >= parsedData.data.length) {
                        console.log(`Successfully inserted ${insertedCount} rows into table '${tableName}'`);
                        resolve({
                            message: `Successfully inserted ${insertedCount} rows into table '${tableName}'`,
                            insertedCount,
                            totalRows: parsedData.data.length,
                            headers: parsedData.headers,
                            errors: errorCount
                        });
                        return;
                    }
                    
                    const row = parsedData.data[index];
                    if (row.length >= cleanHeaders.length) {
                        // Truncate or pad row to match cleanHeaders length
                        const adjustedRow = row.slice(0, cleanHeaders.length);
                        while (adjustedRow.length < cleanHeaders.length) {
                            adjustedRow.push(''); // Pad with empty strings
                        }
                        
                        // Clean the data values
                        const cleanRow = adjustedRow.map(value => {
                            if (value === null || value === undefined) return '';
                            return String(value).trim();
                        });
                        
                        stmt.run(cleanRow, (err) => {
                            if (err) {
                                console.warn(`Failed to insert row ${index}: ${cleanRow.join(', ')} - ${err}`);
                                errorCount++;
                            } else {
                                insertedCount++;
                            }
                            insertNext(index + 1);
                        });
                    } else {
                        console.warn(`Skipping row ${index}: length mismatch (expected ${cleanHeaders.length}, got ${row.length})`);
                        errorCount++;
                        insertNext(index + 1);
                    }
                };
                
                insertNext(0);
            } catch (error) {
                console.error(`Error populating table: ${error}`);
                reject(error);
            }
        });
    }
});

const excelTool = new Stimulus({
    role: "Excel file Assistant",
    objective: "Analyze the Excel file to build a database and import the data",
    instructions: [
      "You are an Excel file analysis assistant that helps users understand and import Excel data into SQLite databases",
      "First, examine the Excel file structure by getting the list of sheets and raw data",
      "Help the user configure a parser to properly extract headers and data from the Excel sheets",
      "Generate appropriate SQL table definitions based on the data structure",
      "Create and populate SQLite tables with the parsed Excel data",
      "When writing TypeScript import methods, provide COMPLETE functions with proper imports, function definitions, error handling, and export statements",
      "Do NOT provide just function names - provide full, executable TypeScript code",
      "Provide clear feedback about the import process and any issues encountered"
    ],
    tools: { sheetsTool, rawDataTool, writeParserTool, writeTableDefinitionTool, writeImportDataTool, populateTableTool },
    maxToolSteps: 10
  });
  
  const interaction = new Interaction(modelDetails, excelTool);
  const cli = new CLIInterface();
  
  // Cleanup function to close database connection
  process.on('SIGINT', () => {
    if (db) {
      db.close();
      console.log('Database connection closed');
    }
    process.exit(0);
  });
  
  cli.startChat(interaction);
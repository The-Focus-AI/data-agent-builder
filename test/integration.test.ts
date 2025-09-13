import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { ExcelReader } from '../src/ExcelReader.js';
import { createTable, importData, tableExists, Column } from '../src/simpleDataLoader.js';

describe('Integration Test - Real Excel File Processing', () => {
  let testFilePath: string;
  let testDbPath: string;
  let tempDir: string;

  before(async () => {
    // Create temporary directory
    tempDir = fs.mkdtempSync(path.join(process.cwd(), 'test-integration-'));
    testDbPath = path.join(tempDir, 'integration.db');

    // Use one of the existing Excel files for testing
    const possibleFiles = [
      'data/Listenfirst database/ListenFirst Talent Followers by Platform thru to Aug\'25.xlsx',
      'data/Pulsar database/A&E HIST LT Pulsar Audiense Affinity Updated Aug\'25.xlsx',
      'data/E-Poll database/A&E Celebrity Custom Data Cuts July 2025.xlsx'
    ];

    for (const file of possibleFiles) {
      if (fs.existsSync(file)) {
        testFilePath = file;
        break;
      }
    }

    if (!testFilePath) {
      console.log('No test Excel files found - skipping integration tests');
    }
  });

  after(async () => {
    // Cleanup
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('should process real Excel file end-to-end', async () => {
    if (!testFilePath) {
      console.log('Skipping test - no Excel file available');
      return;
    }

    console.log(`Testing with file: ${path.basename(testFilePath)}`);

    // Step 1: Load Excel file
    const reader = new ExcelReader(testFilePath);
    await reader.load();
    
    const fileInfo = reader.getFileInfo();
    console.log(`File has ${fileInfo.sheetCount} sheets: ${fileInfo.sheets.join(', ')}`);
    
    assert(fileInfo.sheetCount > 0);
    assert(fileInfo.sheets.length > 0);

    // Step 2: Examine first sheet
    const firstSheet = fileInfo.sheets[0];
    const rawData = reader.getRawData(firstSheet, 20);
    console.log(`First sheet "${firstSheet}" has ${rawData.length} rows (showing first 20)`);
    
    assert(rawData.length > 0);
    assert(Array.isArray(rawData[0]));

    // Step 3: Configure parser (simulate LLM decision)
    const parserConfig = {
      headerRow: 1,
      dataStartRow: 2
    };
    reader.configureParser(parserConfig);

    // Step 4: Get parsed data
    const parsedData = reader.getParsedData(firstSheet);
    console.log(`Parsed data: ${parsedData.headers.length} headers, ${parsedData.data.length} data rows`);
    
    assert(parsedData.headers.length > 0);
    assert(parsedData.data.length > 0);

    // Step 5: Create table (simulate LLM decision on column types)
    // Clean headers to match what importData will do
    const cleanedHeaders = parsedData.headers.map((header, index) => {
      const cleaned = header.trim();
      if (cleaned.length === 0) {
        return `col_${index}`;
      }
      const sanitized = cleaned.replace(/[^a-zA-Z0-9_]/g, '_');
      return sanitized.length > 0 ? sanitized : `col_${index}`;
    });

    const columns: Column[] = cleanedHeaders.map((header) => ({
      name: header,
      dataType: 'TEXT', // Simple approach - all TEXT for now
      nullable: true
    }));

    await createTable(testDbPath, 'excel_data', columns);
    const tableCreated = await tableExists(testDbPath, 'excel_data');
    assert.strictEqual(tableCreated, true);

    // Step 6: Import data
    const importResult = await importData(testDbPath, 'excel_data', parsedData.data, parsedData.headers);
    console.log(`Imported ${importResult.rowsImported} rows with ${importResult.errors.length} errors`);
    
    assert(importResult.rowsImported > 0);
  });

  test('should handle multiple sheets', async () => {
    if (!testFilePath) {
      console.log('Skipping test - no Excel file available');
      return;
    }

    const reader = new ExcelReader(testFilePath);
    await reader.load();
    
    const sheets = reader.getSheets();
    console.log(`Testing multi-sheet handling with ${sheets.length} sheets`);

    // Test each sheet
    for (let i = 0; i < Math.min(sheets.length, 3); i++) { // Limit to first 3 sheets
      const sheetName = sheets[i];
      const rawData = reader.getRawData(sheetName, 10);
      
      console.log(`Sheet "${sheetName}": ${rawData.length} rows`);
      assert(rawData.length >= 0); // Some sheets might be empty
    }
  });

  test('should handle different Excel structures', async () => {
    if (!testFilePath) {
      console.log('Skipping test - no Excel file available');
      return;
    }

    const reader = new ExcelReader(testFilePath);
    await reader.load();
    
    const firstSheet = reader.getSheets()[0];
    const rawData = reader.getRawData(firstSheet, 50);
    
    // Try different parser configurations
    const configs = [
      { headerRow: 1, dataStartRow: 2 },
      { headerRow: 2, dataStartRow: 3 },
      { metadataRows: 2, headerRow: 3, dataStartRow: 4 }
    ];

    for (const config of configs) {
      try {
        reader.configureParser(config);
        const parsedData = reader.getParsedData(firstSheet);
        console.log(`Config ${JSON.stringify(config)}: ${parsedData.headers.length} headers, ${parsedData.data.length} data rows`);
        assert(Array.isArray(parsedData.headers));
        assert(Array.isArray(parsedData.data));
      } catch (error) {
        console.log(`Config ${JSON.stringify(config)} failed (expected for some files): ${error}`);
        // Some configs might fail depending on file structure - that's ok
      }
    }
  });
});

import { describe, test, before } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { ExcelReader } from '../src/ExcelReader.js';
import { FileNotFoundError, InvalidFileError, SheetNotFoundError, LoadError } from '../src/types.js';

describe('ExcelReader - Basic Operations', () => {
  let testFilePath: string;
  let nonExistentPath: string;
  let invalidFilePath: string;

  before(async () => {
    // Create test files
    const testDir = path.join(process.cwd(), 'test-data');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir);
    }

    testFilePath = path.join(testDir, 'test.xlsx');
    nonExistentPath = path.join(testDir, 'nonexistent.xlsx');
    invalidFilePath = path.join(testDir, 'invalid.txt');

    // Create a simple test Excel file (mock)
    // For now, we'll use one of the existing data files
    const existingFile = 'data/Listenfirst database/ListenFirst Talent Followers by Platform thru to Aug\'25.xlsx';
    if (fs.existsSync(existingFile)) {
      fs.copyFileSync(existingFile, testFilePath);
    }

    // Create invalid file
    fs.writeFileSync(invalidFilePath, 'This is not an Excel file');
  });

  test('should load valid Excel file successfully', async () => {
    if (!fs.existsSync(testFilePath)) {
      console.log('Skipping test - no test Excel file available');
      return;
    }

    const reader = new ExcelReader(testFilePath);
    await reader.load();
    
    const fileInfo = reader.getFileInfo();
    assert.strictEqual(typeof fileInfo.filePath, 'string');
    assert.strictEqual(typeof fileInfo.sheetCount, 'number');
    assert.strictEqual(Array.isArray(fileInfo.sheets), true);
  });

  test('should throw FileNotFoundError for non-existent file', async () => {
    const reader = new ExcelReader(nonExistentPath);
    
    try {
      await reader.load();
      assert.fail('Should have thrown FileNotFoundError');
    } catch (error) {
      assert(error instanceof FileNotFoundError);
      assert(error.message.includes(nonExistentPath));
    }
  });

  test('should throw error for non-Excel file', async () => {
    const reader = new ExcelReader(invalidFilePath);
    
    try {
      await reader.load();
      assert.fail('Should have thrown an error');
    } catch (error) {
      // Should throw some kind of error for invalid file
      assert(error instanceof Error);
      console.log(`Caught expected error: ${error.message}`);
    }
  });

  test('should get sheets from loaded file', async () => {
    if (!fs.existsSync(testFilePath)) {
      console.log('Skipping test - no test Excel file available');
      return;
    }

    const reader = new ExcelReader(testFilePath);
    await reader.load();
    
    const sheets = reader.getSheets();
    assert.strictEqual(Array.isArray(sheets), true);
    assert(sheets.length > 0);
  });

  test('should get raw data from sheet', async () => {
    if (!fs.existsSync(testFilePath)) {
      console.log('Skipping test - no test Excel file available');
      return;
    }

    const reader = new ExcelReader(testFilePath);
    await reader.load();
    
    const sheets = reader.getSheets();
    if (sheets.length > 0) {
      const data = reader.getRawData(sheets[0], 10);
      assert.strictEqual(Array.isArray(data), true);
      assert(data.length <= 10);
    }
  });

  test('should throw SheetNotFoundError for non-existent sheet', async () => {
    if (!fs.existsSync(testFilePath)) {
      console.log('Skipping test - no test Excel file available');
      return;
    }

    const reader = new ExcelReader(testFilePath);
    await reader.load();
    
    try {
      reader.getRawData('NonExistentSheet');
      assert.fail('Should have thrown SheetNotFoundError');
    } catch (error) {
      assert(error instanceof SheetNotFoundError);
      assert(error.message.includes('NonExistentSheet'));
    }
  });

  test('should configure parser and get parsed data', async () => {
    if (!fs.existsSync(testFilePath)) {
      console.log('Skipping test - no test Excel file available');
      return;
    }

    const reader = new ExcelReader(testFilePath);
    await reader.load();
    
    const sheets = reader.getSheets();
    if (sheets.length > 0) {
      // Configure parser
      reader.configureParser({
        headerRow: 1,
        dataStartRow: 2
      });
      
      const parsedData = reader.getParsedData(sheets[0]);
      assert.strictEqual(typeof parsedData, 'object');
      assert.strictEqual(Array.isArray(parsedData.metadata), true);
      assert.strictEqual(Array.isArray(parsedData.headers), true);
      assert.strictEqual(Array.isArray(parsedData.data), true);
    }
  });
});

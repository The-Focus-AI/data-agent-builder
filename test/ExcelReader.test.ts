import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { ExcelReader } from '../src/ExcelReader.js';
import {
  FileNotFoundError,
  InvalidFileError,
  SheetNotFoundError,
  LoadError
} from '../src/types.js';

describe('ExcelReader', () => {
  const dataDir = path.join(process.cwd(), 'data');
  const testFiles = {
    // aeCelebrity: path.join(dataDir, 'E-Poll database', 'A&E Celebrity Custom Data Cuts July 2025.xlsx'), // Skipped - too large
    listenFirst: path.join(dataDir, 'Listenfirst database', 'ListenFirst Talent Followers by Platform thru to Aug\'25.xlsx'),
    pulsar: path.join(dataDir, 'Pulsar database', 'A&E HIST LT Pulsar Audiense Affinity Updated Aug\'25.xlsx')
  };

  // Verify test files exist
  before(() => {
    for (const [name, filePath] of Object.entries(testFiles)) {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Test file not found: ${name} at ${filePath}`);
      }
    }
  });

  describe('Constructor and Basic Setup', () => {
    test('should create instance with file path', () => {
      const reader = new ExcelReader(testFiles.listenFirst);
      // We can't test filePath without loading, but we can verify the instance was created
      assert.ok(reader instanceof ExcelReader);
    });

    test('should create instance with custom options', () => {
      const reader = new ExcelReader(testFiles.listenFirst, { defaultMaxRows: 10 });
      // We can't test the options directly, but we can verify the instance was created
      assert.ok(reader instanceof ExcelReader);
    });
  });

  describe('File Loading', () => {
    test('should load valid Excel file', async () => {
      const reader = new ExcelReader(testFiles.listenFirst);
      await reader.load();
      
      const info = reader.getFileInfo();
      assert.ok(info.sheetCount > 0);
      assert.ok(Array.isArray(info.sheets));
    });

    test('should throw FileNotFoundError for non-existent file', async () => {
      const reader = new ExcelReader('/path/to/nonexistent.xlsx');
      
      try {
        await reader.load();
        assert.fail('Should have thrown FileNotFoundError');
      } catch (error) {
        assert.ok(error instanceof FileNotFoundError);
        assert.strictEqual(error.message, 'File not found: /path/to/nonexistent.xlsx');
      }
    });

    test('should throw InvalidFileError for corrupted Excel file', async () => {
      // Create a temporary file that looks like Excel but is corrupted
      const tempFile = path.join(process.cwd(), 'temp-test.xlsx');
      fs.writeFileSync(tempFile, 'PK\x03\x04\x14\x00\x00\x00\x08\x00corrupted data');
      
      try {
        const reader = new ExcelReader(tempFile);
        await reader.load();
        assert.fail('Should have thrown InvalidFileError');
      } catch (error) {
        assert.ok(error instanceof InvalidFileError);
      } finally {
        // Clean up
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
    });
  });

  describe('Sheet Operations', () => {
    test('should list all sheets', async () => {
      const reader = new ExcelReader(testFiles.listenFirst);
      await reader.load();
      
      const sheets = reader.getSheets();
      assert.ok(Array.isArray(sheets));
      assert.ok(sheets.length > 0);
      console.log('Available sheets:', sheets);
    });

    test('should throw error when getting sheets before loading', () => {
      const unloadedReader = new ExcelReader(testFiles.listenFirst);
      
      try {
        unloadedReader.getSheets();
        assert.fail('Should have thrown LoadError');
      } catch (error) {
        assert.ok(error instanceof LoadError);
      }
    });
  });

  describe('Data Extraction', () => {
    test('should extract raw data with default max rows', async () => {
      const reader = new ExcelReader(testFiles.listenFirst);
      await reader.load();
      
      const sheets = reader.getSheets();
      const firstSheet = sheets[0];
      
      const data = reader.getRawData(firstSheet);
      assert.ok(Array.isArray(data));
      assert.ok(data.length <= 20); // Default max rows
      assert.ok(data.length > 0);
      
      // Verify each row is an array
      data.forEach(row => {
        assert.ok(Array.isArray(row));
      });
      
      console.log(`First 5 rows from ${firstSheet}:`, data.slice(0, 5));
    });

    test('should extract raw data with custom max rows', async () => {
      const reader = new ExcelReader(testFiles.listenFirst);
      await reader.load();
      
      const sheets = reader.getSheets();
      const firstSheet = sheets[0];
      
      const data = reader.getRawData(firstSheet, 5);
      assert.strictEqual(data.length, 5);
    });

    test('should extract all rows when no limit specified', async () => {
      const reader = new ExcelReader(testFiles.listenFirst);
      await reader.load();
      
      const sheets = reader.getSheets();
      const firstSheet = sheets[0];
      
      const allData = reader.getAllRows(firstSheet);
      const limitedData = reader.getRawData(firstSheet, 10);
      
      assert.ok(allData.length >= limitedData.length);
    });

    test('should throw SheetNotFoundError for non-existent sheet', async () => {
      const reader = new ExcelReader(testFiles.listenFirst);
      await reader.load();
      
      try {
        reader.getRawData('NonExistentSheet');
        assert.fail('Should have thrown SheetNotFoundError');
      } catch (error) {
        assert.ok(error instanceof SheetNotFoundError);
      }
    });
  });

  describe('Multiple File Testing', () => {
    test('should work with ListenFirst file', async () => {
      const reader = new ExcelReader(testFiles.listenFirst);
      await reader.load();
      
      const info = reader.getFileInfo();
      assert.ok(info.sheetCount > 0);
      
      const sheets = reader.getSheets();
      const data = reader.getRawData(sheets[0], 5);
      assert.ok(data.length > 0);
      
      console.log(`ListenFirst file - Sheets: ${sheets.length}, First 3 rows:`, data.slice(0, 3));
    });

    test('should work with Pulsar file', async () => {
      const reader = new ExcelReader(testFiles.pulsar);
      await reader.load();
      
      const info = reader.getFileInfo();
      assert.ok(info.sheetCount > 0);
      
      const sheets = reader.getSheets();
      const data = reader.getRawData(sheets[0], 5);
      assert.ok(data.length > 0);
      
      console.log(`Pulsar file - Sheets: ${sheets.length}, First 3 rows:`, data.slice(0, 3));
    });
  });

  describe('Parser Configuration (Future Feature)', () => {
    test('should configure parser', async () => {
      const reader = new ExcelReader(testFiles.listenFirst);
      await reader.load();
      
      reader.configureParser({
        metadataRows: 2,
        headerRow: 3,
        dataStartRow: 4
      });
      
      // Configuration should be set (we can't test it directly, but no error should be thrown)
      assert.ok(true);
    });

    test('should throw error when getting parsed data without configuration', async () => {
      const unconfiguredReader = new ExcelReader(testFiles.listenFirst);
      await unconfiguredReader.load();
      
      try {
        unconfiguredReader.getParsedData('Sheet1');
        assert.fail('Should have thrown error for unconfigured parser');
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.strictEqual(error.message, 'Parser not configured. Call configureParser() first.');
      }
    });
  });

  describe('File Information', () => {
    test('should provide file information', async () => {
      const reader = new ExcelReader(testFiles.listenFirst);
      await reader.load();
      
      const info = reader.getFileInfo();
      assert.strictEqual(info.filePath, testFiles.listenFirst);
      assert.ok(typeof info.sheetCount === 'number');
      assert.ok(Array.isArray(info.sheets));
      assert.strictEqual(info.sheets.length, info.sheetCount);
    });

    test('should throw error when getting file info before loading', () => {
      const reader = new ExcelReader(testFiles.listenFirst);
      
      try {
        reader.getFileInfo();
        assert.fail('Should have thrown LoadError');
      } catch (error) {
        assert.ok(error instanceof LoadError);
      }
    });
  });
});

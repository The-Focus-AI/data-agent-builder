import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { createTable, importData, tableExists, getTableInfo, Column } from '../src/simpleDataLoader.js';

describe('Simple Data Loader - Basic Operations', () => {
  let testDbPath: string;
  let tempDir: string;

  before(async () => {
    // Create temporary directory
    tempDir = fs.mkdtempSync(path.join(process.cwd(), 'test-db-'));
    testDbPath = path.join(tempDir, 'test.db');
  });

  after(async () => {
    // Cleanup
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('should create table successfully', async () => {
    const columns: Column[] = [
      { name: 'id', dataType: 'INTEGER', nullable: false },
      { name: 'name', dataType: 'TEXT', nullable: false },
      { name: 'age', dataType: 'INTEGER', nullable: true },
      { name: 'salary', dataType: 'REAL', nullable: true }
    ];

    await createTable(testDbPath, 'employees', columns);
    
    // Verify table was created
    const exists = await tableExists(testDbPath, 'employees');
    assert.strictEqual(exists, true);
  });

  test('should import data successfully', async () => {
    const headers = ['id', 'name', 'age', 'salary'];
    const data = [
      ['1', 'John Doe', '30', '50000.00'],
      ['2', 'Jane Smith', '25', '45000.00'],
      ['3', 'Bob Johnson', '35', '60000.00']
    ];

    const result = await importData(testDbPath, 'employees', data, headers);
    
    assert.strictEqual(result.rowsImported, 3);
    assert.strictEqual(result.errors.length, 0);
  });

  test('should handle import errors gracefully', async () => {
    const headers = ['id', 'name', 'age', 'salary'];
    const data = [
      ['4', 'Alice Brown', '28', '55000.00'],
      ['invalid', 'Bad Data', 'not_a_number', 'invalid_salary'], // This should cause errors
      ['5', 'Charlie Wilson', '32', '58000.00']
    ];

    const result = await importData(testDbPath, 'employees', data, headers);
    
    // Should import some rows successfully (at least the valid ones)
    assert(result.rowsImported >= 2); // At least 2 valid rows
    // May or may not have errors depending on SQLite's tolerance
    console.log(`Imported ${result.rowsImported} rows with ${result.errors.length} errors`);
  });

  test('should get table info', async () => {
    const tableInfo = await getTableInfo(testDbPath, 'employees');
    
    assert.strictEqual(Array.isArray(tableInfo), true);
    assert(tableInfo.length > 0);
    
    // Check column structure
    const columnNames = tableInfo.map((col: any) => col.name);
    assert(columnNames.includes('id'));
    assert(columnNames.includes('name'));
    assert(columnNames.includes('age'));
    assert(columnNames.includes('salary'));
  });

  test('should handle empty data import', async () => {
    const headers = ['id', 'name'];
    const data: string[][] = [];

    const result = await importData(testDbPath, 'employees', data, headers);
    
    assert.strictEqual(result.rowsImported, 0);
    assert.strictEqual(result.errors.length, 0);
  });

  test('should handle missing headers gracefully', async () => {
    const headers: string[] = []; // Empty headers
    const data = [
      ['1', 'John Doe'],
      ['2', 'Jane Smith']
    ];

    try {
      await importData(testDbPath, 'employees', data, headers);
      assert.fail('Should have thrown error for empty headers');
    } catch (error) {
      assert(error instanceof Error);
      assert(error.message.includes('No valid headers found'));
    }
  });

  test('should create table with different data types', async () => {
    const columns: Column[] = [
      { name: 'id', dataType: 'INTEGER', nullable: false },
      { name: 'title', dataType: 'TEXT', nullable: false },
      { name: 'created_at', dataType: 'DATETIME', nullable: true },
      { name: 'is_active', dataType: 'INTEGER', nullable: false }
    ];

    await createTable(testDbPath, 'products', columns);
    
    const exists = await tableExists(testDbPath, 'products');
    assert.strictEqual(exists, true);
  });
});

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { FileReader } from '../src/fileReader.js';
import * as path from 'path';

describe('FileReader', () => {
  test('should analyze Excel files correctly', async () => {
    const fileReader = new FileReader();
    const testFile = 'data/Listenfirst database/ListenFirst Talent Followers by Platform thru to Aug\'25.xlsx';
    
    const analysis = await fileReader.analyzeFile(testFile);
    
    assert.strictEqual(analysis.fileType, 'excel');
    assert.strictEqual(analysis.fileName, 'ListenFirst Talent Followers by Platform thru to Aug\'25.xlsx');
    assert(analysis.rowCount > 0, 'Should have rows');
    assert(analysis.columnCount > 0, 'Should have columns');
    assert(analysis.columns.length > 0, 'Should have column analysis');
    assert(analysis.analysis.businessContext.length > 0, 'Should infer business context');
  });

  test('should handle different Excel file structures', async () => {
    const fileReader = new FileReader();
    const testFile = 'data/Pulsar database/A&E HIST LT Pulsar Audiense Affinity Updated Aug\'25.xlsx';
    
    const analysis = await fileReader.analyzeFile(testFile);
    
    assert.strictEqual(analysis.fileType, 'excel');
    assert(analysis.rowCount > 0, 'Should have rows');
    assert(analysis.columns.length > 0, 'Should have valid columns');
    assert(analysis.analysis.dataQuality, 'Should assess data quality');
  });

  test('should throw error for unsupported file types', async () => {
    const fileReader = new FileReader();
    
    // Create a temporary file with unsupported extension
    const fs = await import('fs');
    const tempFile = 'temp-test.txt';
    fs.writeFileSync(tempFile, 'test content');
    
    try {
      await assert.rejects(
        () => fileReader.analyzeFile(tempFile),
        /Unsupported file type/
      );
    } finally {
      // Clean up
      fs.unlinkSync(tempFile);
    }
  });

  test('should throw error for non-existent files', async () => {
    const fileReader = new FileReader();
    
    await assert.rejects(
      () => fileReader.analyzeFile('non-existent-file.xlsx'),
      /ENOENT/
    );
  });
});

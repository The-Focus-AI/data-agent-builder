import { describe, test } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('Prompt Support Test', () => {
  test('should accept initial prompt parameter', async () => {
    // Find an existing Excel file for testing
    const possibleFiles = [
      'data/Listenfirst database/ListenFirst Talent Followers by Platform thru to Aug\'25.xlsx',
      'data/Pulsar database/A&E HIST LT Pulsar Audiense Affinity Updated Aug\'25.xlsx',
      'data/E-Poll database/A&E Celebrity Custom Data Cuts July 2025.xlsx'
    ];

    let testFilePath = '';
    for (const file of possibleFiles) {
      if (fs.existsSync(file)) {
        testFilePath = file;
        break;
      }
    }

    if (!testFilePath) {
      console.log('Skipping prompt test - no Excel file available');
      return;
    }

    // Create temporary workspace
    const tempDir = fs.mkdtempSync(path.join(process.cwd(), 'test-prompt-'));
    
    try {
      // Test that the script accepts the prompt parameter without crashing
      const testPrompt = 'Analyze this Excel file and create a simple table with the data';
      
      const child = spawn('pnpm', ['exec', 'tsx', 'src/analyzeFile.ts', testFilePath, tempDir, testPrompt], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000 // 5 second timeout
      });

      let output = '';
      let errorOutput = '';

      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      // Wait a bit for the process to start
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Kill the process (we just want to test that it starts with the prompt)
      child.kill();

      // Check that no critical errors occurred
      assert(!errorOutput.includes('Error:'), `Unexpected error: ${errorOutput}`);
      assert(!errorOutput.includes('Cannot find module'), `Module error: ${errorOutput}`);
      
      console.log('✓ Prompt parameter accepted successfully');
      
    } finally {
      // Cleanup
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }
  });

  test('should show usage when missing required parameters', async () => {
    const child = spawn('pnpm', ['exec', 'tsx', 'src/analyzeFile.ts'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 2000
    });

    let errorOutput = '';

    child.stderr?.on('data', (data) => {
      errorOutput += data.toString();
    });

    await new Promise(resolve => {
      child.on('exit', resolve);
    });

    assert(errorOutput.includes('Usage:'), 'Should show usage message');
    assert(errorOutput.includes('excel-file-path'), 'Should mention required parameters');
    assert(errorOutput.includes('workspace-dir'), 'Should mention workspace directory');
    
    console.log('✓ Usage message displayed correctly');
  });
});

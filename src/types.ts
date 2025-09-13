/**
 * Simplified Type Definitions
 * Minimal essential types for the super-simplified architecture
 * All complex analysis logic is handled by the LLM, not TypeScript
 */

/**
 * Excel Parser Configuration
 * LLM decides these values based on file analysis
 */
export interface ExcelParserConfig {
  metadataRows?: number;
  headerRow?: number;
  dataStartRow?: number;
  hasDataAboveHeader?: boolean;
  dataAboveHeaderRow?: number;
}

/**
 * Parsed Excel Data
 * Simple structure for extracted data
 */
export interface ParsedExcelData {
  metadata: string[][];
  headers: string[];
  data: string[][];
}

/**
 * Excel Reader Options
 * Basic configuration options
 */
export interface ExcelReaderOptions {
  defaultMaxRows?: number;
}

// Error Classes - Simple error handling only
export class FileNotFoundError extends Error {
  constructor(filePath: string) {
    super(`File not found: ${filePath}`);
    this.name = 'FileNotFoundError';
  }
}

export class InvalidFileError extends Error {
  constructor(filePath: string, message: string) {
    super(`Invalid file ${filePath}: ${message}`);
    this.name = 'InvalidFileError';
  }
}

export class SheetNotFoundError extends Error {
  constructor(sheetName: string) {
    super(`Sheet not found: ${sheetName}`);
    this.name = 'SheetNotFoundError';
  }
}

export class LoadError extends Error {
  constructor(filePath: string, message: string) {
    super(`Load error for ${filePath}: ${message}`);
    this.name = 'LoadError';
  }
}
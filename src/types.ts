/**
 * Custom error classes for Excel reader operations
 */

export class FileNotFoundError extends Error {
  constructor(filePath: string) {
    super(`File not found: ${filePath}`);
    this.name = 'FileNotFoundError';
  }
}

export class InvalidFileError extends Error {
  constructor(filePath: string, reason?: string) {
    super(`Invalid Excel file: ${filePath}${reason ? ` - ${reason}` : ''}`);
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
  constructor(filePath: string, reason?: string) {
    super(`Failed to load file: ${filePath}${reason ? ` - ${reason}` : ''}`);
    this.name = 'LoadError';
  }
}

/**
 * Configuration for parsing Excel files with different structures
 */
export interface ExcelParserConfig {
  /** Number of metadata rows at the top */
  metadataRows?: number;
  /** Row number containing headers (1-based) */
  headerRow?: number;
  /** Row number where data starts (1-based) */
  dataStartRow?: number;
  /** Whether there are data rows above the header */
  hasDataAboveHeader?: boolean;
}

/**
 * Parsed data structure
 */
export interface ParsedExcelData {
  /** Metadata rows */
  metadata: string[][];
  /** Header row as array of column names */
  headers: string[];
  /** Data rows */
  data: string[][];
}

/**
 * Excel reader options
 */
export interface ExcelReaderOptions {
  /** Default number of rows to return when not specified */
  defaultMaxRows?: number;
}


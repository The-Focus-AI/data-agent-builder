/**
 * Simplified Exports for Super-Simplified Architecture
 * Clean, minimal exports for the LLM-driven Excel analysis system
 */

// Main Excel Reader
export { ExcelReader } from './ExcelReader.js';

// Simple Data Loader Functions
export { createTable, importData, tableExists, getTableInfo } from './simpleDataLoader.js';
export type { Column, ImportResult } from './simpleDataLoader.js';

// Essential Types
export type { ExcelParserConfig, ParsedExcelData, ExcelReaderOptions } from './types.js';
export { 
  FileNotFoundError, 
  InvalidFileError, 
  SheetNotFoundError, 
  LoadError 
} from './types.js';
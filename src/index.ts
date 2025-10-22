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
export type { ExcelParserConfig, ParsedExcelData, ExcelReaderOptions, TableConfig, ColumnMapping } from './types.js';
export {
  FileNotFoundError,
  InvalidFileError,
  SheetNotFoundError,
  LoadError
} from './types.js';

// MCP Server Generation
export { MCPServerGenerator, ToolSuggester } from './generation/MCPServerGenerator.js';
export type { MCPTool, MCPServerConfig } from './generation/MCPServerGenerator.js';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import {
  FileNotFoundError,
  InvalidFileError,
  SheetNotFoundError,
  LoadError,
  ExcelParserConfig,
  ParsedExcelData,
  ExcelReaderOptions
} from './types.js';

/**
 * ExcelReader class for examining Excel files
 */
export class ExcelReader {
  private filePath: string;
  private workbook: XLSX.WorkBook | null = null;
  private options: ExcelReaderOptions;
  private parserConfig: ExcelParserConfig | null = null;

  constructor(filePath: string, options: ExcelReaderOptions = {}) {
    this.filePath = filePath;
    this.options = {
      defaultMaxRows: 20,
      ...options
    };
  }

  /**
   * Load and validate the Excel file
   */
  async load(): Promise<void> {
    try {
      // Check if file exists
      if (!fs.existsSync(this.filePath)) {
        throw new FileNotFoundError(this.filePath);
      }

      // Check if file is readable
      try {
        fs.accessSync(this.filePath, fs.constants.R_OK);
      } catch (error) {
        throw new LoadError(this.filePath, 'File is not readable');
      }

      // Read the file
      const fileBuffer = fs.readFileSync(this.filePath);
      
      // Parse the Excel file
      try {
        this.workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      } catch (error) {
        throw new InvalidFileError(this.filePath, 'Failed to parse as Excel file');
      }

      // Validate that we have sheets
      if (!this.workbook.SheetNames || this.workbook.SheetNames.length === 0) {
        throw new InvalidFileError(this.filePath, 'No sheets found in file');
      }

    } catch (error) {
      if (error instanceof FileNotFoundError || 
          error instanceof InvalidFileError || 
          error instanceof LoadError) {
        throw error;
      }
      throw new LoadError(this.filePath, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Get list of all sheet names
   */
  getSheets(): string[] {
    if (!this.workbook) {
      throw new LoadError(this.filePath, 'File not loaded. Call load() first.');
    }
    return [...this.workbook.SheetNames];
  }

  /**
   * Get raw data from a specific sheet as array of arrays
   */
  getRawData(sheetName: string, maxRows?: number): string[][] {
    if (!this.workbook) {
      throw new LoadError(this.filePath, 'File not loaded. Call load() first.');
    }

    if (!this.workbook.SheetNames.includes(sheetName)) {
      throw new SheetNotFoundError(sheetName);
    }

    const worksheet = this.workbook.Sheets[sheetName];
    if (!worksheet) {
      throw new SheetNotFoundError(sheetName);
    }

    // Convert sheet to array of arrays
    const data = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1, 
      defval: '', 
      raw: false 
    }) as string[][];

    // Limit rows if maxRows is specified
    const limit = maxRows ?? this.options.defaultMaxRows;
    return data.slice(0, limit);
  }

  /**
   * Get all rows from a specific sheet
   */
  getAllRows(sheetName: string): string[][] {
    return this.getRawData(sheetName, undefined);
  }

  /**
   * Configure parser for structured data extraction
   */
  configureParser(config: ExcelParserConfig): void {
    this.parserConfig = config;
  }

  /**
   * Get parsed data based on configuration
   */
  getParsedData(sheetName: string, maxRows?: number): ParsedExcelData {
    if (!this.parserConfig) {
      throw new Error('Parser not configured. Call configureParser() first.');
    }

    const allData = this.getAllRows(sheetName);
    const config = this.parserConfig;

    // Extract metadata rows
    const metadataRows = config.metadataRows || 0;
    const metadata = allData.slice(0, metadataRows);

    // Extract headers
    const headerRowIndex = (config.headerRow || 1) - 1; // Convert to 0-based
    const headers = allData[headerRowIndex] || [];

    // Extract data rows
    const dataStartIndex = (config.dataStartRow || (config.headerRow || 1) + 1) - 1; // Convert to 0-based
    let data = allData.slice(dataStartIndex);

    // If there's data above headers, include it
    if (config.hasDataAboveHeader && config.headerRow) {
      const dataAboveHeader = allData.slice(0, headerRowIndex);
      data = [...dataAboveHeader, ...data];
    }

    // Limit data rows if maxRows is specified
    const limit = maxRows ?? this.options.defaultMaxRows;
    if (limit !== undefined) {
      data = data.slice(0, limit);
    }

    return {
      metadata,
      headers,
      data
    };
  }

  /**
   * Get file information
   */
  getFileInfo(): { filePath: string; sheetCount: number; sheets: string[] } {
    if (!this.workbook) {
      throw new LoadError(this.filePath, 'File not loaded. Call load() first.');
    }

    return {
      filePath: this.filePath,
      sheetCount: this.workbook.SheetNames.length,
      sheets: this.getSheets()
    };
  }
}


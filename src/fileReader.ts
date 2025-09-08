import XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { FileAnalysis, FileAnalysisSchema } from './types.js';

export class FileReader {
  /**
   * Analyze a file and return structured metadata
   */
  async analyzeFile(filePath: string): Promise<FileAnalysis> {
    const stats = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    const fileExtension = path.extname(filePath).toLowerCase();

    if (fileExtension === '.xlsx' || fileExtension === '.xls') {
      return this.analyzeExcelFile(filePath, fileName, stats.size);
    } else if (fileExtension === '.csv') {
      return this.analyzeCsvFile(filePath, fileName, stats.size);
    } else {
      throw new Error(`Unsupported file type: ${fileExtension}`);
    }
  }

  private async analyzeExcelFile(filePath: string, fileName: string, fileSize: number): Promise<FileAnalysis> {
    const workbook = XLSX.readFile(filePath);
    const sheetNames = workbook.SheetNames;
    
    // Analyze the first sheet by default
    const firstSheet = workbook.Sheets[sheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];


    const analysis = this.analyzeData(data, fileName, 'excel', fileSize, sheetNames);
    return FileAnalysisSchema.parse(analysis);
  }

  private async analyzeCsvFile(filePath: string, fileName: string, fileSize: number): Promise<FileAnalysis> {
    const csvContent = fs.readFileSync(filePath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    // Parse CSV data (simple implementation)
    const data = lines.map(line => {
      // Simple CSV parsing - could be enhanced with proper CSV parser
      return line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
    });

    const analysis = this.analyzeData(data, fileName, 'csv', fileSize);
    return FileAnalysisSchema.parse(analysis);
  }

  private analyzeData(
    data: any[][], 
    fileName: string, 
    fileType: 'excel' | 'csv', 
    fileSize: number,
    sheets?: string[]
  ): Partial<FileAnalysis> {
    if (data.length === 0) {
      throw new Error('File appears to be empty');
    }

    // Filter out completely empty rows
    const filteredData = data.filter(row => 
      row && row.some(cell => cell !== null && cell !== undefined && cell !== '')
    );

    if (filteredData.length === 0) {
      throw new Error('File contains no valid data rows');
    }

    // Detect if first row contains headers
    const firstRow = filteredData[0];
    if (!firstRow || firstRow.length === 0) {
      throw new Error('First row is empty or invalid');
    }

    const hasHeaders = this.detectHeaders(firstRow);
    const dataRows = hasHeaders ? filteredData.slice(1) : filteredData;
    
    const rowCount = dataRows.length;
    const columnCount = firstRow.length;

    // Analyze columns
    const columns = this.analyzeColumns(dataRows, firstRow, hasHeaders);
    
    
    // Assess data quality
    const dataQuality = this.assessDataQuality(columns, rowCount);
    const potentialIssues = this.identifyPotentialIssues(columns, dataRows);
    const businessContext = this.inferBusinessContext(columns, fileName);

    return {
      fileName,
      fileType,
      fileSize,
      rowCount,
      columnCount,
      columns,
      sheets,
      analysis: {
        hasHeaders,
        dataQuality,
        potentialIssues,
        businessContext,
      },
    };
  }

  private detectHeaders(firstRow: any[]): boolean {
    // Simple heuristic: if first row contains mostly strings and second row contains mostly numbers/dates
    const stringCount = firstRow.filter(cell => 
      typeof cell === 'string' && 
      !this.isNumeric(cell) && 
      !this.isDate(cell)
    ).length;
    
    return stringCount > firstRow.length * 0.7;
  }

  private analyzeColumns(dataRows: any[][], firstRow: any[], hasHeaders: boolean): any[] {
    const columnNames = hasHeaders ? firstRow : firstRow.map((_, i) => `Column_${i + 1}`);
    
    const columns = columnNames.map((name, index) => {
      const values = dataRows
        .map(row => row && row[index] !== undefined ? row[index] : null)
        .filter(val => val !== null && val !== undefined && val !== '');
      
      const sampleValues = values.slice(0, 5).map(String);
      const nullCount = dataRows.length - values.length;
      const uniqueCount = new Set(values.map(String)).size;
      
      const type = this.detectColumnType(values);
      
      // Handle empty or undefined column names
      const columnName = name && String(name).trim() ? String(name).trim() : `Column_${index + 1}`;
      
      return {
        name: columnName,
        type,
        sampleValues,
        nullCount,
        uniqueCount,
      };
    });
    
    // Filter out completely empty columns (where all values are null/undefined/empty)
    return columns.filter(col => col.sampleValues.length > 0 || col.nullCount < dataRows.length);
  }

  private detectColumnType(values: any[]): 'string' | 'number' | 'date' | 'boolean' | 'mixed' {
    if (values.length === 0) return 'string';
    
    const types = values.map(val => {
      if (typeof val === 'number') return 'number';
      if (typeof val === 'boolean') return 'boolean';
      if (this.isDate(val)) return 'date';
      if (this.isNumeric(val)) return 'number';
      return 'string';
    });
    
    const typeCounts = types.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const dominantType = Object.entries(typeCounts).reduce((a, b) => 
      typeCounts[a[0]] > typeCounts[b[0]] ? a : b
    )[0];
    
    // If dominant type is less than 80%, consider it mixed
    const dominantCount = typeCounts[dominantType];
    return dominantCount / values.length >= 0.8 ? dominantType as any : 'mixed';
  }

  private assessDataQuality(columns: any[], rowCount: number): 'excellent' | 'good' | 'fair' | 'poor' {
    const totalCells = columns.length * rowCount;
    const nullCells = columns.reduce((sum, col) => sum + col.nullCount, 0);
    const nullPercentage = nullCells / totalCells;
    
    if (nullPercentage < 0.05) return 'excellent';
    if (nullPercentage < 0.15) return 'good';
    if (nullPercentage < 0.30) return 'fair';
    return 'poor';
  }

  private identifyPotentialIssues(columns: any[], dataRows: any[][]): string[] {
    const issues: string[] = [];
    
    columns.forEach(col => {
      if (col.nullCount > dataRows.length * 0.5) {
        issues.push(`Column "${col.name}" has >50% missing values`);
      }
      if (col.type === 'mixed') {
        issues.push(`Column "${col.name}" has mixed data types`);
      }
      if (col.uniqueCount === 1 && dataRows.length > 1) {
        issues.push(`Column "${col.name}" has only one unique value`);
      }
    });
    
    return issues;
  }

  private inferBusinessContext(columns: any[], fileName: string): string[] {
    const context: string[] = [];
    const columnNames = columns.map(col => col.name.toLowerCase());
    
    // Common business patterns
    if (columnNames.some(name => name.includes('follow') || name.includes('follower'))) {
      context.push('Social media analytics');
    }
    if (columnNames.some(name => name.includes('celebrity') || name.includes('talent'))) {
      context.push('Celebrity/Talent management');
    }
    if (columnNames.some(name => name.includes('platform') || name.includes('social'))) {
      context.push('Multi-platform data');
    }
    if (columnNames.some(name => name.includes('date') || name.includes('time'))) {
      context.push('Time-series data');
    }
    if (columnNames.some(name => name.includes('affinity') || name.includes('audience'))) {
      context.push('Audience analysis');
    }
    
    // File name patterns
    if (fileName.toLowerCase().includes('poll')) {
      context.push('Survey/Poll data');
    }
    if (fileName.toLowerCase().includes('listener') || fileName.toLowerCase().includes('listen')) {
      context.push('Audio/Media analytics');
    }
    
    return context.length > 0 ? context : ['General data analysis'];
  }

  private isNumeric(value: any): boolean {
    return !isNaN(parseFloat(value)) && isFinite(value);
  }

  private isDate(value: any): boolean {
    if (value instanceof Date) return true;
    if (typeof value === 'string') {
      const date = new Date(value);
      return !isNaN(date.getTime());
    }
    return false;
  }
}

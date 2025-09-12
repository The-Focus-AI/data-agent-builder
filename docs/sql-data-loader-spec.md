# SQL Data Loader Specification

## Overview
A SQL data loader that consumes metadata from the Excel analysis agent and performs bulk data imports into SQLite databases. The loader handles various Excel file structures, supports multi-sheet files, and provides error feedback for reassessment.

## Architecture

### Components
1. **Analysis Agent** (`analyzeFile.ts`) - Generates metadata and schema
2. **Data Loader Agent** (`dataLoader.ts`) - Consumes metadata and imports data
3. **Metadata Format** - JSON + SQL files for communication
4. **Error Feedback Loop** - Structured error objects for reassessment

## Metadata Structure

### Table Metadata
```typescript
interface TableMetadata {
  tableName: string;           // Content-based name suggested by analysis agent
  description?: string;        // Human-readable description
  sourceFile: {
    path: string;
    name: string;
    lastModified: Date;
    size: number;
  };
  suggestedName?: string;      // User can override table name
}
```

### Column Metadata
```typescript
interface ColumnMetadata {
  name: string;
  dataType: 'TEXT' | 'INTEGER' | 'REAL' | 'DATE' | 'DATETIME';
  nullable: boolean;
  description?: string;
  constraints?: string[];      // e.g., ['UNIQUE', 'CHECK(value > 0)']
  suggestedType?: string;      // Analysis agent suggestion
  fallbackType?: string;       // Auto-detected fallback
}
```

### Sheet Metadata
```typescript
interface SheetMetadata {
  name: string;
  rowCount: number;
  columnCount: number;
  parsingConfig: ExcelParserConfig;
  hasMetadata: boolean;
  metadataRows?: number;
}
```

### Complete Metadata Format
```typescript
interface DataLoaderMetadata {
  tables: TableMetadata[];
  columns: ColumnMetadata[];
  sheets: SheetMetadata[];
  importStrategy: 'single_table' | 'separate_tables' | 'hybrid';
  sheetColumnName?: string;    // For single_table strategy
  createdAt: Date;
  analysisAgentVersion: string;
}
```

## Data Loader Agent Interface

### Primary API (Programmatic)
```typescript
class SqlDataLoader {
  constructor(databasePath: string);
  
  // Main import method
  async importFromMetadata(
    metadata: DataLoaderMetadata,
    excelFilePath: string
  ): Promise<ImportResult>;
  
  // Individual operations
  async createTables(metadata: DataLoaderMetadata): Promise<TableCreationResult>;
  async importSheetData(
    sheetName: string, 
    tableName: string, 
    metadata: DataLoaderMetadata
  ): Promise<SheetImportResult>;
  
  // Error handling
  async validateData(
    data: string[][], 
    columns: ColumnMetadata[]
  ): Promise<ValidationResult>;
}

interface ImportResult {
  success: boolean;
  tablesCreated: string[];
  rowsImported: number;
  errors: ImportError[];
  importHistoryId: string;
}

interface ImportError {
  type: 'SCHEMA_ERROR' | 'DATA_ERROR' | 'CONSTRAINT_ERROR' | 'TYPE_ERROR';
  message: string;
  sheetName?: string;
  rowNumber?: number;
  columnName?: string;
  suggestedFix?: string;
  requiresReanalysis: boolean;
}
```

## Multi-Sheet Handling

### Strategy Selection
- **Default**: Single table with `sheet_name` column
- **Fallback**: Separate tables when sheets have very different structures
- **Decision Logic**: Analysis agent determines strategy based on column compatibility

### Column Name Normalization
- Convert to lowercase
- Replace spaces/special chars with underscores
- Handle conflicts by appending sheet name suffix

## Error Handling & Feedback Loop

### Error Types
1. **Schema Errors**: Table creation failures, column type mismatches
2. **Data Errors**: Row-level import failures, constraint violations
3. **Type Errors**: Data doesn't match expected column types
4. **Constraint Errors**: Unique key violations, check constraint failures

### Error Response
- **Stop on Error**: No auto-fixing or skipping
- **Detailed Error Objects**: Include context for reassessment
- **Reanalysis Trigger**: `requiresReanalysis: true` flag
- **Suggested Fixes**: Analysis agent can use for improvement

## Import History Tracking

### Simple Tracking Table
```sql
CREATE TABLE import_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL,
  table_name TEXT NOT NULL,
  import_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  rows_imported INTEGER,
  success BOOLEAN,
  error_message TEXT
);
```

## Data Type Detection & Mapping

### Analysis Agent Specified Types
- Primary method for type determination
- Based on column names, patterns, and data analysis
- Includes confidence levels and reasoning

### Auto-Detection Fallback
- Scan sample of data values
- Pattern matching for dates, numbers, text
- Conservative approach (default to TEXT)

### Type Mapping Rules
```typescript
const TYPE_MAPPING = {
  'string': 'TEXT',
  'number': 'REAL',
  'integer': 'INTEGER', 
  'date': 'DATE',
  'datetime': 'DATETIME',
  'boolean': 'INTEGER'  // 0/1 in SQLite
};
```

## File Structure

```
src/
├── dataLoader.ts           # Main SqlDataLoader class
├── types.ts               # Data loader type definitions
├── errorHandling.ts       # Error types and handling
├── typeDetection.ts       # Auto-detection logic
└── importHistory.ts       # History tracking utilities

docs/
├── sql-data-loader-spec.md    # This specification
└── data-loader-examples.md    # Usage examples
```

## Integration Points

### With Analysis Agent
- Consumes JSON metadata files
- Returns structured error objects
- Supports reassessment workflow

### With ExcelReader
- Uses existing parsing capabilities
- Leverages ExcelParserConfig
- Maintains compatibility with current API

### With SQLite
- Creates optimized table schemas
- Uses prepared statements for performance
- Supports transaction rollback on errors

## Usage Examples

### Basic Usage
```typescript
import { SqlDataLoader } from './dataLoader.js';
import { readFileSync } from 'fs';

const metadata = JSON.parse(readFileSync('metadata.json', 'utf8'));
const loader = new SqlDataLoader('./data.db');

const result = await loader.importFromMetadata(metadata, './data.xlsx');

if (!result.success) {
  // Handle errors, potentially feed back to analysis agent
  console.error('Import failed:', result.errors);
}
```

### Error Handling
```typescript
const result = await loader.importFromMetadata(metadata, excelFile);

if (result.errors.some(e => e.requiresReanalysis)) {
  // Feed errors back to analysis agent for reassessment
  const reanalysisData = {
    originalMetadata: metadata,
    errors: result.errors,
    suggestedFixes: result.errors.map(e => e.suggestedFix)
  };
  
  // Trigger analysis agent with error context
  await triggerReanalysis(reanalysisData);
}
```

## Future Considerations

### Potential Enhancements
- Support for other data sources (CSV, JSON)
- Incremental import capabilities
- Data validation rules engine
- Performance optimization for large files
- Command-line wrapper for the API

### Scalability
- Batch processing for large datasets
- Memory-efficient streaming for huge files
- Parallel processing for multiple sheets
- Progress tracking and reporting

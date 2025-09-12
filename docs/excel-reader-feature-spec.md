# Excel Reader Feature Specification

## Overview
A flexible class for examining Excel (.xlsx) files that can handle various file structures including metadata rows, header rows, and data rows in different configurations.

## Core Requirements

### Basic Functionality
- **File Loading**: Accept full file paths and load Excel files
- **Sheet Listing**: List all available sheets in the loaded file
- **Data Extraction**: Return first n rows (default 20) as array of arrays
- **Error Handling**: Throw descriptive errors for invalid files, missing sheets, etc.

### Data Structure Handling
- **Raw Data Access**: Initially return all rows to allow analysis of file structure
- **Configurable Parsing**: Support configuration for different file formats:
  - Metadata rows (pre-header information)
  - Header row(s) (column definitions)
  - Data rows (actual content)
  - Optional data rows above headers

## Class Design

### ExcelReader Class

#### Constructor
```typescript
constructor(filePath: string)
```

#### Core Methods
```typescript
// Load and validate file
async load(): Promise<void>

// List all sheets
getSheets(): string[]

// Get raw data from a sheet
getRawData(sheetName: string, maxRows?: number): string[][]

// Get all rows from a sheet
getAllRows(sheetName: string): string[][]
```

#### Configuration Methods (Future Enhancement)
```typescript
// Configure parsing for specific file format
configureParser(config: {
  metadataRows?: number,
  headerRow?: number,
  dataStartRow?: number,
  hasDataAboveHeader?: boolean
}): void

// Get parsed data based on configuration
getParsedData(sheetName: string, maxRows?: number): {
  metadata: string[][],
  headers: string[],
  data: string[][]
}
```

## Technical Implementation

### Dependencies
- Use `xlsx` library for Excel file parsing
- TypeScript for type safety
- Node.js built-in error handling

### Error Types
- `FileNotFoundError`: When file doesn't exist
- `InvalidFileError`: When file is not a valid Excel file
- `SheetNotFoundError`: When requested sheet doesn't exist
- `LoadError`: When file fails to load

### Data Format
- All data returned as `string[][]` (array of arrays)
- No assumptions about data types - everything as strings
- Preserve original cell formatting and content

## Usage Examples

### Basic Usage
```typescript
const reader = new ExcelReader('/path/to/file.xlsx');
await reader.load();

const sheets = reader.getSheets();
console.log('Available sheets:', sheets);

const data = reader.getRawData('Sheet1', 20);
console.log('First 20 rows:', data);
```

### Advanced Usage (Future)
```typescript
const reader = new ExcelReader('/path/to/file.xlsx');
await reader.load();

// Configure for a specific file format
reader.configureParser({
  metadataRows: 2,
  headerRow: 3,
  dataStartRow: 4
});

const parsed = reader.getParsedData('Sheet1', 100);
console.log('Metadata:', parsed.metadata);
console.log('Headers:', parsed.headers);
console.log('Data:', parsed.data);
```

## File Structure Support

### Common Patterns
1. **Standard Format**: Headers in row 1, data starts in row 2
2. **Metadata + Headers**: Metadata in rows 1-2, headers in row 3, data starts in row 4
3. **Data Above Headers**: Some data rows above the header row
4. **Multiple Header Rows**: Headers span multiple rows

### Configuration Examples
```typescript
// Pattern 1: Standard
{ headerRow: 1, dataStartRow: 2 }

// Pattern 2: Metadata + Headers
{ metadataRows: 2, headerRow: 3, dataStartRow: 4 }

// Pattern 3: Data above headers
{ dataStartRow: 1, headerRow: 5, hasDataAboveHeader: true }
```

## Implementation Phases

### Phase 1: Basic Reader
- File loading and validation
- Sheet listing
- Raw data extraction
- Basic error handling

### Phase 2: Configuration System
- Parser configuration methods
- Structured data extraction
- Support for different file formats

### Phase 3: Advanced Features
- Auto-detection of file structure
- Data type inference
- Export capabilities

## Testing Strategy
- Unit tests for each method
- Test files with various structures
- Error condition testing
- Performance testing with large files

## Future Enhancements
- Support for other Excel formats (.xls, .csv)
- Data type conversion
- Filtering and querying capabilities
- Memory-efficient streaming for large files


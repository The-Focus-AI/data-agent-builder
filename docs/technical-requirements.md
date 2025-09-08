# Technical Requirements

## Development Environment

### Prerequisites
- Node.js 18+ 
- pnpm package manager
- TypeScript 5.0+
- tsx for running TypeScript directly

### Project Structure
```
data-agent-builder/
├── data/                          # Input data files
│   ├── E-Poll database/
│   ├── Listenfirst database/
│   └── Pulsar database/
├── src/
│   ├── tools/                     # Custom Umwelten tools
│   │   ├── file-analyzer.ts
│   │   ├── data-processor.ts
│   │   ├── code-generator.ts
│   │   └── schema-extractor.ts
│   ├── agents/                    # Generated chat agents
│   │   ├── templates/
│   │   │   ├── basic-chat-agent.ts
│   │   │   ├── data-analysis-agent.ts
│   │   │   └── custom-agent.ts
│   │   └── generated/             # Output directory
│   ├── utils/
│   │   ├── file-utils.ts
│   │   ├── template-engine.ts
│   │   └── validation.ts
│   └── main.ts                    # Main application entry point
├── docs/                          # Documentation
├── tests/                         # Test files
├── generated/                     # Generated agent outputs
├── package.json
├── tsconfig.json
└── README.md
```

## Dependencies

### Core Dependencies
```json
{
  "dependencies": {
    "umwelten": "latest",
    "xlsx": "^0.18.5",
    "csv-parser": "^3.0.0",
    "csv-writer": "^1.6.0",
    "zod": "^3.22.0",
    "fs-extra": "^11.1.1",
    "path": "^0.12.7",
    "mime-types": "^2.1.35"
  }
}
```

### Development Dependencies
```json
{
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/fs-extra": "^11.0.1",
    "@types/mime-types": "^2.1.1",
    "typescript": "^5.0.0",
    "tsx": "^4.0.0",
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "ts-jest": "^29.0.0"
  }
}
```

### File Processing Libraries

#### Excel Processing (xlsx)
- **Purpose**: Read and analyze Excel files
- **Features**: 
  - Sheet detection and reading
  - Data type inference
  - Schema extraction
  - Large file handling

#### CSV Processing (csv-parser)
- **Purpose**: Parse CSV files
- **Features**:
  - Streaming parser for large files
  - Header detection
  - Data type inference
  - Error handling

#### File System (fs-extra)
- **Purpose**: Enhanced file operations
- **Features**:
  - Promise-based API
  - Directory operations
  - File copying and moving
  - Path utilities

## TypeScript Configuration

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "tests"
  ]
}
```

## Package.json Scripts

```json
{
  "scripts": {
    "dev": "tsx src/main.ts",
    "build": "tsc",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src/**/*.ts",
    "format": "prettier --write src/**/*.ts",
    "analyze": "tsx src/tools/file-analyzer.ts",
    "generate": "tsx src/main.ts --generate",
    "demo": "tsx src/demo.ts"
  }
}
```

## Data File Requirements

### Supported File Types
- **Excel**: .xlsx, .xls
- **CSV**: .csv, .tsv
- **JSON**: .json
- **Text**: .txt (for structured data)

### File Size Limits
- **Excel**: Up to 50MB
- **CSV**: Up to 100MB (streaming processing)
- **JSON**: Up to 25MB
- **Text**: Up to 10MB

### Data Structure Requirements
- **Excel**: Must have headers in first row
- **CSV**: Must have consistent column structure
- **JSON**: Must be valid JSON with consistent structure
- **Text**: Must have recognizable delimiters or structure

## Tool Development Requirements

### Tool Interface
```typescript
interface Tool {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  execute: (params: any) => Promise<any>;
}
```

### Error Handling
- All tools must implement proper error handling
- Use Zod for parameter validation
- Return structured error responses
- Log errors for debugging

### Performance Requirements
- File processing should be asynchronous
- Large files should use streaming where possible
- Implement timeouts for long-running operations
- Cache results when appropriate

## Agent Generation Requirements

### Template System
- Must support multiple agent templates
- Templates should be configurable
- Must generate valid TypeScript code
- Should include proper imports and dependencies

### Generated Code Quality
- Must be syntactically correct TypeScript
- Should include proper error handling
- Must be runnable with tsx
- Should include basic documentation

### Customization Options
- Configurable system prompts
- Selectable tool sets
- Model provider configuration
- Custom file processing logic

## Testing Requirements

### Unit Tests
- Test individual tools
- Test file processing functions
- Test template generation
- Test validation logic

### Integration Tests
- Test complete workflow
- Test with real data files
- Test generated agents
- Test error scenarios

### Performance Tests
- Test with large files
- Test concurrent processing
- Test memory usage
- Test response times

## Security Requirements

### Input Validation
- Validate all file paths
- Sanitize file contents
- Prevent path traversal attacks
- Validate file types and sizes

### Error Handling
- Don't expose sensitive information
- Log errors securely
- Handle malformed files gracefully
- Implement rate limiting

### File Processing
- Process files in isolated environment
- Clean up temporary files
- Validate file permissions
- Handle corrupted files

## Deployment Requirements

### Environment Variables
```bash
# Model configuration
UMWELTEN_MODEL_PROVIDER=ollama
UMWELTEN_MODEL_NAME=qwen3:latest

# File processing
MAX_FILE_SIZE=104857600  # 100MB
TEMP_DIR=/tmp/data-agent-builder

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log
```

### Output Requirements
- Generated agents should be self-contained
- Include all necessary dependencies
- Provide clear usage instructions
- Include example configurations

## Monitoring and Logging

### Logging Requirements
- Log all file processing operations
- Log tool executions
- Log agent generation
- Log errors and warnings

### Metrics
- Track processing times
- Track success/failure rates
- Track file types processed
- Track generated agent usage

## Documentation Requirements

### Code Documentation
- JSDoc comments for all functions
- README for each tool
- Usage examples
- API documentation

### User Documentation
- Installation instructions
- Usage guide
- Configuration options
- Troubleshooting guide

### Developer Documentation
- Architecture overview
- Tool development guide
- Template system documentation
- Testing guidelines

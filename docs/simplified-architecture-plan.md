# Super-Simplified Architecture Plan

## Core Principle: LLM is the Brain, TypeScript is the Hands

### Current Problems
- **Too much analysis logic in TypeScript** (2000+ lines)
- **Complex strategy selection** (multiSheetHandler.ts - 443 lines)
- **Over-engineered error handling** (errorHandling.ts - 400+ lines)
- **Redundant Excel reading logic** (multiple implementations)
- **Complex type system** with many unused optional fields

### Target Architecture
- **LLM makes ALL decisions** about parsing, data types, import strategies
- **TypeScript provides simple tools** for data access and execution
- **Massive code reduction** from 2000+ lines to ~500 lines
- **Clear separation**: LLM = analysis, TypeScript = execution

## New File Structure

```
src/
├── analyzeFile.ts              # Chat interface + 5 simple tools
├── ExcelReader.ts              # Basic Excel reading only  
├── simpleDataLoader.ts         # Basic SQLite operations
└── types.ts                    # Minimal essential types

# DELETED:
# - dataLoader/ directory entirely
# - All complex analysis logic
# - All strategy selection logic  
# - All complex error handling
```

## Tool Architecture

### 5 Simple Tools (All logic in LLM, not TypeScript)

1. **getSheetsTool** - List sheets (no analysis)
2. **getRawDataTool** - Get raw data (no analysis)
3. **writeConfigTool** - Write final config (LLM decides everything)
4. **createTableTool** - Create SQLite table (simple SQL execution)
5. **importDataTool** - Import data (simple data loading)

### Data Flow
```
1. LLM calls getSheetsTool() → Gets sheet list
2. LLM calls getRawDataTool() → Examines each sheet's data  
3. LLM analyzes the data (in its "brain")
4. LLM calls writeConfigTool() → Writes final configuration
5. LLM calls createTableTool() → Creates SQLite table
6. LLM calls importDataTool() → Imports data
```

## Benefits

1. **LLM makes all decisions** - No complex TypeScript logic
2. **Simple tools** - Each tool does one thing only
3. **Massive code reduction** - From 2000+ lines to ~500 lines
4. **Easier to understand** - Clear separation of concerns
5. **More flexible** - LLM can adapt to any Excel structure
6. **Faster development** - No complex logic to debug

## Implementation Phases

1. **Phase 1**: Architecture Documentation ✅
2. **Phase 2**: Simplify analyzeFile.ts to 5 basic tools
3. **Phase 3**: Simplify ExcelReader.ts to basic operations only
4. **Phase 4**: Create simpleDataLoader.ts with basic SQLite operations
5. **Phase 5**: Delete complex dataLoader modules
6. **Phase 6**: Simplify types.ts to minimal essential types
7. **Phase 7**: Update tests to match simplified architecture
8. **Phase 8**: Update documentation to reflect simplified architecture

# Data Agent Builder - Implementation Plan

## Overview

This document outlines the plan to create a tool that analyzes files (particularly those in the `data/` directory) and generates source code implementing a chat agent using the Umwelten framework.

## Project Goals

1. **File Analysis Tool**: Create a tool that can analyze various data files (Excel, CSV, etc.)
2. **Agent Code Generator**: Generate TypeScript source code for chat agents using Umwelten
3. **Custom Tools Integration**: Build custom tools tailored to data analysis needs
4. **Framework Integration**: Leverage Umwelten's tool system and interaction framework

## Current Data Structure

The project contains data files from three sources:
- **E-Poll database**: `A&E Celebrity Custom Data Cuts July 2025.xlsx`
- **ListenFirst database**: `ListenFirst Talent Followers by Platform thru to Aug'25.xlsx`
- **Pulsar database**: `A&E HIST LT Pulsar Audiense Affinity Updated Aug'25.xlsx`

## Architecture Overview

```
data-agent-builder/
├── data/                          # Input data files
├── src/
│   ├── tools/                     # Custom Umwelten tools
│   │   ├── file-analyzer.ts       # Analyzes data files
│   │   ├── code-generator.ts      # Generates agent source code
│   │   └── data-processor.ts      # Processes specific data formats
│   ├── agents/                    # Generated chat agents
│   │   └── templates/             # Agent templates
│   └── utils/                     # Utility functions
├── docs/                          # Documentation
└── generated/                     # Output generated agents
```

## Umwelten Framework Analysis

Based on research, Umwelten provides:

### Core Features
- **Tool Integration**: Register and use custom tools
- **Interaction System**: Handle chat interactions with models
- **CLI Support**: Command-line interface for tool management
- **Model Integration**: Support for various LLM providers (Ollama, etc.)

### Tool System
- Tools are registered upon import
- Tools can be discovered via `getTool()` function
- Tools execute through Vercel AI SDK
- Results are returned to the model for processing

### Interaction Flow
1. Tool Registration → Tool Discovery → Tool Execution → Result Processing

## Implementation Plan

### Phase 1: Foundation Setup

#### 1.1 Project Structure
- [ ] Create `src/` directory structure
- [ ] Set up TypeScript configuration
- [ ] Install Umwelten and dependencies
- [ ] Create basic package.json with pnpm

#### 1.2 Umwelten Integration
- [ ] Install umwelten package
- [ ] Set up basic interaction system
- [ ] Test tool registration and discovery
- [ ] Configure model provider (Ollama)

### Phase 2: Custom Tools Development

#### 2.1 File Analyzer Tool
```typescript
// src/tools/file-analyzer.ts
export const fileAnalyzer = {
  name: 'fileAnalyzer',
  description: 'Analyzes data files and extracts metadata',
  parameters: {
    filePath: { type: 'string', description: 'Path to the data file' },
    analysisType: { type: 'string', description: 'Type of analysis to perform' }
  },
  execute: async ({ filePath, analysisType }) => {
    // Implementation for file analysis
  }
};
```

#### 2.2 Data Processor Tool
```typescript
// src/tools/data-processor.ts
export const dataProcessor = {
  name: 'dataProcessor',
  description: 'Processes specific data formats (Excel, CSV)',
  parameters: {
    filePath: { type: 'string' },
    format: { type: 'string', enum: ['excel', 'csv', 'json'] }
  },
  execute: async ({ filePath, format }) => {
    // Implementation for data processing
  }
};
```

#### 2.3 Code Generator Tool
```typescript
// src/tools/code-generator.ts
export const codeGenerator = {
  name: 'codeGenerator',
  description: 'Generates TypeScript source code for chat agents',
  parameters: {
    agentType: { type: 'string' },
    tools: { type: 'array' },
    configuration: { type: 'object' }
  },
  execute: async ({ agentType, tools, configuration }) => {
    // Implementation for code generation
  }
};
```

### Phase 3: Agent Templates

#### 3.1 Basic Chat Agent Template
```typescript
// src/agents/templates/basic-chat-agent.ts
export const basicChatAgentTemplate = `
import { Interaction } from 'umwelten';
import { {{TOOLS_IMPORTS}} } from './tools';

const modelDetails = {
  provider: 'ollama',
  model: 'qwen3:latest'
};

const systemPrompt = \`{{SYSTEM_PROMPT}}\`;

const interaction = new Interaction(modelDetails, systemPrompt);
interaction.setTools([{{TOOLS_LIST}}]);

export const chatAgent = async (userInput: string) => {
  const response = await interaction.processInput(userInput);
  return response;
};
`;
```

#### 3.2 Data Analysis Agent Template
```typescript
// src/agents/templates/data-analysis-agent.ts
export const dataAnalysisAgentTemplate = `
import { Interaction } from 'umwelten';
import { fileAnalyzer, dataProcessor } from './tools';

const modelDetails = {
  provider: 'ollama',
  model: 'qwen3:latest'
};

const systemPrompt = \`You are a data analysis assistant. You can analyze files, 
process data, and provide insights based on the data structure and content.\`;

const interaction = new Interaction(modelDetails, systemPrompt);
interaction.setTools([fileAnalyzer, dataProcessor]);

// Additional data analysis specific logic
export const dataAnalysisAgent = async (userInput: string) => {
  // Implementation
};
`;
```

### Phase 4: Main Agent Implementation

#### 4.1 Master Agent
Create a master agent that:
- Analyzes input files
- Determines appropriate tools needed
- Generates custom chat agent code
- Outputs complete TypeScript implementation

#### 4.2 File Analysis Logic
- Detect file types (Excel, CSV, JSON)
- Extract schema information
- Identify data patterns
- Generate appropriate tool configurations

#### 4.3 Code Generation Logic
- Select appropriate agent template
- Configure tools based on file analysis
- Generate custom system prompts
- Output complete, runnable code

### Phase 5: Testing and Validation

#### 5.1 Unit Tests
- Test individual tools
- Test file analysis capabilities
- Test code generation accuracy

#### 5.2 Integration Tests
- Test complete workflow
- Validate generated agents
- Test with actual data files

#### 5.3 End-to-End Tests
- Test with real data files
- Verify generated agents work correctly
- Performance testing

## Technical Requirements

### Dependencies
```json
{
  "dependencies": {
    "umwelten": "latest",
    "xlsx": "^0.18.5",
    "csv-parser": "^3.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "tsx": "^4.0.0"
  }
}
```

### File Processing Libraries
- **xlsx**: For Excel file processing
- **csv-parser**: For CSV file processing
- **fs-extra**: For enhanced file system operations

### Validation
- **Zod**: For parameter validation
- **TypeScript**: For type safety

## Usage Examples

### Example 1: Analyze Excel File
```typescript
const agent = new DataAgentBuilder();
const result = await agent.analyzeFile('./data/A&E Celebrity Custom Data Cuts July 2025.xlsx');
const generatedAgent = await agent.generateAgent(result);
```

### Example 2: Generate Custom Agent
```typescript
const config = {
  agentType: 'data-analysis',
  tools: ['fileAnalyzer', 'dataProcessor', 'chartGenerator'],
  systemPrompt: 'You are a celebrity data analysis expert'
};
const agentCode = await agent.generateAgentCode(config);
```

## Success Criteria

1. **File Analysis**: Successfully analyze all three data file types
2. **Code Generation**: Generate working TypeScript chat agents
3. **Tool Integration**: Custom tools work within Umwelten framework
4. **Documentation**: Complete documentation for usage and extension

## Next Steps

1. **Create PRD**: Develop detailed Product Requirements Document
2. **Set up development environment**: Install dependencies and configure TypeScript
3. **Implement Phase 1**: Foundation setup and basic Umwelten integration
4. **Iterate and test**: Build incrementally with testing at each phase

## Questions to Resolve

1. **Umwelten API**: Need to verify exact API for tool registration and interaction
2. **Model Configuration**: Determine best model for data analysis tasks
3. **File Processing**: Choose optimal libraries for Excel/CSV processing
4. **Code Generation**: Determine template system and customization options
5. **Error Handling**: Define error handling strategy for file processing and code generation

## References

- [Umwelten Tools API](https://umwelten.thefocus.ai/api/tools)
- [Umwelten Documentation](https://umwelten.thefocus.ai)
- [Vercel AI SDK](https://sdk.vercel.ai/) (used by Umwelten)
- [Zod Validation](https://zod.dev/)

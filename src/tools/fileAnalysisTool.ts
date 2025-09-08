import { z } from 'zod';
import { registerTool } from 'umwelten/dist/stimulus/tools/registry.js';
import { FileReader } from '../fileReader.js';
import { FileAnalysis } from '../types.js';

// Tool schema for file analysis
const FileAnalysisToolSchema = z.object({
  filePath: z.string().describe('Path to the file to analyze'),
});

const fileAnalysisTool = {
  name: 'analyzeFile',
  description: 'Analyze a data file (Excel or CSV) to understand its structure, data types, and business context',
  parameters: FileAnalysisToolSchema,
  execute: async (params: z.infer<typeof FileAnalysisToolSchema>): Promise<{
    success: boolean;
    analysis?: FileAnalysis;
    error?: string;
  }> => {
    try {
      const fileReader = new FileReader();
      const analysis = await fileReader.analyzeFile(params.filePath);
      
      return {
        success: true,
        analysis,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

// Register the tool with Umwelten
registerTool(fileAnalysisTool);

export { fileAnalysisTool };

import { z } from 'zod';
import { registerTool } from 'umwelten/dist/stimulus/tools/registry.js';
import * as fs from 'fs';
import * as path from 'path';

// Tool schema for listing sample data files
const SampleDataToolSchema = z.object({
  directory: z.string().optional().describe('Directory to search for sample files (defaults to data/)'),
});

const sampleDataTool = {
  name: 'listSampleData',
  description: 'List available sample data files in the data directory',
  parameters: SampleDataToolSchema,
  execute: async (params: z.infer<typeof SampleDataToolSchema>): Promise<{
    success: boolean;
    files?: Array<{
      name: string;
      path: string;
      size: number;
      type: string;
    }>;
    error?: string;
  }> => {
    try {
      const dataDir = params.directory || 'data';
      
      if (!fs.existsSync(dataDir)) {
        return {
          success: false,
          error: `Directory ${dataDir} does not exist`,
        };
      }

      const files: Array<{
        name: string;
        path: string;
        size: number;
        type: string;
      }> = [];

      const scanDirectory = (dir: string, relativePath: string = '') => {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const itemRelativePath = path.join(relativePath, item);
          const stats = fs.statSync(fullPath);
          
          if (stats.isDirectory()) {
            scanDirectory(fullPath, itemRelativePath);
          } else if (stats.isFile()) {
            const ext = path.extname(item).toLowerCase();
            if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') {
              files.push({
                name: item,
                path: itemRelativePath,
                size: stats.size,
                type: ext === '.csv' ? 'csv' : 'excel',
              });
            }
          }
        }
      };

      scanDirectory(dataDir);

      return {
        success: true,
        files,
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
registerTool(sampleDataTool);

export { sampleDataTool };

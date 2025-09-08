import { z } from 'zod';

// File analysis types
export const FileAnalysisSchema = z.object({
  fileName: z.string(),
  fileType: z.enum(['excel', 'csv']),
  fileSize: z.number(),
  rowCount: z.number(),
  columnCount: z.number(),
  columns: z.array(z.object({
    name: z.string(),
    type: z.enum(['string', 'number', 'date', 'boolean', 'mixed']),
    sampleValues: z.array(z.string()),
    nullCount: z.number(),
    uniqueCount: z.number(),
  })),
  sheets: z.array(z.string()).optional(), // For Excel files
  analysis: z.object({
    hasHeaders: z.boolean(),
    dataQuality: z.enum(['excellent', 'good', 'fair', 'poor']),
    potentialIssues: z.array(z.string()),
    businessContext: z.array(z.string()),
  }),
});

export type FileAnalysis = z.infer<typeof FileAnalysisSchema>;

// Tool generation types
export const ToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.record(z.any()),
  returnType: z.string(),
  businessValue: z.string(),
});

export type Tool = z.infer<typeof ToolSchema>;

// Agent configuration types
export const AgentConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  tools: z.array(ToolSchema),
  systemPrompt: z.string(),
  sampleQueries: z.array(z.string()),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

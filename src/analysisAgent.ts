import { Interaction } from 'umwelten/dist/interaction/interaction.js';
import { ModelDetails } from 'umwelten/dist/cognition/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class AnalysisAgent {
  private modelDetails: ModelDetails;

  constructor() {
    // Configure the model - using a simple configuration for now
    this.modelDetails = {
      name: 'qwen3:latest',
      provider: 'ollama' // You can change this to other providers
    };
  }

  /**
   * Start an interactive analysis session using Umwelten CLI
   */
  async startInteractiveSession(): Promise<void> {
    console.log('🔍 Data Analysis Agent Started');
    console.log('================================');
    console.log('I can help you analyze your data files and suggest intelligent tools.');
    console.log('Starting Umwelten interactive session...\n');

    try {
      // Use Umwelten CLI to start an interactive session
      const command = `umwelten chat --provider ${this.modelDetails.provider} --model ${this.modelDetails.name}`;
      console.log(`Running: ${command}\n`);
      
      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd()
      });
      
      if (stderr) {
        console.error('Error:', stderr);
      }
    } catch (error) {
      console.error('Error starting analysis session:', error);
      throw error;
    }
  }

  /**
   * Run a demo with specific tools using Umwelten CLI
   */
  async runDemo(prompt?: string): Promise<void> {
    console.log('🔍 Data Analysis Agent Demo');
    console.log('============================');
    
    const defaultPrompt = prompt || "Please list all available sample data files and then analyze one of them to understand its structure and business context.";
    
    try {
      const command = `umwelten tools demo --provider ${this.modelDetails.provider} --model ${this.modelDetails.name} --prompt "${defaultPrompt}"`;
      console.log(`Running: ${command}\n`);
      
      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd()
      });
      
      if (stderr) {
        console.error('Error:', stderr);
      }
    } catch (error) {
      console.error('Error running demo:', error);
      throw error;
    }
  }

  /**
   * List available tools using Umwelten CLI
   */
  async listTools(): Promise<void> {
    console.log('🔧 Available Tools:\n');
    
    try {
      const { stdout, stderr } = await execAsync('umwelten tools list', {
        cwd: process.cwd()
      });
      
      console.log(stdout);
      if (stderr) {
        console.error('Error:', stderr);
      }
    } catch (error) {
      console.error('Error listing tools:', error);
    }
  }

  /**
   * Get a quick analysis of a specific file using Umwelten CLI
   */
  async analyzeFile(filePath: string): Promise<void> {
    console.log(`🔍 Analyzing file: ${filePath}\n`);
    
    const prompt = `Please analyze the file: ${filePath}. Use the analyzeFile tool to examine its structure, data types, and business context. Provide detailed insights about the data and suggest useful tools that could be generated from it.`;
    
    try {
      const command = `umwelten tools demo --provider ${this.modelDetails.provider} --model ${this.modelDetails.name} --prompt "${prompt}"`;
      console.log(`Running: ${command}\n`);
      
      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd()
      });
      
      if (stderr) {
        console.error('Error:', stderr);
      }
    } catch (error) {
      console.error('Error analyzing file:', error);
    }
  }

  /**
   * List available sample data files using Umwelten CLI
   */
  async listSampleFiles(): Promise<void> {
    console.log('📁 Available Sample Data Files:\n');
    
    const prompt = "Please list all available sample data files using the listSampleData tool.";
    
    try {
      const command = `umwelten tools demo --provider ${this.modelDetails.provider} --model ${this.modelDetails.name} --prompt "${prompt}"`;
      console.log(`Running: ${command}\n`);
      
      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd()
      });
      
      if (stderr) {
        console.error('Error:', stderr);
      }
    } catch (error) {
      console.error('Error listing sample files:', error);
    }
  }
}

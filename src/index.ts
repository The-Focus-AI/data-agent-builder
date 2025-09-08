import { Command } from "commander";
import { chatCommand } from "./chat.js";
import { FileReader } from "./fileReader.js";

const program = new Command();

program
  .name("data-agent-builder")
  .description("Data Agent Builder - Analyze files and generate intelligent tools")
  .version("1.0.0");

// Add the chat command
program.addCommand(chatCommand);

// Add a demo command for quick file analysis
program
  .command("demo")
  .description("Run a quick demo of file analysis")
  .action(async () => {
    console.log('🔍 Data Agent Builder - File Analysis Demo');
    console.log('=======================================\n');

    const fileReader = new FileReader();
    
    // Test with the available sample files
    const sampleFiles = [
      'data/E-Poll database/A&E Celebrity Custom Data Cuts July 2025.xlsx',
      'data/Listenfirst database/ListenFirst Talent Followers by Platform thru to Aug\'25.xlsx',
      'data/Pulsar database/A&E HIST LT Pulsar Audiense Affinity Updated Aug\'25.xlsx'
    ];

    for (const filePath of sampleFiles) {
      try {
        console.log(`Analyzing: ${filePath}`);
        console.log('----------------------------------------');
        
        const analysis = await fileReader.analyzeFile(filePath);
        
        console.log(`File: ${analysis.fileName}`);
        console.log(`Type: ${analysis.fileType}`);
        console.log(`Size: ${(analysis.fileSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`Rows: ${analysis.rowCount}`);
        console.log(`Columns: ${analysis.columnCount}`);
        console.log(`Data Quality: ${analysis.analysis.dataQuality}`);
        console.log(`Has Headers: ${analysis.analysis.hasHeaders}`);
        
        if (analysis.sheets) {
          console.log(`Sheets: ${analysis.sheets.join(', ')}`);
        }
        
        console.log('\nColumns:');
        analysis.columns.forEach((col, index) => {
          console.log(`  ${index + 1}. ${col.name} (${col.type}) - ${col.uniqueCount} unique values`);
          if (col.sampleValues.length > 0) {
            console.log(`     Sample: ${col.sampleValues.join(', ')}`);
          }
        });
        
        if (analysis.analysis.businessContext.length > 0) {
          console.log('\nBusiness Context:');
          analysis.analysis.businessContext.forEach(context => {
            console.log(`  - ${context}`);
          });
        }
        
        if (analysis.analysis.potentialIssues.length > 0) {
          console.log('\nPotential Issues:');
          analysis.analysis.potentialIssues.forEach(issue => {
            console.log(`  - ${issue}`);
          });
        }
        
        console.log('\n' + '='.repeat(50) + '\n');
        
      } catch (error) {
        console.error(`Error analyzing ${filePath}:`, error);
        console.log('\n' + '='.repeat(50) + '\n');
      }
    }
  });

// Parse command line arguments
program.parse();
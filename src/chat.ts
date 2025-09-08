import { Command } from "commander";
import { Interaction } from "umwelten/dist/interaction/interaction.js";
import { BaseModelRunner } from "umwelten/dist/cognition/runner.js";
import { listTools, toVercelToolSet, ToolSet } from "umwelten/dist/stimulus/tools/index.js";
import readline from "readline";
import fs from "fs";
import path from "path";

// Import our tools to register them
import "./tools/fileAnalysisTool.js";
import "./tools/sampleDataTool.js";

export const chatCommand = new Command("chat")
  .description("Interactive chat with data analysis tools")
  .option("-p, --provider <provider>", "Model provider (e.g., ollama, openrouter)", "ollama")
  .option("-m, --model <model>", "Model name (e.g., gpt-oss:latest, qwen3:latest)", "qwen3:latest")
  .option("-f, --file <filePath>", "File to include in the chat")
  .action(async (options: { provider: string; model: string; file?: string }) => {
    const { provider, model, file } = options;

    // Create model details
    const modelDetails = {
      name: model,
      provider: provider,
    };

    // Create model runner
    const runner = new BaseModelRunner();

    // Get registered tools and convert to ToolSet
    const registeredTools = listTools();
    const toolSet: ToolSet = {};
    registeredTools.forEach(tool => {
      toolSet[tool.name] = tool;
    });

    // Handle file attachment if provided
    let initialPrompt = `You are a Data Analysis Agent specialized in analyzing Excel and CSV files. Your role is to:

1. **Analyze Data Files**: Use the analyzeFile tool to examine file structure, data types, and patterns
2. **Provide Insights**: Identify business context, data quality issues, and potential use cases
3. **Suggest Tools**: Recommend domain-specific tools that could be generated from the data
4. **Guide Users**: Help users understand their data and plan next steps

When analyzing files:
- Always start by listing available sample data files
- Provide detailed analysis of file structure and content
- Identify business context from column names and data patterns
- Suggest specific, actionable tools that would be valuable
- Highlight any data quality issues or concerns

Be thorough, helpful, and focus on practical business value.

Hello! I'm your Data Analysis Agent. I can help you analyze Excel and CSV files, understand their structure, and suggest intelligent tools. How can I help you today?`;

    if (file) {
      try {
        const filePath = path.resolve(file);
        if (!fs.existsSync(filePath)) {
          console.error(`Error: File '${file}' does not exist.`);
          process.exit(1);
        }
        
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const fileName = path.basename(filePath);
        initialPrompt = `I've attached a file called '${fileName}'. Here's its content:\n\n${fileContent}\n\nHow can I help you with this file?`;
        console.log(`File attached: ${fileName}`);
      } catch (error) {
        console.error(`Error reading file '${file}':`, error);
        process.exit(1);
      }
    }

    // Create readline interface
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: "You: ",
    });

    console.log(`🔍 Data Analysis Agent Started`);
    console.log(`================================`);
    console.log(`Model: ${provider}/${model}`);
    console.log(`Available tools: ${Object.keys(toolSet).join(', ')}`);
    console.log("Type 'quit' or 'exit' to end the conversation.\n");

    // Create initial interaction with file attachment if provided
    const initialInteraction = new Interaction(modelDetails, initialPrompt);
    
    // Set tools on the interaction
    if (Object.keys(toolSet).length > 0) {
      initialInteraction.setTools(toolSet);
    }
    
    if (file) {
      try {
        await initialInteraction.addAttachmentFromPath(file);
      } catch (error) {
        console.error("Error attaching file to interaction:", error);
      }
    }

    // Start the conversation
    rl.prompt();

    rl.on("line", async (line) => {
      const message = line.trim();
      
      if (message.toLowerCase() === "exit" || message.toLowerCase() === "quit") {
        console.log("Goodbye! 👋");
        rl.close();
        return;
      }

      if (message === "") {
        rl.prompt();
        return;
      }

      // Create interaction with the user's message
      const interaction = new Interaction(modelDetails, message);
      
      // Set tools on the interaction
      if (Object.keys(toolSet).length > 0) {
        interaction.setTools(toolSet);
      }

      try {
        // Stream the model's response
        process.stdout.write("🤖 Agent: ");
        const response = await runner.streamText(interaction);
        if (response?.content) {
          process.stdout.write(response.content + "\n\n");
        } else {
          process.stdout.write("[No response]\n\n");
        }
      } catch (error) {
        console.error("Error:", error);
      }

      rl.prompt();
    });

    rl.on("close", () => {
      console.log("Chat session ended.");
      process.exit(0);
    });
  });

// Execute the command if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  chatCommand.parse();
}

import { Command } from "commander";
import { Interaction } from "umwelten/dist/interaction/interaction.js";
import { BaseModelRunner } from "umwelten/dist/cognition/runner.js";
import readline from "readline";
import fs from "fs";
import path from "path";

export const chatCommand = new Command("chat")
  .description("Interactive chat with a model using umwelten classes")
  .option("-p, --provider <provider>", "Model provider (e.g., ollama, openrouter)", "ollama")
  .option("-m, --model <model>", "Model name (e.g., gpt-oss:latest, qwen3:latest)", "gpt-oss:latest")
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

    // Handle file attachment if provided
    let initialPrompt = "Hello! How can I help you today?";
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

    console.log(`Starting chat with ${provider}/${model}`);
    console.log("Type 'quit' or 'exit' to end the conversation.\n");

    // Create initial interaction with file attachment if provided
    const initialInteraction = new Interaction(modelDetails, initialPrompt);
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
        console.log("Goodbye!");
        rl.close();
        return;
      }

      if (message === "") {
        rl.prompt();
        return;
      }

      // Create interaction with the user's message
      const interaction = new Interaction(modelDetails, message);

      try {
        // Stream the model's response
        process.stdout.write("Model: ");
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
}c
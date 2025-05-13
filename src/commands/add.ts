import fs from 'fs-extra';
import path from 'path';
import ora from 'ora';
import chalk from 'chalk';

interface AddOptions {
  name?: string;
}

export async function addComponent(component: string, options: AddOptions): Promise<void> {
  const cwd = process.cwd();
  const spinner = ora(`Adding ${component}...`).start();
  
  try {
    // Make sure we're in a Jedi-Ops project by checking for wrangler.toml
    const wranglerPath = path.join(cwd, 'wrangler.toml');
    if (!await fs.pathExists(wranglerPath)) {
      spinner.fail('Not in a Jedi-Ops project. Make sure wrangler.toml exists.');
      throw new Error('Not in a Jedi-Ops project');
    }
    
    switch (component) {
      case 'queue-consumer':
        await addQueueConsumer(cwd, options.name || 'queue-consumer', spinner);
        break;
      case 'dispatch-processor':
        await addDispatchProcessor(cwd, spinner);
        break;
      default:
        spinner.fail(`Unknown component: ${component}`);
        throw new Error(`Unknown component: ${component}`);
    }
    
    spinner.succeed(`${component} added successfully`);
  } catch (error) {
    spinner.fail(`Failed to add ${component}`);
    throw error;
  }
}

async function addQueueConsumer(cwd: string, name: string, spinner: ora.Ora): Promise<void> {
  spinner.text = `Adding queue consumer: ${name}...`;
  
  // Sanitize the name for file paths
  const sanitizedName = name.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
  
  // Create worker directory
  const workerDir = path.join(cwd, 'workers', sanitizedName);
  await fs.ensureDir(workerDir);
  
  // Copy template files
  const templateDir = path.join(__dirname, '../templates/add/workers/queue-consumer');
  
  // If the template directory doesn't exist yet, create a basic worker file
  if (!await fs.pathExists(templateDir)) {
    // Create a basic worker file
    const workerContent = `
export interface Env {
  ${sanitizedName.toUpperCase()}_QUEUE: Queue;
}

export default {
  async queue(batch: MessageBatch<any>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        console.log(\`Processing message with ID: \${message.id}\`);
        console.log(\`Message body: \${JSON.stringify(message.body)}\`);
        
        // Process the message here
        
        // Acknowledge the message to remove it from the queue
        message.ack();
      } catch (error) {
        console.error(\`Error processing message \${message.id}\`, error);
        message.retry();
      }
    }
  }
};
`.trim();
    
    await fs.writeFile(path.join(workerDir, 'index.ts'), workerContent);
  } else {
    await fs.copy(templateDir, workerDir, { overwrite: true });
    
    // Update any placeholders in the files
    const files = await fs.readdir(workerDir);
    for (const file of files) {
      const filePath = path.join(workerDir, file);
      if ((await fs.stat(filePath)).isFile()) {
        let content = await fs.readFile(filePath, 'utf8');
        content = content.replace(/QUEUE_NAME/g, sanitizedName.toUpperCase());
        content = content.replace(/queue-name/g, sanitizedName);
        await fs.writeFile(filePath, content);
      }
    }
  }
  
  // Update wrangler.toml to add the queue
  const wranglerPath = path.join(cwd, 'wrangler.toml');
  let wranglerContent = await fs.readFile(wranglerPath, 'utf8');
  
  // Check if the queue is already defined
  if (!wranglerContent.includes(`${sanitizedName.toUpperCase()}_QUEUE`)) {
    // Add the queue binding
    const queueBinding = `
[[queues.consumers]]
queue = "${sanitizedName}-queue"
max_batch_size = 10
max_batch_timeout = 5
max_retries = 3
dead_letter_queue = "${sanitizedName}-dlq"

[[queues.producers]]
queue = "${sanitizedName}-queue"
binding = "${sanitizedName.toUpperCase()}_QUEUE"
`.trim();
    
    wranglerContent += '\n\n' + queueBinding;
    await fs.writeFile(wranglerPath, wranglerContent);
  }
}

async function addDispatchProcessor(cwd: string, spinner: ora.Ora): Promise<void> {
  spinner.text = 'Adding dispatch processor...';
  
  // Add a specialized queue consumer named dispatch-processor
  await addQueueConsumer(cwd, 'dispatch-processor', spinner);
}
import fs from 'fs-extra';
import path from 'path';
import ora from 'ora';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { execSync } from 'child_process';

interface InitOptions {
  name?: string;
  directory?: string;
  skipPrompts?: boolean;
}

interface ProjectConfig {
  name: string;
  directory: string;
  useRedis: boolean;
  useQueues: boolean;
  authKey: string;
}

export async function initProject(options: InitOptions): Promise<void> {
  let { name, directory, skipPrompts } = options;
  
  console.log(chalk.blue(`
    ____          ___       ____              
   / / /___  ____/ (_)___  / __ \\____  _____  
  / / / __ \\/ __  / / __ \\/ / / / __ \\/ ___/  
 / / / /_/ / /_/ / / /_/ / /_/ / /_/ (__  )   
/_/_/\\____/\\__,_/_/\\____/\\____/ .___/____/    
                             /_/            
                      ${chalk.yellow('Worker Queue Platform')}
  `));
  
  // Interactive setup if not skipping prompts
  const config = await promptForConfig(name, directory, !!skipPrompts);
  
  const spinner = ora('Creating project structure...').start();
  
  try {
    // Ensure the directory exists
    await fs.ensureDir(config.directory);
    
    // Copy template files
    const templateDir = path.join(__dirname, '../templates/init');
    await fs.copy(templateDir, config.directory, { overwrite: true });
    
    // Remove the GitOps .gitignore if it exists
    const gitOpsIgnorePath = path.join(config.directory, '.gitignore-gitops');
    if (await fs.pathExists(gitOpsIgnorePath)) {
      await fs.remove(gitOpsIgnorePath);
    }
    
    // Copy .env.example to .env for easy configuration
    const envExamplePath = path.join(config.directory, '.env.example');
    const envPath = path.join(config.directory, '.env');
    if (await fs.pathExists(envExamplePath)) {
      await fs.copyFile(envExamplePath, envPath);
      
      // Replace the auth key in the .env file
      let envContent = await fs.readFile(envPath, 'utf8');
      envContent = envContent.replace(/AUTH_KEY=".*"/g, `AUTH_KEY="${config.authKey}"`);
      await fs.writeFile(envPath, envContent);
      
      console.log(chalk.green('Created .env file with your auth key'));
    }
    
    // Update package.json
    const packageJsonPath = path.join(config.directory, 'package.json');
    if (await fs.pathExists(packageJsonPath)) {
      const packageJson = await fs.readJson(packageJsonPath);
      packageJson.name = config.name;
      
      // Remove Redis dependency if not needed
      if (!config.useRedis) {
        delete packageJson.dependencies['@upstash/redis'];
      }
      
      await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
    } else {
      // Create package.json if it doesn't exist in the template
      const dependencies: Record<string, string> = {
        hono: '^3.3.0',
      };
      
      if (config.useRedis) {
        dependencies['@upstash/redis'] = '^1.22.0';
      }
      
      const packageJson = {
        name: config.name,
        version: '0.1.0',
        description: 'Worker queue platform on Cloudflare Workers created with Jedi-Ops',
        main: 'src/index.ts',
        scripts: {
          start: 'wrangler dev',
          deploy: 'wrangler deploy',
          format: 'prettier --write "src/**/*.ts"'
        },
        dependencies,
        devDependencies: {
          '@cloudflare/workers-types': '^4.20230628.0',
          typescript: '^5.1.6',
          wrangler: '^3.1.1',
          prettier: '^3.0.0'
        }
      };
      await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
    }
    
    // Update wrangler.toml with project name and configuration
    const wranglerPath = path.join(config.directory, 'wrangler.toml');
    if (await fs.pathExists(wranglerPath)) {
      let wranglerContent = await fs.readFile(wranglerPath, 'utf8');
      
      // Update project name
      wranglerContent = wranglerContent.replace(/name = ".*"/g, `name = "${config.name}"`);
      
      // Remove queue configuration if not needed
      if (!config.useQueues) {
        wranglerContent = wranglerContent.replace(/# Define queues for the main process\n\[\[queues\.producers\]\]\nqueue = ".*"\nbinding = ".*"\n\n\[\[queues\.producers\]\]\nqueue = ".*"\nbinding = ".*"\n\n# Configure the dispatch processor consumer\n\[\[queues\.consumers\]\]\nqueue = ".*"\nmax_batch_size = .*\nmax_batch_timeout = .*\nmax_retries = .*\ndead_letter_queue = ".*"\n\n# Configure the todo processor consumer\n\[\[queues\.consumers\]\]\nqueue = ".*"\nmax_batch_size = .*\nmax_batch_timeout = .*\nmax_retries = .*\ndead_letter_queue = ".*"/g, 
          '# Queues are currently disabled\n# Uncomment and configure the section below to enable Cloudflare Queues\n\n# [[queues.producers]]\n# queue = "dispatch-queue"\n# binding = "DISPATCH_QUEUE"\n\n# [[queues.producers]]\n# queue = "todo-queue"\n# binding = "TODO_QUEUE"');
      }
      
      await fs.writeFile(wranglerPath, wranglerContent);
    }
    
    // Update src/index.ts to remove Redis or Queues code if not needed
    const indexPath = path.join(config.directory, 'src/index.ts');
    if (await fs.pathExists(indexPath)) {
      let indexContent = await fs.readFile(indexPath, 'utf8');
      
      if (!config.useRedis) {
        // Remove Redis import
        indexContent = indexContent.replace(/import { Redis } from '@upstash\/redis\/cloudflare';\n/g, '');
        
        // Remove Redis environment variables
        indexContent = indexContent.replace(/  UPSTASH_REDIS_URL: string;\n  UPSTASH_REDIS_TOKEN: string;\n/g, '');
        
        // Remove or modify the Redis-related endpoint
        indexContent = indexContent.replace(/\/\/ Redis pub\/sub endpoint if Upstash Redis is configured\napp\.post\('\/publish', async \(c\) => \{[\s\S]*?}\);\n\n/g, 
          '// Redis pub/sub endpoint is disabled (Upstash Redis not configured)\n\n');
      }
      
      if (!config.useQueues) {
        // Remove Queue binding
        indexContent = indexContent.replace(/  \/\/ Cloudflare Queue binding\n  DISPATCH_QUEUE: Queue;\n/g, '');
        
        // Remove or modify the Queue-related endpoint
        indexContent = indexContent.replace(/\/\/ Queue endpoint to enqueue jobs\napp\.post\('\/enqueue', async \(c\) => \{[\s\S]*?}\);\n\n/g,
          '// Queue endpoint is disabled (Cloudflare Queues not configured)\n\n');
      }
      
      await fs.writeFile(indexPath, indexContent);
    }
    
    // If Queues are disabled, remove the workers directory or add a README explaining it's disabled
    if (!config.useQueues) {
      const workersDir = path.join(config.directory, 'workers');
      if (await fs.pathExists(workersDir)) {
        await fs.remove(workersDir);
        // Create a README in its place
        await fs.ensureDir(workersDir);
        await fs.writeFile(
          path.join(workersDir, 'README.md'),
          '# Queue Workers\n\nCloudflare Queues are currently disabled in this project.\n\nTo enable queue processing:\n\n1. Update wrangler.toml to uncomment and configure the queue bindings\n2. Run `jedi-ops add queue-consumer --name your-processor-name`\n'
        );
      }
    }
    
    spinner.succeed('Project created successfully');
    
    // Show next steps
    console.log(chalk.green('\n✅ Project initialized successfully!'));
    console.log(chalk.blue('\n🎮 Next steps:'));
    console.log(`1. ${chalk.yellow(`cd ${path.relative(process.cwd(), config.directory)}`)}`);
    
    // Recommend Bun over npm
    console.log(`2. ${chalk.green('bun install')} ${chalk.gray('(recommended for speed)')}`);
    console.log(`   ${chalk.gray('or')} ${chalk.yellow('npm install')}`);
    
    console.log(`3. Configure environment in ${chalk.cyan('.env')} file:`);
    
    if (config.useRedis) {
      console.log(chalk.yellow(`
   # Update your .env file with Upstash Redis credentials
   # Get your Redis credentials at https://console.upstash.com
   UPSTASH_REDIS_URL="https://your-upstash-region.upstash.io/redis/your-db-id"
   UPSTASH_REDIS_TOKEN="your-upstash-token"`));
    }
    
    console.log(`4. ${chalk.green('bun start')} ${chalk.gray('(recommended)')} or ${chalk.yellow('npm start')}`);
    
    if (config.useQueues) {
      console.log(chalk.blue('\n🚀 To add more queue consumers:'));
      console.log(`- ${chalk.yellow('npx jedi-ops add queue-consumer --name my-processor')}`);
    }
    
    console.log(chalk.blue('\n📚 Documentation:'));
    console.log(`- ${chalk.magenta('README.md')} in your project for more information`);
    console.log(`- ${chalk.cyan('https://developers.cloudflare.com/workers/')} for Cloudflare Workers docs`);
    if (config.useQueues) {
      console.log(`- ${chalk.cyan('https://developers.cloudflare.com/queues/')} for Cloudflare Queues docs`);
    }
    if (config.useRedis) {
      console.log(`- ${chalk.cyan('https://docs.upstash.com/redis')} for Upstash Redis docs`);
    }
    
    console.log(chalk.blue('\nMay the Force be with you! 🚀'));
    
  } catch (error) {
    spinner.fail('Failed to create project');
    throw error;
  }
}

async function promptForConfig(
  defaultName?: string,
  defaultDirectory?: string,
  skipPrompts = false
): Promise<ProjectConfig> {
  // Generate random auth key - 32 alphanumeric characters
  const randomAuthKey = Array.from(
    { length: 32 },
    () => Math.random().toString(36)[2]
  ).join('');
  
  // Default configuration
  const defaultConfig: ProjectConfig = {
    name: defaultName || 'jedi-ops-project',
    directory: defaultDirectory || path.join(process.cwd(), defaultName || 'jedi-ops-project'),
    useRedis: true,
    useQueues: true,
    authKey: randomAuthKey
  };
  
  // If skipPrompts is true, return the default configuration
  if (skipPrompts) {
    if (!defaultDirectory && defaultName) {
      defaultConfig.directory = path.join(process.cwd(), defaultName);
    }
    return defaultConfig;
  }
  
  // Otherwise, prompt for configuration
  const questions = [
    {
      type: 'input',
      name: 'name',
      message: 'Project name:',
      default: defaultConfig.name,
      validate: (input: string) => input.trim() !== '' || 'Project name cannot be empty'
    },
    {
      type: 'input',
      name: 'directory',
      message: 'Project directory:',
      default: (answers: { name: string }) => 
        defaultDirectory || path.join(process.cwd(), answers.name),
      validate: (input: string) => input.trim() !== '' || 'Directory cannot be empty'
    },
    {
      type: 'confirm',
      name: 'useQueues',
      message: 'Enable Cloudflare Queues for background processing?',
      default: defaultConfig.useQueues
    },
    {
      type: 'confirm',
      name: 'useRedis',
      message: 'Enable Upstash Redis for pub/sub messaging?',
      default: defaultConfig.useRedis
    },
    {
      type: 'input',
      name: 'authKey',
      message: 'Auth key for securing webhook endpoints (leave empty to generate random):',
      default: '',
      filter: (input: string) => input.trim() === '' ? randomAuthKey : input.trim()
    }
  ];
  
  const answers = await inquirer.prompt(questions);
  
  // If directory is not absolute, make it absolute
  if (!path.isAbsolute(answers.directory)) {
    answers.directory = path.join(process.cwd(), answers.directory);
  }
  
  return {
    name: answers.name,
    directory: answers.directory,
    useRedis: answers.useRedis,
    useQueues: answers.useQueues,
    authKey: answers.authKey
  };
}
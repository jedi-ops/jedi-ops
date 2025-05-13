#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { initProject } from './commands/init';
import { addComponent } from './commands/add';

const program = new Command();

program
  .name('jedi-ops')
  .description('CLI tool for creating worker queue platforms on Cloudflare Workers')
  .version('0.0.1');

program
  .command('init')
  .description('Initialize a new Jedi-Ops project')
  .option('-n, --name <name>', 'Project name')
  .option('-d, --directory <directory>', 'Target directory')
  .option('-y, --yes', 'Skip prompts and use defaults')
  .action(async (options) => {
    try {
      await initProject({
        name: options.name,
        directory: options.directory,
        skipPrompts: options.yes
      });
    } catch (error) {
      console.error(chalk.red('Error initializing project:'), error);
      process.exit(1);
    }
  });

program
  .command('add <component>')
  .description('Add a new component to your Jedi-Ops project')
  .option('-n, --name <name>', 'Component name (required for queue consumers)')
  .action(async (component, options) => {
    try {
      if (component === 'queue-consumer' && !options.name) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Enter a name for your queue consumer:',
            validate: (input) => input.length > 0 || 'Name is required'
          }
        ]);
        options.name = answers.name;
      }
      
      await addComponent(component, options);
      console.log(chalk.green(`✅ Component ${component} added successfully!`));
    } catch (error) {
      console.error(chalk.red(`Error adding component ${component}:`), error);
      process.exit(1);
    }
  });

// Handle case when no command is provided
if (process.argv.length === 2) {
  program.help();
}

program.parse(process.argv);
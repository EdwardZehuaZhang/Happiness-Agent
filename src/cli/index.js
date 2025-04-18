#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const fs = require('fs');
const config = require('config');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { v4: uuidv4 } = require('uuid');
const { OrchestratorClient } = require('../core/orchestrator');
const { spinner, logger } = require('../utils');

// Initialize orchestrator client
const orchestrator = new OrchestratorClient(config.get('agents'));

program
  .name('happiness')
  .description('Happiness Agent - Fully Automated Development System')
  .version('0.1.0');

// Initialize a new project
program
  .command('init')
  .description('Initialize a new project')
  .option('-n, --name <name>', 'Project name')
  .option('-d, --description <description>', 'Project description')
  .action(async (options) => {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Project name:',
        default: options.name || path.basename(process.cwd()),
        when: !options.name
      },
      {
        type: 'input',
        name: 'description',
        message: 'Project description:',
        default: options.description || 'A Happiness Agent project',
        when: !options.description
      }
    ]);

    const projectName = options.name || answers.name;
    const projectDescription = options.description || answers.description;

    const spin = spinner.start('Initializing project...');

    try {
      // Create project structure
      if (!fs.existsSync('.happiness')) {
        fs.mkdirSync('.happiness');
        fs.mkdirSync('.happiness/context_snapshots');
        fs.mkdirSync('.happiness/artifacts');
        fs.mkdirSync('.happiness/logs');
      }

      // Create project config
      const projectConfig = {
        name: projectName,
        description: projectDescription,
        created_at: new Date().toISOString(),
        id: uuidv4()
      };

      fs.writeFileSync(
        '.happiness/project.json', 
        JSON.stringify(projectConfig, null, 2)
      );

      spin.succeed('Project initialized successfully');
      console.log(chalk.green(`\nProject "${projectName}" has been created!`));
      console.log(`\nGet started by running:`);
      console.log(chalk.cyan(`  happiness generate "Your prompt here"`));
    } catch (error) {
      spin.fail('Failed to initialize project');
      logger.error('Initialization error', error);
      console.error(chalk.red('Error:'), error.message);
    }
  });

// Generate code from prompt
program
  .command('generate')
  .description('Generate code from a prompt')
  .argument('<prompt>', 'The prompt to generate code from')
  .option('-o, --output <dir>', 'Output directory', './generated')
  .action(async (prompt, options) => {
    // Check if in a Happiness project
    if (!fs.existsSync('.happiness')) {
      console.error(chalk.red('Error: Not in a Happiness project. Run `happiness init` first.'));
      process.exit(1);
    }

    const spin = spinner.start('Processing prompt...');

    try {
      // Start the full workflow
      const taskId = await orchestrator.startWorkflow('full_cycle', {
        user_prompt: prompt
      });

      spin.text = `Task started (ID: ${taskId})`;

      // Poll for status
      let isDone = false;
      let status = null;

      while (!isDone) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        status = await orchestrator.getTaskStatus(taskId);
        spin.text = `Status: ${status.status} (${status.progress || '0'}%)`;
        
        if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(status.status)) {
          isDone = true;
        }
      }

      if (status.status === 'COMPLETED') {
        spin.succeed(`Task completed successfully`);
        
        // Get artifacts
        const artifacts = await orchestrator.getTaskArtifacts(taskId);
        
        // Ensure output directory exists
        if (!fs.existsSync(options.output)) {
          fs.mkdirSync(options.output, { recursive: true });
        }
        
        // Save artifacts
        for (const [name, content] of Object.entries(artifacts)) {
          const artifactPath = path.join(options.output, name);
          fs.writeFileSync(artifactPath, content);
        }
        
        console.log(chalk.green(`\nCode generated successfully in ${options.output}`));
      } else {
        spin.fail(`Task ${status.status.toLowerCase()}`);
        if (status.error) {
          console.error(chalk.red('Error:'), status.error);
        }
      }
    } catch (error) {
      spin.fail('Failed to generate code');
      logger.error('Generation error', error);
      console.error(chalk.red('Error:'), error.message);
    }
  });

// Get task status
program
  .command('status')
  .description('Check the status of a task')
  .argument('<task-id>', 'Task ID to check')
  .action(async (taskId) => {
    try {
      const status = await orchestrator.getTaskStatus(taskId);
      
      console.log(chalk.blue('Status:'), status.status);
      if (status.progress) {
        console.log(chalk.blue('Progress:'), `${status.progress}%`);
      }
      if (status.message) {
        console.log(chalk.blue('Message:'), status.message);
      }
      if (status.error) {
        console.log(chalk.red('Error:'), status.error);
      }
    } catch (error) {
      logger.error('Status check error', error);
      console.error(chalk.red('Error:'), error.message);
    }
  });

// Get task artifacts
program
  .command('artifacts')
  .description('Get artifacts from a completed task')
  .argument('<task-id>', 'Task ID to get artifacts from')
  .option('-o, --output <dir>', 'Output directory', './artifacts')
  .action(async (taskId, options) => {
    const spin = spinner.start('Retrieving artifacts...');

    try {
      // Get artifacts
      const artifacts = await orchestrator.getTaskArtifacts(taskId);
      
      // Ensure output directory exists
      if (!fs.existsSync(options.output)) {
        fs.mkdirSync(options.output, { recursive: true });
      }
      
      // Save artifacts
      for (const [name, content] of Object.entries(artifacts)) {
        const artifactPath = path.join(options.output, name);
        fs.writeFileSync(artifactPath, content);
      }
      
      spin.succeed('Artifacts retrieved successfully');
      console.log(chalk.green(`\nArtifacts saved to ${options.output}`));
    } catch (error) {
      spin.fail('Failed to retrieve artifacts');
      logger.error('Artifact retrieval error', error);
      console.error(chalk.red('Error:'), error.message);
    }
  });

// List active tasks
program
  .command('list')
  .description('List all active tasks')
  .action(async () => {
    try {
      const tasks = await orchestrator.listTasks();
      
      if (tasks.length === 0) {
        console.log('No active tasks found.');
        return;
      }
      
      console.log(chalk.blue('Active tasks:'));
      
      tasks.forEach(task => {
        console.log(
          chalk.green(`ID: ${task.id}`),
          chalk.blue(`Status: ${task.status}`),
          chalk.yellow(`Type: ${task.type}`),
          chalk.cyan(`Started: ${new Date(task.started_at).toLocaleString()}`)
        );
      });
    } catch (error) {
      logger.error('List tasks error', error);
      console.error(chalk.red('Error:'), error.message);
    }
  });

// Handle unrecognized commands
program.on('command:*', () => {
  console.error(chalk.red(`Invalid command: ${program.args.join(' ')}`));
  console.error('See --help for a list of available commands.');
  process.exit(1);
});

// Parse command line arguments
program.parse(process.argv);

// If no arguments provided, show help
if (process.argv.length === 2) {
  program.help();
} 
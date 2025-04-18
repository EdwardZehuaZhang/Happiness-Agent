#!/usr/bin/env node

/**
 * Minimal CLI implementation for Happiness Agent MVP
 */

const { program } = require('commander');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { v4: uuidv4 } = require('uuid');
const { MinimalOrchestratorClient } = require('../core/minimal-orchestrator');
const { logger, spinner, fileUtils } = require('../utils');

// Basic configuration for MVP
const config = {
  code_generator: {
    api_url: process.env.CODE_GEN_API_URL || 'http://localhost:3000/api'
  }
};

// Initialize minimal orchestrator client
const orchestrator = new MinimalOrchestratorClient(config);

program
  .name('happiness-mvp')
  .description('Happiness Agent MVP - Code Generation System')
  .version('0.1.0');

// Initialize a new project
program
  .command('init')
  .description('Initialize a new project')
  .option('-n, --name <name>', 'Project name')
  .action(async (options) => {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Project name:',
        default: options.name || path.basename(process.cwd()),
        when: !options.name
      }
    ]);

    const projectName = options.name || answers.name;
    const spin = spinner.start('Initializing project...');

    try {
      // Create minimal project structure
      if (!fs.existsSync('.happiness')) {
        fs.mkdirSync('.happiness');
        fs.mkdirSync('.happiness/generated', { recursive: true });
      }

      // Create basic project config
      const projectConfig = {
        name: projectName,
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
      console.log(chalk.cyan(`  happiness-mvp generate "Create a simple web app"`));
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
  .option('-l, --language <language>', 'Programming language (javascript, python)')
  .option('-o, --output <dir>', 'Output directory', '.happiness/generated')
  .action(async (prompt, options) => {
    // Check if in a Happiness project
    if (!fs.existsSync('.happiness')) {
      console.error(chalk.red('Error: Not in a Happiness project. Run `happiness-mvp init` first.'));
      process.exit(1);
    }

    const spin = spinner.start('Processing prompt...');

    try {
      // Generate code using the minimal orchestrator
      const taskId = await orchestrator.generateCode(prompt, {
        language: options.language
      });

      spin.text = `Generating code (Task ID: ${taskId})`;

      // Poll for status
      let isDone = false;
      let status = null;

      while (!isDone) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        status = await orchestrator.getTaskStatus(taskId);
        
        spin.text = `Status: ${status.status}`;
        
        if (['COMPLETED', 'FAILED'].includes(status.status)) {
          isDone = true;
        }
      }

      if (status.status === 'COMPLETED') {
        spin.succeed(`Code generation completed successfully`);
        
        // Get generated code
        const codeFiles = await orchestrator.getTaskArtifacts(taskId);
        
        // Create a directory for this generation
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputDir = path.join(options.output, `gen-${timestamp}`);
        
        fileUtils.ensureDir(outputDir);
        
        // Save code files
        for (const [filename, content] of Object.entries(codeFiles)) {
          const filePath = path.join(outputDir, filename);
          fileUtils.ensureDir(path.dirname(filePath));
          fs.writeFileSync(filePath, content);
        }
        
        console.log(chalk.green(`\nCode generated successfully in ${outputDir}`));
        console.log('\nFiles generated:');
        Object.keys(codeFiles).forEach(file => {
          console.log(`  - ${file}`);
        });
      } else {
        spin.fail(`Code generation failed`);
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

// List all generations
program
  .command('list')
  .description('List all code generations')
  .action(async () => {
    try {
      const tasks = await orchestrator.listTasks();
      
      if (tasks.length === 0) {
        console.log('No code generations found.');
        return;
      }
      
      console.log(chalk.blue('Code Generations:'));
      
      tasks.forEach(task => {
        const statusColor = task.status === 'COMPLETED' ? chalk.green : 
                           task.status === 'FAILED' ? chalk.red : chalk.yellow;
        
        console.log(
          chalk.cyan(`ID: ${task.id}`),
          statusColor(`Status: ${task.status}`),
          chalk.white(`Prompt: "${task.prompt}"`)
        );
      });
    } catch (error) {
      logger.error('List error', error);
      console.error(chalk.red('Error:'), error.message);
    }
  });

// Get status of a specific generation
program
  .command('status')
  .description('Check the status of a code generation')
  .argument('<task-id>', 'Task ID to check')
  .action(async (taskId) => {
    try {
      const status = await orchestrator.getTaskStatus(taskId);
      
      const statusColor = status.status === 'COMPLETED' ? chalk.green : 
                          status.status === 'FAILED' ? chalk.red : chalk.yellow;
      
      console.log(chalk.cyan('Task ID:'), status.id);
      console.log(statusColor('Status:'), status.status);
      console.log(chalk.white('Prompt:'), status.prompt);
      
      if (status.error) {
        console.log(chalk.red('Error:'), status.error);
      }
      
      console.log(chalk.blue('Started:'), new Date(status.started_at).toLocaleString());
      
      if (status.completed_at) {
        console.log(chalk.blue('Completed:'), new Date(status.completed_at).toLocaleString());
      }
    } catch (error) {
      logger.error('Status check error', error);
      console.error(chalk.red('Error:'), error.message);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// If no arguments provided, show help
if (process.argv.length === 2) {
  program.help();
} 
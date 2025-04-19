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
const { logger, spinner, fileUtils, configUtils } = require('../utils');

// Load the MVP configuration
const config = configUtils.loadConfig('mvp');

// Initialize minimal orchestrator client with the configuration
const orchestrator = new MinimalOrchestratorClient(config);

program
  .name('happiness-mvp')
  .description('Happiness Agent MVP - Code Generation System')
  .version(config.project.version || '0.1.0');

// Initialize a new project
program
  .command('init')
  .description('Initialize a new project')
  .option('-n, --name <n>', 'Project name')
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
      // Create project structure based on config
      const basePath = config.storage.base_path || '.happiness';
      const generationsPath = config.storage.generations_path || '.happiness/generated';
      
      fileUtils.ensureDir(basePath);
      fileUtils.ensureDir(generationsPath);
      fileUtils.ensureDir(path.join(basePath, 'logs'));

      // Create basic project config
      const projectConfig = {
        name: projectName,
        created_at: new Date().toISOString(),
        id: uuidv4(),
        version: config.project.version || '0.1.0',
        supported_languages: config.code_generator?.supported_languages || ['javascript', 'python']
      };

      // Save project config
      configUtils.saveProjectConfig(projectConfig);

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
  .option('-o, --output <dir>', 'Output directory')
  .action(async (prompt, options) => {
    // Check if in a Happiness project
    const projectConfig = configUtils.getProjectConfig();
    if (!projectConfig) {
      console.error(chalk.red('Error: Not in a Happiness project. Run `happiness-mvp init` first.'));
      process.exit(1);
    }

    // Validate language option if provided
    if (options.language && !config.code_generator.supported_languages.includes(options.language)) {
      console.error(chalk.red(`Error: Unsupported language: ${options.language}.`));
      console.log(`Supported languages: ${config.code_generator.supported_languages.join(', ')}`);
      process.exit(1);
    }

    const spin = spinner.start('Processing prompt...');

    try {
      // Set default output directory from config if not specified
      if (!options.output) {
        options.output = config.storage.generations_path;
      }

      // Generate code using the minimal orchestrator
      const taskId = await orchestrator.generateCode(prompt, {
        language: options.language,
        output: options.output
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
        
        console.log(chalk.green(`\nCode generated successfully in ${status.outputPath}`));
        console.log('\nFiles generated:');
        Object.keys(codeFiles).forEach(file => {
          console.log(`  - ${file}`);
        });

        // Print helpful next steps
        console.log('\nNext steps:');
        console.log(`  1. Navigate to the generated code: ${chalk.cyan(`cd ${status.outputPath}`)}`);
        
        if (Object.keys(codeFiles).includes('package.json')) {
          console.log(`  2. Install dependencies: ${chalk.cyan('npm install')}`);
          console.log(`  3. Run the application: ${chalk.cyan('npm start')}`);
        } else if (Object.keys(codeFiles).includes('requirements.txt')) {
          console.log(`  2. Create a virtual environment: ${chalk.cyan('python -m venv venv')}`);
          console.log(`  3. Activate the environment: ${chalk.cyan(process.platform === 'win32' ? 'venv\\Scripts\\activate' : 'source venv/bin/activate')}`);
          console.log(`  4. Install dependencies: ${chalk.cyan('pip install -r requirements.txt')}`);
          console.log(`  5. Run the application: ${chalk.cyan('python app.py')} or ${chalk.cyan('python main.py')}`);
        }
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
      // Check if in a Happiness project
      const projectConfig = configUtils.getProjectConfig();
      if (!projectConfig) {
        console.error(chalk.red('Error: Not in a Happiness project. Run `happiness-mvp init` first.'));
        process.exit(1);
      }

      const tasks = await orchestrator.listTasks();
      
      if (tasks.length === 0) {
        console.log('No code generations found.');
        return;
      }
      
      console.log(chalk.blue('Code Generations:'));
      
      tasks.forEach(task => {
        const statusColor = 
          task.status === 'COMPLETED' ? chalk.green : 
          task.status === 'FAILED' ? chalk.red : chalk.yellow;
        
        console.log(
          chalk.cyan(`ID: ${task.id}`),
          statusColor(`Status: ${task.status}`),
          task.outputPath ? chalk.white(`Path: ${task.outputPath}`) : '',
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
      // Check if in a Happiness project
      const projectConfig = configUtils.getProjectConfig();
      if (!projectConfig) {
        console.error(chalk.red('Error: Not in a Happiness project. Run `happiness-mvp init` first.'));
        process.exit(1);
      }

      const status = await orchestrator.getTaskStatus(taskId);
      
      const statusColor = 
        status.status === 'COMPLETED' ? chalk.green : 
        status.status === 'FAILED' ? chalk.red : chalk.yellow;
      
      console.log(chalk.cyan('Task ID:'), status.id);
      console.log(statusColor('Status:'), status.status);
      console.log(chalk.white('Prompt:'), status.prompt);
      
      if (status.outputPath) {
        console.log(chalk.blue('Output Path:'), status.outputPath);
      }
      
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
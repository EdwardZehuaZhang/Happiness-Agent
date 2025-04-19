#!/usr/bin/env node

/**
 * Utility script to scan and register existing code generations
 * 
 * This is useful when you have existing generations that weren't tracked
 * in the tasks.json file
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { logger, configUtils, fileUtils } = require('../utils');

// Load the MVP configuration
const config = configUtils.loadConfig('mvp');

// Path to generations
const basePath = config.storage?.base_path || '.happiness';
const generationsPath = config.storage?.generations_path || '.happiness/generated';
const tasksPath = path.join(basePath, 'tasks.json');

// Function to scan and register generations
async function scanAndRegisterGenerations() {
  console.log(`Scanning ${generationsPath} for existing generations...`);
  
  // Ensure base directory exists
  fileUtils.ensureDir(basePath);
  
  // Load existing tasks if any
  let tasks = [];
  if (fs.existsSync(tasksPath)) {
    try {
      tasks = JSON.parse(fs.readFileSync(tasksPath, 'utf-8'));
      console.log(`Loaded ${tasks.length} existing tasks.`);
    } catch (error) {
      console.error('Failed to load existing tasks', error);
    }
  }
  
  // Check if generations directory exists
  if (!fs.existsSync(generationsPath)) {
    console.log('Generations directory not found.');
    return;
  }
  
  // Get all generation directories
  const generationDirs = fs
    .readdirSync(generationsPath)
    .filter(name => name.startsWith('gen-'))
    .map(name => path.join(generationsPath, name));
  
  console.log(`Found ${generationDirs.length} generation directories.`);
  
  // Check for existing task IDs to avoid duplicates
  const existingPaths = tasks.map(task => task.outputPath);
  
  // For each generation directory, create a task record if it doesn't exist
  let newTasks = 0;
  for (const dir of generationDirs) {
    // Skip if already in tasks
    if (existingPaths.includes(dir)) {
      console.log(`Skipping already registered directory: ${dir}`);
      continue;
    }
    
    // Try to determine language and type from the files
    let language = 'unknown';
    let prompt = 'Unknown generated code';
    
    try {
      // Read README.md to extract original prompt
      const readmePath = path.join(dir, 'README.md');
      if (fs.existsSync(readmePath)) {
        const readmeContent = fs.readFileSync(readmePath, 'utf-8');
        
        // Try to extract the prompt from the README
        const promptMatch = readmeContent.match(/> ([^\n]+)/);
        if (promptMatch && promptMatch[1]) {
          prompt = promptMatch[1];
        }
        
        // Determine language
        if (readmeContent.includes('npm install')) {
          language = 'javascript';
        } else if (readmeContent.includes('pip install')) {
          language = 'python';
        }
      }
      
      // Use current date rather than trying to parse from the filename
      const now = new Date().toISOString();
      
      // Create a new task record
      const task = {
        id: uuidv4(),
        prompt: prompt,
        options: { language },
        status: 'COMPLETED',
        started_at: now,
        completed_at: now,
        outputPath: dir,
        results: {
          validation: { passed: true, issues: [] }
        }
      };
      
      // Add to tasks array
      tasks.push(task);
      newTasks++;
      
      console.log(`Registered generation: ${dir}`);
    } catch (error) {
      console.error(`Failed to register generation ${dir}:`, error);
    }
  }
  
  // Save updated tasks
  try {
    fs.writeFileSync(tasksPath, JSON.stringify(tasks, null, 2));
    console.log(`Successfully registered ${newTasks} new generations.`);
    console.log(`Total tasks: ${tasks.length}`);
  } catch (error) {
    console.error('Failed to save tasks', error);
  }
}

// Run the function
scanAndRegisterGenerations()
  .then(() => {
    console.log('Complete!');
  })
  .catch(error => {
    console.error('Error:', error);
  });
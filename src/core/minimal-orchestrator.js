/**
 * Minimal Orchestrator Client for MVP
 * 
 * Simplified orchestrator that focuses on core code generation workflow
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { logger, configUtils, fileUtils } = require('../utils');
const { Orchestrator, Task } = require('../interfaces/core');
const path = require('path');
const fs = require('fs');

class MinimalOrchestratorClient extends Orchestrator {
  /**
   * Initialize the minimal orchestrator client
   * @param {Object} customConfig - Optional custom configuration
   */
  constructor(customConfig = null) {
    super();
    // Load the MVP configuration
    this.config = customConfig || configUtils.loadConfig('mvp');
    this.tasks = new Map();
    this.codeGeneratorUrl = this.config.code_generator?.api_url || 'http://localhost:3000/api';
    this.apiKey = process.env[this.config.code_generator?.api_key_env] || 'demo-key';
    this.supportedLanguages = this.config.code_generator?.supported_languages || ['javascript', 'python'];
    
    // Load tasks from disk if available
    this.loadTasksFromDisk();
  }

  /**
   * Load tasks from disk
   */
  loadTasksFromDisk() {
    try {
      const basePath = this.config.storage?.base_path || '.happiness';
      const tasksPath = path.join(basePath, 'tasks.json');
      
      if (fs.existsSync(tasksPath)) {
        const tasksData = JSON.parse(fs.readFileSync(tasksPath, 'utf-8'));
        
        // Convert array back to Map
        if (Array.isArray(tasksData)) {
          tasksData.forEach(task => {
            this.tasks.set(task.id, task);
          });
        }
        
        logger.info(`Loaded ${this.tasks.size} tasks from disk.`);
      }
    } catch (error) {
      logger.error('Failed to load tasks from disk', error);
    }
  }

  /**
   * Save tasks to disk
   */
  saveTasksToDisk() {
    try {
      const basePath = this.config.storage?.base_path || '.happiness';
      const tasksPath = path.join(basePath, 'tasks.json');
      
      fileUtils.ensureDir(basePath);
      
      // Convert Map to array for serialization
      const tasksArray = Array.from(this.tasks.values());
      
      fs.writeFileSync(tasksPath, JSON.stringify(tasksArray, null, 2));
      logger.info(`Saved ${tasksArray.length} tasks to disk.`);
    } catch (error) {
      logger.error('Failed to save tasks to disk', error);
    }
  }

  /**
   * Generate code from a prompt
   * @param {string} prompt - The user's prompt
   * @param {Object} options - Additional options
   * @returns {string} Task ID for tracking the generation
   */
  async generateCode(prompt, options = {}) {
    const taskId = uuidv4();
    
    // Initialize the task using our Task interface
    const task = new Task(taskId, prompt, options);
    this.tasks.set(taskId, task);
    
    // Save tasks to disk immediately after creating a new one
    this.saveTasksToDisk();

    // Start the code generation asynchronously
    this.executeCodeGeneration(taskId, prompt, options).catch(error => {
      logger.error(`Code generation error for task ${taskId}`, error);
      
      const task = this.tasks.get(taskId);
      if (task) {
        task.status = 'FAILED';
        task.error = error.message;
        task.completed_at = new Date().toISOString();
        this.tasks.set(taskId, task);
        
        // Save tasks to disk after update
        this.saveTasksToDisk();
      }
    });

    return taskId;
  }

  /**
   * Execute code generation
   * @param {string} taskId - ID of the task
   * @param {string} prompt - The user's prompt
   * @param {Object} options - Additional options
   */
  async executeCodeGeneration(taskId, prompt, options) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Update task status
    task.status = 'RUNNING';
    this.tasks.set(taskId, task);
    this.saveTasksToDisk();

    try {
      // In a real implementation, this would call the code generator API
      // For MVP, we'll use a simpler approach with direct implementation or mock
      
      // Step 1: Generate code
      task.status = 'GENERATING_CODE';
      this.tasks.set(taskId, task);
      this.saveTasksToDisk();
      
      const generatedCode = await this.callCodeGenerator(prompt, options);
      
      // Step 2: Simple validation/testing if enabled in config
      if (this.config.validation?.enable_basic_testing) {
        task.status = 'VALIDATING';
        this.tasks.set(taskId, task);
        this.saveTasksToDisk();
        
        const validationResult = this.validateCode(generatedCode);
        task.results = {
          code: generatedCode,
          validation: validationResult
        };
      } else {
        task.results = {
          code: generatedCode,
          validation: { passed: true, issues: [] }
        };
      }
      
      // Step 3: Save artifacts if specified in config
      if (this.config.storage?.generations_path) {
        task.status = 'SAVING_ARTIFACTS';
        this.tasks.set(taskId, task);
        this.saveTasksToDisk();
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputDir = path.join(
          options.output || this.config.storage.generations_path,
          `gen-${timestamp}`
        );
        
        fileUtils.ensureDir(outputDir);
        
        // Save code files
        for (const [filename, content] of Object.entries(generatedCode)) {
          const filePath = path.join(outputDir, filename);
          fileUtils.ensureDir(path.dirname(filePath));
          fs.writeFileSync(filePath, content);
        }
        
        task.outputPath = outputDir;
      }
      
      task.status = 'COMPLETED';
      task.completed_at = new Date().toISOString();
      this.tasks.set(taskId, task);
      this.saveTasksToDisk();
      
    } catch (error) {
      logger.error(`Task execution error for task ${taskId}`, error);
      
      task.status = 'FAILED';
      task.error = error.message;
      task.completed_at = new Date().toISOString();
      this.tasks.set(taskId, task);
      this.saveTasksToDisk();
      throw error;
    }
  }

  /**
   * Call the code generator service
   * @param {string} prompt - The user's prompt
   * @param {Object} options - Additional options
   * @returns {Object} Generated code
   */
  async callCodeGenerator(prompt, options) {
    // For MVP, we can use a mock implementation
    // In production, this would call an actual API
    
    // Mock delay to simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Determine language based on options or detect from prompt
    const language = options.language || this.detectLanguage(prompt);
    
    // Generate code based on language
    switch (language) {
      case 'javascript':
        return this.generateJavaScriptCode(prompt);
      case 'python':
        return this.generatePythonCode(prompt);
      default:
        // Check if specified language is supported
        if (options.language && !this.supportedLanguages.includes(options.language)) {
          throw new Error(`Unsupported language: ${options.language}. Supported languages are: ${this.supportedLanguages.join(', ')}`);
        }
        return this.generateJavaScriptCode(prompt); // Default to JavaScript
    }
  }

  /**
   * Simple language detection from prompt
   * @param {string} prompt - The user's prompt
   * @returns {string} Detected language
   */
  detectLanguage(prompt) {
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('python') || lowerPrompt.includes('django') || lowerPrompt.includes('flask')) {
      return 'python';
    }
    
    if (lowerPrompt.includes('java') && !lowerPrompt.includes('javascript')) {
      return 'java';
    }
    
    // Default to JavaScript
    return 'javascript';
  }

  /**
   * Generate JavaScript code from prompt
   * @param {string} prompt - The user's prompt
   * @returns {Object} Generated code files
   */
  generateJavaScriptCode(prompt) {
    // Very basic implementation for MVP
    // In production, this would use a more sophisticated approach
    
    const isNodeBackend = prompt.toLowerCase().includes('api') || 
                          prompt.toLowerCase().includes('server') ||
                          prompt.toLowerCase().includes('backend');
    
    const isReactFrontend = prompt.toLowerCase().includes('react') ||
                             prompt.toLowerCase().includes('frontend') ||
                             prompt.toLowerCase().includes('ui');
    
    const files = {};
    
    if (isNodeBackend) {
      files['server.js'] = `
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Simple in-memory data store
const items = [];

// GET all items
app.get('/api/items', (req, res) => {
  res.json(items);
});

// GET item by id
app.get('/api/items/:id', (req, res) => {
  const item = items.find(i => i.id === parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
});

// POST new item
app.post('/api/items', (req, res) => {
  const item = {
    id: items.length + 1,
    name: req.body.name,
    created: new Date()
  };
  items.push(item);
  res.status(201).json(item);
});

// DELETE item
app.delete('/api/items/:id', (req, res) => {
  const index = items.findIndex(i => i.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'Item not found' });
  items.splice(index, 1);
  res.status(204).send();
});

app.listen(port, () => {
  console.log(\`Server running on port \${port}\`);
});
      `;
      
      files['package.json'] = `{
  "name": "api-server",
  "version": "1.0.0",
  "description": "API Server generated by Happiness Agent",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.17.1"
  },
  "devDependencies": {
    "jest": "^27.0.6",
    "nodemon": "^2.0.12"
  }
}`;
    }
    
    if (isReactFrontend) {
      files['App.js'] = `
import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newItemName, setNewItemName] = useState('');

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/items');
      const data = await response.json();
      setItems(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching items:', error);
      setLoading(false);
    }
  };

  const addItem = async (e) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    
    try {
      const response = await fetch('/api/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newItemName }),
      });
      
      const newItem = await response.json();
      setItems([...items, newItem]);
      setNewItemName('');
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  const deleteItem = async (id) => {
    try {
      await fetch(\`/api/items/\${id}\`, {
        method: 'DELETE',
      });
      
      setItems(items.filter(item => item.id !== id));
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Item Manager</h1>
      </header>
      <main>
        <form onSubmit={addItem}>
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="Enter item name"
            required
          />
          <button type="submit">Add Item</button>
        </form>
        
        {loading ? (
          <p>Loading...</p>
        ) : (
          <ul>
            {items.length === 0 ? (
              <p>No items found.</p>
            ) : (
              items.map(item => (
                <li key={item.id}>
                  {item.name}
                  <button onClick={() => deleteItem(item.id)}>Delete</button>
                </li>
              ))
            )}
          </ul>
        )}
      </main>
    </div>
  );
}

export default App;
      `;
      
      files['App.css'] = `
.App {
  text-align: center;
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.App-header {
  background-color: #282c34;
  padding: 20px;
  color: white;
  margin-bottom: 20px;
}

form {
  margin-bottom: 20px;
  display: flex;
  justify-content: center;
}

input {
  padding: 10px;
  font-size: 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-right: 10px;
  flex-grow: 1;
  max-width: 300px;
}

button {
  padding: 10px 15px;
  background-color: #61dafb;
  color: black;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

button:hover {
  background-color: #21a1cb;
}

ul {
  list-style-type: none;
  padding: 0;
}

li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  margin-bottom: 10px;
  background-color: #f5f5f5;
  border-radius: 4px;
}
      `;
    }
    
    // Add a README.md regardless of project type
    files['README.md'] = `# Project Generated by Happiness Agent

This project was automatically generated based on your prompt:

> ${prompt}

## Getting Started

1. Install dependencies:
   \`\`\`
   npm install
   \`\`\`

2. Run the project:
   \`\`\`
   npm start
   \`\`\`

## Project Structure

${Object.keys(files).map(file => `- ${file}`).join('\n')}

## Next Steps

1. Review the generated code
2. Add additional features as needed
3. Write tests for your application
4. Deploy your application
    `;
    
    return files;
  }

  /**
   * Generate Python code from prompt
   * @param {string} prompt - The user's prompt
   * @returns {Object} Generated code files
   */
  generatePythonCode(prompt) {
    // Basic Python code generation for MVP
    
    const isFlask = prompt.toLowerCase().includes('flask') || 
                    prompt.toLowerCase().includes('web') ||
                    prompt.toLowerCase().includes('api');
    
    const isDataScience = prompt.toLowerCase().includes('data') ||
                           prompt.toLowerCase().includes('analysis') ||
                           prompt.toLowerCase().includes('machine learning');
    
    const files = {};
    
    if (isFlask) {
      files['app.py'] = `
from flask import Flask, request, jsonify
import json
from datetime import datetime

app = Flask(__name__)

# Simple in-memory data store
items = []

@app.route('/api/items', methods=['GET'])
def get_items():
    return jsonify(items)

@app.route('/api/items/<int:item_id>', methods=['GET'])
def get_item(item_id):
    item = next((i for i in items if i['id'] == item_id), None)
    if item is None:
        return jsonify({'error': 'Item not found'}), 404
    return jsonify(item)

@app.route('/api/items', methods=['POST'])
def create_item():
    data = request.get_json()
    item = {
        'id': len(items) + 1,
        'name': data.get('name'),
        'created': datetime.now().isoformat()
    }
    items.append(item)
    return jsonify(item), 201

@app.route('/api/items/<int:item_id>', methods=['DELETE'])
def delete_item(item_id):
    global items
    initial_length = len(items)
    items = [i for i in items if i['id'] != item_id]
    
    if len(items) == initial_length:
        return jsonify({'error': 'Item not found'}), 404
    
    return '', 204

if __name__ == '__main__':
    app.run(debug=True)
      `;
      
      files['requirements.txt'] = `
Flask==2.0.1
pytest==6.2.5
      `;
    }
    
    if (isDataScience) {
      files['analysis.py'] = `
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error, r2_score

# Load data (sample code)
def load_data(file_path):
    print(f"Loading data from {file_path}")
    # In a real application, you would load your data here
    # For demo purposes, we'll create a synthetic dataset
    np.random.seed(42)
    n_samples = 100
    x = np.linspace(0, 10, n_samples)
    y = 2 * x + 1 + np.random.normal(0, 1, n_samples)
    
    df = pd.DataFrame({
        'feature': x,
        'target': y
    })
    return df

# Perform basic data analysis
def analyze_data(df):
    print("Performing data analysis")
    print("\\nData Sample:")
    print(df.head())
    
    print("\\nBasic Statistics:")
    print(df.describe())
    
    print("\\nChecking for missing values:")
    print(df.isnull().sum())
    
    # Basic visualization
    plt.figure(figsize=(10, 6))
    plt.scatter(df['feature'], df['target'])
    plt.title('Feature vs Target')
    plt.xlabel('Feature')
    plt.ylabel('Target')
    plt.savefig('feature_target_scatter.png')
    print("Scatter plot saved as 'feature_target_scatter.png'")
    
    return df

# Train a simple model
def train_model(df):
    print("Training model")
    X = df[['feature']]
    y = df['target']
    
    # Split the data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    # Train a linear regression model
    model = LinearRegression()
    model.fit(X_train, y_train)
    
    # Make predictions
    y_pred = model.predict(X_test)
    
    # Evaluate the model
    mse = mean_squared_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    
    print(f"Model Results:")
    print(f"  Coefficient: {model.coef_[0]:.4f}")
    print(f"  Intercept: {model.intercept_:.4f}")
    print(f"  Mean Squared Error: {mse:.4f}")
    print(f"  R² Score: {r2:.4f}")
    
    return model

# Main function
def main():
    print("Starting data analysis")
    df = load_data('data.csv')
    df = analyze_data(df)
    model = train_model(df)
    print("Analysis complete")

if __name__ == '__main__':
    main()
      `;
      
      files['requirements.txt'] = `
pandas==1.3.3
matplotlib==3.4.3
numpy==1.21.2
scikit-learn==1.0
      `;
    }
    
    // Add a README.md regardless of project type
    files['README.md'] = `# Python Project Generated by Happiness Agent

This project was automatically generated based on your prompt:

> ${prompt}

## Getting Started

1. Create a virtual environment:
   \`\`\`
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\\Scripts\\activate
   \`\`\`

2. Install dependencies:
   \`\`\`
   pip install -r requirements.txt
   \`\`\`

3. Run the project:
   \`\`\`
   python ${isFlask ? 'app.py' : 'analysis.py'}
   \`\`\`

## Project Structure

${Object.keys(files).map(file => `- ${file}`).join('\n')}

## Next Steps

1. Review the generated code
2. Add additional features as needed
3. Write tests for your application
4. Deploy your application
    `;
    
    return files;
  }

  /**
   * Simple code validation
   * @param {Object} codeFiles - Generated code files
   * @returns {Object} Validation results
   */
  validateCode(codeFiles) {
    // For MVP, this is a very basic validation
    // In production, this would be more sophisticated
    
    const results = {
      passed: true,
      issues: []
    };
    
    // Check if at least one file was generated
    if (Object.keys(codeFiles).length === 0) {
      results.passed = false;
      results.issues.push({
        type: 'error',
        message: 'No code files were generated'
      });
    }
    
    // Check if README exists
    if (!codeFiles['README.md']) {
      results.issues.push({
        type: 'warning',
        message: 'README.md file is missing'
      });
    }
    
    // Basic package.json validation for JavaScript projects
    if (codeFiles['package.json']) {
      try {
        const packageJson = JSON.parse(codeFiles['package.json']);
        
        if (!packageJson.name) {
          results.issues.push({
            type: 'warning',
            message: 'package.json is missing a name field'
          });
        }
        
        if (!packageJson.main) {
          results.issues.push({
            type: 'warning',
            message: 'package.json is missing a main field'
          });
        }
      } catch (error) {
        results.passed = false;
        results.issues.push({
          type: 'error',
          message: 'Invalid package.json: ' + error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Get the status of a task
   * @param {string} taskId - ID of the task
   * @returns {Object} Task status
   */
  async getTaskStatus(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    
    return {
      id: task.id,
      status: task.status,
      prompt: task.prompt,
      error: task.error,
      started_at: task.started_at,
      completed_at: task.completed_at,
      outputPath: task.outputPath
    };
  }

  /**
   * Get task artifacts (generated code)
   * @param {string} taskId - ID of the task
   * @returns {Object} Task artifacts
   */
  async getTaskArtifacts(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    
    if (task.status !== 'COMPLETED') {
      throw new Error(`Task ${taskId} is not completed (status: ${task.status})`);
    }
    
    return task.results.code;
  }

  /**
   * List all tasks
   * @returns {Array} List of tasks
   */
  async listTasks() {
    return Array.from(this.tasks.values()).map(task => ({
      id: task.id,
      status: task.status,
      prompt: task.prompt.substring(0, 50) + (task.prompt.length > 50 ? '...' : ''),
      started_at: task.started_at,
      completed_at: task.completed_at,
      outputPath: task.outputPath
    }));
  }
}

module.exports = { MinimalOrchestratorClient };
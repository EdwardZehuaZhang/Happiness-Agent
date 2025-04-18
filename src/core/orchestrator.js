/**
 * Orchestrator Client
 * 
 * Manages communication with the agent network and orchestrates workflows
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils');

class OrchestratorClient {
  /**
   * Initialize the orchestrator client
   * @param {Object} agentConfig - Configuration for agent connections
   */
  constructor(agentConfig) {
    this.agents = agentConfig;
    this.tasks = new Map();
    this.workflows = {};
    this.loadWorkflows();
  }

  /**
   * Load workflow definitions
   */
  loadWorkflows() {
    try {
      // In a real implementation, this would load from config or API
      this.workflows = {
        full_cycle: {
          steps: [
            {
              name: 'analyze_requirements',
              agent: 'consultant',
              action: 'analyze_prompt',
              inputs: params => ({
                user_prompt: params.user_prompt
              }),
              outputMapping: result => ({
                scope_definition: result.scope_definition
              })
            },
            {
              name: 'decompose_tasks',
              agent: 'pm',
              action: 'create_task_plan',
              inputs: (params, prevResults) => ({
                scope_definition: prevResults.analyze_requirements.scope_definition
              }),
              outputMapping: result => ({
                task_plan: result.task_plan
              })
            },
            {
              name: 'generate_code',
              agent: 'code_generator',
              action: 'generate_module',
              inputs: (params, prevResults) => ({
                task_plan: prevResults.decompose_tasks.task_plan
              }),
              outputMapping: result => ({
                generated_code: result.generated_code
              })
            },
            {
              name: 'run_tests',
              agent: 'test_runner',
              action: 'test_module',
              inputs: (params, prevResults) => ({
                code_path: prevResults.generate_code.generated_code
              }),
              outputMapping: result => ({
                test_results: result.test_results
              })
            },
            {
              name: 'lint_code',
              agent: 'linter',
              action: 'lint_code',
              inputs: (params, prevResults) => ({
                code_path: prevResults.generate_code.generated_code
              }),
              outputMapping: result => ({
                lint_results: result.lint_results
              })
            },
            {
              name: 'analyze_errors',
              agent: 'error_analyzer',
              action: 'analyze_issues',
              inputs: (params, prevResults) => ({
                test_results: prevResults.run_tests.test_results,
                lint_results: prevResults.lint_code.lint_results
              }),
              outputMapping: result => ({
                error_analysis: result.error_analysis
              }),
              condition: (prevResults) => {
                // Check if there are any errors to analyze
                const testResults = prevResults.run_tests.test_results;
                const lintResults = prevResults.lint_code.lint_results;
                return testResults.failures > 0 || lintResults.issues.length > 0;
              }
            },
            {
              name: 'refine_code',
              agent: 'code_generator',
              action: 'refine_code',
              inputs: (params, prevResults) => ({
                code_path: prevResults.generate_code.generated_code,
                error_analysis: prevResults.analyze_errors.error_analysis
              }),
              outputMapping: result => ({
                refined_code: result.refined_code
              }),
              condition: (prevResults) => {
                // Only run if we analyzed errors
                return prevResults.analyze_errors && prevResults.analyze_errors.error_analysis;
              }
            }
          ]
        }
      };
    } catch (error) {
      logger.error('Failed to load workflows', error);
      throw new Error('Failed to load workflow definitions');
    }
  }

  /**
   * Start a workflow execution
   * @param {string} workflowName - Name of the workflow to execute
   * @param {Object} params - Input parameters for the workflow
   * @returns {string} Task ID for the workflow execution
   */
  async startWorkflow(workflowName, params) {
    if (!this.workflows[workflowName]) {
      throw new Error(`Workflow "${workflowName}" not found`);
    }

    const workflow = this.workflows[workflowName];
    const taskId = uuidv4();
    
    // Initialize the task state
    this.tasks.set(taskId, {
      id: taskId,
      type: workflowName,
      status: 'PENDING',
      params,
      steps: workflow.steps.map(step => ({
        name: step.name,
        status: 'PENDING',
        result: null
      })),
      results: {},
      started_at: new Date().toISOString()
    });

    // Start the workflow execution asynchronously
    this.executeWorkflow(taskId, workflow, params).catch(error => {
      logger.error(`Workflow execution error for task ${taskId}`, error);
      
      const task = this.tasks.get(taskId);
      if (task) {
        task.status = 'FAILED';
        task.error = error.message;
        this.tasks.set(taskId, task);
      }
    });

    return taskId;
  }

  /**
   * Execute a workflow
   * @param {string} taskId - ID of the task
   * @param {Object} workflow - Workflow definition
   * @param {Object} params - Input parameters
   */
  async executeWorkflow(taskId, workflow, params) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Update task status
    task.status = 'RUNNING';
    this.tasks.set(taskId, task);

    // Execute each step in the workflow
    const stepResults = {};
    
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      const taskStep = task.steps[i];
      
      // Check if this step should be executed based on condition
      if (step.condition && !step.condition(stepResults)) {
        taskStep.status = 'SKIPPED';
        continue;
      }
      
      // Update step status
      taskStep.status = 'RUNNING';
      this.tasks.set(taskId, task);
      
      try {
        // Prepare inputs for this step
        const inputs = typeof step.inputs === 'function'
          ? step.inputs(params, stepResults)
          : step.inputs;
        
        // Execute the step
        const result = await this.executeStep(step.agent, step.action, inputs);
        
        // Process the result
        const mappedResult = step.outputMapping ? step.outputMapping(result) : result;
        
        // Store the result
        stepResults[step.name] = mappedResult;
        taskStep.result = mappedResult;
        taskStep.status = 'COMPLETED';
        
        // Update task state
        task.results = { ...task.results, ...mappedResult };
        this.tasks.set(taskId, task);
        
      } catch (error) {
        logger.error(`Step execution error for task ${taskId}, step ${step.name}`, error);
        
        taskStep.status = 'FAILED';
        taskStep.error = error.message;
        task.status = 'FAILED';
        task.error = `Failed to execute step ${step.name}: ${error.message}`;
        
        this.tasks.set(taskId, task);
        return;
      }
    }
    
    // All steps completed successfully
    task.status = 'COMPLETED';
    task.completed_at = new Date().toISOString();
    this.tasks.set(taskId, task);
  }

  /**
   * Execute a single step using an agent
   * @param {string} agentName - Name of the agent to use
   * @param {string} action - Action to execute
   * @param {Object} inputs - Input parameters
   * @returns {Object} Result from the agent
   */
  async executeStep(agentName, action, inputs) {
    // In a real implementation, this would call the agent's API
    // For now, we'll simulate the agent's response
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // For demo purposes, generate mock responses
    // In a real implementation, this would call the actual agent APIs
    switch (`${agentName}:${action}`) {
      case 'consultant:analyze_prompt':
        return {
          scope_definition: {
            name: 'Sample Module',
            features: ['Feature 1', 'Feature 2'],
            requirements: ['Req 1', 'Req 2']
          }
        };
        
      case 'pm:create_task_plan':
        return {
          task_plan: {
            tasks: [
              { id: 1, name: 'Task 1', description: 'Implement feature 1' },
              { id: 2, name: 'Task 2', description: 'Implement feature 2' }
            ],
            dependencies: [[1, 2]]
          }
        };
        
      case 'code_generator:generate_module':
        return {
          generated_code: 'generated/sample_module'
        };
        
      case 'test_runner:test_module':
        return {
          test_results: {
            total: 5,
            passed: 4,
            failures: 1,
            tests: [
              { name: 'Test 1', status: 'PASSED' },
              { name: 'Test 2', status: 'PASSED' },
              { name: 'Test 3', status: 'FAILED', error: 'Expected 3, got 4' },
              { name: 'Test 4', status: 'PASSED' },
              { name: 'Test 5', status: 'PASSED' }
            ]
          }
        };
        
      case 'linter:lint_code':
        return {
          lint_results: {
            issues: [
              { type: 'warning', location: 'file.js:10', message: 'Unused variable' },
              { type: 'error', location: 'file.js:15', message: 'Missing semicolon' }
            ]
          }
        };
        
      case 'error_analyzer:analyze_issues':
        return {
          error_analysis: {
            issues: [
              {
                type: 'test_failure',
                location: 'module.js:25',
                description: 'Incorrect calculation',
                suggested_fix: 'Change + to *'
              },
              {
                type: 'lint_error',
                location: 'module.js:15',
                description: 'Missing semicolon',
                suggested_fix: 'Add semicolon'
              }
            ],
            summary: 'Minor issues found'
          }
        };
        
      case 'code_generator:refine_code':
        return {
          refined_code: 'refined/sample_module'
        };
        
      default:
        throw new Error(`Unknown agent action: ${agentName}:${action}`);
    }
  }

  /**
   * Get the status of a task
   * @param {string} taskId - ID of the task
   * @returns {Object} Task status information
   */
  async getTaskStatus(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    
    // Calculate progress
    const totalSteps = task.steps.length;
    const completedSteps = task.steps.filter(s => 
      s.status === 'COMPLETED' || s.status === 'SKIPPED'
    ).length;
    
    const progress = Math.floor((completedSteps / totalSteps) * 100);
    
    return {
      id: task.id,
      status: task.status,
      progress,
      error: task.error,
      started_at: task.started_at,
      completed_at: task.completed_at,
      message: this.getStatusMessage(task)
    };
  }

  /**
   * Get a human-readable status message
   * @param {Object} task - Task object
   * @returns {string} Status message
   */
  getStatusMessage(task) {
    switch (task.status) {
      case 'PENDING':
        return 'Task is queued and waiting to start';
        
      case 'RUNNING':
        const currentStep = task.steps.find(s => s.status === 'RUNNING');
        return currentStep 
          ? `Executing step: ${currentStep.name}` 
          : 'Task is running';
        
      case 'COMPLETED':
        return 'Task completed successfully';
        
      case 'FAILED':
        return task.error || 'Task failed';
        
      case 'CANCELLED':
        return 'Task was cancelled';
        
      default:
        return 'Unknown status';
    }
  }

  /**
   * Get artifacts produced by a task
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
    
    // In a real implementation, this would retrieve actual artifacts
    // For now, we'll return mock artifacts
    
    return {
      'results.json': JSON.stringify(task.results, null, 2),
      'example.js': 'console.log("Hello from the generated code!");',
      'README.md': `# Generated Module\n\nThis module was generated by Happiness Agent.`
    };
  }

  /**
   * List all active tasks
   * @returns {Array} List of tasks
   */
  async listTasks() {
    return Array.from(this.tasks.values())
      .filter(task => ['PENDING', 'RUNNING'].includes(task.status))
      .map(task => ({
        id: task.id,
        type: task.type,
        status: task.status,
        started_at: task.started_at
      }));
  }

  /**
   * Cancel a running task
   * @param {string} taskId - ID of the task to cancel
   * @returns {boolean} Success status
   */
  async cancelTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    
    if (task.status !== 'RUNNING' && task.status !== 'PENDING') {
      throw new Error(`Task ${taskId} cannot be cancelled (status: ${task.status})`);
    }
    
    task.status = 'CANCELLED';
    task.completed_at = new Date().toISOString();
    this.tasks.set(taskId, task);
    
    return true;
  }
}

module.exports = { OrchestratorClient }; 
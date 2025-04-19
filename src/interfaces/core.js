/**
 * Core interfaces for Happiness Agent MVP
 * 
 * This file defines the essential interfaces for components in the MVP version
 */

/**
 * Task interface represents a code generation task
 */
class Task {
  /**
   * Create a new task
   * @param {string} id - Unique identifier for the task
   * @param {string} prompt - User prompt for code generation
   * @param {Object} options - Additional options
   */
  constructor(id, prompt, options = {}) {
    this.id = id;
    this.prompt = prompt;
    this.options = options;
    this.status = 'PENDING';
    this.started_at = new Date().toISOString();
    this.completed_at = null;
    this.error = null;
    this.results = null;
  }
}

/**
 * CodeGenerator interface for generating code from prompts
 */
class CodeGenerator {
  /**
   * Generate code from a prompt
   * @param {string} prompt - User prompt for code generation
   * @param {Object} options - Additional options (language, etc.)
   * @returns {Promise<Object>} Generated code files
   */
  async generateCode(prompt, options) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Detect programming language from prompt
   * @param {string} prompt - User prompt
   * @returns {string} Detected language
   */
  detectLanguage(prompt) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Validate generated code
   * @param {Object} code - Generated code files
   * @returns {Object} Validation results
   */
  validateCode(code) {
    throw new Error('Method not implemented');
  }
}

/**
 * Orchestrator interface for managing the code generation workflow
 */
class Orchestrator {
  /**
   * Generate code from a prompt
   * @param {string} prompt - User prompt
   * @param {Object} options - Additional options
   * @returns {Promise<string>} Task ID
   */
  async generateCode(prompt, options) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Get the status of a task
   * @param {string} taskId - Task ID
   * @returns {Promise<Object>} Task status
   */
  async getTaskStatus(taskId) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Get the artifacts (generated code) of a completed task
   * @param {string} taskId - Task ID
   * @returns {Promise<Object>} Generated code files
   */
  async getTaskArtifacts(taskId) {
    throw new Error('Method not implemented');
  }
  
  /**
   * List all tasks
   * @returns {Promise<Array>} List of tasks
   */
  async listTasks() {
    throw new Error('Method not implemented');
  }
}

/**
 * Storage interface for managing generated code artifacts
 */
class ArtifactStorage {
  /**
   * Save artifacts to storage
   * @param {string} taskId - Task ID
   * @param {Object} artifacts - Artifacts to save
   * @returns {Promise<string>} Storage path
   */
  async saveArtifacts(taskId, artifacts) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Get artifacts from storage
   * @param {string} taskId - Task ID
   * @returns {Promise<Object>} Retrieved artifacts
   */
  async getArtifacts(taskId) {
    throw new Error('Method not implemented');
  }
  
  /**
   * List all artifacts
   * @returns {Promise<Array>} List of artifacts
   */
  async listArtifacts() {
    throw new Error('Method not implemented');
  }
}

module.exports = {
  Task,
  CodeGenerator,
  Orchestrator,
  ArtifactStorage
};
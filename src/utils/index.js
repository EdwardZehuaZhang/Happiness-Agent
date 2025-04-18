/**
 * Utility functions for the Happiness Agent
 */

const winston = require('winston');
const ora = require('ora');
const fs = require('fs');
const path = require('path');

/**
 * Logger utility
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'happiness-agent' },
  transports: [
    // Write logs to file
    new winston.transports.File({ 
      filename: path.join(
        process.env.LOG_PATH || (fs.existsSync('.happiness') ? '.happiness/logs' : '.'),
        'error.log'
      ), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(
        process.env.LOG_PATH || (fs.existsSync('.happiness') ? '.happiness/logs' : '.'),
        'combined.log'
      )
    })
  ]
});

// If we're not in production, log to the console as well
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

/**
 * Spinner utility for CLI
 */
const spinner = {
  /**
   * Start a spinner with the given text
   * @param {string} text - Text to display
   * @returns {Object} Ora spinner instance
   */
  start: (text) => {
    return ora(text).start();
  },
  
  /**
   * Create a new spinner but don't start it
   * @param {string} text - Text to display
   * @returns {Object} Ora spinner instance
   */
  create: (text) => {
    return ora(text);
  }
};

/**
 * File utilities
 */
const fileUtils = {
  /**
   * Ensure a directory exists
   * @param {string} dir - Directory path
   */
  ensureDir: (dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  },
  
  /**
   * Write JSON to a file
   * @param {string} filePath - File path
   * @param {Object} data - Data to write
   */
  writeJSON: (filePath, data) => {
    fileUtils.ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  },
  
  /**
   * Read JSON from a file
   * @param {string} filePath - File path
   * @returns {Object} Parsed JSON data
   */
  readJSON: (filePath) => {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  }
};

/**
 * Time utilities
 */
const timeUtils = {
  /**
   * Sleep for the specified time
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Promise that resolves after the specified time
   */
  sleep: (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  
  /**
   * Format a date
   * @param {string|Date} date - Date to format
   * @returns {string} Formatted date
   */
  formatDate: (date) => {
    const d = new Date(date);
    return d.toLocaleString();
  }
};

/**
 * Format utilities
 */
const formatUtils = {
  /**
   * Format bytes to a human-readable string
   * @param {number} bytes - Bytes to format
   * @param {number} decimals - Number of decimal places
   * @returns {string} Formatted string
   */
  formatBytes: (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  },
  
  /**
   * Format milliseconds to a human-readable string
   * @param {number} ms - Milliseconds to format
   * @returns {string} Formatted string
   */
  formatTime: (ms) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(1);
    
    return `${minutes}m ${seconds}s`;
  }
};

/**
 * Validation utilities
 */
const validationUtils = {
  /**
   * Check if a string is a valid UUID
   * @param {string} uuid - UUID to validate
   * @returns {boolean} Whether the UUID is valid
   */
  isValidUUID: (uuid) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  },
  
  /**
   * Check if a value is a non-empty string
   * @param {any} value - Value to check
   * @returns {boolean} Whether the value is a non-empty string
   */
  isNonEmptyString: (value) => {
    return typeof value === 'string' && value.trim().length > 0;
  }
};

module.exports = {
  logger,
  spinner,
  fileUtils,
  timeUtils,
  formatUtils,
  validationUtils
}; 
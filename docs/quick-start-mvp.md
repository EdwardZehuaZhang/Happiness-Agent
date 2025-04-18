# Happiness Agent MVP Quick Start Guide

This guide will help you get started with the MVP version of Happiness Agent, which focuses on essential code generation functionality.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/happiness-ai/happiness-agent.git
   cd happiness-agent
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Link the CLI for local development:
   ```bash
   npm link
   ```

## Basic Usage

The MVP version provides a simplified CLI with core functionality:

### Initialize a Project

```bash
happiness-mvp init --name my-project
```

This creates a `.happiness` directory with basic configuration.

### Generate Code from a Prompt

```bash
happiness-mvp generate "Create a REST API for a todo list using Express"
```

For Python code:
```bash
happiness-mvp generate "Create a Flask API for a todo list" --language python
```

The generated code will be stored in `.happiness/generated/gen-[timestamp]`.

### List All Generations

```bash
happiness-mvp list
```

This will show all code generations with their status.

### Check Status of a Generation

```bash
happiness-mvp status [task-id]
```

Replace `[task-id]` with the ID shown when you ran the generate command.

## Example Workflows

### Creating a Node.js REST API

1. Initialize a project:
   ```bash
   happiness-mvp init --name todo-api
   ```

2. Generate the API code:
   ```bash
   happiness-mvp generate "Create a REST API for a todo list with the following features:
   - Add, update, delete todos
   - Mark todos as complete
   - Filter todos by status"
   ```

3. Navigate to the generated code:
   ```bash
   cd .happiness/generated/gen-[timestamp]
   ```

4. Install dependencies and run the server:
   ```bash
   npm install
   npm start
   ```

### Creating a Python Data Analysis Script

1. Initialize a project:
   ```bash
   happiness-mvp init --name data-analysis
   ```

2. Generate the analysis code:
   ```bash
   happiness-mvp generate "Create a Python script to analyze a dataset of housing prices, showing correlations between price and square footage" --language python
   ```

3. Navigate to the generated code:
   ```bash
   cd .happiness/generated/gen-[timestamp]
   ```

4. Create a virtual environment and run the script:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   python analysis.py
   ```

## Supported Languages and Project Types

The MVP version supports:

### JavaScript/Node.js
- Express REST APIs
- React frontends

### Python
- Flask web applications
- Data analysis scripts

## Limitations

The MVP version has these limitations:

1. Limited language support (JavaScript and Python)
2. Basic code generation without advanced customization
3. No persistent storage for generated code (stored locally only)
4. Simple testing and validation
5. No multi-agent workflow (uses single code generator)

For more advanced features, check the full version documentation. 
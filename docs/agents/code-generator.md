# Code Generator Agent

## Overview

The Code Generator Agent is responsible for transforming task plans into working code. It specializes in generating code across multiple programming languages and frameworks based on specifications.

## Capabilities

- Generate complete modules based on task specifications
- Refine code based on error analysis feedback
- Add tests for newly generated code
- Support multiple programming languages and frameworks
- Adapt to project-specific coding standards

## Agent API

### Endpoints

#### Generate Module

```
POST /api/tasks/generate_module
```

**Request Body:**
```json
{
  "task_plan": {
    "module_name": "string",
    "description": "string",
    "requirements": ["string"],
    "language": "string",
    "framework": "string",
    "dependencies": ["string"]
  }
}
```

**Response:**
```json
{
  "task_id": "string",
  "status": "string",
  "artifacts": {
    "generated_code": "string"
  }
}
```

#### Refine Code

```
POST /api/tasks/refine_code
```

**Request Body:**
```json
{
  "code_path": "string",
  "error_analysis": {
    "issues": [
      {
        "type": "string",
        "location": "string",
        "description": "string",
        "suggested_fix": "string"
      }
    ]
  }
}
```

**Response:**
```json
{
  "task_id": "string",
  "status": "string",
  "artifacts": {
    "refined_code": "string"
  }
}
```

## Configuration

The Code Generator Agent requires the following configuration:

```json
{
  "code_generator": {
    "agent_card_url": "https://agent-code-gen.happiness-ai.com/.well-known/agent.json",
    "auth_type": "Bearer",
    "token_env": "CODE_GEN_API_TOKEN",
    "timeout_ms": 60000,
    "supported_languages": [
      "javascript",
      "typescript",
      "python",
      "java",
      "go",
      "rust"
    ],
    "supported_frameworks": [
      "react",
      "angular",
      "vue",
      "express",
      "fastapi",
      "spring",
      "gin"
    ]
  }
}
```

## Prompting Strategies

For optimal code generation, structure your task plans with:

1. **Clear Requirements**: Explicit functional requirements
2. **Architecture Guidelines**: High-level design patterns to follow
3. **Dependencies**: External libraries and frameworks
4. **Code Style**: Preferred coding conventions
5. **Error Handling**: Expected error scenarios

Example prompt template:

```
Generate a [language] module using [framework] that implements:

- Functionality: [detailed description]
- API Endpoints: [list of endpoints with methods]
- Data Models: [data structure definitions]
- Error Handling: [error scenarios to handle]

The code should follow [style guide] conventions and include appropriate tests.
```

## Error Handling

The agent handles the following error scenarios:

- **Invalid Task Plan**: Returns detailed validation errors
- **Unsupported Language/Framework**: Lists supported options
- **Timeout**: Generates partial code with completion suggestions
- **Authentication Failure**: Returns clear auth requirements 
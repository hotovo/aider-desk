# Changelog

## [0.5.0]

- added toggle for edit format lock by repeating the same command (/ask, /architect)
- persisting MCP agent message history for next messages
- added support for Amazon Bedrock provider in MPC agent (#20)
- added support for o3-mini model in MCP agent
- keeping the selected MCP servers when toggling MCP agent
- added option to add context files to MCP agent
- properly adding Aider's files present at start to AiderDesk's Context files
- added /mcp command to toggle MCP agent
- added maximum tokens setting for MCP agent
- improved MCP agent system prompt
- MCP agent now uses aider as another tool

## [0.4.2]

- added debouncing to autocompletion in prompt field
- keeping the processing on errors (e.g. LLM model API overload that keeps retrying)
- using --no-cache-dir when installing Python packages on start

## [0.4.1]

- fixed prompt field answer handling to properly prepare for next prompt after answering question
- fixed architect auto-accept behavior in connector to work properly with AiderDesk
- fixed yes/no question answering with custom prompt
- added support for /run command
- added support for /reasoning-effort, /think-tokens commands and showing the values in the project bar
- added Thinking and Answer message blocks when using reasoning models
- fixed watch files infinite loop caused by missing ignores

## [0.4.0]

- fancy animation for loading message
- added Gemini model support for MCP agent
- updated autocompletion in prompt field to include abbreviations
- fixed MCP tool schema for Gemini provider
- added REST API for managing context files and running prompt
- added `get-addable-files` REST API endpoint
- MCP server for AiderDesk

## [0.3.3]

- skip adding ignored non read-only files to the context
- improved MCP client interruption handling
- properly adding user input messages to the input history when using MCP tools
- wrapping long tool message content
- better handling of MCP tool errors
- increase max buffer size for socket.io events to 100MB to fix issue with large repos

## [0.3.2]

- added result of MCP tool to the tool message
- updated Claude model to 3.7 in default preferred list of models
- system prompt for MCP agent can be now configured in settings
- fixed prompt field focus issue after model selection
- properly showing preferred models in model selector when searching
- added missing vertical scrollbar when MCP server has many tools
- interpolating ${projectDir} in MCP server config `env` values
- interpolating ${projectDir} in MCP server config `args`

## [0.3.1]

- using python executable to install packages instead of pip
- added `/map` and `/map-refresh` commands for repository mapping functionality
- prevent infinite loading state after application refresh
- added AIDER_DESK_NO_AUTO_UPDATE environment variable to disable automatic updates

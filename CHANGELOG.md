# Changelog

## [UNRELEASED]

- added custom commands availability to all modes
- added info message when agent hits max output tokens
- improved handling of unknown finish reason during agent iteration
- fixed UnicodeEncodeError on Windows inside Aider
- correctly handling stored answer
- added retry for other finish reason in Agent run
- todo list disappearance outside agent mode or without useTodoTools enabled
- added optional target file parameter to /web command

## [0.21.0]

- not storing tool messages without the usage report into DB
- added cached token information for Gemini models
- fixed issue with unfinished stream response text preceding a tool call
- default agent profile for new users set to Power Tools and added Aider as the second one
- explicit cache control with Requesty Anthropic models used only when auto caching is disabled
- unified LLM providers settings
- improved onboarding flow with new unified LLM providers
- added action to open directory with logs into Settings -> Version
- added file completion with @ mention
- added option to open project in AiderDesk from command line
- notification when update is ready to be installed
- custom commands in Agent mode
- fixed issue with maximizing window on startup
- added description to agent profile
- removed rule files from the context files presented to agent as they are already in system prompt

## [0.20.0]

- removed duplicated cost from assistant message when tool is used
- usage dashboard with tokens and cost and charts with breakdown data
- updated to GA gemini models
- omitting error message for failing MCP server that are not enabled
- sub-agent tool presentation and context persistence improvements
- added icon for auto-approve to agent selector for immediate recognition
- showing streaming of reasoning (thinking) on agent messages
- determining default agent model based on available API keys in environment
- properly pasting files with path outside of project that start with project dir

## [0.19.0]

- revamped starting progress bar
- added /clear-logs command to clear log messages from chat
- added user-friendly aider options configuration
- added TODO tasks list functionality to Agent
- do not add the same message in a row to input history
- removed Aider run_prompt tool responses to reduce token usage
- added options to manage TODO list items (add, edit, remove)
- interrupt action cancels the current question
- optimized MCP servers reloading when switching between projects
- added new 'agent' tool for sub-agent executions
- updated temp directory for pasted images and web scraped content

## [0.18.0]

- added /compact command to compact conversation history
- prompts starting with '/' are checked if they are path like before checking them as commands
- properly closing deleted MCP servers
- adding HOME environment to MCP server connection
- read file power tool now denies to read binary files
- retrying 'unknown' responses from Gemini models
- improved prompt field with autocompletion
- calculating cost including cached tokens for Gemini models
- tool result containing image data is passed as image message to models
- added duplicate tool call prevention in Agent
- normalizing tool IDs before sending them to LLM
- added AIDER_DESK_AIDER_VERSION environment variable to use custom version of Aider
- fixed claude-4-sonnet-20250514 default model
- added caching info for Requesty provider
- setting to use Vim bindings in Prompt field
- using uv for Python package management
- respecting model and weak-model set in .aider.conf.yaml (project dir and $HOME) when opening project
- added support for extra Python packages to be installed on start via AIDER_DESK_EXTRA_PYTHON_PACKAGES environment variable

## [0.17.0]

- enhanced group question handling with All and Skip answers for questions like Add file?
- handling outdated Python venv directory by reinitializing it
- added prompt behavior settings for command confirmation and auto suggestions
- updated Aider context management tools to handle multiple files at once
- gemini-2.5-pro-preview-05-06 -> gemini-2.5-pro-preview-06-05
- added log message when max iterations are reached in Agent mode
- added drop file(s) support to Add File dialog
- properly passing reasoningEffort to Requesty provider
- improved caching for various providers and enhanced token and cost usage tracking
- added /init command to initialize PROJECT.md rules file with project information
- added configurable temperature setting for Agent profile
- added custom base URL config for Gemini provider
- added Clear chat button to project top bar

## [0.16.1]

- added functionality to reorder open project tabs
- made the Python exec detection smarter during the installation
- use python.exe instead of pythonw.exe on Windows
- MCP server tools set to Always approved now don't require confirmation
- fixed Gemini model response in Agent
- added Thinking budget, Include thoughts and Use search grounding settings for Gemini provider
- improved error handling for syntax highlighting in CodeBlock component

## [0.16.0]

- light mode theme
- added Requesty provider in Agent
- fixed search power tool usage
- explicit caching for Anthropic models in Agent
- ability to setup models for OpenRouter, Requesty, and OpenAI-compatible providers
- added boto3 as preinstalled Python package
- improved Agent model selector with search and preferred models
- glob and grep power tools respect gitignore patterns
- added descriptions for commands
- adding paths of working files for improved reference in Agent when full context files are not included
- tool messages now correctly copy the full JSON content of the tool
- rule files for Agent and optionally for Aider
- auto-approve for Agent flow and tools to remove interaction with user
- anonymous telemetry data collection
- enhanced paste functionality to support multiple files in Add Context Files dialog
- loading models info with context window and costs for Agent

## [0.15.1]

- fixed agent providers settings for OpenRouter
- correctly using provider and model based on selected Agent profile

## [0.15.0]

- explicitly sending project base directory to Aider process
- disabled spell check for input fields as it does not serve any purpose
- added loading message when auto linting and showing output of auto test command
- loading list of available models from Ollama server
- popup menu for input history
- agent profiles
- added gemini-2.5-flash-preview-05-20 to agent models
- added claude-sonnet-4-20250514 to agent models
- correctly showing many recent project in open project dialog
- using carousel to projects list when there are many opened projects
- warning for already open projects in Open Project dialog
- added missing usage tokens and cost on tool messages

## [0.14.1]

- fixed issue with black screen on code block render

## [0.14.0]

- correctly showing release notes HTML
- implemented confirmations for Power tools and added new answer "Always for this run"
- adding files created by power tools into git
- updated Gemini 2.5 Pro Preview version for Agent
- reinitializing Executor in Python Connector after shutdown (e.g. sleep)
- added session token support for Agent's Bedrock provider
- properly normalizing Windows path on non-Windows OS
- added Remove action for log messages
- added support for /commit command
- enhanced AddFileDialog with multi-file selection and also directory selection
- enhanced write and edit tool messages syntax highlighted code and diff viewer
- improved overall performance of the diff viewer
- loading environment variables for Agent providers from .env files in home and project directories
- find in chat functionality

## [0.13.0]

- improved requests to OpenRouter by adding require_parameters: true
- added code edit format selector
- notifications for prompt completion and questions
- properly awaiting after the question is answered before asking the next question
- normalizing file paths before using them further
- optimized MCP server initialization
- added option to add files as read-only when clicking with CTRL/CMD
- added UI button to drop all context files
- ability to edit last user message via user message action menu or /edit-last command
- added Power Tools for direct file operations, searching, and bash execution
- enhanced tool error handling by retrying with matching tool names
- improved tool messages presentation
- optimized messages context for implicit caching (e.g. Gemini 2.5 models)

## [0.12.0]

- correct placement of --init flag for Docker MCP server execution
- added support for /copy-context command
- added support for /tokens command
- added token usage progress bar to cost info
- added direct support for OpenRouter in Agent mode
- added version info for Aider and AiderDesk and improved update handling
- fixed project directory compatibility when mixing IDE on Windows and AiderDesk on WSL
- fixed issue with no attribute 'usage_report'
- initial model for project now respect --model option or check for API keys in environment variables
- improved performance of add/drop actions when working with a large number of files in context
- added support for /reset command
- added support for /drop command
- added ability to redo the last user message via user message action menu or /redo command

## [0.11.1]

- using Aider's --env and --env-file options for Agent LLM providers
- added confirmation dialog for Aider restart after settings changes
- improved Agent internal Aider tool description and fixed flow with adding new file to context
- fixed editing of custom instructions for Agent settings

## [0.11.0]

- fixed issue with docker MCP server not closing properly
- closing session popup when clicking on the button again
- added zoom level setting
- properly adding Aider's reflection message as user message
- fixed max reflections count
- reasoning effort and thinking tokens stored for projects
- fixed Select dropdown positioning
- removed mode locking functionality - mode is now always 'locked'
- commands are now stored in input history
- added Markdown rendering support for messages
- added bottom bar to message with additional info and actions
- added ability to remove last message from the context

## [0.10.0]

- arrow up/down does not change the history prompt after editing the text anymore
- improved agent system prompt
- added gpt-4.1 and gpt-4.1-mini models for Agent
- added more information about selected model (tokens, cost per 1M tokens, etc.)
- showing Agent model in the project bar
- implemented tool approval settings for enhanced user control
- added o4-mini model in Agent
- properly handling user input when tool call is denied by user
- added model selector for Agent model to Project bar
- using env vars for Agent LLM providers (API keys, etc.)
- enhanced agent system prompt with improved structure and clarity
- added gemini-2.5-flash-preview-04-17 model for Agent
- added export session to Markdown functionality
- added option to include repo map in Agent context

## [0.9.0]

- fixed editor response in architect mode
- fixed right padding in prompt field
- added invalidToolArguments tool for handling invalid tool arguments error in agent
- updated tool message rendering
- added option to show and manage all project files in Context Files
- added gemini-2.0-flash-exp model in Agent
- improved tool message handling within session
- fixed overflowing of the code blocks in messages
- pasting multiple MCP servers at once within the same JSON will add all the servers
- revamped session management
- adding command output to context messages for Agent
- fixed PATH environment variable on MacOS
- enhanced MCP server configuration with possibility to update the whole config
- added support for Ollama provider in Agent
- replace system prompt with custom instructions for Agent
- fixed issue with `npx` in MCP servers on Windows

## [0.8.0]

- refactored Agent to use Vercel AI SDK, added new Agent mode, updated agent flow, and enhanced LLM provider support/tool handling
- correctly showing MCP config tab on Configure servers action
- option to disable specific MCP server tools
- removed tool response limiting
- fixed issue with tool responses when using Gemini models
- added localization support (currently English and Chinese)
- added Agent mode as one of the available modes instead of having it as a separate setting

## [0.7.1]

- added support for OpenAI compatible providers in MCP agent

## [0.7.0]

- added support for Deepseek provider in MCP agent
- added General settings with Start Up section with options to load context messages and files from last session
- added support for managing sessions
- fixed issue with 0.80.0 aider version
- show read-only icon in Context Files when all files are displayed

## [0.6.0]

- added support for /context command
- added support for gemini-2.5-pro-exp-03-25 model in MCP agent
- added support for custom OpenAI compatible models with openai/ prefix

## [0.5.1]

- optimized start up installation of packages
- using AWS_PROFILE environment variable for Bedrock provider when no accessKeyId/secretAccessKey is provided

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

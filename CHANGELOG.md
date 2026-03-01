# Changelog

## [0.55.0]

- added support for commiting changes via the Updated Files page
- added comprehensive Extention system
- omit deleted files in Updated Files
- added Alibaba Coding Plan provider
- added locking of files when using edit power tool to avoid race conditions
- moved BMAD mode out of Preview mode
- added xhigh reasoning effort for OpenAI and OpenAI compatible providers
- speed up startup by loading some of the long-loading managers in background
- better handling of memory embedding process when swithing between models
- removed BAAI/bge-large-en-v1.5 as Memory embedding model due to app crash
- added Copy as Markdown action to task actions menu in task sidebar
- added mode to view all files at once in Updated Files page

## [0.54.0]

- added support for message queue while task is processing
- making sure to include user message when using Gemini models to avoid signature error
- added missing tooltips to prompt field icons
- subagent now always uses Compact context compaction type
- added current workflow information in BMAD mode
- improved initial context for some BMAD workflows
- git add is not used when the project is not a git repository
- agent with Aider tools and aider specific commands now properly start the aider connector
- task name is now based on user story name when using BMAD create-story, dev-story and code-review workflows
- added support for selecting a specific model when executing BMAD workflows
- moved message navigation controls outside the scrollable container
- added Gemini CLI as supported provider
- enhanced hook system to allow modification of event data
- added some example hooks
- added button to view changes for updated context files

## [0.53.0]

- fixed mobile project dropdown to truncate long project names with ellipsis instead of pushing icons off-screen
- optimized mobile layout for bmad mode - agent selector now stacks under mode selector and action buttons are absolutely positioned at top right
- optimized MCP server initialization
- optimized Aider connector start-up management
- better detection of state for Quick Flow BMAD workflows
- added support for Mermaid diagrams in messages
- updated BMAD library installation to use the command approach
- correctly reading the BMAD workflow files when preparing context
- added Show task info button for quick access to task information
- image messages are sent also when Include Context Files is disabled
- properly initializing internal task in project
- added Updated Files section with information about the changes and ability to request changes on specific line
- BMAD mode consecutive prompts are now properly sending when working via browser
- sync task baseDir with project baseDir to handle migrated tasks
- correcly showing the project files with special characters
- increased timeout of semantic search tool to avoid errors when the tool is running multiple times in parallel
- added Brainstorming as another BMAD workflow option

## [0.52.0]

- decreased default max tokens of semantic search for better context management
- added support for Anthropic compatible provider
- added direct support for Kimi Coding Plan provider
- improved UX for initial user message
- improved handling files within the context of the agent
- properly removing the tool calls from assistant message when using remove messages up to here action
- added BMAD Method mode
- files are now clearing properly on new tasks when IDE plugin is not connected
- moved mode tooltips to right alignment for better usability
- added option to use compact view mode for messages
- fixed issue with Merge actions from worktrees
- default agent profiles now do not include the context files
- rules directory is correctly handled when using Aider modes and Worktree
- added detaled information about the context files
- setting Compact as default messages view mode
- added quick actions for BMAD mode workflows

## [0.51.0]

- hiding the subtasks when parent task is archived
- skipping model loading for disabled providers
- updated visuals of model selectors
- Claude Agent SDK provider only available when claude executable is present
- added action to handoff a todo item to a new task
- improved perfomance by replacing library used to render tooltips
- filtering out unsupported language in the semantic search tool
- removed empty tooltip from folders in context files tree and using muted color for project files not in the context
- improving Glob and Grep tool messages to give more info to user
- added support for 'project' and 'task' parameters in URL hash for direct navigation to a specific project and task
- added context management task settings for automatic conversation compaction or handoff
- properly updating the agent profile list after deletion
- added action to restore default agent profiles
- added /resolve-conflicts command to resolve the conflicts in the current branch
- creating subtask correctly inherits agent profile, provider and model from parent task
- properly loading the pending text in prompt field when switching tasks
- added delete up to here action to remove all messages up to some message
- added support for pasting images from clipboard in the browser
- showing the subagent tool error message in the tool message
- showing project tabs as dropdown on mobile devices
- properly positioning message menu over the top content
- added support for unknown file type in diff viewer to show without highlighting
- storing context messages during the agent run
- added browser notifications

## [0.50.1]

- setting the executably path manually for Claude Agent SDK provider in Electron
- fixed internal TypeError when processing the response

## [0.50.0]

- further improvement to the rendering performance
- properly showing the Aider cost
- added option to disable thinking for Z.AI Coding Plan provider models
- hidden pin and state change actions for new tasks
- search field for messages (CTRL+F) properly showing only for active project
- added optimistic user message on prompt submission for better user experience
- updated notification messages to include task name and state
- added support for terminals in the browser
- added visual indicator to project tab when that project is in progress
- improved usability of message virtual rendering
- added Claude Agent SDK as a provider to use with Claude subscription
- using Enter action on mobiles adds a new line instead of submitting the prompt
- properly storing the handoff task context before executing it
- fixed tooltip translation for TODO items actions
- added action to fork a task from a specific message

## [0.49.0]

- improved responsiveness for small screen devices with mobile-first layouts for task sidebar, task bar, and prompt field components
- added full-screen task sidebar on mobile with toggle button
- added flexible layout adjustments for model selectors and dropdowns to prevent overflow on small screens
- added action to remove any message in the conversation
- added tooltip to read and edit file power tools to show the file path on hover
- added support for subtasks with worktree inheritance
- updated task tools with the subtask capabilities
- added missing scrollbar to task sidebar on mobile devices
- added Select all action into menu
- ensuring to include usage in for LiteLLM models when streaming
- added optimistic updates to redo user message and interrupt response
- setting max width for the autocompletion popup in prompt field
- added task search tools for searching within tasks and parent tasks using semantic search
- properly interrupting determine task state action after agent completion
- max output tokens for models is now undefined by default
- added handoff feature to create a new task with focus from current conversation
- changes made in mdx files are now properly showing up in diff viewer

## [0.48.1]

- passing the model info properly to Aider in the connector

## [0.48.0]

- added missing menu actions to the last user message
- correctly handling copy actions on MacOS and mobile devices
- correctly handling export to markdown in browsers
- removed duplicate AGENTS.md entry from the system prompt knowledge section
- added direct support for Synthetic provider
- optimized performance when switching between tasks and projects
- added /task-info command for task information
- added favicon to browser clients
- properly using the compacting threshold from the task when updated
- added configuration option to hide task state actions
- added output streaming to bash power tool during the execution
- improved retrieve memories tool description for better results
- agent mode set as default for new projects and updated empty task message
- properly replacing ~ in paths of power tools for HOME
- added agent creator skill
- added MCP tool auto-setup to Z.AI Coding Plan provider
- added direct support for OpenCode ZEN provider
- added icon to the task item in the sidebar in case is in worktree mode
- added change state submenu to task sidebar for updating task states
- properly setting the default value for max output tokens when not specified in Aider modes
- added configurable symlink folders for worktrees to automatically link untracked dependencies
- added support for ${taskDir} placeholder in MCP server config and updated value of ${projectDir} placeholder
- added direct support for LiteLLM provider

## [0.47.0]

- added ability to pin tasks to the top of the task sidebar
- added AI-powered task name generation
- fixed context manager not marking as loaded in some cases
- improved cost input field editing in Model Library to avoid reformatting during typing
- sanitizing agent profile when reading the config file to ensure all required fields are present
- added worktree directory important reminder when working in the worktree
- added shift-click support for selecting task ranges in multiselect mode
- correctly showing uncut list of uncommited files in the worktree status
- added task actions based on the task state for easier workflow
- added task settings page with smart task state and auto-generate task name configuration
- improved instructions for using memory tools for better utilization
- added ability to delete memories from the retrieve memory tool message
- added optional state input argument to list tasks tool to filter by state
- added optional format for fetch tool to fetch markdown, html or raw content
- matching for full path when checking if file exists in the context before asking to add it
- updated default temperature for Z.AI models to 0.7 for better results

## [0.46.0]

- added Vitest testing framework
- added Writing Tests skill
- implemented templating system for agent prompts with modular structure
- enhanced thinking block content handling
- improved cursor styling for context file section headers
- added icons to worktree merge related actions
- added keyboard shortcuts
- fixed task selection on touch devices
- added navigation for jumping between user messages
- correctly showing usage data on tool results when loading existing tasks
- added support for custom system prompts for main agent, compact conversation and other prompts
- correctly showing the rule files based on the current task mode
- added optional execute argument to create task tool to allow executing it after creation
- added update memory tool to complement other memory tools
- added copy button to the bash tool command
- added ability to disable provider profiles to hide their models
- added missing endpoint for updating model
- correctly allowing to run multiple tasks simultaneously in the browser
- added multi-select support for file suggestions using Ctrl/Cmd key

## [0.45.1]

- using ollama_chat/ prefix for ollama models in Aider modes to fix 'parsing chunk' issue with gpt-oss models

## [0.45.0]

- improved worktree merge functionality with support for custom target branches and commit messages
- added visual status indicators for worktrees (ahead commits, uncommitted changes, conflict predictions)
- added rebase support for worktrees with manual and AI-assisted conflict resolution
- added specialized Conflict Resolution agent for automated merge conflict fixing in worktrees
- moved worktree safety confirmation dialogs to the UI for better user experience
- added a hook system for intercepting and reacting to application events (tasks, prompts, agents, tools, files, etc.)
- fixed height of MCP server form
- added custom skill activation tool message
- added diff viewer type selector with side-by-side, unified and compact diff view
- not switching mode when switching other parameters in browser
- added automatic file detection from prompts with interactive confirmation to add detected files to context in Aider modes
- improved project file listing to respect .gitignore patterns in non-git mode
- propagating "Retrying" message from Aider
- paste action also works for non files in Add File dialog
- added auto-restart of Gemini voice session to somehow mitigate the issue of stopping after 30 seconds

## [0.44.0]

- fixed issue with missing reasoning_content field when using deepseek-reasoner
- added memory management system with agent integration
- added Use memory tools and Use task tools quick actions to Agent selector
- optimized agent profile update and related event handling
- added Skill tools for activating skills in Agent mode
- properly passing max_tokens when using Aider modes
- architect model is now correctly set for a task
- properly reading API_KEY environment variables for some providers when using Aider modes
- updated link to telemetry docs
- user message correctly stored before Aider returns response in case of interrupt or error
- fixed microphone permission issue on macOS
- added voice support to browser client
- added voice settings with microphone selection and additional configuration
- added Auto Approve lock on project level for new tasks
- added Auto Approve for Aider modes
- fixed project name display in Agent settings for Windows paths

## [0.43.0]

- selected agent profile and models are now stored per task
- recent projects are now correctly added when closing a project
- updated default models for providers
- using settings from the last active projects when opening a new project
- improved agent profile management and UI selection handling
- including AGENTS.md in the Rule files as those are automatically added to the context
- added missing icon buttons and tooltips for items in the fies tree
- estimated tokens now correctly recalculate when switching the Include files and Include repo map settings
- storing files sidebar width and added collapse/expand functionality
- task-level selected mode and models
- terminal view now correctly uses task directory in case of worktree mode
- added search functionality to Project Files
- fixed Invalid Prompt issue with some OpenRouter models
- added tools for managing tasks (list, get, get message, create, delete)
- added refresh functionality for Project Files
- added option to include non-git files in Project Files

## [0.42.1]

- fixed issue with Aider not loading on Windows

## [0.42.0]

- redesign settings interface with sidebar navigation
- agent profiles are now file based for better extensibility
- agent profiles can now be created per project
- agent profiles can be cut and pasted between projects via Settings
- agent profiles can now have its own rules directory with rule files
- showing rule files in context files tree in Agent mode
- fixed issue with caching when using OpenRouter provider and Anthropic models
- watch files functionality now correctly only triggers once per project
- updated close button text in Changelog dialog
- added hide and unhide batch actions for models in Model Library

## [0.41.0]

- added resize functionality to todo window
- added multiselect to task sidebar
- passing auto approve options and denying execution of bash commands when running Aider via tool
- added voice control/speech to text support using Gemini or OpenAI provider
- corrected parameter name for internal helper tool when LLM uses invalid tool arguments
- added missing parameters to providers when Disable streaming is used
- added line and limit info to the read file tool message
- added new Fresh color theme

## [0.40.0]

- added support for MiniMax provider
- added maxResults parameter to grep tool with default 50
- "Show/Hide all files" now persist the state across the tasks per project
- enhanced model configuration with temperature and max tokens support at the model level, with optional agent profile overrides
- improved new task handling in sidebar
- better utilization of abort signals and improved the interruption handling
- passing the model parameters (cost, temperature) to Aider process to utilize Model Library settings

## [0.39.1]

- files are now correctly sent to the UI

## [0.39.0]

- improved performance of loading large number of messages
- enhanced file read tool with line number display and partial file reading capabilities
- improved agentic flow for providers that stop right after the tool call
- fixed occasional white screen error when using compacting
- provider overrides now currently show the current state of the provider settings
- added archive/unarchive task actions
- added option to disable streaming for provider or specific model
- fixed issue with response getting stuck in Aider modes in some cases
- added search functionality to task sidebar
- custom commands now working properly in Agent mode when used within browser
- improved auto-scrolling while generating the response
- added missing provider parameters when generating commit message
- moved auto approve to task level
- added bash tool pattern settings for automatic approval and denial of commands
- added copy button to subagent prompt
- dropping the files clears them immediately instead of waiting for event from Aider
- fixed provider options handling with multiple OpenAI Compatible providers
- added reasoning effort support for OpenAI compatible provider
- creating task branch when using worktree
- added support for GPUStack provider
- optimized autocompletion and all files loading

## [0.38.0]

- performance improvements related to rendered messages
- omit showing empty Thinking block when there is no thinking content
- loading current question in browser client and added event when answering question
- added export to markdown and export to image actions for a task
- avoid creating new task when there is already a new task
- added possibility to use git worktree for isolated changes
- added copy task ID action for a task
- added welcome message for empty task view
- fixed issue with drop all files not working after changes in Settings -> Aider
- added Refresh action to Model Library to reload models
- added reasoning effort support for Azure provider and fixed reasoning models not working
- remember the prompt field value when switching between tasks
- added save prompt action for future task executions
- added action to duplicate task
- avoid selecting a task when only opening its context menu

## [0.37.1]

- fixed issue with no responses when using Requesty provider
- todo tools are now properly used with new task management

## [0.37.0]

- improved API key handling from environment variables in Agent mode
- added support for auto-compact of the conversation when token usage exceeds a configurable threshold
- added task sidebar with task management
- fixed weak model prefix not being set correctly when different from the main model
- added possibility to lock the weak model

## [0.36.0]

- added checkbox for showing/hiding Hidden models in Model Library
- correctly opening About tab in Settings when Update is available icon is clicked
- fixed issue with incorrect tool definition for AiderDesk MCP server
- added sorting to tables in Model Library and Usage dashboard
- auto approve setting from main agent is passed to subagents
- added support for custom commands to be organized inside subfolders
- added drag and drop option to change position of Agent profiles

## [0.35.0]

- updated icon for when the tool is denied
- using correct OPENAI_ environment variables for Z.AI Coding Plan provider in Aider modes
- removed _API_KEY environment setting for Aider modes when it's not defined in Provider
- model command now correctly opens the agent model selector when in agent mode
- fixed issue with duplicated parts of the message appearing while streaming
- migrated AI SDK from v4 to v5 for better future support and improvements
- search grounding with Gemini models now also available to be used with other tools
- properly using overridden custom token cost values for model
- show info that Export to Image of messages is not available when using virtualized rendering
- added support for Web Search tool for OpenAI models
- properly reconstructing thinking messages after loading the session when there are multiple message parts

## [0.34.0]

- properly using env vars from Settings -> Aider when loading provider models
- AIDER_DESK_DATA_DIR now properly respected
- added support for ARGUMENTS placeholder in custom commands
- reloading project keeps the current session
- improved performance of model library by using virtualized table for models
- added support for provider overrides on model level
- added support for Z.AI Coding Plan provider
- updated Electron version to fix issues with latest MacOS version
- added support for virtualized rendering of messages
- moved Markdown rendering option to General settings
- improved performance of glob and grep tools by using `git check-ignore`
- updated subagent run task tool to use ID based on names instead of UUIDs to prevent wrong subagent being run
- thinking message is not added anymore after interrupting the tool call
- added support for Markdown tables rendering

## [0.33.0]

- fixed issue with diff edit format not being set correctly on startup
- added model library for provider and model management
- allow to customize AIDER_DESK_DATA_DIR via environment variable
- added support for Azure provider
- fixed not being possible to interrupt agent run when switching between projects
- fixed issue with context files not being highlighted in All files mode on Windows
- improved parsing of thinking blocks to avoid nested issues
- using models.dev to load models metadata
- added more actions for project tabs

## [0.32.0]

- changed system prompt to XML structure for better instruction following across the various models
- fixed issue with text jumping in Prompt field when typing fast
- notifications correctly using selected theme
- added check for new project paths
- yes-always options correctly respected
- correctly using the selected edit format in Architect mode
- added warning for Gemini models' tool limitation with search grounding
- added compact information about current actions to subagent messages
- added 'clear_context' tool to AiderDesk MCP server
- added Cerebras provider

## [0.31.0]

- updated to React 19 for possible performance improvements
- added better undo last commit support even outside of Aider modes
- added support for optional autoApprove property in custom commands
- improved support when using subfolder of git root as project directory
- properly loading messages from the last session on startup
- added None reasoning effort option for OpenAI provider
- added dynamic model loading for LLM providers
- enhanced Power tool messages UX
- automatically setting configured provider models when API keys are provided

## [0.30.0]

- extended context memory mode for Subagents to Full context or Last message
- added server settings to control exposing the API and browser access
- added basic authentication for the server access
- added possibility to start Cloudflare tunnel to access the server
- added tokens info for context files
- added option to change font size
- added simple but functional responsive design
- fixed issue causing info message types appearing before the end of diffs when using fast models

## [0.29.0]

- updating the context info after Aider mode requests
- showing message when generating commit message after modifications
- added 'Can use subagents' configuration to Agent profile
- added events manager layer and support for Socket.IO event updates
- added headless mode with AIDER_DESK_HEADLESS=true environment variable
- added full API layer for external clients
- added context memory option to Subagents to preserve context within the same conversation

## [0.28.1]

- properly using bundled probe binaries

## [0.28.0]

- added model selector to Agent profile in Settings
- correctly using the selected model when compacting the conversation
- updated scrollbar style in agent selector when there is more profiles than fit
- implemented subagents functionality
- added confirm before edit option for Aider coder
- added fetch power tool
- removed Playwright dependency for web scraping in favor of internal browser
- fixed issue with getting stuck when dropping files
- updated temperature range to 0-2 with 0.5 step
- gracefully handling no changes in file edit tool instead of erroring
- drag and drop external files to Context files
- added scroll to bottom button to the message area
- including AGENTS.md in the system prompt by default when using Agent mode
- fixed issue with duplication in thinking section of message with some OpenRouter models
- properly using context messages and files when using context aware commands (e.g. /tokens)
- added support for 'minimal' reasoning effort (for GPT-5 model)
- showing relevant model selectors in Project bar based on the mode and tools

## [0.27.0]

- parsing <think> tags as reasoning part of the response
- fixed unnecessary reload of component during onboarding process
- implemented better support for themes + new themes added
- implemented support for fonts + new fonts added
- added keyboard shortcuts to toggle TODO list (Alt+T), Include context files (Alt+F), Include repository map (Alt+R), and Auto-approve (Alt+Y)
- updated application main menu and included Settings
- fixed multiselect checkboxes
- added `docs-site/` with documentation app

## [0.26.0]

- pasting image processed in AiderDesk instead of using Aider to handle it
- added image file processing support for Agent context
- using relative path for web scrapped content files
- AGENTS.md instead of PROJECT.md when using /init
- using "diff" mode as default for models in Aider
- added configurable require_parameters for OpenRouter
- updated prompt field placeholders with real like examples
- added support for arm64 macOS builds
- message groups for Aider and Sub-agent prompts
- added support for Vertex AI provider
- increase stdout buffer size for shell commands in custom commands
- added keyboard navigation to select component
- remember last editFormat per model and per project
- fixed issue with GPT-5 model in Agent mode
- added summaries to Agent profile sections accordions
- updated Electron libraries to the latest versions
- properly set history item when search query is used
- tool message names to use neutral tense
- added context menu with Copy and Paste actions
- properly loading last session on start when IDE plugin is connected
- added reasoning effort to OpenAI provider in Agent mode

## [0.25.1]

- properly adding files recursively when directory is added to context

## [0.25.0]

- improved connection and communication with Aider
- reading cached tokens when working with Aider modes
- fixed start up with using local Aider installation via AIDER_DESK_AIDER_VERSION
- fixed command output messages in the context
- added hourly, daily, monthly, yearly aggregation for dashboard data
- added support for non-git projects
- fixed map-refresh command not to display the map
- added integrated terminal component
- added model selectors loaded from the Requesty and OpenRouter APIs
- added advanced settings to OpenRouter provider
- correctly handling user's rejected message to Architect plan

## [0.24.0]

- support for headers in streamable MCP servers
- added search to input history
- added Langfuse OpenTelemetry instrumentation for Agent and Aider
- added action to clears all todo list tasks
- fixed architect mode interruption while editing files

## [0.23.0]

- fixed laggy prompt field clearing after submitting message
- added support for streamable remote MCP servers
- added direct configuration for LM Studio provider
- added direct configuration for Groq provider
- improved escape character sanitization in file edit tool
- render HTML tags properly in messages
- basic support for udiff format in diff viewer
- excluding information about disabled power tools in the system prompt
- improved context files messages in Agent
- improved Aider initial startup error handling

## [0.22.0]

- added custom commands availability to all modes
- added info message when agent hits max output tokens
- improved handling of unknown finish reason during agent iteration
- fixed UnicodeEncodeError on Windows inside Aider
- correctly handling stored answer
- added retry for other finish reason in Agent run
- todo list disappearance outside agent mode or without useTodoTools enabled
- added optional target file parameter to /web command
- /web commands are now saved into input history

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

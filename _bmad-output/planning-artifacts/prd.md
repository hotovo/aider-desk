---
stepsCompleted: [step-01-init, step-01b-continue, step-02-discovery, step-03-success, step-04-journeys, step-05-domain, step-06-innovation, step-07-project-type, step-08-scoping, step-09-functional, step-10-nonfunctional, step-11-polish, step-12]
inputDocuments:
  - product-brief-aider-desk-2026-01-14.md
  - project-context.md
workflowType: 'prd'
classification:
  projectType: developer_tool
  domain: general
  complexity: medium
  projectContext: brownfield
---

# Product Requirements Document - aider-desk

**Author:** Vlad
**Date:** 2026-01-14

<!-- Content will be appended sequentially through collaborative workflow steps -->

## Success Criteria

### User Success

Users experience a friction-free extension system where installation is straightforward and self-service. Extension creators can successfully customize AiderDesk to their specific workflows without requiring core development changes. Extension users install extensions that "just work" - no support needed, no configuration hassles, immediate functionality.

**Key Success Moment:** A user downloads an extension, copies it to their extensions folder, and within minutes sees new functionality integrated into their AiderDesk interface without reading documentation or asking for help.

### Business Success

**3-Month Objectives:**
- 20 unique extensions created by the community
- Over 50% of active users install at least one extension
- Initial ecosystem established with users sharing and discovering extensions

**12-Month Objectives:**
- Marketplace foundation in place (even if basic initially)
- Custom workflows at scale across user base
- AiderDesk recognized as extensible platform driving differentiation
- Enhanced user trust and loyalty through community-driven features

### Technical Success

The extension system works reliably and predictably. Extensions load correctly, tools register properly, events fire as expected, and UI elements integrate seamlessly. No crashes or performance regressions introduced by extensions. Extension API remains stable and well-documented for developers.

### Measurable Outcomes

- **Extension Creation:** 20+ community extensions within 3 months
- **Installation Rate:** 50%+ of users install at least one extension
- **Installation Friction:** Minimal support requests for installation issues
- **Extension Reliability:** Extensions function without crashes or breaking changes
- **Community Engagement:** GitHub stars, Discord discussions, documentation engagement

## Product Scope

### MVP - Minimum Viable Product

The complete extension system core:

- **Extension API (TypeScript):**
  - Tool registration (`registerTool()`)
  - Event subscription (all hook events + `agentRunFinished`, `agentIterationFinished`)
  - UI elements (action buttons, dialogs)
  - Task/subtask creation APIs
  - State management (persistent across sessions)
  - Settings access (agent profiles, model configurations)

- **Extension Discovery:**
  - Global directory: `~/.aider-desk/extensions/`
  - Project directory: `.aider-desk/extensions/`
  - Auto-discovery and loading

- **Extension Builder Skill:**
  - Special skill for AI-assisted extension development
  - Help users draft, debug, and refine extensions

- **WakaTime Extension:**
  - Migration from existing hook to extension format
  - Demonstrates extension capabilities

- **Documentation:**
  - Complete API reference
  - Multiple working examples
  - Extension builder skill usage guide
  - Best practices and patterns

**Out of Scope for MVP:**
- GUI configuration screens
- Extension marketplace
- npm package support
- Extension signing/security

### Growth Features (Post-MVP)

- GUI-based configuration screens for extension settings
- Extension marketplace with:
  - Browsing and installation
  - Ratings and reviews
  - User feedback
  - Search and filtering

### Vision (Future)

- npm package support for complex extensions with dependencies
- Extension signing and trust mechanisms
- Advanced UI components beyond buttons/dialogs
- Web-based extension marketplace
- Mobile extension support (if AiderDesk expands)
- Third-party marketplace ecosystem
- MCP integration for external server connections

## User Journeys

### Journey 1: Alex - Extension Creator (Success Path)

**Opening Scene:**  
Alex has been working on a complex refactoring all week. He's exhausted from repeating the same manual cleanup tasks after each code change. He's heard whispers in the AiderDesk Discord about a new extension system that lets users build custom tools. At 11 PM on a Friday, he decides to take a look at the documentation.

**Rising Action:**  
Alex opens the LLM-friendly extension docs and realizes everything clicks - the API patterns make sense, the TypeScript types guide him, and the examples show exactly what he needs. He activates the "Extension Builder" skill in AiderDesk and starts conversing with the agent. "I want to register a tool that runs prettier and eslint on changed files," he types. The agent drafts the initial extension code, complete with proper type definitions and error handling.

He saves the file to `~/.aider-desk/extensions/auto-formatter.ts`, restarts AiderDesk, and watches in anticipation. The extension appears in the UI. He asks the agent to run it, and suddenly his messy code is beautifully formatted - no manual intervention needed.

**Climax:**  
Alex feels a rush of excitement. He just automated away hours of drudgery in an evening. He tests edge cases, handles errors, refines the tool's response format. With the agent's help, he adds a settings panel that lets users configure which formatters to run and how aggressively. The extension is polished and reliable.

**Resolution:**  
Alex publishes his extension to GitHub with clear documentation. A few days later, he sees a notification in Discord - "OMG, this auto-formatter extension saved me so much time!" Alex smiles. He's not just using AiderDesk anymore; he's contributing to it. He's already thinking about his next extension - maybe a workflow that automatically generates tests from code changes.

**Journey Reveals Requirements:**
- Extension Builder skill with conversational assistance
- Complete, LLM-friendly documentation with examples
- TypeScript types and error handling patterns
- Extension auto-discovery from global directory
- Settings access for extension configuration
- Easy testing and iteration workflow

---

### Journey 2: Jordan - Extension User (Adoption Path)

**Opening Scene:**  
Jordan has been using AiderDesk for three months. He's productive but constantly finds himself switching between windows - checking docs, running manual tests, copying output to Jira. He complains in Discord: "I wish AiderDesk could help with this whole workflow." Another user replies: "Check out the Workflow Helper extension - Alex built it and it's amazing."

**Rising Action:**  
Jordan clicks the GitHub link. The README is clear, shows screenshots of what the extension does, and has a simple installation instruction: "Copy workflow-helper.ts to ~/.aider-desk/extensions/ and restart AiderDesk." Jordan downloads the file, navigates to the folder, drops it in, and restarts the app.

Nothing happens. Jordan panics - did he install it wrong? Is his version incompatible? He notices a small "Extensions" menu in the settings. He opens it and sees "Workflow Helper - Loaded ✓". Relief washes over him. He opens a project, runs the agent, and sees a new "Generate Jira Ticket" button appear in the UI.

**Climax:**  
Jordan clicks the button. The extension reads the changes, creates a formatted Jira ticket description, and even suggests a title. Jordan's jaw drops - what used to take 15 minutes of copy-paste just happened in seconds. He tries the other features: automatic test generation, documentation updates, commit message suggestions. All of them work flawlessly.

**Resolution:**  
Jordan becomes an extension evangelist. He's installed five more extensions in two weeks - one for Docker container management, one for API testing, another for environment variable validation. His workflow is transformed. He starts reporting bugs and feature requests, feeling invested in the ecosystem. When someone asks "Should I try AiderDesk?", Jordan replies: "Yes, and install these extensions - they'll change your life."

**Journey Reveals Requirements:**
- Simple, foolproof installation (copy file + restart)
- Visual confirmation that extension loaded successfully
- Clear documentation with screenshots
- UI elements integrated seamlessly (buttons, dialogs)
- Extensions work reliably without configuration
- Extension discovery mechanism (GitHub links, Discord recommendations)

---

### Journey 3: Sam - Product Manager (Team Standardization Path)

**Opening Scene:**  
Sam's team is struggling with inconsistent code review practices. Some reviewers check everything, others miss critical issues. Developers complain about "subjective feedback." Sam wants to enforce a consistent review checklist but doesn't have technical skills to implement it herself. She asks her lead developer: "Can AiderDesk help with this?"

**Rising Action:**  
Her lead dev says: "I can build an extension that adds a review checklist to AiderDesk's agent workflow." Two days later, he shares a prototype. Sam watches over his shoulder as he demonstrates: when code is ready for review, the extension automatically runs a checklist - checks naming conventions, validates documentation, ensures tests exist.

Sam is impressed but wants customization: "We need to add security review items for production deployments." The dev updates the extension's configuration file and adds the security checks. Sam reviews the checklist - perfect. He publishes the extension to the team's shared repository.

**Climax:**  
Sam rolls out the extension to all developers. Installation is automated via the team's onboarding script - they just copy the file. In the first week, review consistency improves dramatically. Developers appreciate the clear checklist, reviewers save time, and the team's code quality metrics improve. Sam feels empowered - she's standardized her team's workflow without writing a single line of code.

**Resolution:**  
Sam becomes a champion of extensions for process improvement. She works with engineering to build extensions for CI/CD status checking, deployment approvals, and incident postmortem generation. Her team becomes one of the most productive in the company. When the VP asks about their secret, Sam replies: "AiderDesk extensions - we customize our tooling to match our exact processes."

**Journey Reveals Requirements:**
- Extension configuration file for non-technical customization
- Project-specific extension discovery (.aider-desk/extensions/)
- Team sharing workflows (shared repositories, automated installation)
- Extensions integrate into existing agent workflows seamlessly
- Extensions enable non-technical users to influence development processes

---

### Journey 4: Taylor - Domain Specialist (Data Analyst)

**Opening Scene:**  
Taylor is a data analyst who occasionally needs to debug data pipeline code. She understands SQL and Python basics but gets lost in complex error messages. Today, she's facing a cryptic failure in a transformation script. She asks her developer colleague for help, but they're in meetings. Taylor opens AiderDesk and tries to investigate the error herself.

**Rising Action:**  
The agent provides helpful suggestions, but Taylor doesn't understand the technical context. She remembers her colleague mentioned they installed a "Data Pipeline Debug Helper" extension for her. Taylor doesn't know how it works, but she knows it's supposed to help.

She opens AiderDesk and sees a new button: "Debug Pipeline Issue - Data Analyst Mode." When she clicks it, instead of technical stack traces, the extension shows a friendly explanation: "The transformation is failing because source data has null values. Would you like to: (a) Filter out null values, (b) Fill with defaults, (c) Stop and investigate?"

**Climax:**  
Taylor chooses option (b). The extension generates Python code to handle the null values properly, written with clear comments explaining what each line does. Taylor reviews the code - it makes sense! She copies it into her script, runs it, and the transformation succeeds. She didn't need to understand stack traces or exception handling. She just solved her problem.

**Resolution:**  
Taylor becomes more confident with technical tasks. Whenever she encounters data pipeline issues, she uses the Data Analyst extension. She even learns from the generated code, gradually understanding Python better. She recommends the extension to other analysts on her team. They're all more productive, and the developers are freed from constant data debugging questions.

**Journey Reveals Requirements:**
- Extensions can provide domain-specific, user-friendly interfaces
- Extension capabilities can be tailored to specific skill levels
- Extensions can bridge technical gaps for non-developers
- UI elements can simplify complex operations
- Extensions generate educational, understandable output

---

### Journey Requirements Summary

The journeys reveal core capabilities needed:

**Extension Builder Experience (Alex):**
- Extension Builder skill with AI assistance
- Complete documentation with examples and patterns
- TypeScript API with strong typing and error handling
- Easy testing and iteration workflow

**Extension User Experience (Jordan):**
- Simple installation (copy file + restart)
- Visual confirmation of successful loading
- Clear documentation with examples
- Reliable, seamless UI integration
- Easy discovery and sharing mechanisms

**Team Standardization (Sam):**
- Project-scoped extensions (.aider-desk/extensions/)
- Configuration files for non-technical customization
- Team sharing workflows
- Integration into existing agent workflows

**Domain-Specific Interfaces (Taylor):**
- Custom UI elements for specific domains
- User-friendly abstractions over technical complexity
- Educational, understandable outputs
- Skill-level-tailored capabilities

## Developer Tool Specific Requirements

### Project-Type Overview

The AiderDesk Extension System transforms AiderDesk from a fixed-feature application into an extensible developer platform. Extensions are TypeScript-based modules that integrate deeply with AiderDesk's React UI, multi-process architecture, and AI agent capabilities. The system uses a single-file (or multi-file with imports) approach that prioritizes simplicity over formal packaging.

### Technical Architecture Considerations

**Language Strategy:**
- **TypeScript** is the definitive language for extensions
- Leverages TypeScript's type safety and rich ecosystem
- Aligns with AiderDesk's existing codebase (React + TypeScript)
- Full access to TypeScript language features and patterns

**Extension Structure:**
- Primary format: Single TypeScript file extensions
- Advanced format: Multiple TypeScript files with imports (for complex extensions)
- No formal packaging system (npm, etc.) required for MVP
- Simple drop-to-folder installation model

**API Surface:**
- `registerTool()` - Register custom tools for agent invocation
- `on()` - Subscribe to system events (all hook events + new agent lifecycle events)
- `registerActionButton()` - Add UI buttons to interface
- Dialogs and modals - Create user interaction elements
- `createTask()`, `createSubtask()` - Integrate with AiderDesk task system
- State management API - Persistent state across sessions
- Settings access API - Read agent profiles, model configurations

**Multi-Process Integration:**
- Extensions run in appropriate Electron process context
- IPC-aware API design for main/renderer/preload communication
- Security boundaries respected (no direct access to privileged operations)

### Extension Development Experience

**Skill-Based Development:**
- **Extension Builder Skill** is the primary development workflow
- AI-assisted development directly within AiderDesk
- No traditional IDE integration required
- Agent helps with code generation, debugging, and refinement
- Skill provides:
  - API guidance and suggestions
  - Code templates and patterns
  - Error diagnosis and fixes
  - Best practices recommendations

**Development Workflow:**
1. User activates Extension Builder Skill in AiderDesk
2. Conversational interaction to define extension behavior
3. Agent generates TypeScript code with proper types and structure
4. User saves extension file to appropriate directory
5. AiderDesk auto-discovers and loads extension
6. User tests and iterates with agent assistance

**Type Safety:**
- Full TypeScript type definitions for entire Extension API
- Compile-time error detection during development
- IDE-like experience within AiderDesk skill interface
- Clear, well-typed interfaces for all extension capabilities

### Documentation Strategy

**Docs-Site Integration:**
- Extend existing AiderDesk docs-site with extension documentation
- Maintain consistent documentation structure and branding
- Leverage existing docs infrastructure (build, deployment, i18n)

**Documentation Content:**
- Complete API reference with TypeScript type signatures
- LLM-friendly documentation for agent-assisted development
- Multiple working examples for each major capability:
  - Tool registration
  - Tool result manipulation
  - UI element registration (action buttons, dialogs)
  - Event subscription
  - Task/subtask creation
  - State management
  - Settings access

**Extension Builder Skill Documentation:**
- How to activate and use the skill
- Conversation patterns and examples
- Common workflows and use cases
- Troubleshooting and best practices

### Extension Examples

**Core Examples (MVP):**

1. **Tool Registration Example:**
   - Register a custom tool that agents can invoke
   - Handle tool parameters and return formatted results
   - Error handling and edge cases

2. **Tool Result Update Example:**
   - Intercept and modify agent tool results
   - Enhance or transform responses
   - Add metadata or formatting

3. **UI Element Examples:**
   - Add action buttons to UI
   - Create custom dialogs for user interaction
   - Display status indicators or notifications

**Migration Example:**
- **WakaTime Extension:** Migrate existing hook to extension format
- Demonstrates real-world usage
- Shows complete extension structure

### Implementation Considerations

**Extension Discovery:**
- Global directory: `~/.aider-desk/extensions/` (personal extensions)
- Project directory: `.aider-desk/extensions/` (project-specific extensions)
- Auto-discovery on AiderDesk startup
- Hot-reload during development (for iteration)

**Extension Loading:**
- Type-check extensions on load (using TypeScript compiler API)
- Validate API usage and security boundaries
- Graceful error handling for malformed extensions
- Extension metadata extraction (name, version, description)

**Security Considerations:**
- Sandboxed extension execution environment
- No direct access to file system or privileged APIs
- Explicit permissions for sensitive operations
- Extension manifest or metadata for transparency

**Performance:**
- Minimal overhead for extension loading and invocation
- Lazy loading where appropriate
- No blocking main thread operations
- Extension performance monitoring and debugging tools

**Backward Compatibility:**
- Stable Extension API contract for extensions
- Versioning strategy for API evolution
- Deprecation warnings and migration guides
- Maintain compatibility with existing extensions as system evolves

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Platform MVP
- Focus on demonstrating extensibility works and users can build custom functionality
- Empower extension creators with a complete, well-designed API
- Enable early adopters to create and share extensions
- Validate that the extension concept solves real user problems

**Resource Requirements:**
- TypeScript/React development experience
- Electron multi-process architecture understanding
- API design and developer experience focus
- Documentation and example creation skills

**Rationale:** A platform MVP is appropriate because the success criteria depend on community extension creation (20 extensions in 3 months). The best way to enable this is to provide a complete, well-documented API that empowers creators like Alex to build what they need.

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- **Alex (Extension Creator):** Full extension development workflow with Extension Builder Skill
- **Jordan (Extension User):** Discover, install, and use community extensions
- **Sam (Team Standardization):** Create and share project-specific extensions
- **Taylor (Domain Specialist):** Benefit from domain-specific extensions built by others

**Must-Have Capabilities:**

**Extension API (TypeScript):**
- `registerTool()` - Register custom tools for agent invocation
- `on()` - Subscribe to system events (all hook events + `agentRunFinished`, `agentIterationFinished`)
- UI elements - Action buttons, dialogs for user interaction
- `createTask()`, `createSubtask()` - Integrate with AiderDesk task system
- State management - Persistent state across sessions
- Settings access - Read agent profiles, model configurations

**Extension Discovery:**
- Global directory: `~/.aider-desk/extensions/`
- Project directory: `.aider-desk/extensions/`
- Auto-discovery and loading on startup
- Multi-file support with imports for complex extensions

**Extension Builder Skill:**
- AI-assisted extension development within AiderDesk
- API guidance and code generation
- Debugging and refinement assistance
- Best practices recommendations

**WakaTime Extension:**
- Migration from existing hook to extension format
- Demonstrates real-world extension usage
- Validates extensibility model

**Documentation:**
- Complete API reference with TypeScript type signatures
- LLM-friendly documentation for agent-assisted development
- Multiple working examples: tool registration, event handling, UI elements, tasks, state, settings
- Extension Builder Skill usage guide
- Best practices and patterns

**Technical Foundation:**
- TypeScript type definitions for entire Extension API
- Compile-time type checking for extensions
- Security sandboxing and IPC-aware design
- Extension loading validation and error handling
- Performance-conscious implementation

### Post-MVP Features

**Phase 2 (Post-MVP - Growth):**

- GUI-based configuration screens for extension settings
- Extension marketplace foundation:
  - Browsing and installation
  - Ratings and reviews
  - User feedback
  - Search and filtering
- Enhanced extension examples and patterns
- Extension performance monitoring and debugging tools

**Phase 3 (Expansion - Vision):**

- npm package support for complex extensions with dependencies
- Extension signing and trust mechanisms
- Advanced UI components beyond buttons/dialogs
- Web-based extension marketplace
- Mobile extension support (if AiderDesk expands)
- Third-party marketplace ecosystem
- MCP integration for external server connections

### Risk Mitigation Strategy

**Technical Risks:**

**Risk:** Extension security vulnerabilities could compromise AiderDesk
**Mitigation:**
- Sandboxed extension execution environment
- Explicit permission model for sensitive operations
- No direct access to file system or privileged APIs
- Extension type-checking and validation on load
- Security-focused API design with clear boundaries

**Risk:** Extension performance could degrade AiderDesk responsiveness
**Mitigation:**
- Lazy loading where appropriate
- Non-blocking extension operations
- Extension performance monitoring tools
- Clear documentation of performance best practices

**Market Risks:**

**Risk:** Users don't create extensions despite full API availability
**Mitigation:**
- Extension Builder Skill lowers development barrier
- Multiple working examples provide patterns to follow
- LLM-friendly documentation enables AI-assisted development
- Early engagement with power users (Alex personas)
- Community showcase and encouragement

**Risk:** Extension ecosystem doesn't reach 50% adoption target
**Mitigation:**
- WakaTime migration provides immediate, useful extension
- Seed extensions for common use cases
- Focus on extensions that solve high-pain workflows
- Community Discord engagement and support

**Resource Risks:**

**Risk:** Documentation and example creation takes longer than expected
**Mitigation:**
- LLM-friendly documentation design reduces writing effort
- Extension Builder Skill serves as living documentation
- Start with core examples, expand based on user feedback
- Community contributions for additional examples

**Risk:** Extension Builder Skill complexity underestimates effort
**Mitigation:**
- Skill can be iterative - basic assistance first, advanced features later
- API completeness makes skill implementation more straightforward
- User feedback drives skill capability expansion

## Functional Requirements

### Extension Development

**FR1:** Extension creators can register custom tools that agents and subagents can invoke during conversations
**FR2:** Extension creators can subscribe to system events including all hook events and new agent lifecycle events
**FR3:** Extension creators can register action buttons in the AiderDesk UI
**FR4:** Extension creators can create custom dialogs and modals for user interaction
**FR5:** Extension creators can create and manage tasks within AiderDesk's task system
**FR6:** Extension creators can create and manage subtasks within AiderDesk's task system
**FR7:** Extension creators can maintain persistent state that persists across AiderDesk sessions
**FR8:** Extension creators can read agent profiles and model configurations
**FR9:** Extension creators can write TypeScript code using the complete Extension API with full type safety
**FR10:** Extension creators can create multi-file extensions that import from other files

### Extension Installation & Discovery

**FR11:** Users can install extensions by copying TypeScript files to a global extensions directory
**FR12:** Users can install extensions by copying TypeScript files to a project-specific extensions directory
**FR13:** AiderDesk automatically discovers and loads extensions from both global and project directories on startup
**FR14:** Users can see which extensions are currently loaded and their status
**FR15:** Users can manually trigger extension reload during development

### Extension Execution

**FR16:** Agents can invoke tools registered by extensions during conversations
**FR17:** Extensions can modify tool results before they are returned to the agent
**FR18:** Extension action buttons appear in the appropriate UI contexts
**FR19:** Extension dialogs display when triggered by user actions or extension logic
**FR20:** Extension event handlers execute when subscribed system events occur
**FR21:** Extensions can create tasks that appear in AiderDesk's task management UI
**FR22:** Extensions can create subtasks within existing tasks
**FR23:** Extensions access their persistent state across AiderDesk sessions
**FR24:** Extensions read agent profiles and model configurations when needed

### Extension Builder Skill

**FR25:** Users can activate a dedicated Extension Builder skill within AiderDesk
**FR26:** Extension Builder skill provides API guidance and suggestions for extension development
**FR27:** Extension Builder skill generates TypeScript code templates for extension development
**FR28:** Extension Builder skill diagnoses errors in extension code
**FR29:** Extension Builder skill suggests improvements and best practices for extensions
**FR30:** Extension Builder skill helps users iterate on extensions through conversational interaction

### Extension API Capabilities

**FR31:** Extension API provides method for registering custom tools with defined parameters and return types
**FR32:** Extension API provides method for subscribing to system events
**FR33:** Extension API provides method for registering UI action buttons
**FR34:** Extension API provides method for creating custom dialogs and modals
**FR35:** Extension API provides method for creating tasks
**FR36:** Extension API provides method for creating subtasks
**FR37:** Extension API provides method for reading and writing persistent state
**FR38:** Extension API provides method for reading agent profiles and model configurations
**FR39:** Extension API provides complete TypeScript type definitions for all capabilities
**FR40:** Extension API runs extensions within appropriate Electron process contexts with IPC awareness

### Extension Documentation

**FR41:** Users can access complete API reference documentation with TypeScript type signatures
**FR42:** Documentation includes multiple working examples for tool registration
**FR43:** Documentation includes multiple working examples for event subscription
**FR44:** Documentation includes multiple working examples for UI element registration
**FR45:** Documentation includes multiple working examples for task and subtask creation
**FR46:** Documentation includes multiple working examples for state management
**FR47:** Documentation includes multiple working examples for settings access
**FR48:** Documentation includes usage guide for the Extension Builder skill
**FR49:** Documentation is formatted in LLM-friendly structure for AI-assisted development
**FR50:** Documentation extends the existing AiderDesk docs-site infrastructure

### Extension Security & Validation

**FR51:** AiderDesk type-checks extensions on load using TypeScript compiler API
**FR52:** AiderDesk validates extension API usage and security boundaries on load
**FR53:** AiderDesk handles malformed extensions with graceful error messages
**FR54:** Extensions execute in a sandboxed environment without direct file system access
**FR55:** Extensions cannot access privileged APIs without explicit permissions
**FR56:** AiderDesk validates extension operations against security policies during execution

## Non-Functional Requirements

### Performance

**NFR1:** Extension loading and initialization does not visibly delay AiderDesk startup time
**NFR2:** Extension tool invocation does not add noticeable latency to agent responses
**NFR3:** Extension event handlers execute without blocking main application thread
**NFR4:** Multiple extensions can run concurrently without degrading AiderDesk responsiveness
**NFR5:** Extension Builder skill provides responsive assistance without significant delays

### Reliability

**NFR6:** AiderDesk continues running normally when an extension encounters an error
**NFR7:** Extension errors are logged with sufficient context for debugging without disrupting user experience
**NFR8:** Malformed or invalid extensions are detected and reported without causing AiderDesk to crash
**NFR9:** Extension validation failures provide clear error messages to users
**NFR10:** Extension crashes are isolated and do not affect other extensions or AiderDesk core functionality

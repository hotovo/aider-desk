---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - project-context.md
  - README.md
  - docs-site/docs/intro.md
  - docs-site/docs/agent-mode/agent-mode.md
date: 2026-01-14
author: Vlad
---

# Product Brief: aider-desk

<!-- Content will be appended sequentially through collaborative workflow steps -->

## Executive Summary

AiderDesk Extension System is a next-generation extensibility framework that transforms the application from a fixed-feature product into a platform where users can build, share, and install custom functionality. Inspired by pi-agent's powerful extension system but adapted for AiderDesk's desktop-first architecture, this system gives users the same level of control and customization that power users demand.

The extension system addresses a critical limitation of the current hook system, which was built as a proof-of-concept and lacks the depth needed for serious customization. By providing a TypeScript-based API with tool registration, event handling, UI component integration, and task/subtask management, extensions unlock workflows that would otherwise require core development effort.

This system serves multiple strategic goals: it offloads niche features to the community, accelerates feature delivery, enables users to tailor AiderDesk to their specific workflows, and creates an ecosystem that drives adoption and growth. With planned future support for GUI-based configuration, extensions will become even more accessible while maintaining power for advanced users.

---

## Core Vision

### Problem Statement

AiderDesk's current hook system was implemented as a proof-of-concept and is fundamentally limited. While it provides basic event subscription and message modification, it cannot register custom tools that the agent can call, lacks UI component capabilities beyond simple logging, offers no state management, and prevents users from implementing complex workflows without core development changes. As AiderDesk's user base grows and use cases diversify, this limitation becomes a development bottleneck - features that could be implemented once as extensions now require core engineering resources, and power users with unique workflow needs find the platform insufficiently flexible.

### Problem Impact

Without a robust extension system, AiderDesk faces multiple risks: feature delivery slows as the team must implement niche functionality in core code; users cannot customize their workflows leading to reduced adoption and potential churn; the product cannot accommodate diverse user needs creating market vulnerability; power users migrate to more extensible alternatives; and the platform misses ecosystem growth opportunities. Extensions that exist today like the WakaTime hook remain stuck in POC state, demonstrating the gap between what's possible and what's usable. Most critically, the inability for users to create and share powerful workflows like a full BMAD METHOD implementation means AiderDesk cannot benefit from community innovation.

### Why Existing Solutions Fall Short

The current hook system in AiderDesk provides only basic event subscription capabilities. Hooks can react to system events and modify some data, but they cannot proactively register new tools that the agent or subagents can invoke, have no ability to add custom UI elements like buttons or interactive dialogs, offer no persistent state management across sessions, are restricted to JavaScript without TypeScript type safety, and provide no structured way to package and share complex extensions. While pi-agent's extension system demonstrates what's possible with tools, commands, rich UI, and state management, its terminal-first design and TUI components don't translate to AiderDesk's desktop environment, and its lack of project-scoped extensions and task management integration means AiderDesk users would lose native capabilities they rely on.

### Proposed Solution

AiderDesk Extension System introduces a TypeScript-based extension API that provides comprehensive customization capabilities while maintaining the desktop application's React-based UI framework. Extensions are single TypeScript files that register custom tools, subscribe to events (including new agentRunFinished and agentIterationFinished events), add UI elements like action buttons and dialogs, create and manage tasks/subtasks, maintain persistent state, and read existing settings such as agent profiles and model configurations. Extensions are auto-discovered from global (`~/.aider-desk/extensions/`) and project-specific (`.aider-desk/extensions/`) directories, enabling both personal customizations and team sharing. Phase 1 focuses on the backend extension API with basic UI element support, while Phase 2 will add GUI-based configuration screens for extension settings, eliminating the need for manual configuration file editing.

### Key Differentiators

AiderDesk's extension system provides unique advantages over pi-agent and other extensible tools. The desktop-first architecture leverages React UI components instead of terminal-based interfaces, enabling rich interactive elements that feel native to the application. Native task and subtask management APIs allow extensions to create and orchestrate workflows within AiderDesk's existing task system, something terminal-based tools cannot offer. Seamless agent and subagent integration means extensions can leverage AiderDesk's sophisticated AI agent capabilities. Future GUI-based configuration for extension settings will dramatically improve accessibility compared to editing configuration files. Project-scoped extensions enable per-project customizations that fit naturally into AiderDesk's workflow. Perhaps most importantly, the system empowers users to extend AiderDesk with full control over their workflow configuration, creating custom actions, automations, and integrations that transform how they work with the application.

---

## Target Users

### Primary Users

#### Alex - Software Engineer & Extension Creator

**Background:**
Senior software engineer building SaaS products. Uses AiderDesk daily for feature development, bug fixes, and refactoring. Proficient with TypeScript, React, and modern tooling. Values efficiency and hates repetitive tasks.

**Motivations:**
- Customize AiderDesk to fit his specific workflow
- Avoid waiting for core team to implement niche features
- Share useful extensions with the community
- Build complex workflows like a full BMAD METHOD implementation

**Current Pain:**
- Hook system too limited for what he wants to accomplish
- Can't register custom tools that agent can invoke
- Can't add UI elements to streamline common actions
- Contributing to core AD is too specific and harder to extend

**Success Vision:**
"Building extensions is easier than core contribution. I can use AiderDesk itself - with a special skill the agent activates - to help me build the exact extension I need. The documentation is LLM-friendly so I can even let the agent draft the initial code. I can share my BMAD METHOD workflow with the community."

---

### Secondary Users

#### Jordan - Developer Workflow Adopter

**Background:**
Software engineer using AiderDesk for various projects. Appreciates power of automation but doesn't want to build extensions from scratch. Wants to leverage community-created workflows to boost productivity.

**Motivations:**
- Save time by using battle-tested extensions
- Adopt workflows that others have perfected
- Contribute back feedback to improve extensions

**Current Pain:**
- Hard to discover useful extensions without a centralized marketplace
- Not sure which extensions are reliable and well-maintained

**Success Vision:**
"I can find extensions through community Discord, GitHub examples, or future marketplace. When I install one, it just works. My 'aha!' moment is realizing I've saved hours of work. The extension is well-documented with good user feedback so I can trust it."

---

#### Sam - Product Manager

**Background:**
Product manager overseeing development teams. Uses AiderDesk occasionally to understand development workflows. Relies on engineering-built extensions to enforce standardized processes without needing technical knowledge.

**Motivations:**
- Ensure team follows consistent workflows
- Reduce time spent on manual project management
- Leverage engineering's expertise without being technical

**Success Vision:**
"Extensions are well-documented and have great user feedback. Installation is simple - just download and copy to folder. Later, I can even install from within AiderDesk itself. I can rely on my team's expertise without learning complex tools."

---

#### Taylor - Domain Specialist (Data Analyst / Accountant)

**Background:**
Domain specialist who uses AiderDesk occasionally for specific technical tasks related to their field. Relies on domain-specific extensions built for them by developers.

**Motivations:**
- Use powerful tools without needing to understand their internals
- Automate domain-specific workflows
- Focus on core work, not tool configuration

**Success Vision:**
"Someone builds an extension for my domain. I just download and copy it to a folder, or maybe even install it with a simple command. Later, there's a marketplace within AiderDesk where I can browse and install. The extension just works - I don't need to understand how."

---

### User Journey

#### Extension Creator (Alex) Journey

**Discovery:** Alex learns about the extension system through AiderDesk documentation or community discussion. He realizes it can solve a workflow problem.

**Onboarding:** Alex reads LLM-friendly documentation. He activates a special "extension builder" skill within AiderDesk. The agent helps him draft his BMAD METHOD workflow extension, providing structure and examples.

**Core Usage:** Alex iterates on his extension using AiderDesk itself. The agent assists with debugging and refinement. He tests it thoroughly.

**Sharing Moment:** Alex publishes his BMAD METHOD extension to GitHub with clear documentation. Community provides feedback and it becomes a go-to resource.

**Long-term:** Alex becomes a trusted extension creator, known for high-quality workflow automations.

---

#### Extension User (Jordan) Journey

**Discovery:** Jordan discovers a useful extension through community Discord, GitHub examples, or hears about it from colleagues.

**Onboarding:** Jordan reads the extension's documentation and user feedback. Installation is simple - download of `.ts` file and copy it to `~/.aider-desk/extensions/`. AiderDesk auto-detects it.

**Core Usage:** Jordan installs a BMAD METHOD extension. It just works - adds actions buttons, registers tools, and automates his workflow.

**Success Moment:** Jordan realizes he's saved hours of manual work. His productivity increases dramatically.

**Long-term:** Jordan becomes an extension power user, sharing feedback and contributing to the ecosystem. He may even start creating his own extensions.

---

#### Non-Technical User (Sam/Taylor) Journey

**Discovery:** Sam or Taylor hears about a useful extension from their team or community.

**Onboarding:** Installation is straightforward - download and copy to folder, or use a simple command within AiderDesk. Later, they can browse and install from a built-in marketplace.

**Core Usage:** The extension is well-documented and reliable. It provides domain-specific functionality without requiring technical knowledge.

**Success Moment:** They accomplish tasks that would have been difficult or impossible without the extension.

**Long-term:** They rely on extensions as part of their regular workflow, confident in their simplicity and reliability.

---

## Success Metrics

### User Success Metrics

**Extension Creators (Alex):**
- **Primary Outcome:** Ability to customize AiderDesk to their specific workflow
- **Success Moment:** "I can customize AD to my workflow exactly how I want"
- **Key Behaviors:**
  - Shares extensions with their team
  - Shares extensions with broader community
  - Returns to build more extensions
  - Provides feedback on documentation and developer experience

**Extension Users (Jordan, Sam, Taylor):**
- **Primary Outcome:** Solve workflow problems through extensions
- **Success Moment:** Installing an extension that "just works" and transforms their workflow
- **Key Behaviors:**
  - Regularly use installed extensions
  - Recommend extensions to teammates
  - Provide feedback on extensions
  - Return to discover more extensions

---

### Business Objectives

#### 3-Month Objectives
- **Customizing Workflows:** Enable power users to create extensions that solve their specific workflow problems
- **Building Trust with AD:** Demonstrate that AiderDesk invests in user empowerment and community growth
- **Initial Ecosystem:** First wave of high-quality extensions created and shared by power users

#### 12-Month Objectives
- **Marketplace Foundation:** Lay groundwork for extension marketplace (even if basic initially)
- **Custom Workflows at Scale:** Growing number of users customizing their workflows with extensions
- **Differentiation:** AiderDesk recognized as extensible platform vs. fixed-feature product
- **Trust & Loyalty:** Enhanced user trust through community-driven features

---

### Key Performance Indicators

#### Ecosystem Health KPIs

**Extension Creation & Sharing:**
- **New Extensions Created:** Number of unique extensions created per month
- **Extensions Shared:** Number of extensions published to GitHub/shared publicly per month
- **Extension Quality:** User ratings, issue resolution rates, community adoption

#### User Acquisition & Growth KPIs

**New Users from Extensibility:**
- **New Users Citing Extensions:** Percentage of new users mentioning extensibility as reason for adoption
- **Visible Influx:** Noticeably more users trying out AiderDesk (qualitative + quantitative)
- **User Trials:** Number of users installing at least one extension within first week

#### User Retention & Engagement KPIs

**Extension Adoption:**
- **Extension Installation Rate:** Percentage of active users who have installed at least one extension
- **Extension Usage Frequency:** How often extensions are used (daily, weekly, monthly)
- **Extension Retention:** Percentage of installed extensions still used after 30 days

**User Retention:**
- **User Retention with Extensions:** Retention rate of users who use extensions vs. those who don't
- **Return to Extension System:** Percentage of users who install additional extensions after first one

#### Leading Indicators (Predict Success)

**Early Adoption Signals:**
- **Community Interest:** GitHub stars on extension examples, Discord discussions about extensions
- **Documentation Engagement:** Page views on extension documentation
- **Extension Builder Skill Usage:** How often users activate extension builder skill to get help

---

### Connecting Metrics to Strategy

**User Success → Business Success:**
- When creators share extensions → ecosystem grows → attracts new users
- When users customize workflows → they stick around → retention improves
- When community contributes → trust builds → product differentiates

**Leading → Lagging:**
- Early community interest (leading) → predicts extension ecosystem growth (lagging)
- Extension builder skill usage (leading) → predicts successful extensions created (lagging)
- Documentation engagement (leading) → predicts extension adoption (lagging)

---

## MVP Scope

### Core Features (MVP - Phase 1)

**Full Extension System:**
- **Single TypeScript File Extensions** - Simple, approachable format for extension developers
- **Extension API** - Comprehensive TypeScript-based API including:
  - Tool registration (`registerTool()`)
  - Event subscription (`on()` for all hook events + `agentRunFinished`, `agentIterationFinished`)
  - UI element registration (`registerActionButton()`, dialogs)
  - Task/subtask creation APIs (`createTask()`, `createSubtask()`)
  - State management (persistent state across sessions)
  - Settings access (read agent profiles, model configurations)
- **Event System** - All existing hook events migrated plus new agent lifecycle events
- **UI Elements** - Action buttons, dialogs for user interaction
- **Extension Discovery** - Auto-discovery from:
  - Global: `~/.aider-desk/extensions/`
  - Project: `.aider-desk/extensions/`
- **Extension Builder Skill** - Special skill that agent can activate to help users build extensions
- **WakaTime Extension** - Existing hook reimplemented as extension example
- **Documentation** - LLM-friendly documentation with:
  - Complete API reference
  - Multiple working examples
  - Extension builder skill usage guide
  - Best practices and patterns

**Rationale:** This entire system constitutes a cohesive MVP. Users aren't expecting GUI config initially. The system is designed to naturally evolve without rewrites.

---

### Out of Scope for MVP

**Explicitly Deferred to Phase 2:**
- **GUI Configuration Screens** - Extension settings configuration through AiderDesk UI (currently would require manual config file editing)

**Rationale:** This is clearly Phase 2 based on our earlier discussions. The backend extension system is the foundation; UI configuration is an enhancement to improve accessibility later.

---

### MVP Success Criteria

**Primary Success Indicators:**
- **Extension Utilization:** Some users are actively utilizing extensions (measurable: installed extensions, extension usage frequency)
- **User Validation:** Qualitative feedback like "AD helped me build this to make my workflow easier"
- **Ecosystem Start:** At least one non-example extension created by a user (not just WakaTime)
- **Migration Success:** WakaTime successfully migrated from hook to extension without major issues
- **Documentation Effectiveness:** Users can create extensions with minimal support (documentation usage vs. support requests)

**Decision Points:**
- If no extensions created beyond examples → investigate onboarding friction
- If documentation generates excessive support questions → improve clarity and examples
- If extension builder skill not used → improve discoverability or value proposition

---

### Future Vision

**Phase 2 Enhancements (Natural Evolution):**
- **GUI Configuration** - Extension settings screens within AiderDesk UI
- **Extension Marketplace** - Built-in marketplace with:
  - Browsing and installation
  - Ratings and reviews
  - User feedback and popularity metrics
  - Search and filtering

**Long-term Ecosystem Growth (2-3 Years):**
- **npm Package Support** - Complex extensions as installable npm packages with dependencies
- **Extension Signing/Security** - Trust mechanism for third-party extensions
- **Advanced UI Components** - Rich custom UI components beyond buttons/dialogs
- **Web-based Discovery** - Browser-based extension marketplace
- **Mobile Extension Support** - If AiderDesk expands to mobile
- **Third-Party Marketplace** - External developers building extensions as business
- **MCP Integration** - Extensions that integrate with external MCP servers

**Architecture for No-Rewrite Evolution:**
- Core extension API designed for extensibility from Day 1
- Clear separation between extension system and UI (UI is just another extension capability)
- Future marketplace builds on existing discovery and installation patterns
- GUI configuration adds UI layer to existing settings system, doesn't replace it

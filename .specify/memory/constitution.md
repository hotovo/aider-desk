# AiderDesk Constitution

<!-- Sync Impact Report:
Version change: 1.0.0 → 1.0.0 (initial constitution)
Modified principles: None (new constitution)
Added sections: All sections (new constitution)
Removed sections: None
Templates requiring updates: ✅ plan-template.md, ✅ spec-template.md, ✅ tasks-template.md
Follow-up TODOs: None
-->

## Core Principles

### I. Code Quality Excellence
All code MUST adhere to established coding standards and maintain high quality benchmarks. TypeScript is mandatory for all new code with strict type checking enabled. Code MUST be self-documenting with clear, meaningful variable and function names. Complex logic MUST be accompanied by explanatory comments. All code MUST pass ESLint with auto-fix and maintain consistent formatting using Prettier. Code complexity MUST be minimized through proper abstraction and single responsibility principle adherence.

### IV. Performance Requirements
All code MUST meet strict performance benchmarks. UI rendering MUST maintain 60fps during animations and interactions. Memory usage MUST be optimized to prevent leaks and excessive consumption. File operations MUST be efficient with proper streaming for large files. The application MUST start within 3 seconds on supported hardware. Resource-intensive operations MUST be properly managed to prevent blocking the main thread. Database queries MUST be optimized and include proper indexing.

### V. Architecture Integrity
The multi-process Electron architecture MUST be maintained with clear separation between main, renderer, and preload processes. IPC communication MUST be type-safe and secure. The agent system built on Vercel AI SDK MUST follow established patterns for tool integration. MCP server functionality MUST remain extensible and backward compatible. Project management MUST support multiple concurrent projects with isolated Python processes. All external integrations MUST follow the established patterns for IDE plugins and REST APIs.

## Development Standards

### Technology Stack Requirements
Frontend MUST use React 18 with TypeScript, Tailwind CSS for styling, and Framer Motion for animations. Backend processes MUST use Node.js with TypeScript. Python integration MUST use the established connector pattern. Build system MUST use electron-vite with esbuild for MCP server. All dependencies MUST be vetted for security and compatibility. Version management MUST follow semantic versioning with proper changelog maintenance.

### Security & Privacy
All user data MUST be handled securely with proper encryption at rest and in transit. API keys and sensitive configuration MUST be stored securely using electron-store. File system access MUST be properly sandboxed and validated. External tool integrations MUST be properly authenticated and authorized. Telemetry data MUST be anonymized and respect user privacy preferences. All network communications MUST use secure protocols.

## Quality Gates

### Code Review Process
All pull requests MUST require at least one code review approval. Reviews MUST verify compliance with constitution principles. Automated checks MUST pass including type checking, linting, and testing. Performance benchmarks MUST be met for all changes. Documentation MUST be updated for all user-facing changes. Breaking changes MUST be properly versioned and communicated.

### Testing Requirements
Unit test coverage MUST be maintained above 80% for all critical paths. Integration tests MUST validate cross-process communication. Contract tests MUST ensure API compatibility. Performance tests MUST validate response time requirements. Accessibility tests MUST ensure WCAG compliance. Security tests MUST validate data protection measures.

## Governance

This constitution supersedes all other development practices and guidelines. Amendments require documentation, team approval, and migration plan. All development activities MUST verify compliance with constitutional principles. Complexity deviations MUST be explicitly justified and documented. Use AGENTS.md for runtime development guidance and reference. Version changes follow semantic versioning: MAJOR for backward-incompatible changes, MINOR for new features, PATCH for clarifications and fixes.

**Version**: 1.0.0 | **Ratified**: 2025-10-03 | **Last Amended**: 2025-10-03
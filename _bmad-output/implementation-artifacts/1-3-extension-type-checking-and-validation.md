# Story 1.3: Extension Type-Checking and Validation

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **system developer**,
I want **to validate extension code using TypeScript compiler API**,
So that **malformed or invalid extensions are detected before loading**.

## Acceptance Criteria

1. **Given** an extension file has been discovered
2. **When** the extension is type-checked using TypeScript compiler API
3. **Then** the TypeScript code is compiled and diagnostics are collected
4. **And** any TypeScript errors are reported with clear error messages (FR53, NFR9)
5. **And** ~~imports are validated for prohibited modules (fs, child_process, electron) (FR54, FR55)~~ (Excluded for now)
6. **And** extensions with TypeScript errors are rejected before loading (NFR8)
7. **And** ~~extensions with prohibited imports are rejected with clear error messages~~ (Excluded for now)
8. **And** validation failures return diagnostic details for debugging (NFR7)

## Tasks / Subtasks

- [x] Create ExtensionValidator class (AC: 1, 8)
  - [x] Define file location: `src/main/extensions/extension-validator.ts`
  - [x] Create `ExtensionValidator` class
  - [x] Add `validateExtension(filePath: string): Promise<ValidationResult>` method
- [x] Implement TypeScript compilation and diagnostics (AC: 2, 3, 4, 8)
  - [x] Use `ts.createProgram` or `ts.createLanguageService` to compile the file
  - [x] Retrieve diagnostics using `ts.getPreEmitDiagnostics`
  - [x] Format diagnostics into clear error messages
  - [x] Return failure result if critical errors exist
- [ ] ~~Implement Prohibited Import Validation (AC: 5, 7)~~ (Moved to future story)
  - [ ] ~~Walk the AST to find `ts.ImportDeclaration` nodes~~
  - [ ] ~~Check module specifiers against prohibited list (`fs`, `child_process`, `electron`)~~
  - [ ] ~~Also check for dynamic imports if possible/necessary~~
  - [ ] ~~Return failure result if prohibited imports are found~~
- [x] Integration with ExtensionManager (AC: 6)
  - [x] Update `ExtensionManager` to use `ExtensionValidator`
  - [x] Filter out invalid extensions from the discovery list (or mark them as invalid)
- [x] Add Unit Tests
  - [x] Test with valid extension file
  - [x] Test with extension having syntax errors
  - [ ] ~~Test with extension using prohibited imports (`fs`, `electron`)~~ (Deferred)
  - [x] Test error message clarity

## Dev Notes

- **Library Usage**: Use the `typescript` package (already in devDependencies) for the compiler API.
- **Performance**: Creating a `ts.Program` can be heavy. Consider reusing a single compiler host or program instance if validating multiple files, or ensure it doesn't block the main thread too much (though currently strictly sequential in main process might be acceptable for MVP).
- **Prohibited Modules**: The list includes `fs`, `child_process`, `electron`. Note that `original-fs` should also be blocked if it's accessible.
- **Error Formatting**: Use `ts.formatDiagnosticsWithColorAndContext` or similar for readable logs, but ensure the returned error message is clean for UI/Logs.

### Project Structure Notes

- **File Location**: `src/main/extensions/extension-validator.ts`
- **Exports**: Export `ExtensionValidator` and `ValidationResult` interface from `src/main/extensions/index.ts`.
- **Integration**: `ExtensionManager` in `src/main/extensions/extension-manager.ts` will need to import and instantiate `ExtensionValidator`.

### Technical Requirements

- **TypeScript API**:
  - `import * as ts from 'typescript';`
  - `ts.createProgram([filePath], compilerOptions)`
  - `program.getSemanticDiagnostics()`, `program.getSyntacticDiagnostics()`
  - `ts.forEachChild` for AST traversal to find imports.

- **ValidationResult Interface**:
  ```typescript
  export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings?: string[];
  }
  ```

### Architecture Compliance

- **Sandboxing**: This story is the *static analysis* part of sandboxing. It prevents obvious security violations (imports) and ensures code validity before execution.
- **Error Handling**: Follow the pattern of not crashing the app. If validation fails, just log it and skip the extension.

### References

- [TypeScript Compiler API Documentation](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)
- [Story 1.2 Implementation](_bmad-output/implementation-artifacts/1-2-extension-file-discovery.md)
- [Architecture Decision: Security Sandbox](_bmad-output/planning-artifacts/architecture.md#security-sandbox-boundaries)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List
- Implemented `ExtensionValidator` class using TypeScript compiler API.
- Added `validateExtension` method to check for syntax and type errors.
- Integrated `ExtensionValidator` into `ExtensionManager` to filter invalid extensions.
- Added unit tests for valid and invalid extensions.
- Deferred prohibited import validation to a future story as per user request.

### File List
- src/main/extensions/extension-validator.ts
- src/main/extensions/__tests__/extension-validator.test.ts
- src/main/extensions/extension-manager.ts
- src/main/extensions/__tests__/extension-manager.test.ts
- src/main/extensions/index.ts

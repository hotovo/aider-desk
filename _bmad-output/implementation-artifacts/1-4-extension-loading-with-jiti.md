# Story 1.4: Extension Loading with jiti

**Status**: review
**Story Key**: 1-4-extension-loading-with-jiti

## Story

As a **system developer**,
I want **to load valid TypeScript extension files using jiti**,
So that **extensions can be loaded without pre-compilation**.

## Acceptance Criteria

- [x] **Given** an extension file has passed type-checking and validation
- [x] **When** jiti transpiles and requires the extension file
- [x] **Then** the extension module is loaded as a JavaScript class
- [x] **And** the extension class is instantiated
- [x] **And** the extension's static metadata is extracted from the class
- [x] **And** extensions are loaded in the order: global extensions first, then project extensions (FR13)
- [x] **And** project extensions override global extensions with the same name
- [x] **And** loading errors are caught and logged with extension name and error details (NFR7, NFR10)
- [x] **And** failed extensions do not prevent other extensions from loading (NFR6, NFR10)
- [x] **And** the extension is added to the extension registry with its metadata

## Tasks/Subtasks

- [x] Implement `loadExtension` method in `ExtensionLoader`
    - [x] Add `jiti` dependency
    - [x] Import `jiti` and configure it for TypeScript loading
    - [x] Implement loading logic: require file, extract default export
    - [x] Verify default export is a class
    - [x] Instantiate extension class
    - [x] Extract metadata from instance or static property
- [x] Implement `loadExtensions` method in `ExtensionManager` or `ExtensionLoader`
    - [x] Iterate through discovered files
    - [x] Handle loading order (global first, then project)
    - [x] Handle overriding (map by name)
    - [x] Error handling (try-catch per extension)
- [x] Update `ExtensionRegistry` to store loaded extensions
    - [x] Add `register(extension: Extension)` method
    - [x] Add `getExtensions()` method
- [x] Define minimal `Extension` interface if not available
    - [x] Define `ExtensionMetadata` interface (name, version, description, author, capabilities)
    - [x] Define `Extension` interface (onLoad, onUnload, metadata)

## Dev Notes

- `jiti` is a runtime TS transpiler.
- We need to ensure `jiti` is configured correctly.
- We need to handle `default` export.
- Metadata extraction: likely `MyExtension.metadata` or `instance.metadata`.
- Registry should map `extensionId` -> `ExtensionInstance`.

## Dev Agent Record

### Debug Log
- (Empty)

### Completion Notes
- Implemented `ExtensionLoader` using `jiti` for dynamic TypeScript loading.
- Created `ExtensionRegistry` to manage loaded extensions.
- Updated `ExtensionManager` to integrate discovery, validation, loading, and registration.
- Added comprehensive unit tests for loader, registry, and manager using Vitest with jiti mocking.
- Verified that all acceptance criteria are met, including error handling, loading order, and overriding logic.
- All new tests passed: `extension-loader.test.ts`, `extension-manager.test.ts`, `extension-registry.test.ts`.

## File List
- src/main/extensions/extension-loader.ts
- src/main/extensions/extension-manager.ts
- src/main/extensions/extension-registry.ts
- src/common/extensions/types.ts
- src/main/extensions/__tests__/extension-loader.test.ts
- src/main/extensions/__tests__/extension-manager.test.ts
- src/main/extensions/__tests__/extension-registry.test.ts

## Change Log
- (Empty)

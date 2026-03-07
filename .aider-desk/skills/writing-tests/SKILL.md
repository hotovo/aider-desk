---
name: writing-tests
description: Write unit tests, component tests, and integration tests for AiderDesk using Vitest and React Testing Library. Use when creating new tests, adding test coverage, configuring mocks, setting up test files, or debugging failing tests.
---

# Writing Tests

Write effective tests using Vitest and React Testing Library.

## Quick Start

Create a unit test in `src/common/__tests__/utils/math.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { add } from '../../utils/math';

describe('math utility', () => {
  it('adds two numbers correctly', () => {
    expect(add(1, 2)).toBe(3);
  });
});
```

Run tests with `npm run test`.

## Core Patterns

### Unit Testing
Focus on pure functions and logic in `src/main` or `src/common`. Use `vi.mock()` for dependencies.
- [references/unit-testing-examples.md](references/unit-testing-examples.md)

### Component Testing
Test React components in `src/renderer`. Focus on user interactions and props.
- [references/component-testing-patterns.md](references/component-testing-patterns.md)

### Mocking
Use centralized mock factories for consistent testing across components and contexts.
- [references/mocking-guide.md](references/mocking-guide.md) - Mock factories and API patterns

## Debugging Failing Tests

1. Read the error output and identify the failing assertion
2. Check mock setup — verify `vi.mock()` paths and return values match expectations
3. For component tests, inspect rendered output with `screen.debug()`
4. Run a single test in isolation: `npm run test:node -- --no-color -t "test name"`
5. Verify coverage: `npm run test:coverage` to confirm new code is tested

## Advanced Usage

For detailed information:
- [references/test-organization.md](references/test-organization.md) - Directory structure and naming
- [references/running-tests.md](references/running-tests.md) - CLI commands and coverage
- [references/best-practices.md](references/best-practices.md) - Principles and patterns
- [references/test-patterns.md](references/test-patterns.md) - Code templates
- [assets/test-checklist.md](assets/test-checklist.md) - Pre-flight checklist

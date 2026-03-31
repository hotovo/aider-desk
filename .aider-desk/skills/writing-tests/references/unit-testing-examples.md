# Unit Testing Examples

Detailed examples for writing unit tests in AiderDesk.

## Utility Functions

### Example: Date Formatting
```typescript
// packages/common/__tests__/utils/date.test.ts
import { describe, it, expect } from 'vitest';
import { formatDate } from '../../utils/date';

describe('formatDate', () => {
  it('formats valid date to ISO string', () => {
    const date = new Date('2024-01-01');
    expect(formatDate(date)).toBe('2024-01-01');
  });

  it('returns empty string for null input', () => {
    expect(formatDate(null)).toBe('');
  });
});
```

## Service Classes (Main Process)

### Example: Project Manager
Use `vi.mocked()` to interact with global mocks defined in `setup.ts`.

```typescript
// src/main/__tests__/services/ProjectManager.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectManager } from '../../services/ProjectManager';
import fs from 'fs';

vi.mock('fs');

describe('ProjectManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates directory if it does not exist', async () => {
    const manager = new ProjectManager();
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await manager.initProject('/test/path');

    expect(fs.mkdirSync).toHaveBeenCalledWith('/test/path');
  });
});
```

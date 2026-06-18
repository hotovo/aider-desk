/**
 * Tests for power tools grep functionality.
 * Tests run real ripgrep against temp files to verify correctness.
 * Also includes a stress test that verifies large outputs don't cause
 * maxBuffer errors (relevant after refactoring from execFileAsync to spawn).
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/ripgrep', () => ({
  ensureRipgrepBinary: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/constants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/constants')>();
  return {
    ...actual,
    RIPGREP_BINARY_PATH: process.platform === 'win32' ? 'rg.exe' : 'rg',
  };
});

const POWER_TOOL_GROUP_NAME = 'power';
const TOOL_GROUP_NAME_SEPARATOR = '---';
const POWER_TOOL_GREP = 'grep';

describe('Power Tools - grep functionality', () => {
  let createPowerToolset: any;
  let mockTask: any;
  let mockProfile: any;
  let mockPromptContext: any;
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'power-grep-test-'));

    mockTask = {
      taskId: 'current-task-id',
      getTaskDir: vi.fn(() => tempDir),
      addToolMessage: vi.fn(),
      addLogMessage: vi.fn(),
      addToGit: vi.fn(),
    };

    mockProfile = {
      toolApprovals: {},
      toolSettings: {},
    };

    mockPromptContext = { id: 'test-prompt-context' };

    const approvalModule = await import('../approval-manager');
    vi.spyOn(approvalModule.ApprovalManager.prototype, 'handleToolApproval').mockResolvedValue([true, undefined] as never);

    const powerModule = await import('../power');
    createPowerToolset = powerModule.createPowerToolset;
  }, 30000);

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const getGrepTool = () => {
    if (!createPowerToolset) {
      throw new Error('createPowerToolset not initialized');
    }
    const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext);
    const grepToolKey = `${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_GREP}`;
    return tools[grepToolKey];
  };

  const execGrep = async (filePattern: string, searchTerm: string, options: { contextLines?: number; caseSensitive?: boolean; maxResults?: number } = {}) => {
    const grepTool = getGrepTool();
    const { contextLines = 0, caseSensitive = false, maxResults = 50 } = options;
    return grepTool.execute(
      { filePattern, searchTerm, contextLines, caseSensitive, maxResults },
      { toolCallId: `grep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
    ) as Promise<string>;
  };

  describe('basic functionality', () => {
    it('should find matches in a single file', async () => {
      await fs.writeFile(
        path.join(tempDir, 'component.tsx'),
        `import React from 'react';
const Component = () => <div>Hello</div>;
export default Component;
`,
        'utf8',
      );

      const result = await execGrep('*.tsx', 'React');

      expect(result).toContain('component.tsx');
      expect(result).toContain("import React from 'react'");
    });

    it('should find matches across multiple files', async () => {
      await fs.writeFile(path.join(tempDir, 'file1.ts'), 'const value = 42;\nconst value2 = 43;\n', 'utf8');
      await fs.writeFile(path.join(tempDir, 'file2.ts'), 'const value = 99;\n', 'utf8');

      const result = await execGrep('*.ts', 'value');

      expect(result).toContain('file1.ts');
      expect(result).toContain('file2.ts');
      expect(result).toContain('const value = 42');
      expect(result).toContain('const value = 99');
    });

    it('should count matches correctly in the result header', async () => {
      await fs.writeFile(path.join(tempDir, 'test.ts'), 'const hello = 1;\nconst hello2 = 2;\n', 'utf8');

      const result = await execGrep('*.ts', 'hello');

      expect(result).toContain('2 matches');
    });
  });

  describe('no matches', () => {
    it('should return no matches message when pattern not found', async () => {
      await fs.writeFile(path.join(tempDir, 'test.ts'), 'console.log("hello")', 'utf8');

      const result = await execGrep('*.ts', 'nonexistent_pattern_xyz123');

      expect(result).toContain('No matches');
    });

    it('should return no matches message when file pattern matches no files', async () => {
      await fs.writeFile(path.join(tempDir, 'test.ts'), 'const value = 1;\n', 'utf8');

      const result = await execGrep('*.py', 'value');

      expect(result).toContain('No matches');
    });
  });

  describe('maxResults limiting', () => {
    it('should limit results to maxResults', async () => {
      const lines: string[] = [];
      for (let i = 0; i < 100; i++) {
        lines.push(`const match${i} = ${i};`);
      }
      await fs.writeFile(path.join(tempDir, 'large.ts'), lines.join('\n') + '\n', 'utf8');

      const result = await execGrep('*.ts', 'match', { maxResults: 10 });

      expect(result).toContain('10 matches');
      expect(result).toContain('limit reached');
    });

    it('should not show limit notice when under maxResults', async () => {
      await fs.writeFile(path.join(tempDir, 'test.ts'), 'const hello = 1;\n', 'utf8');

      const result = await execGrep('*.ts', 'hello', { maxResults: 50 });

      expect(result).not.toContain('limit reached');
    });
  });

  describe('case sensitivity', () => {
    it('should perform case-insensitive search by default', async () => {
      await fs.writeFile(path.join(tempDir, 'test.ts'), 'const Foo = 1;\nconst foo = 2;\nconst FOO = 3;\n', 'utf8');

      const result = await execGrep('*.ts', 'foo', { caseSensitive: false });

      expect(result).toContain('const Foo = 1');
      expect(result).toContain('const foo = 2');
      expect(result).toContain('const FOO = 3');
    });

    it('should perform case-sensitive search when requested', async () => {
      await fs.writeFile(path.join(tempDir, 'test.ts'), 'const Foo = 1;\nconst foo = 2;\nconst FOO = 3;\n', 'utf8');

      const result = await execGrep('*.ts', 'Foo', { caseSensitive: true });

      expect(result).toContain('const Foo = 1');
      expect(result).not.toContain('const foo = 2');
      expect(result).not.toContain('const FOO = 3');
    });
  });

  describe('context lines', () => {
    it('should include context lines around matches', async () => {
      const content = `line1
line2
TARGET_LINE
line4
line5
`;
      await fs.writeFile(path.join(tempDir, 'test.ts'), content, 'utf8');

      const result = await execGrep('*.ts', 'TARGET_LINE', { contextLines: 1 });

      expect(result).toContain('TARGET_LINE');
      expect(result).toContain('line2');
      expect(result).toContain('line4');
    });

    it('should not include context lines when contextLines is 0', async () => {
      const content = `line1
TARGET_LINE
line3
`;
      await fs.writeFile(path.join(tempDir, 'test.ts'), content, 'utf8');

      const result = await execGrep('*.ts', 'TARGET_LINE', { contextLines: 0 });

      expect(result).toContain('TARGET_LINE');
      expect(result).not.toContain('line1');
      expect(result).not.toContain('line3');
    });
  });

  describe('regex patterns', () => {
    it('should support regex search terms', async () => {
      await fs.writeFile(path.join(tempDir, 'test.ts'), 'const user123 = 1;\nconst product456 = 2;\nconst order789 = 3;\n', 'utf8');

      const result = await execGrep('*.ts', 'user\\d+');

      expect(result).toContain('const user123 = 1');
      expect(result).not.toContain('product456');
      expect(result).not.toContain('order789');
    });

    it('should support anchored regex', async () => {
      await fs.writeFile(path.join(tempDir, 'test.ts'), 'const start = true;\nconst end_start = false;\n', 'utf8');

      const result = await execGrep('*.ts', '^const start');

      expect(result).toContain('const start = true');
      expect(result).not.toContain('end_start');
    });
  });

  describe('nested directories', () => {
    it('should search files in nested directories', async () => {
      await fs.mkdir(path.join(tempDir, 'src', 'components'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'src', 'components', 'Button.ts'), 'export const MyComponent = 42;\n', 'utf8');
      await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), 'export { MyComponent } from "./components/Button";\n', 'utf8');

      const result = await execGrep('*.ts', 'MyComponent');

      expect(result).toContain('Button.ts');
      expect(result).toContain('index.ts');
    });

    it('should search with glob pattern for specific extension', async () => {
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'src', 'file.ts'), 'const target = 1;\n', 'utf8');
      await fs.writeFile(path.join(tempDir, 'src', 'file.tsx'), 'const target = 2;\n', 'utf8');

      const result = await execGrep('*.tsx', 'target');

      expect(result).toContain('file.tsx');
      expect(result).not.toContain('file.ts:');
    });
  });

  describe('file pattern matching', () => {
    it('should match multiple file extensions with glob', async () => {
      await fs.writeFile(path.join(tempDir, 'a.ts'), 'const found = true;\n', 'utf8');
      await fs.writeFile(path.join(tempDir, 'b.js'), 'const found = true;\n', 'utf8');
      await fs.writeFile(path.join(tempDir, 'c.py'), 'const found = true;\n', 'utf8');

      const resultTs = await execGrep('*.ts', 'found');
      expect(resultTs).toContain('a.ts');
      expect(resultTs).not.toContain('b.js');
      expect(resultTs).not.toContain('c.py');

      const resultJs = await execGrep('*.js', 'found');
      expect(resultJs).toContain('b.js');
      expect(resultJs).not.toContain('a.ts');
    });
  });

  describe('large output handling', () => {
    it('should handle many files with many matches without maxBuffer error', async () => {
      const numFiles = 30;
      const linesPerFile = 200;

      const writePromises: Promise<void>[] = [];
      for (let f = 0; f < numFiles; f++) {
        const lines: string[] = [];
        for (let i = 0; i < linesPerFile; i++) {
          lines.push(`const searchTerm_${f}_${i} = ${i};`);
        }
        writePromises.push(fs.writeFile(path.join(tempDir, `file_${f}.ts`), lines.join('\n') + '\n', 'utf8'));
      }
      await Promise.all(writePromises);

      const result = await execGrep('*.ts', 'searchTerm', { maxResults: 6000 });

      expect(result).not.toContain('maxBuffer');
      expect(result).not.toContain('Error during grep');
      expect(result).toContain('matches');
    });

    it('should kill ripgrep early when maxResults is reached, even with massive output', async () => {
      const numFiles = 50;
      const linesPerFile = 500;

      const writePromises: Promise<void>[] = [];
      for (let f = 0; f < numFiles; f++) {
        const lines: string[] = [];
        for (let i = 0; i < linesPerFile; i++) {
          lines.push(`const searchTerm_${f}_${i} = ${i};`);
        }
        writePromises.push(fs.writeFile(path.join(tempDir, `file_${f}.ts`), lines.join('\n') + '\n', 'utf8'));
      }
      await Promise.all(writePromises);

      const result = await execGrep('*.ts', 'searchTerm', { maxResults: 5 });

      expect(result).not.toContain('maxBuffer');
      expect(result).not.toContain('Error during grep');
      expect(result).toContain('5 matches');
      expect(result).toContain('limit reached');
    });
  });
});

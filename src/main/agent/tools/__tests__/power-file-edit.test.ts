/**
 * Tests for power tools file_edit functionality, particularly edge cases
 * with backtick patterns and special characters (issue #707)
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

describe('Power Tools - file_edit edge cases', () => {
  let createPowerToolset: any;
  let mockTask: any;
  let mockProfile: any;
  let mockPromptContext: any;
  let tempDir: string;

  const POWER_TOOL_GROUP_NAME = 'power';
  const TOOL_GROUP_NAME_SEPARATOR = '---';
  const POWER_TOOL_FILE_EDIT = 'file_edit';

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create temp directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'power-edit-test-'));

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

    // Mock approval manager to always approve
    const approvalModule = await import('../approval-manager');
    vi.spyOn(approvalModule.ApprovalManager.prototype, 'handleToolApproval').mockResolvedValue([true, undefined] as never);

    const powerModule = await import('../power');
    createPowerToolset = powerModule.createPowerToolset;
  });

  afterEach(async () => {
    // Cleanup temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const getFileEditTool = () => {
    const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext);
    const fileEditToolKey = `${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_EDIT}`;
    return tools[fileEditToolKey];
  };

  describe('searchTerm containing backticks (issue #707 - FIXED)', () => {
    it('should correctly find and replace when searchTerm contains backtick patterns', async () => {
      // This test reproduces the exact bug from issue #707
      // When the searchTerm itself contains backticks, the file gets corrupted
      const goFileContent = `package steps

func InitializeScenario(ctx *godog.ScenarioContext) {
	ctx.Step(\`^an existing registered user with uploaded content$\`, s.anExistingRegisteredUserWithUploadedContent)
	ctx.Step(\`^an existing registered user$\`, s.anExistingRegisteredUser)
	ctx.Step(\`^the user is logged in$\`, s.theUserIsLoggedIn)
}
`;

      const filePath = 'steps.go';
      const fullPath = path.join(tempDir, filePath);
      await fs.writeFile(fullPath, goFileContent, 'utf8');

      const fileEditTool = getFileEditTool();

      // This is the problematic case: searchTerm contains backticks
      // When the LLM sends this searchTerm, the file gets corrupted
      const searchTermWithBackticks = 'ctx.Step(`^an existing registered user$`, s.anExistingRegisteredUser)';
      const replacementWithBackticks = 'ctx.Step(`^a new registered user$`, s.anExistingRegisteredUser)';

      const result = await fileEditTool.execute(
        {
          filePath,
          searchTerm: searchTermWithBackticks,
          replacementText: replacementWithBackticks,
          isRegex: false,
          replaceAll: false,
        },
        { toolCallId: 'tool-call-backtick-1' },
      );

      expect(result).toContain('Successfully edited');

      const editedContent = await fs.readFile(fullPath, 'utf8');

      // The replacement should have occurred
      expect(editedContent).toContain('ctx.Step(`^a new registered user$`, s.anExistingRegisteredUser)');

      // Other step definitions should remain intact (not corrupted)
      expect(editedContent).toContain('ctx.Step(`^an existing registered user with uploaded content$`, s.anExistingRegisteredUserWithUploadedContent)');
      expect(editedContent).toContain('ctx.Step(`^the user is logged in$`, s.theUserIsLoggedIn)');

      // Verify no content duplication occurred
      const funcCount = (editedContent.match(/func InitializeScenario/g) || []).length;
      expect(funcCount).toBe(1);
      const ctxStepCount = (editedContent.match(/ctx\.Step/g) || []).length;
      expect(ctxStepCount).toBe(3); // 3 step definitions, not duplicated
    }, 30000);

    it('should handle searchTerm with complex backtick regex patterns', async () => {
      // Test with patterns like \`^step with "([^"]*)"$\`
      const goFileContent = `func InitializeScenario(ctx *godog.ScenarioContext) {
	ctx.Step(\`^the user has uploaded files named "([^"]*)", "([^"]*)", "([^"]*)"$\`, s.theUserHasUploadedFilesNamed)
	ctx.Step(\`^the user filters content by name "([^"]*)"$\`, s.theUserFiltersContentByName)
}
`;

      const filePath = 'complex-patterns.go';
      const fullPath = path.join(tempDir, filePath);
      await fs.writeFile(fullPath, goFileContent, 'utf8');

      const fileEditTool = getFileEditTool();

      // Search term contains complex regex pattern inside backticks
      const searchTerm = 'ctx.Step(`^the user filters content by name "([^"]*)"$`, s.theUserFiltersContentByName)';
      const replacementText = 'ctx.Step(`^the user filters by name "([^"]*)"$`, s.theUserFiltersContentByName)';

      const result = await fileEditTool.execute(
        {
          filePath,
          searchTerm,
          replacementText,
          isRegex: false,
          replaceAll: false,
        },
        { toolCallId: 'tool-call-backtick-2' },
      );

      expect(result).toContain('Successfully edited');

      const editedContent = await fs.readFile(fullPath, 'utf8');

      // Replacement should work
      expect(editedContent).toContain('ctx.Step(`^the user filters by name "([^"]*)"$`, s.theUserFiltersContentByName)');

      // Other pattern should remain intact
      expect(editedContent).toContain('ctx.Step(`^the user has uploaded files named "([^"]*)", "([^"]*)", "([^"]*)"$`, s.theUserHasUploadedFilesNamed)');

      // No duplication
      const funcCount = (editedContent.match(/func InitializeScenario/g) || []).length;
      expect(funcCount).toBe(1);
    });
  });

  describe('Go files with backtick raw strings (issue #707)', () => {
    it('should correctly edit Go file with godog step definitions containing backticks', async () => {
      // This is the reproduction case from issue #707
      const goFileContent = `package features

import (
	"github.com/cucumber/godog"
)

func InitializeScenario(ctx *godog.ScenarioContext) {
	ctx.Step(\`^I have a step with "([^"]*)"$\`, iHaveAStepWith)
	ctx.Step(\`^the result should be "([^"]*)"$\`, theResultShouldBe)
}

func iHaveAStepWith(arg1 string) error {
	return nil
}

func theResultShouldBe(arg1 string) error {
	return nil
}
`;

      const filePath = 'features/step_definitions/steps.go';
      const fullPath = path.join(tempDir, filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, goFileContent, 'utf8');

      const fileEditTool = getFileEditTool();

      // Try to replace the function body
      const result = await fileEditTool.execute(
        {
          filePath,
          searchTerm: `func iHaveAStepWith(arg1 string) error {
	return nil
}`,
          replacementText: `func iHaveAStepWith(arg1 string) error {
	// Added comment
	return nil
}`,
          isRegex: false,
          replaceAll: false,
        },
        { toolCallId: 'tool-call-123' },
      );

      expect(result).toContain('Successfully edited');

      // Verify the file content is not corrupted
      const editedContent = await fs.readFile(fullPath, 'utf8');

      // The godog step definitions should remain intact
      expect(editedContent).toContain('ctx.Step(`^I have a step with "([^"]*)"$`, iHaveAStepWith)');
      expect(editedContent).toContain('ctx.Step(`^the result should be "([^"]*)"$`, theResultShouldBe)');

      // The new comment should be present
      expect(editedContent).toContain('// Added comment');

      // The file should not have duplicated content
      const lines = editedContent.split('\n');
      const functionCount = lines.filter((line) => line.includes('func iHaveAStepWith')).length;
      expect(functionCount).toBe(1);
    });

    it('should not corrupt file when replacing content near backtick strings', async () => {
      const goFileContent = `package main

func main() {
	ctx.Step(\`^pattern with backticks$\`, handler)
	fmt.Println("hello")
}
`;

      const filePath = 'main.go';
      const fullPath = path.join(tempDir, filePath);
      await fs.writeFile(fullPath, goFileContent, 'utf8');

      const fileEditTool = getFileEditTool();

      const result = await fileEditTool.execute(
        {
          filePath,
          searchTerm: 'fmt.Println("hello")',
          replacementText: 'fmt.Println("world")',
          isRegex: false,
          replaceAll: false,
        },
        { toolCallId: 'tool-call-124' },
      );

      expect(result).toContain('Successfully edited');

      const editedContent = await fs.readFile(fullPath, 'utf8');
      expect(editedContent).toContain('fmt.Println("world")');
      expect(editedContent).toContain('ctx.Step(`^pattern with backticks$`, handler)');

      // Ensure no duplication
      expect(editedContent.match(/ctx\.Step/g) || []).toHaveLength(1);
    });

    it('should handle multiple backtick patterns in Go file', async () => {
      const goFileContent = `package main

func Feature1(ctx *godog.ScenarioContext) {
	ctx.Step(\`^step one$\`, stepOne)
	ctx.Step(\`^step two with "([^"]*)"$\`, stepTwo)
	ctx.Step(\`^step three (\\d+)$\`, stepThree)
}

func stepOne() error { return nil }
func stepTwo(s string) error { return nil }
func stepThree(n int) error { return nil }
`;

      const filePath = 'feature1.go';
      const fullPath = path.join(tempDir, filePath);
      await fs.writeFile(fullPath, goFileContent, 'utf8');

      const fileEditTool = getFileEditTool();

      const result = await fileEditTool.execute(
        {
          filePath,
          searchTerm: 'func stepOne() error { return nil }',
          replacementText: `func stepOne() error {
	// Implementation
	return nil
}`,
          isRegex: false,
          replaceAll: false,
        },
        { toolCallId: 'tool-call-125' },
      );

      expect(result).toContain('Successfully edited');

      const editedContent = await fs.readFile(fullPath, 'utf8');

      // All three step definitions should remain intact
      expect(editedContent).toContain('ctx.Step(`^step one$`, stepOne)');
      expect(editedContent).toContain('ctx.Step(`^step two with "([^"]*)"$`, stepTwo)');
      expect(editedContent).toContain('ctx.Step(`^step three (\\d+)$`, stepThree)');

      // Verify no content duplication
      expect(editedContent.match(/func Feature1/g) || []).toHaveLength(1);
      expect(editedContent.match(/func stepOne/g) || []).toHaveLength(1);
      expect(editedContent.match(/func stepTwo/g) || []).toHaveLength(1);
      expect(editedContent.match(/func stepThree/g) || []).toHaveLength(1);
    });
  });

  describe('special characters handling', () => {
    it('should handle file with mixed quotes and backticks', async () => {
      const fileContent = `const str1 = "double quotes"
const str2 = 'single quotes'
const str3 = \`backtick string\`
const str4 = \`mixed "quotes" and 'more'\`
`;

      const filePath = 'test.txt';
      const fullPath = path.join(tempDir, filePath);
      await fs.writeFile(fullPath, fileContent, 'utf8');

      const fileEditTool = getFileEditTool();

      const result = await fileEditTool.execute(
        {
          filePath,
          searchTerm: 'const str3 = `backtick string`',
          replacementText: 'const str3 = `modified backtick`',
          isRegex: false,
          replaceAll: false,
        },
        { toolCallId: 'tool-call-126' },
      );

      expect(result).toContain('Successfully edited');

      const editedContent = await fs.readFile(fullPath, 'utf8');
      expect(editedContent).toContain('const str3 = `modified backtick`');
      expect(editedContent).toContain('const str1 = "double quotes"');
      expect(editedContent).toContain("const str2 = 'single quotes'");
      expect(editedContent).toContain('const str4 = `mixed "quotes" and \'more\'`');
    });

    it('should handle regex patterns with backticks', async () => {
      const fileContent = `pattern1 = \`^[a-z]+$\`
pattern2 = \`^\\d{4}$\`
pattern3 = "normal string"
`;

      const filePath = 'patterns.txt';
      const fullPath = path.join(tempDir, filePath);
      await fs.writeFile(fullPath, fileContent, 'utf8');

      const fileEditTool = getFileEditTool();

      // Using regex mode
      const result = await fileEditTool.execute(
        {
          filePath,
          searchTerm: 'pattern3 = "normal string"',
          replacementText: 'pattern3 = "updated string"',
          isRegex: false,
          replaceAll: false,
        },
        { toolCallId: 'tool-call-127' },
      );

      expect(result).toContain('Successfully edited');

      const editedContent = await fs.readFile(fullPath, 'utf8');
      expect(editedContent).toContain('pattern3 = "updated string"');
      expect(editedContent).toContain('pattern1 = `^[a-z]+$`');
    });

    it('should preserve backtick content when not part of search term', async () => {
      const fileContent = `func Test() {
	query := \`SELECT * FROM users WHERE id = ?\`
	result := execute(query)
	return result
}
`;

      const filePath = 'test.go';
      const fullPath = path.join(tempDir, filePath);
      await fs.writeFile(fullPath, fileContent, 'utf8');

      const fileEditTool = getFileEditTool();

      const result = await fileEditTool.execute(
        {
          filePath,
          searchTerm: '	result := execute(query)',
          replacementText: `	result := execute(query)
	log.Println("executed query")`,
          isRegex: false,
          replaceAll: false,
        },
        { toolCallId: 'tool-call-128' },
      );

      expect(result).toContain('Successfully edited');

      const editedContent = await fs.readFile(fullPath, 'utf8');
      expect(editedContent).toContain('query := `SELECT * FROM users WHERE id = ?`');
      expect(editedContent).toContain('log.Println("executed query")');
    });
  });

  describe('edge cases with search term containing special patterns', () => {
    it('should find and replace content that contains regex-like patterns in literal mode', async () => {
      const fileContent = `// Pattern: ^[a-z]+$
// Matches: test, hello, world
const regex = /^[a-z]+$/;
`;

      const filePath = 'regex.js';
      const fullPath = path.join(tempDir, filePath);
      await fs.writeFile(fullPath, fileContent, 'utf8');

      const fileEditTool = getFileEditTool();

      const result = await fileEditTool.execute(
        {
          filePath,
          searchTerm: '// Pattern: ^[a-z]+$',
          replacementText: '// Pattern: ^[A-Z]+$',
          isRegex: false,
          replaceAll: false,
        },
        { toolCallId: 'tool-call-129' },
      );

      expect(result).toContain('Successfully edited');

      const editedContent = await fs.readFile(fullPath, 'utf8');
      expect(editedContent).toContain('// Pattern: ^[A-Z]+$');
      expect(editedContent).toContain('const regex = /^[a-z]+$/;');
    });

    it('should handle multiline replacement with backticks in content', async () => {
      const fileContent = `func Query() string {
	return \`SELECT
		id,
		name,
		email
	FROM users\`
}
`;

      const filePath = 'query.go';
      const fullPath = path.join(tempDir, filePath);
      await fs.writeFile(fullPath, fileContent, 'utf8');

      const fileEditTool = getFileEditTool();

      const result = await fileEditTool.execute(
        {
          filePath,
          searchTerm: '	FROM users`',
          replacementText: `	FROM users
	WHERE active = true\``,
          isRegex: false,
          replaceAll: false,
        },
        { toolCallId: 'tool-call-130' },
      );

      expect(result).toContain('Successfully edited');

      const editedContent = await fs.readFile(fullPath, 'utf8');
      expect(editedContent).toContain('WHERE active = true');
      expect(editedContent).toContain('FROM users');
      expect(editedContent).toContain('	id,');
      expect(editedContent).toContain('	name,');
      expect(editedContent).toContain('	email');
    });
  });

  describe('error handling', () => {
    it('should return warning when search term not found', async () => {
      const fileContent = 'simple content';

      const filePath = 'simple.txt';
      const fullPath = path.join(tempDir, filePath);
      await fs.writeFile(fullPath, fileContent, 'utf8');

      const fileEditTool = getFileEditTool();

      const result = await fileEditTool.execute(
        {
          filePath,
          searchTerm: 'not found',
          replacementText: 'replacement',
          isRegex: false,
          replaceAll: false,
        },
        { toolCallId: 'tool-call-131' },
      );

      expect(result).toContain('Warning');
      expect(result).toContain('not found');

      // File should remain unchanged
      const content = await fs.readFile(fullPath, 'utf8');
      expect(content).toBe(fileContent);
    });

    it('should return error for non-existent file', async () => {
      const fileEditTool = getFileEditTool();

      const result = await fileEditTool.execute(
        {
          filePath: 'non-existent-file.txt',
          searchTerm: 'something',
          replacementText: 'else',
          isRegex: false,
          replaceAll: false,
        },
        { toolCallId: 'tool-call-132' },
      );

      expect(result).toContain('Error');
      expect(result).toContain('not found');
    });

    it('should handle identical search and replacement text', async () => {
      const fileContent = 'original content';

      const filePath = 'same.txt';
      const fullPath = path.join(tempDir, filePath);
      await fs.writeFile(fullPath, fileContent, 'utf8');

      const fileEditTool = getFileEditTool();

      const result = await fileEditTool.execute(
        {
          filePath,
          searchTerm: 'content',
          replacementText: 'content',
          isRegex: false,
          replaceAll: false,
        },
        { toolCallId: 'tool-call-133' },
      );

      expect(result).toContain('Already updated');
    });
  });

  describe('replace all functionality', () => {
    it('should replace all occurrences while preserving backticks', async () => {
      const fileContent = `const a = \`value\`;
const b = \`value\`;
const c = \`value\`;
`;

      const filePath = 'multiple.txt';
      const fullPath = path.join(tempDir, filePath);
      await fs.writeFile(fullPath, fileContent, 'utf8');

      const fileEditTool = getFileEditTool();

      const result = await fileEditTool.execute(
        {
          filePath,
          searchTerm: '`value`',
          replacementText: '`updated`',
          isRegex: false,
          replaceAll: true,
        },
        { toolCallId: 'tool-call-134' },
      );

      expect(result).toContain('Successfully edited');

      const editedContent = await fs.readFile(fullPath, 'utf8');
      expect(editedContent).toBe(`const a = \`updated\`;
const b = \`updated\`;
const c = \`updated\`;
`);
    });
  });
});

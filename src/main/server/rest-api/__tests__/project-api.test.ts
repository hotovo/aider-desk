import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

describe('ProjectApi - commit-changes endpoint', () => {
  describe('CommitChangesSchema validation', () => {
    const CommitChangesSchema = z
      .object({
        projectDir: z.string().min(1, 'Project directory is required'),
        taskId: z.string().min(1, 'Task id is required'),
        message: z.string(),
        amend: z.boolean(),
      })
      .refine((data) => data.amend || data.message.trim().length > 0, {
        message: 'Commit message is required',
        path: ['message'],
      });

    it('should reject regular commit (amend: false) with empty message', () => {
      const invalidData = {
        projectDir: '/test/project',
        taskId: 'task-123',
        message: '',
        amend: false,
      };

      const result = CommitChangesSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('message');
        expect(result.error.issues[0].message).toBe('Commit message is required');
      }
    });

    it('should reject regular commit (amend: false) with whitespace-only message', () => {
      const invalidData = {
        projectDir: '/test/project',
        taskId: 'task-123',
        message: '   ',
        amend: false,
      };

      const result = CommitChangesSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('message');
        expect(result.error.issues[0].message).toBe('Commit message is required');
      }
    });

    it('should validate regular commit (amend: false) with non-empty message', () => {
      const validData = {
        projectDir: '/test/project',
        taskId: 'task-123',
        message: 'feat: add new feature',
        amend: false,
      };

      const result = CommitChangesSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate amend commit (amend: true) with empty message', () => {
      const validData = {
        projectDir: '/test/project',
        taskId: 'task-123',
        message: '',
        amend: true,
      };

      const result = CommitChangesSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate amend commit (amend: true) with whitespace-only message', () => {
      const validData = {
        projectDir: '/test/project',
        taskId: 'task-123',
        message: '   ',
        amend: true,
      };

      const result = CommitChangesSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate amend commit (amend: true) with non-empty message', () => {
      const validData = {
        projectDir: '/test/project',
        taskId: 'task-123',
        message: 'fix: update existing commit',
        amend: true,
      };

      const result = CommitChangesSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });
});

describe('ProjectApi - remove-message endpoint', () => {
  beforeEach(() => {
    // Setup block can be added here if needed for future tests
  });

  describe('RemoveMessageSchema validation', () => {
    it('should validate valid request data', () => {
      const RemoveMessageSchema = z.object({
        projectDir: z.string().min(1, 'Project directory is required'),
        taskId: z.string().min(1, 'Task id is required'),
        messageId: z.string().min(1, 'Message id is required'),
      });

      const validData = {
        projectDir: '/test/project',
        taskId: 'task-123',
        messageId: 'msg-456',
      };

      const result = RemoveMessageSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject data with missing projectDir', () => {
      const RemoveMessageSchema = z.object({
        projectDir: z.string().min(1, 'Project directory is required'),
        taskId: z.string().min(1, 'Task id is required'),
        messageId: z.string().min(1, 'Message id is required'),
      });

      const invalidData = {
        taskId: 'task-123',
        messageId: 'msg-456',
      };

      const result = RemoveMessageSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('projectDir');
      }
    });

    it('should reject data with missing taskId', () => {
      const RemoveMessageSchema = z.object({
        projectDir: z.string().min(1, 'Project directory is required'),
        taskId: z.string().min(1, 'Task id is required'),
        messageId: z.string().min(1, 'Message id is required'),
      });

      const invalidData = {
        projectDir: '/test/project',
        messageId: 'msg-456',
      };

      const result = RemoveMessageSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('taskId');
      }
    });

    it('should reject data with missing messageId', () => {
      const RemoveMessageSchema = z.object({
        projectDir: z.string().min(1, 'Project directory is required'),
        taskId: z.string().min(1, 'Task id is required'),
        messageId: z.string().min(1, 'Message id is required'),
      });

      const invalidData = {
        projectDir: '/test/project',
        taskId: 'task-123',
      };

      const result = RemoveMessageSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('messageId');
      }
    });

    it('should reject data with empty projectDir', () => {
      const RemoveMessageSchema = z.object({
        projectDir: z.string().min(1, 'Project directory is required'),
        taskId: z.string().min(1, 'Task id is required'),
        messageId: z.string().min(1, 'Message id is required'),
      });

      const invalidData = {
        projectDir: '',
        taskId: 'task-123',
        messageId: 'msg-456',
      };

      const result = RemoveMessageSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Project directory is required');
      }
    });
  });
});

describe('ProjectApi - run-code-inline-request endpoint', () => {
  describe('RunCodeInlineRequestSchema validation', () => {
    it('should validate valid request data', () => {
      const RunCodeInlineRequestSchema = z.object({
        projectDir: z.string().min(1, 'Project directory is required'),
        filename: z.string().min(1, 'Filename is required'),
        lineNumber: z.number().int().min(1, 'Line number is required'),
        userComment: z.string().min(1, 'User comment is required'),
      });

      const validData = {
        projectDir: '/test/project',
        filename: 'src/utils/example.ts',
        lineNumber: 42,
        userComment: 'Fix the bug here',
      };

      const result = RunCodeInlineRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject data with missing projectDir', () => {
      const RunCodeInlineRequestSchema = z.object({
        projectDir: z.string().min(1, 'Project directory is required'),
        filename: z.string().min(1, 'Filename is required'),
        lineNumber: z.number().int().min(1, 'Line number is required'),
        userComment: z.string().min(1, 'User comment is required'),
      });

      const invalidData = {
        filename: 'src/utils/example.ts',
        lineNumber: 42,
        userComment: 'Fix the bug here',
      };

      const result = RunCodeInlineRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('projectDir');
      }
    });

    it('should reject data with missing filename', () => {
      const RunCodeInlineRequestSchema = z.object({
        projectDir: z.string().min(1, 'Project directory is required'),
        filename: z.string().min(1, 'Filename is required'),
        lineNumber: z.number().int().min(1, 'Line number is required'),
        userComment: z.string().min(1, 'User comment is required'),
      });

      const invalidData = {
        projectDir: '/test/project',
        lineNumber: 42,
        userComment: 'Fix the bug here',
      };

      const result = RunCodeInlineRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('filename');
      }
    });

    it('should reject data with missing lineNumber', () => {
      const RunCodeInlineRequestSchema = z.object({
        projectDir: z.string().min(1, 'Project directory is required'),
        filename: z.string().min(1, 'Filename is required'),
        lineNumber: z.number().int().min(1, 'Line number is required'),
        userComment: z.string().min(1, 'User comment is required'),
      });

      const invalidData = {
        projectDir: '/test/project',
        filename: 'src/utils/example.ts',
        userComment: 'Fix the bug here',
      };

      const result = RunCodeInlineRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('lineNumber');
      }
    });

    it('should reject data with missing userComment', () => {
      const RunCodeInlineRequestSchema = z.object({
        projectDir: z.string().min(1, 'Project directory is required'),
        filename: z.string().min(1, 'Filename is required'),
        lineNumber: z.number().int().min(1, 'Line number is required'),
        userComment: z.string().min(1, 'User comment is required'),
      });

      const invalidData = {
        projectDir: '/test/project',
        filename: 'src/utils/example.ts',
        lineNumber: 42,
      };

      const result = RunCodeInlineRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('userComment');
      }
    });

    it('should reject data with empty projectDir', () => {
      const RunCodeInlineRequestSchema = z.object({
        projectDir: z.string().min(1, 'Project directory is required'),
        filename: z.string().min(1, 'Filename is required'),
        lineNumber: z.number().int().min(1, 'Line number is required'),
        userComment: z.string().min(1, 'User comment is required'),
      });

      const invalidData = {
        projectDir: '',
        filename: 'src/utils/example.ts',
        lineNumber: 42,
        userComment: 'Fix the bug here',
      };

      const result = RunCodeInlineRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Project directory is required');
      }
    });

    it('should reject data with empty filename', () => {
      const RunCodeInlineRequestSchema = z.object({
        projectDir: z.string().min(1, 'Project directory is required'),
        filename: z.string().min(1, 'Filename is required'),
        lineNumber: z.number().int().min(1, 'Line number is required'),
        userComment: z.string().min(1, 'User comment is required'),
      });

      const invalidData = {
        projectDir: '/test/project',
        filename: '',
        lineNumber: 42,
        userComment: 'Fix the bug here',
      };

      const result = RunCodeInlineRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Filename is required');
      }
    });

    it('should reject data with empty userComment', () => {
      const RunCodeInlineRequestSchema = z.object({
        projectDir: z.string().min(1, 'Project directory is required'),
        filename: z.string().min(1, 'Filename is required'),
        lineNumber: z.number().int().min(1, 'Line number is required'),
        userComment: z.string().min(1, 'User comment is required'),
      });

      const invalidData = {
        projectDir: '/test/project',
        filename: 'src/utils/example.ts',
        lineNumber: 42,
        userComment: '',
      };

      const result = RunCodeInlineRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('User comment is required');
      }
    });

    it('should reject data with lineNumber as 0', () => {
      const RunCodeInlineRequestSchema = z.object({
        projectDir: z.string().min(1, 'Project directory is required'),
        filename: z.string().min(1, 'Filename is required'),
        lineNumber: z.number().int().min(1, 'Line number is required'),
        userComment: z.string().min(1, 'User comment is required'),
      });

      const invalidData = {
        projectDir: '/test/project',
        filename: 'src/utils/example.ts',
        lineNumber: 0,
        userComment: 'Fix the bug here',
      };

      const result = RunCodeInlineRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('lineNumber');
      }
    });

    it('should reject data with negative lineNumber', () => {
      const RunCodeInlineRequestSchema = z.object({
        projectDir: z.string().min(1, 'Project directory is required'),
        filename: z.string().min(1, 'Filename is required'),
        lineNumber: z.number().int().min(1, 'Line number is required'),
        userComment: z.string().min(1, 'User comment is required'),
      });

      const invalidData = {
        projectDir: '/test/project',
        filename: 'src/utils/example.ts',
        lineNumber: -1,
        userComment: 'Fix the bug here',
      };

      const result = RunCodeInlineRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('lineNumber');
      }
    });

    it('should reject data with decimal lineNumber', () => {
      const RunCodeInlineRequestSchema = z.object({
        projectDir: z.string().min(1, 'Project directory is required'),
        filename: z.string().min(1, 'Filename is required'),
        lineNumber: z.number().int().min(1, 'Line number is required'),
        userComment: z.string().min(1, 'User comment is required'),
      });

      const invalidData = {
        projectDir: '/test/project',
        filename: 'src/utils/example.ts',
        lineNumber: 42.5,
        userComment: 'Fix the bug here',
      };

      const result = RunCodeInlineRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('lineNumber');
      }
    });

    it('should accept data with valid absolute filename', () => {
      const RunCodeInlineRequestSchema = z.object({
        projectDir: z.string().min(1, 'Project directory is required'),
        filename: z.string().min(1, 'Filename is required'),
        lineNumber: z.number().int().min(1, 'Line number is required'),
        userComment: z.string().min(1, 'User comment is required'),
      });

      const validData = {
        projectDir: '/test/project',
        filename: '/absolute/path/to/file.ts',
        lineNumber: 10,
        userComment: 'Add error handling',
      };

      const result = RunCodeInlineRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept data with valid relative filename', () => {
      const RunCodeInlineRequestSchema = z.object({
        projectDir: z.string().min(1, 'Project directory is required'),
        filename: z.string().min(1, 'Filename is required'),
        lineNumber: z.number().int().min(1, 'Line number is required'),
        userComment: z.string().min(1, 'User comment is required'),
      });

      const validData = {
        projectDir: '/test/project',
        filename: 'src/components/Button.tsx',
        lineNumber: 15,
        userComment: 'Add styling',
      };

      const result = RunCodeInlineRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });
});

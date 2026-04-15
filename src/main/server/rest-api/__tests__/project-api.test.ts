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

describe('ProjectApi - run-code-change-requests endpoint', () => {
  const ChangeRequestItemSchema = z.object({
    filename: z.string().min(1, 'Filename is required'),
    lineNumber: z.number().int().min(1, 'Line number is required'),
    userComment: z.string().min(1, 'User comment is required'),
  });

  const RunCodeChangeRequestsSchema = z.object({
    projectDir: z.string().min(1, 'Project directory is required'),
    taskId: z.string().min(1, 'Task id is required'),
    requests: z.array(ChangeRequestItemSchema).min(1, 'At least one request is required'),
    createNewTask: z.boolean().optional(),
  });

  describe('RunCodeChangeRequestsSchema validation', () => {
    it('should validate valid request data', () => {
      const validData = {
        projectDir: '/test/project',
        taskId: 'task-123',
        requests: [{ filename: 'src/utils/example.ts', lineNumber: 42, userComment: 'Fix the bug here' }],
      };

      const result = RunCodeChangeRequestsSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate valid request data with multiple requests', () => {
      const validData = {
        projectDir: '/test/project',
        taskId: 'task-123',
        requests: [
          { filename: 'src/utils/example.ts', lineNumber: 42, userComment: 'Fix the bug here' },
          { filename: 'src/utils/other.ts', lineNumber: 10, userComment: 'Add error handling' },
        ],
      };

      const result = RunCodeChangeRequestsSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject data with missing projectDir', () => {
      const invalidData = {
        taskId: 'task-123',
        requests: [{ filename: 'src/utils/example.ts', lineNumber: 42, userComment: 'Fix the bug here' }],
      };

      const result = RunCodeChangeRequestsSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('projectDir');
      }
    });

    it('should reject data with missing taskId', () => {
      const invalidData = {
        projectDir: '/test/project',
        requests: [{ filename: 'src/utils/example.ts', lineNumber: 42, userComment: 'Fix the bug here' }],
      };

      const result = RunCodeChangeRequestsSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('taskId');
      }
    });

    it('should reject data with empty requests array', () => {
      const invalidData = {
        projectDir: '/test/project',
        taskId: 'task-123',
        requests: [],
      };

      const result = RunCodeChangeRequestsSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('requests');
      }
    });

    it('should reject request item with missing filename', () => {
      const invalidData = {
        projectDir: '/test/project',
        taskId: 'task-123',
        requests: [{ lineNumber: 42, userComment: 'Fix the bug here' }],
      };

      const result = RunCodeChangeRequestsSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(expect.arrayContaining(['requests', 0, 'filename']));
      }
    });

    it('should reject request item with missing userComment', () => {
      const invalidData = {
        projectDir: '/test/project',
        taskId: 'task-123',
        requests: [{ filename: 'src/utils/example.ts', lineNumber: 42 }],
      };

      const result = RunCodeChangeRequestsSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(expect.arrayContaining(['requests', 0, 'userComment']));
      }
    });

    it('should reject request item with invalid lineNumber', () => {
      const invalidData = {
        projectDir: '/test/project',
        taskId: 'task-123',
        requests: [{ filename: 'src/utils/example.ts', lineNumber: 0, userComment: 'Fix the bug here' }],
      };

      const result = RunCodeChangeRequestsSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(expect.arrayContaining(['requests', 0, 'lineNumber']));
      }
    });

    it('should accept request with createNewTask boolean at top level', () => {
      const validData = {
        projectDir: '/test/project',
        taskId: 'task-123',
        requests: [{ filename: 'src/utils/example.ts', lineNumber: 42, userComment: 'Fix the bug here' }],
        createNewTask: true,
      };

      const result = RunCodeChangeRequestsSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });
});

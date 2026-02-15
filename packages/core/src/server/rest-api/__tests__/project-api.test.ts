import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

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

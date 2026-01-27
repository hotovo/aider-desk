import { describe, it, expect, beforeEach } from 'vitest';

import { encodeBaseDir, decodeBaseDir, buildHomeUrl, parseUrlParams } from '../routes';

describe('routes utilities', () => {
  beforeEach(() => {
    // Mock window.location
    delete (window as any).location;
    (window as any).location = new URL('http://localhost:24337');
  });

  describe('encodeBaseDir', () => {
    it('encodes simple paths', () => {
      expect(encodeBaseDir('/home/user/project')).toBe('%2Fhome%2Fuser%2Fproject');
    });

    it('encodes paths with spaces', () => {
      expect(encodeBaseDir('/home/user/my project')).toBe('%2Fhome%2Fuser%2Fmy%20project');
    });

    it('encodes paths with special characters', () => {
      expect(encodeBaseDir('/home/user/project#1')).toBe('%2Fhome%2Fuser%2Fproject%231');
    });

    it('encodes Windows paths', () => {
      expect(encodeBaseDir('C:\\Users\\user\\project')).toBe('C%3A%5CUsers%5Cuser%5Cproject');
    });
  });

  describe('decodeBaseDir', () => {
    it('decodes simple paths', () => {
      expect(decodeBaseDir('%2Fhome%2Fuser%2Fproject')).toBe('/home/user/project');
    });

    it('decodes paths with spaces', () => {
      expect(decodeBaseDir('%2Fhome%2Fuser%2Fmy%20project')).toBe('/home/user/my project');
    });

    it('decodes paths with special characters', () => {
      expect(decodeBaseDir('%2Fhome%2Fuser%2Fproject%231')).toBe('/home/user/project#1');
    });

    it('decodes Windows paths', () => {
      expect(decodeBaseDir('C%3A%5CUsers%5Cuser%5Cproject')).toBe('C:\\Users\\user\\project');
    });

    it('is symmetric with encodeBaseDir', () => {
      const originalPath = '/home/user/my project';
      const encoded = encodeBaseDir(originalPath);
      const decoded = decodeBaseDir(encoded);
      expect(decoded).toBe(originalPath);
    });
  });

  describe('buildHomeUrl', () => {
    it('returns home route without parameters', () => {
      expect(buildHomeUrl()).toBe('/home');
    });

    it('returns home URL with project parameter', () => {
      expect(buildHomeUrl('/home/user/project')).toBe('/home?project=%2Fhome%2Fuser%2Fproject');
    });

    it('returns home URL with task parameter', () => {
      expect(buildHomeUrl(undefined, 'task-123')).toBe('/home?task=task-123');
    });

    it('returns home URL with both project and task parameters', () => {
      expect(buildHomeUrl('/home/user/project', 'task-123')).toBe('/home?project=%2Fhome%2Fuser%2Fproject&task=task-123');
    });

    it('properly encodes special characters in baseDir', () => {
      expect(buildHomeUrl('/home/user/my project', 'task-123')).toBe('/home?project=%2Fhome%2Fuser%2Fmy%20project&task=task-123');
    });
  });

  describe('parseUrlParams', () => {
    it('parses URL with no parameters', () => {
      (window as any).location.hash = '#/home';
      expect(parseUrlParams((window as any).location)).toEqual({
        projectBaseDir: null,
        taskId: null,
      });
    });

    it('parses URL with project parameter', () => {
      (window as any).location.hash = '#/home?project=%2Fhome%2Fuser%2Fproject';
      expect(parseUrlParams((window as any).location)).toEqual({
        projectBaseDir: '/home/user/project',
        taskId: null,
      });
    });

    it('parses URL with task parameter', () => {
      (window as any).location.hash = '#/home?task=task-123';
      expect(parseUrlParams((window as any).location)).toEqual({
        projectBaseDir: null,
        taskId: 'task-123',
      });
    });

    it('parses URL with both project and task parameters', () => {
      (window as any).location.hash = '#/home?project=%2Fhome%2Fuser%2Fproject&task=task-123';
      expect(parseUrlParams((window as any).location)).toEqual({
        projectBaseDir: '/home/user/project',
        taskId: 'task-123',
      });
    });

    it('decodes encoded baseDir', () => {
      (window as any).location.hash = '#/home?project=%2Fhome%2Fuser%2Fmy%20project';
      expect(parseUrlParams((window as any).location)).toEqual({
        projectBaseDir: '/home/user/my project',
        taskId: null,
      });
    });

    it('handles URLs with additional hash fragments', () => {
      (window as any).location.hash = '#/home?project=%2Fhome%2Fuser%2Fproject#some-fragment';
      expect(parseUrlParams((window as any).location)).toEqual({
        projectBaseDir: '/home/user/project',
        taskId: null,
      });
    });
  });
});

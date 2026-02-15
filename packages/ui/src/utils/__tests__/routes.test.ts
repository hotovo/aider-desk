import { describe, it, expect, beforeEach } from 'vitest';

import { encodeBaseDir, decodeBaseDir } from '../routes';

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
});

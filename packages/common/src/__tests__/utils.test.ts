import { describe, it, expect } from 'vitest';

import { getRelativePath, parseCommandArgs, parseSkillCommand } from '../utils';
import { OS } from '../types';

describe('parseCommandArgs', () => {
  it('should parse simple space-separated arguments', () => {
    expect(parseCommandArgs('run-tests src/renderer')).toEqual(['run-tests', 'src/renderer']);
  });

  it('should treat text within double quotes as a single argument', () => {
    expect(parseCommandArgs('run-tests src/renderer "run these tests multiple times"')).toEqual([
      'run-tests',
      'src/renderer',
      'run these tests multiple times',
    ]);
  });

  it('should handle empty string', () => {
    expect(parseCommandArgs('')).toEqual([]);
  });

  it('should handle single argument', () => {
    expect(parseCommandArgs('hello')).toEqual(['hello']);
  });

  it('should handle multiple quoted arguments', () => {
    expect(parseCommandArgs('cmd "first arg" "second arg"')).toEqual(['cmd', 'first arg', 'second arg']);
  });

  it('should handle mixed quoted and unquoted arguments', () => {
    expect(parseCommandArgs('cmd plain "quoted value" another')).toEqual(['cmd', 'plain', 'quoted value', 'another']);
  });

  it('should handle unclosed quotes by treating rest as part of the argument', () => {
    expect(parseCommandArgs('cmd "unclosed quote')).toEqual(['cmd', 'unclosed quote']);
  });

  it('should handle empty quoted string', () => {
    expect(parseCommandArgs('cmd ""')).toEqual(['cmd', '']);
  });

  it('should handle multiple spaces between arguments', () => {
    expect(parseCommandArgs('cmd   arg1   arg2')).toEqual(['cmd', 'arg1', 'arg2']);
  });

  it('should handle quotes in the middle of unquoted argument', () => {
    expect(parseCommandArgs('cmd say"hello"world')).toEqual(['cmd', 'sayhelloworld']);
  });

  it('should handle leading and trailing spaces', () => {
    expect(parseCommandArgs('  cmd arg  ')).toEqual(['cmd', 'arg']);
  });
});

describe('parseSkillCommand', () => {
  it('should return null for a prompt without the /skill: prefix', () => {
    expect(parseSkillCommand('hello world')).toBeNull();
  });

  it('should return null when skill name is missing', () => {
    expect(parseSkillCommand('/skill:')).toBeNull();
    expect(parseSkillCommand('/skill: ')).toBeNull();
  });

  it('should parse skill name only', () => {
    expect(parseSkillCommand('/skill:pdf')).toEqual({ skillName: 'pdf', prompt: '' });
  });

  it('should parse skill name with additional prompt text', () => {
    expect(parseSkillCommand('/skill:pdf extract tables from the document')).toEqual({
      skillName: 'pdf',
      prompt: 'extract tables from the document',
    });
  });

  it('should trim additional prompt text', () => {
    expect(parseSkillCommand('/skill:pdf   extract tables   ')).toEqual({ skillName: 'pdf', prompt: 'extract tables' });
  });

  it('should support multiline prompt text', () => {
    expect(parseSkillCommand('/skill:pdf extract\ntables\nfrom document')).toEqual({
      skillName: 'pdf',
      prompt: 'extract\ntables\nfrom document',
    });
  });
});

describe('getRelativePath', () => {
  it.each([
    { base: '/project', target: '/project/.worktrees/Fix', os: OS.Linux, expected: '.worktrees/Fix' },
    { base: '/project/', target: '/project/src/', os: OS.Linux, expected: 'src' },
    { base: '/project', target: '/project/', os: OS.Linux, expected: '' },
    { base: '/project', target: '/Project/src', os: OS.Linux, expected: '/Project/src' },
    { base: '/project', target: '/project-other/src', os: OS.Linux, expected: '/project-other/src' },
    { base: '/project', target: '/other/worktree', os: OS.Linux, expected: '/other/worktree' },
    { base: '/', target: '/project/src', os: OS.Linux, expected: 'project/src' },
    { base: '/project', target: '/project/Src', os: OS.MacOS, expected: 'Src' },
    { base: '', target: '/project', os: OS.Linux, expected: '/project' },
    { base: '/project', target: '', os: OS.Linux, expected: '' },
    { base: String.raw`C:\Projects\App`, target: String.raw`c:\projects\app\.worktrees\Fix`, os: OS.Windows, expected: '.worktrees/Fix' },
    { base: String.raw`C:\Projects\App`, target: 'c:/projects/app/Src/', os: OS.Windows, expected: 'Src' },
    { base: 'C:/Projects/App/', target: String.raw`c:\projects\APP`, os: OS.Windows, expected: '' },
    { base: 'C:/Projects/App', target: 'C:/Projects/AppOther/Src', os: OS.Windows, expected: 'C:/Projects/AppOther/Src' },
    { base: 'C:/Projects/App', target: String.raw`D:\Worktrees\Fix`, os: OS.Windows, expected: String.raw`D:\Worktrees\Fix` },
    { base: 'C:/', target: String.raw`c:\Projects\App`, os: OS.Windows, expected: 'Projects/App' },
    { base: String.raw`\\Server\Share\App`, target: String.raw`\\server\share\app\Src`, os: OS.Windows, expected: 'Src' },
    { base: '/home/user/app', target: String.raw`\\wsl.localhost\Ubuntu\home\user\app\Src`, os: OS.Linux, expected: 'Src' },
  ])('resolves $target against $base on $os', ({ base, target, os, expected }) => {
    expect(getRelativePath(base, target, os)).toBe(expected);
  });
});

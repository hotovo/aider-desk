import { describe, it, expect } from 'vitest';

import { parseCommandArgs } from '../utils';

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

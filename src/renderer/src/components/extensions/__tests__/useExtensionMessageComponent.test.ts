import { describe, it, expect } from 'vitest';
import { Message, ToolMessage } from '@common/types';

const matchesMessage = (message: Message, messageFilter: { types?: Message['type'][]; serverName?: string; toolName?: string } | undefined): boolean => {
  if (!messageFilter) {
    return false;
  }

  if (messageFilter.types && messageFilter.types.length > 0) {
    if (!messageFilter.types.includes(message.type)) {
      return false;
    }
  }

  if (messageFilter.serverName || messageFilter.toolName) {
    if (message.type !== 'tool') {
      return false;
    }

    const toolMessage = message as ToolMessage;
    if (messageFilter.serverName && toolMessage.serverName !== messageFilter.serverName) {
      return false;
    }

    if (messageFilter.toolName && toolMessage.toolName !== messageFilter.toolName) {
      return false;
    }
  }

  return true;
};

describe('matchesMessage', () => {
  const userMessage: Message = { id: '1', type: 'user', content: 'hello' };
  const responseMessage: Message = { id: '2', type: 'response', content: 'hi' };
  const toolMessage: ToolMessage = { id: '3', type: 'tool', content: '{}', serverName: 'my-extension', toolName: 'run-linter', args: {} };
  const logMessage: Message = { id: '4', type: 'log', content: 'info' };

  it('returns false when messageFilter is undefined', () => {
    expect(matchesMessage(userMessage, undefined)).toBe(false);
  });

  it('matches by message type', () => {
    expect(matchesMessage(userMessage, { types: ['user'] })).toBe(true);
    expect(matchesMessage(userMessage, { types: ['tool'] })).toBe(false);
    expect(matchesMessage(responseMessage, { types: ['response'] })).toBe(true);
    expect(matchesMessage(logMessage, { types: ['log'] })).toBe(true);
  });

  it('matches when no type filter is specified', () => {
    expect(matchesMessage(userMessage, {})).toBe(true);
    expect(matchesMessage(toolMessage, {})).toBe(true);
  });

  it('matches tool message by serverName', () => {
    expect(matchesMessage(toolMessage, { serverName: 'my-extension' })).toBe(true);
    expect(matchesMessage(toolMessage, { serverName: 'other-extension' })).toBe(false);
  });

  it('matches tool message by toolName', () => {
    expect(matchesMessage(toolMessage, { toolName: 'run-linter' })).toBe(true);
    expect(matchesMessage(toolMessage, { toolName: 'other-tool' })).toBe(false);
  });

  it('matches tool message by both serverName and toolName', () => {
    expect(matchesMessage(toolMessage, { serverName: 'my-extension', toolName: 'run-linter' })).toBe(true);
    expect(matchesMessage(toolMessage, { serverName: 'my-extension', toolName: 'other-tool' })).toBe(false);
    expect(matchesMessage(toolMessage, { serverName: 'other-extension', toolName: 'run-linter' })).toBe(false);
  });

  it('does not match non-tool messages when serverName or toolName is specified', () => {
    expect(matchesMessage(userMessage, { serverName: 'my-extension' })).toBe(false);
    expect(matchesMessage(responseMessage, { toolName: 'run-linter' })).toBe(false);
  });

  it('matches combined type and tool filters', () => {
    expect(matchesMessage(toolMessage, { types: ['tool'], serverName: 'my-extension' })).toBe(true);
    expect(matchesMessage(toolMessage, { types: ['user'], serverName: 'my-extension' })).toBe(false);
  });
});

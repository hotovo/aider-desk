import { describe, it, expect } from 'vitest';

import { McpManager } from '../mcp-manager';

import type { McpServerConfig } from '@common/types';

describe('McpManager - scope calculation', () => {
  it('should calculate scope without interpolation', () => {
    const manager = new McpManager();
    const config: McpServerConfig = {
      command: 'npx',
      args: ['@modelcontextprotocol/server-filesystem', '/path'],
    };

    // Access private method via any for testing
    const scope = (manager as any).calculateServerScope(config, '/project', '/project/worktree', 'test-server');
    expect(scope).toBe('/project/worktree');
  });

  it('should calculate scope with taskDir when no projectDir', () => {
    const manager = new McpManager();
    const config: McpServerConfig = {
      command: 'npx',
      args: ['@modelcontextprotocol/server-filesystem', '/path'],
    };

    const scope = (manager as any).calculateServerScope(config, null, '/project/worktree', 'test-server');
    expect(scope).toBe('/project/worktree');
  });

  it('should calculate scope with projectDir when no taskDir', () => {
    const manager = new McpManager();
    const config: McpServerConfig = {
      command: 'npx',
      args: ['@modelcontextprotocol/server-filesystem', '/path'],
    };

    const scope = (manager as any).calculateServerScope(config, '/project', null, 'test-server');
    expect(scope).toBe('/project');
  });

  it('should calculate global scope when no interpolation and no dirs', () => {
    const manager = new McpManager();
    const config: McpServerConfig = {
      command: 'npx',
      args: ['@modelcontextprotocol/server-filesystem', '/path'],
    };

    const scope = (manager as any).calculateServerScope(config, null, null, 'test-server');
    expect(scope).toBe('global');
  });

  it('should calculate scope with projectDir interpolation only', () => {
    const manager = new McpManager();
    const config: McpServerConfig = {
      command: 'npx',
      args: ['@modelcontextprotocol/server-filesystem', '${projectDir}/data'],
    };

    const scope = (manager as any).calculateServerScope(config, '/project', '/project/worktree', 'test-server');
    expect(scope).toBe('/project');
  });

  it('should calculate global scope with projectDir interpolation but no projectDir', () => {
    const manager = new McpManager();
    const config: McpServerConfig = {
      command: 'npx',
      args: ['@modelcontextprotocol/server-filesystem', '${projectDir}/data'],
    };

    const scope = (manager as any).calculateServerScope(config, null, '/project/worktree', 'test-server');
    expect(scope).toBe('global');
  });

  it('should calculate scope with both projectDir and taskDir interpolation', () => {
    const manager = new McpManager();
    const config: McpServerConfig = {
      command: 'npx',
      args: ['@modelcontextprotocol/server-filesystem', '${projectDir}/${taskDir}'],
    };

    const scope = (manager as any).calculateServerScope(config, '/project', '/project/worktree', 'test-server');
    expect(scope).toBe('/project:/project/worktree');
  });

  it('should calculate global scope with both interpolations but no projectDir', () => {
    const manager = new McpManager();
    const config: McpServerConfig = {
      command: 'npx',
      args: ['@modelcontextprotocol/server-filesystem', '${projectDir}/${taskDir}'],
    };

    const scope = (manager as any).calculateServerScope(config, null, '/project/worktree', 'test-server');
    expect(scope).toBe('global');
  });

  it('should detect interpolation in env vars', () => {
    const manager = new McpManager();
    const config: McpServerConfig = {
      command: 'npx',
      args: ['@modelcontextprotocol/server-filesystem', '/path'],
      env: {
        PROJECT_PATH: '${projectDir}',
      },
    };

    const scope = (manager as any).calculateServerScope(config, '/project', '/project/worktree', 'test-server');
    expect(scope).toBe('/project');
  });

  it('should detect interpolation in URL', () => {
    const manager = new McpManager();
    const config: McpServerConfig = {
      url: 'http://localhost:8080/${projectDir}',
    };

    const scope = (manager as any).calculateServerScope(config, '/project', '/project/worktree', 'test-server');
    expect(scope).toBe('/project');
  });

  it('should detect interpolation in headers', () => {
    const manager = new McpManager();
    const config: McpServerConfig = {
      url: 'http://localhost:8080',
      headers: {
        'X-Project-Dir': '${projectDir}',
      },
    };

    const scope = (manager as any).calculateServerScope(config, '/project', '/project/worktree', 'test-server');
    expect(scope).toBe('/project');
  });
});

import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { checkProject } from '../check-project';

vi.mock('@/constants', () => ({
  AIDER_DESK_DIR: '.aider-desk',
  AIDER_DESK_AGENTS_DIR: '.aider-desk/agents',
  AIDER_DESK_EXTENSIONS_DIR: '.aider-desk/extensions',
  AIDER_DESK_MCP_SERVERS_FILE: 'mcp-servers.json',
}));

describe('checkProject', () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aiderdesk-project-check-'));
  });

  afterEach(async () => {
    await fs.rm(projectDir, { recursive: true, force: true });
  });

  const write = async (relativePath: string, content: string) => {
    const filePath = path.join(projectDir, relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content);
  };

  it('returns empty lists for a project without configuration', async () => {
    expect(await checkProject(projectDir)).toEqual({ agents: [], mcpServers: [], extensions: [] });
    expect(await fs.readdir(projectDir)).toEqual([]);
  });

  it('lists agents, MCP servers, and extension entry points without executing code', async () => {
    await write('.aider-desk/agents/custom/config.json', '{"id":"default","enabledServers":["test"]}');
    await write('.aider-desk/mcp-servers.json', '{"mcpServers":{"test":{"command":"never-execute"}}}');
    await write('.aider-desk/extensions/standalone.ts', 'throw new Error("must not execute");');
    await write('.aider-desk/extensions/nested/index.js', 'throw new Error("must not execute");');
    await write('.aider-desk/extensions/nested/index.ts', 'throw new Error("must not execute");');
    await write('.aider-desk/extensions/ignored/readme.md', 'not an extension');

    expect(await checkProject(projectDir)).toEqual({
      agents: [{ name: 'custom', path: path.join('.aider-desk', 'agents', 'custom') }],
      mcpServers: [{ name: 'test', path: path.join('.aider-desk', 'mcp-servers.json') }],
      extensions: [
        { name: 'nested', path: path.join('.aider-desk', 'extensions', 'nested', 'index.ts') },
        { name: 'standalone.ts', path: path.join('.aider-desk', 'extensions', 'standalone.ts') },
      ],
    });
  });

  it('includes rule-only agent directories', async () => {
    await write('.aider-desk/agents/default/rules/instructions.md', 'project instructions');
    expect((await checkProject(projectDir)).agents).toHaveLength(1);
  });

  it.each(['not json', 'null', '[]', '{"mcpServers":[]}'])('rejects malformed MCP configuration: %s', async (content) => {
    await write('.aider-desk/mcp-servers.json', content);
    await expect(checkProject(projectDir)).rejects.toThrow();
  });

  it('does not treat inspection errors as an empty inventory', async () => {
    await write('.aider-desk/extensions', 'not a directory');
    await expect(checkProject(projectDir)).rejects.toThrow();
  });
});

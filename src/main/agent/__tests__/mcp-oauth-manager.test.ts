vi.mock('@/logger');

import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { McpOAuthStatus } from '@common/types';

import { McpOAuthManager } from '../mcp-oauth-manager';

const temporaryDirectories: string[] = [];

const createManager = async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aider-desk-mcp-oauth-'));
  temporaryDirectories.push(directory);
  const storePath = path.join(directory, 'mcp-oauth.json');
  const manager = new McpOAuthManager(storePath);
  await manager.init();
  return { manager, storePath };
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe('McpOAuthManager', () => {
  it('persists OAuth provider state and tokens across restarts', async () => {
    const { manager, storePath } = await createManager();
    const serverUrl = 'https://mcp.example.com/mcp';
    const provider = await manager.getProvider(serverUrl);
    const state = await provider.state?.();

    expect(state).toBeTruthy();
    await provider.saveState?.(state!);
    await provider.saveCodeVerifier('verifier');
    await provider.saveClientInformation?.({ client_id: 'client-id', client_secret: 'client-secret' });
    await provider.saveAuthorizationServerInformation?.({
      authorizationServerUrl: 'https://mcp.example.com',
      tokenEndpoint: 'https://mcp.example.com/oauth/token',
    });
    await provider.redirectToAuthorization(new URL(`https://mcp.example.com/oauth/authorize?state=${state}`));

    expect(await manager.getStatus(serverUrl)).toEqual({ status: McpOAuthStatus.AuthenticationRequired });
    expect(await manager.startAuthorization(serverUrl)).toContain('/oauth/authorize');
    expect(await manager.getStatus(serverUrl)).toEqual({ status: McpOAuthStatus.Authorizing });

    await provider.saveTokens({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      token_type: 'Bearer',
      expires_in: 3600,
    });

    const reloadedManager = new McpOAuthManager(storePath);
    await reloadedManager.init();
    expect(await reloadedManager.getStatus(serverUrl)).toEqual({ status: McpOAuthStatus.Authenticated });
    expect(await (await reloadedManager.getProvider(serverUrl)).tokens()).toMatchObject({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    });

    if (process.platform !== 'win32') {
      expect((await fs.stat(storePath)).mode & 0o777).toBe(0o600);
    }
  });

  it('clears credentials while remembering that authentication is required', async () => {
    const { manager } = await createManager();
    const serverUrl = 'https://mcp.example.com/mcp';
    const provider = await manager.getProvider(serverUrl);
    await provider.saveTokens({ access_token: 'access-token', token_type: 'Bearer' });

    await manager.disconnect(serverUrl);

    expect(await manager.getStatus(serverUrl)).toEqual({ status: McpOAuthStatus.AuthenticationRequired });
    expect(await (await manager.getProvider(serverUrl)).tokens()).toBeUndefined();
  });

  it('clears a pending authorization after an OAuth error', async () => {
    const { manager } = await createManager();
    const serverUrl = 'https://mcp.example.com/mcp';
    const provider = await manager.getProvider(serverUrl);
    await provider.saveState?.('expected-state');
    await provider.redirectToAuthorization(new URL('https://mcp.example.com/oauth/authorize'));
    await manager.startAuthorization(serverUrl);

    await manager.cancelAuthorization('expected-state');

    expect(await manager.getStatus(serverUrl)).toEqual({ status: McpOAuthStatus.AuthenticationRequired });
    expect(await manager.startAuthorization(serverUrl)).toBeNull();
  });

  it('rejects authorization servers on a different origin', async () => {
    const { manager } = await createManager();
    const provider = await manager.getProvider('https://mcp.example.com/mcp');

    expect(() => provider.validateAuthorizationServerURL?.('https://mcp.example.com/mcp', 'https://login.example.com')).toThrow(
      'OAuth authorization server must use the MCP server origin',
    );
    await expect(
      (await manager.getMcpSdkProvider('https://mcp.example.com/mcp')).redirectToAuthorization(new URL('https://login.example.com/oauth')),
    ).rejects.toThrow('OAuth authorization server must use the MCP server origin');
  });

  it('blocks cross-origin OAuth requests before sending them', async () => {
    const { manager } = await createManager();
    const validatedFetch = manager.createValidatedFetch('https://mcp.example.com/mcp');

    await expect(validatedFetch('https://login.example.com/.well-known/oauth-authorization-server')).rejects.toThrow(
      'OAuth authorization server must use the MCP server origin',
    );
  });
});

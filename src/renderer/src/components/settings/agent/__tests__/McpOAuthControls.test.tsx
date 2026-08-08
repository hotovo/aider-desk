import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { McpOAuthStatus } from '@common/types';

import { McpOAuthControls } from '../McpOAuthControls';

import { createMockApi } from '@/__tests__/mocks/api';
import { useApi } from '@/contexts/ApiContext';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/contexts/ApiContext', () => ({
  useApi: vi.fn(),
}));

const config = { url: 'https://mcp.example.com/mcp' };

describe('McpOAuthControls', () => {
  const onAuthenticated = vi.fn();
  const onDisconnected = vi.fn();
  const onStatusChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts OAuth from the MCP server item', async () => {
    const api = createMockApi({
      getMcpOAuthStatus: vi.fn(() => Promise.resolve({ status: McpOAuthStatus.AuthenticationRequired })),
      startMcpOAuth: vi.fn(() => Promise.resolve('https://mcp.example.com/oauth/authorize')),
    });
    vi.mocked(useApi).mockReturnValue(api);

    render(
      <McpOAuthControls
        serverName="sentry"
        config={config}
        refreshTrigger={0}
        onAuthenticated={onAuthenticated}
        onDisconnected={onDisconnected}
        onStatusChange={onStatusChange}
      />,
    );

    fireEvent.click(await screen.findByText('mcp.oauth.connect'));

    await waitFor(() => {
      expect(api.startMcpOAuth).toHaveBeenCalledWith('sentry', config);
      expect(api.openUrlExternally).toHaveBeenCalledWith('https://mcp.example.com/oauth/authorize');
    });
    expect(screen.getByText('mcp.oauth.authorizing')).toBeInTheDocument();
  });

  it('disconnects an authenticated server', async () => {
    const api = createMockApi({
      getMcpOAuthStatus: vi.fn(() => Promise.resolve({ status: McpOAuthStatus.Authenticated })),
    });
    vi.mocked(useApi).mockReturnValue(api);

    render(
      <McpOAuthControls
        serverName="sentry"
        config={config}
        refreshTrigger={0}
        onAuthenticated={onAuthenticated}
        onDisconnected={onDisconnected}
        onStatusChange={onStatusChange}
      />,
    );

    fireEvent.click(await screen.findByText('mcp.oauth.disconnect'));

    await waitFor(() => {
      expect(api.disconnectMcpOAuth).toHaveBeenCalledWith('sentry', config);
      expect(onDisconnected).toHaveBeenCalledOnce();
    });
    expect(screen.getByText('mcp.oauth.authenticationRequired')).toBeInTheDocument();
  });
});

import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { McpOAuthStatus } from '@common/types';

import { McpServerToolsPanel } from '../McpServerToolsPanel';

import { createMockApi } from '@/__tests__/mocks/api';
import { render } from '@/__tests__/render';
import { useApi } from '@/contexts/ApiContext';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/contexts/ApiContext', () => ({
  useApi: vi.fn(),
}));

const config = { url: 'https://mcp.example.com/mcp' };
const authError = "McpAuthenticationRequiredError: MCP server 'sentry' requires OAuth authentication.";

describe('McpServerToolsPanel', () => {
  const onReload = vi.fn();
  const onEdit = vi.fn();
  const onRemove = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the Connect button when a late tools-load error reports authentication is required', async () => {
    const api = createMockApi({
      loadMcpServerTools: vi.fn(() => Promise.resolve([])),
      getMcpOAuthStatus: vi
        .fn()
        .mockResolvedValueOnce({ status: McpOAuthStatus.NotRequired })
        .mockResolvedValue({ status: McpOAuthStatus.AuthenticationRequired }),
    });
    vi.mocked(useApi).mockReturnValue(api);

    const props = {
      serverName: 'sentry',
      config,
      tools: null,
      onReload,
      onEdit,
      onRemove,
    };

    const { rerender } = render(<McpServerToolsPanel {...props} loading error={null} />);

    // Initial OAuth status resolves before discovery completes, so no Connect button yet
    await waitFor(() => {
      expect(api.getMcpOAuthStatus).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText('mcp.oauth.connect')).not.toBeInTheDocument();

    rerender(<McpServerToolsPanel {...props} loading={false} error={authError} />);

    expect(await screen.findByText('mcp.oauth.connect')).toBeInTheDocument();
    await waitFor(() => {
      expect(api.getMcpOAuthStatus).toHaveBeenCalledTimes(2);
    });
  });
});

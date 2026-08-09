import { type ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { McpOAuthStatus, ToolApprovalState } from '@common/types';

import { McpServerItem } from '../../mcp/McpServerItem';

import { createMockApi } from '@/__tests__/mocks/api';
import { useApi } from '@/contexts/ApiContext';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/contexts/ApiContext', () => ({
  useApi: vi.fn(),
}));

vi.mock('@/components/common/Accordion', () => ({
  Accordion: ({ children, isOpen }: { children: ReactNode; isOpen?: boolean }) => (
    <div data-testid="accordion" data-open={isOpen}>
      {isOpen ? children : null}
    </div>
  ),
}));

vi.mock('@/components/common/IconButton', () => ({
  IconButton: () => null,
}));

describe('McpServerItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('shows only the OAuth guidance when authentication is required', async () => {
    const api = createMockApi({
      loadMcpServerTools: vi.fn(() => Promise.reject(new Error("McpAuthenticationRequiredError: MCP server 'sentry' requires OAuth authentication."))),
      getMcpOAuthStatus: vi.fn(() => Promise.resolve({ status: McpOAuthStatus.AuthenticationRequired })),
    });
    vi.mocked(useApi).mockReturnValue(api);

    render(
      <McpServerItem
        serverName="sentry"
        config={{ url: 'https://mcp.sentry.dev/mcp' }}
        toolApprovals={{}}
        onApprovalChange={vi.fn<(toolId: string, approval: ToolApprovalState) => void>()}
      />,
    );

    expect(await screen.findByText('mcp.oauth.authenticationRequired')).toBeInTheDocument();
    expect(screen.getByTestId('accordion')).toHaveAttribute('data-open', 'true');
    await waitFor(() => {
      expect(screen.queryByText(/McpAuthenticationRequiredError/)).not.toBeInTheDocument();
    });
  });
});

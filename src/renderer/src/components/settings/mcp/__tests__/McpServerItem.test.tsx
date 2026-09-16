import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';
import { McpServerConfig, McpTool, ToolApprovalState } from '@common/types';

import { McpServerItem } from '../McpServerItem';

import { createMockApi } from '@/__tests__/mocks/api';
import { render } from '@/__tests__/render';
import { useApi } from '@/contexts/ApiContext';

vi.mock('@/contexts/ApiContext', async () => {
  const actual = await vi.importActual<typeof import('@/contexts/ApiContext')>('@/contexts/ApiContext');
  return {
    ...actual,
    useApi: vi.fn(),
  };
});

vi.mock('../McpOAuthControls', () => ({
  McpOAuthControls: () => <div />,
}));

describe('McpServerItem bulk approval select', () => {
  const config: McpServerConfig = { url: 'https://mcp.example.com/mcp' };
  const tools: McpTool[] = [
    { name: 'tool_one', serverName: 'test-server', description: 'one', inputSchema: { type: 'object' } },
    { name: 'tool_two', serverName: 'test-server', description: 'two', inputSchema: { type: 'object' } },
  ];
  const onApprovalChange = vi.fn();
  const onEnabledChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const toolId = (toolName: string) => `test-server${TOOL_GROUP_NAME_SEPARATOR}${toolName}`;

  const renderComponent = (toolApprovals: Record<string, ToolApprovalState> = {}) => {
    vi.mocked(useApi).mockReturnValue(createMockApi({ loadMcpServerTools: vi.fn(() => Promise.resolve(tools)) }));
    render(
      <McpServerItem
        serverName="test-server"
        config={config}
        toolApprovals={toolApprovals}
        onApprovalChange={onApprovalChange}
        enabled
        onEnabledChange={onEnabledChange}
      />,
    );
  };

  const openAccordion = async () => {
    const header = await screen.findByText('test-server');
    fireEvent.click(header);
    await screen.findByText('mcp.tools');
    return screen.getAllByRole('button', { hidden: true }).filter((el) => el.getAttribute('aria-haspopup') === 'listbox');
  };

  it('shows the shared approval value on the All select', async () => {
    renderComponent();
    const selectButtons = await openAccordion();

    expect(selectButtons).toHaveLength(3);
    selectButtons.forEach((button) => expect(button).toHaveTextContent('tool.approval.always'));
  });

  it('shows "-" when tool approvals differ', async () => {
    renderComponent({ [toolId('tool_one')]: ToolApprovalState.Always, [toolId('tool_two')]: ToolApprovalState.Never });
    const selectButtons = await openAccordion();

    expect(selectButtons[0]).toHaveTextContent('-');
    expect(selectButtons[1]).toHaveTextContent('tool.approval.always');
    expect(selectButtons[2]).toHaveTextContent('tool.approval.never');
  });

  it('applies the chosen approval to all tools at once', async () => {
    renderComponent();
    const selectButtons = await openAccordion();

    fireEvent.click(selectButtons[0]);
    const listbox = await screen.findByRole('listbox');
    fireEvent.click(within(listbox).getByText('tool.approval.never'));

    await waitFor(() => {
      expect(onApprovalChange).toHaveBeenCalledTimes(1);
      expect(onApprovalChange).toHaveBeenCalledWith([toolId('tool_one'), toolId('tool_two')], ToolApprovalState.Never);
    });
  });

  it('does not apply anything when selecting the mixed "-" label', async () => {
    renderComponent({ [toolId('tool_one')]: ToolApprovalState.Always, [toolId('tool_two')]: ToolApprovalState.Never });
    const selectButtons = await openAccordion();

    fireEvent.click(selectButtons[0]);
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).queryByText('-')).not.toBeInTheDocument();

    fireEvent.keyDown(selectButtons[0], { key: 'Escape' });
    expect(onApprovalChange).not.toHaveBeenCalled();
  });
});

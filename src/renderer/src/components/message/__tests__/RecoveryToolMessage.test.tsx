import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToolMessage } from '@common/types';
import { createToolRecoveryNotice, ToolRecoveryCode } from '@common/tool-recovery';
import zh from '@common/locales/zh.json';
import { POWER_TOOL_GROUP_NAME, POWER_TOOL_BASH, POWER_TOOL_FILE_READ, SKILLS_TOOL_GROUP_NAME, SKILLS_TOOL_ACTIVATE_SKILL } from '@common/tools';

import { MessageBlock } from '../MessageBlock';
import { CompactToolMessage } from '../CompactToolMessage';

import { render } from '@/__tests__/render';
import { ApiContext } from '@/contexts/ApiContext';
import { createMockApi } from '@/__tests__/mocks/api';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => (key.startsWith('durability.notices.') ? zh.durability.notices[key.split('.').at(-1)! as ToolRecoveryCode] : key),
  }),
}));

const message = (serverName: string, toolName: string, content = JSON.stringify(createToolRecoveryNotice(ToolRecoveryCode.Interrupted))): ToolMessage => ({
  id: 'interrupted-tool',
  type: 'tool',
  serverName,
  toolName,
  args: {},
  content,
});

const tools = [
  [POWER_TOOL_GROUP_NAME, POWER_TOOL_BASH],
  [POWER_TOOL_GROUP_NAME, POWER_TOOL_FILE_READ],
  [SKILLS_TOOL_GROUP_NAME, SKILLS_TOOL_ACTIVATE_SKILL],
  ['custom-server', 'custom-tool'],
];

describe('recovery notice dispatch', () => {
  it.each(tools)('shows a localized warning instead of specialized output for %s/%s', (serverName, toolName) => {
    const tool = message(serverName, toolName);
    render(<MessageBlock baseDir="/project" taskId="task" message={tool} allFiles={[]} renderMarkdown={false} hideMessageBar />);
    expect(screen.getByRole('status')).toHaveTextContent(zh.durability.notices.interrupted);
    expect(screen.queryByText(createToolRecoveryNotice(ToolRecoveryCode.Interrupted).message, { exact: true })).not.toBeInTheDocument();
    expect(JSON.parse(tool.content).message).toBe(createToolRecoveryNotice(ToolRecoveryCode.Interrupted).message);
  });

  it('shows localized nested interruption warnings while retaining completed progress', () => {
    const content = JSON.stringify({
      interruption: createToolRecoveryNotice(ToolRecoveryCode.Interrupted),
      toolResults: [{ name: 'read', output: 'COMPLETED_PROGRESS' }],
    });
    render(
      <ApiContext.Provider value={createMockApi()}>
        <CompactToolMessage message={message('custom', 'orchestrate', content)} isExpanded onToggle={vi.fn()} />
      </ApiContext.Provider>,
    );
    expect(screen.getByRole('status')).toHaveTextContent(zh.durability.notices.interrupted);
    expect(screen.getByText(/COMPLETED_PROGRESS/)).toBeInTheDocument();
  });
});

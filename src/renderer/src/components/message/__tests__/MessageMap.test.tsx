import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AssistantGroupMessage, GroupMessage, Message } from '@common/types';

import { MessageMap } from '../MessageMap';
import { createMessageMapTurns } from '../messageMap';

import { render } from '@/__tests__/render';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { role?: string; number?: number }) => {
      if (values?.role !== undefined) {
        return `${key} ${values.role} ${values.number}`;
      }
      if (values?.number !== undefined) {
        return `${key} ${values.number}`;
      }
      return key;
    },
  }),
}));

const messages: Message[] = [
  { id: 'user-1', type: 'user', content: 'First question' },
  { id: 'tool-1', type: 'tool', content: 'Tool output' },
  { id: 'assistant-1', type: 'response', content: 'First answer' },
  { id: 'user-2', type: 'user', content: 'Second question' },
  { id: 'assistant-2', type: 'response', content: 'Latest answer' },
];

const turnName = (number: number) => `messages.map.goToTurn ${number}`;

describe('MessageMap', () => {
  it('previews the whole turn on hover without navigating and navigates to the turn start on click', async () => {
    const onNavigate = vi.fn();
    render(<MessageMap messages={messages} onNavigate={onNavigate} getVisibleIndex={() => 0} visibleIndex={0} />);
    const marker = screen.getByRole('button', { name: turnName(2) });

    fireEvent.pointerEnter(marker);
    await waitFor(() => expect(screen.getByText('Second question')).toBeInTheDocument());
    expect(screen.getByText('Latest answer')).toBeInTheDocument();
    expect(onNavigate).not.toHaveBeenCalled();

    fireEvent.click(marker);
    expect(onNavigate).toHaveBeenCalledExactlyOnceWith(3);
    fireEvent.pointerLeave(marker);
  });

  it('previews on keyboard focus without navigating', async () => {
    const onNavigate = vi.fn();
    render(<MessageMap messages={messages} onNavigate={onNavigate} getVisibleIndex={() => 0} visibleIndex={0} />);
    const marker = screen.getByRole('button', { name: turnName(1) });

    fireEvent.focus(marker);
    await waitFor(() => expect(screen.getByText('First question')).toBeInTheDocument());
    expect(onNavigate).not.toHaveBeenCalled();
    fireEvent.blur(marker);
  });

  it('marks the turn currently in view based on visibleIndex', () => {
    const { rerender } = render(<MessageMap messages={messages} onNavigate={vi.fn()} getVisibleIndex={() => 0} visibleIndex={0} />);
    expect(screen.getByRole('button', { name: turnName(1) })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: turnName(2) })).not.toHaveAttribute('aria-current');

    rerender(<MessageMap messages={messages} onNavigate={vi.fn()} getVisibleIndex={() => 0} visibleIndex={3} />);
    expect(screen.getByRole('button', { name: turnName(2) })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: turnName(1) })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('navigation')).toHaveClass('opacity-10', 'hover:opacity-100', 'focus-within:opacity-100');
  });

  it('navigates to user prompts relative to the visible list index and to the latest assistant', () => {
    const onNavigate = vi.fn();
    render(<MessageMap messages={messages} onNavigate={onNavigate} getVisibleIndex={() => 2} visibleIndex={2} />);

    fireEvent.click(screen.getByRole('button', { name: 'messages.previousUserMessage' }));
    expect(onNavigate).toHaveBeenLastCalledWith(0);
    fireEvent.click(screen.getByRole('button', { name: 'messages.nextUserMessage' }));
    expect(onNavigate).toHaveBeenLastCalledWith(3);
    fireEvent.click(screen.getByRole('button', { name: 'messages.map.lastAssistant' }));
    expect(onNavigate).toHaveBeenLastCalledWith(4);
  });

  it('updates the latest reply as messages arrive', () => {
    const onNavigate = vi.fn();
    const { rerender } = render(<MessageMap messages={messages} onNavigate={onNavigate} getVisibleIndex={() => 0} visibleIndex={0} />);
    rerender(
      <MessageMap messages={[...messages, { id: 'new', type: 'response', content: 'New reply' }]} onNavigate={onNavigate} getVisibleIndex={() => 0} visibleIndex={0} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'messages.map.lastAssistant' }));
    expect(onNavigate).toHaveBeenLastCalledWith(5);
  });

  it('hides the map without conversational messages and disables unavailable shortcuts', () => {
    const { rerender } = render(<MessageMap messages={[]} onNavigate={vi.fn()} getVisibleIndex={() => 0} visibleIndex={0} />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    rerender(<MessageMap messages={[messages[0]]} onNavigate={vi.fn()} getVisibleIndex={() => 0} visibleIndex={0} />);
    expect(screen.getByRole('button', { name: 'messages.map.lastAssistant' })).toBeDisabled();
    rerender(<MessageMap messages={[messages[2]]} onNavigate={vi.fn()} getVisibleIndex={() => 0} visibleIndex={0} />);
    expect(screen.getByRole('button', { name: 'messages.previousUserMessage' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'messages.nextUserMessage' })).toBeDisabled();
  });
});

describe('createMessageMapTurns', () => {
  it('groups assistant replies under the preceding user prompt and tracks the last reply', () => {
    expect(createMessageMapTurns(messages)).toEqual([
      { id: '0-user-1', number: 1, startIndex: 0, userIndex: 0, userPreview: 'First question', lastAssistantIndex: 2, lastAssistantPreview: 'First answer' },
      { id: '3-user-2', number: 2, startIndex: 3, userIndex: 3, userPreview: 'Second question', lastAssistantIndex: 4, lastAssistantPreview: 'Latest answer' },
    ]);
  });

  it('creates a leading turn without a user prompt for replies before the first user message', () => {
    const turns = createMessageMapTurns([{ id: 'assistant-0', type: 'response', content: 'Intro' }, messages[0], messages[2]]);
    expect(turns).toEqual([
      { id: '0-assistant-0', number: 1, startIndex: 0, userIndex: null, userPreview: '', lastAssistantIndex: 0, lastAssistantPreview: 'Intro' },
      { id: '1-user-1', number: 2, startIndex: 1, userIndex: 1, userPreview: 'First question', lastAssistantIndex: 2, lastAssistantPreview: 'First answer' },
    ]);
  });

  it('maps compact and nested grouped messages to their containing rendered item', () => {
    const compact: AssistantGroupMessage = {
      id: 'compact',
      type: 'assistant-group',
      content: '',
      responseMessage: { id: 'response', type: 'response', content: 'Compact answer' },
      toolMessages: [],
    };
    const group: GroupMessage = {
      id: 'group',
      type: 'group',
      content: '',
      group: { id: 'group', name: 'Thread' },
      children: [messages[0], compact],
    };
    const turns = createMessageMapTurns([messages[3], group]);
    expect(turns.map((turn) => [turn.startIndex, turn.userIndex, turn.lastAssistantIndex])).toEqual([
      [0, 0, null],
      [1, 1, 1],
    ]);
    expect(turns[1].userPreview).toBe('First question');
    expect(turns[1].lastAssistantPreview).toBe('Compact answer');
  });

  it('bounds preview length', () => {
    const turns = createMessageMapTurns([{ id: 'long', type: 'user', content: 'x'.repeat(10000) }]);
    expect(turns[0].userPreview).toHaveLength(280);
  });
});

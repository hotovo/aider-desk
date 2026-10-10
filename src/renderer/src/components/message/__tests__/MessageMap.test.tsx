import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AssistantGroupMessage, GroupMessage, Message } from '@common/types';

import { MessageMap } from '../MessageMap';
import { createMessageMapMarkers, createMessageMapTurns, MessageMapRole } from '../messageMap';

import { render } from '@/__tests__/render';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { label?: string; number?: number }) => {
      if (values?.label !== undefined) {
        return `${key} ${values.label} ${values.number}`;
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

const markerName = (role: MessageMapRole, number: number) =>
  `messages.map.goToMessage messages.map.${role === MessageMapRole.User ? 'userPrompt' : 'assistantReply'} ${number}`;

const renderMap = (overrides: Partial<Parameters<typeof MessageMap>[0]> = {}) =>
  render(
    <MessageMap
      messages={messages}
      visibleIndex={0}
      onNavigate={vi.fn()}
      onPreviousUserMessage={vi.fn()}
      onNextUserMessage={vi.fn()}
      hasPreviousUserMessage
      hasNextUserMessage
      onScrollToBottom={vi.fn()}
      {...overrides}
    />,
  );

describe('MessageMap', () => {
  it('previews the assistant reply on hover without navigating and navigates to it on click', async () => {
    const onNavigate = vi.fn();
    renderMap({ onNavigate });
    const marker = screen.getByRole('button', { name: markerName(MessageMapRole.Assistant, 2) });

    fireEvent.pointerEnter(marker);
    await waitFor(() => expect(screen.getByText('Latest answer')).toBeInTheDocument());
    expect(onNavigate).not.toHaveBeenCalled();

    fireEvent.click(marker);
    expect(onNavigate).toHaveBeenCalledExactlyOnceWith(4, false);
    fireEvent.pointerLeave(marker);
  });

  it('shows the updated streaming preview when the marker is hovered after an update', async () => {
    const onNavigate = vi.fn();
    const { rerender } = renderMap({ onNavigate });
    const updatedMessages = messages.map((message) => (message.id === 'assistant-2' ? { ...message, content: 'Latest answer continued' } : message));
    rerender(
      <MessageMap
        messages={updatedMessages}
        visibleIndex={0}
        onNavigate={onNavigate}
        onPreviousUserMessage={vi.fn()}
        onNextUserMessage={vi.fn()}
        hasPreviousUserMessage
        hasNextUserMessage
        onScrollToBottom={vi.fn()}
      />,
    );
    const marker = screen.getByRole('button', { name: markerName(MessageMapRole.Assistant, 2) });

    fireEvent.pointerEnter(marker);
    await waitFor(() => expect(screen.getByText('Latest answer continued')).toBeInTheDocument());
    fireEvent.click(marker);
    expect(onNavigate).toHaveBeenCalledExactlyOnceWith(4, false);
    fireEvent.pointerLeave(marker);
  });

  it('navigates to the user prompt of a turn on click', () => {
    const onNavigate = vi.fn();
    renderMap({ onNavigate });

    fireEvent.click(screen.getByRole('button', { name: markerName(MessageMapRole.User, 2) }));
    expect(onNavigate).toHaveBeenCalledExactlyOnceWith(3, false);
  });

  it('previews on keyboard focus without navigating', async () => {
    const onNavigate = vi.fn();
    renderMap({ onNavigate });
    const marker = screen.getByRole('button', { name: markerName(MessageMapRole.User, 1) });

    fireEvent.focus(marker);
    await waitFor(() => expect(screen.getByText('First question')).toBeInTheDocument());
    expect(onNavigate).not.toHaveBeenCalled();
    fireEvent.blur(marker);
  });

  it('colors user markers green and assistant markers blue', () => {
    renderMap();
    expect(screen.getByRole('button', { name: markerName(MessageMapRole.User, 1) }).firstChild).toHaveClass('bg-success-light');
    expect(screen.getByRole('button', { name: markerName(MessageMapRole.Assistant, 1) }).firstChild).toHaveClass('bg-info-light');
  });

  it('marks only the user message in view (or the previous one) and never an assistant marker', () => {
    const { rerender } = renderMap({ visibleIndex: 0 });
    const firstMarker = screen.getByRole('button', { name: markerName(MessageMapRole.User, 1) });
    expect(firstMarker).toHaveAttribute('aria-current', 'true');
    expect(firstMarker.firstChild).toHaveClass('ring-1');

    const renderAt = (visibleIndex: number) =>
      rerender(
        <MessageMap
          messages={messages}
          visibleIndex={visibleIndex}
          onNavigate={vi.fn()}
          onPreviousUserMessage={vi.fn()}
          onNextUserMessage={vi.fn()}
          hasPreviousUserMessage
          hasNextUserMessage
          onScrollToBottom={vi.fn()}
        />,
      );

    // Scrolled into the first turn's reply: still the first user message.
    renderAt(2);
    expect(screen.getByRole('button', { name: markerName(MessageMapRole.User, 1) })).toHaveAttribute('aria-current', 'true');

    // Scrolled onto the second turn's reply: the second user message, not the assistant marker.
    renderAt(4);
    expect(screen.getByRole('button', { name: markerName(MessageMapRole.User, 2) })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: markerName(MessageMapRole.User, 1) })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: markerName(MessageMapRole.Assistant, 1) })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: markerName(MessageMapRole.Assistant, 2) })).not.toHaveAttribute('aria-current');
  });

  it('becomes opaque only on hover, has a solid background and no left border', () => {
    renderMap();
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveClass('opacity-10', 'hover:opacity-100', 'border-y', 'border-r', 'hover:bg-bg-primary-light');
    expect(nav.className).not.toContain('focus-within:opacity-100');
    expect(nav.className).not.toMatch(/(^|\s)border-l(\s|$)/);
  });

  it('delegates user navigation to the provided handlers and scrolls to bottom', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const onScrollToBottom = vi.fn();
    renderMap({ onPreviousUserMessage: onPrev, onNextUserMessage: onNext, onScrollToBottom });

    fireEvent.click(screen.getByRole('button', { name: 'messages.previousUserMessage' }));
    expect(onPrev).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'messages.nextUserMessage' }));
    expect(onNext).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'messages.scrollToBottom' }));
    expect(onScrollToBottom).toHaveBeenCalledOnce();
  });

  it('disables the user navigation shortcuts based on the provided availability flags', () => {
    renderMap({ hasPreviousUserMessage: false, hasNextUserMessage: false });
    expect(screen.getByRole('button', { name: 'messages.previousUserMessage' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'messages.nextUserMessage' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'messages.scrollToBottom' })).toBeEnabled();
  });

  it('hides the map without conversational messages', () => {
    renderMap({ messages: [] });
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
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

describe('createMessageMapMarkers', () => {
  it('creates a green user marker and a blue last-assistant marker per turn in scroll order', () => {
    expect(createMessageMapMarkers(createMessageMapTurns(messages))).toEqual([
      { id: '0-user-1-user', turnNumber: 1, role: MessageMapRole.User, index: 0, preview: 'First question' },
      { id: '0-user-1-assistant', turnNumber: 1, role: MessageMapRole.Assistant, index: 2, preview: 'First answer' },
      { id: '3-user-2-user', turnNumber: 2, role: MessageMapRole.User, index: 3, preview: 'Second question' },
      { id: '3-user-2-assistant', turnNumber: 2, role: MessageMapRole.Assistant, index: 4, preview: 'Latest answer' },
    ]);
  });

  it('omits the missing side when a turn only has one role', () => {
    expect(createMessageMapMarkers(createMessageMapTurns([{ id: 'u', type: 'user', content: 'Question' }]))).toEqual([
      { id: '0-u-user', turnNumber: 1, role: MessageMapRole.User, index: 0, preview: 'Question' },
    ]);
  });
});

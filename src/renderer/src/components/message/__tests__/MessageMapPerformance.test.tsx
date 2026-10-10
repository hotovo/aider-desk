import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { Message } from '@common/types';

import { MessageMap } from '../MessageMap';

import { render } from '@/__tests__/render';

const { translate } = vi.hoisted(() => ({
  translate: vi.fn((key: string, values?: { label?: string; number?: number }) => (values?.label ? `${key} ${values.label} ${values.number}` : key)),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: translate }),
}));

const markerRenderCount = () => translate.mock.calls.filter(([key]) => key === 'messages.map.goToMessage').length;

const createMessages = (answer = 'x'.repeat(280)): Message[] => [
  { id: 'user-1', type: 'user', content: 'First question' },
  { id: 'assistant-1', type: 'response', content: 'First answer' },
  { id: 'user-2', type: 'user', content: 'Second question' },
  { id: 'assistant-2', type: 'response', content: answer },
];

const createProps = () => ({
  messages: createMessages(),
  visibleIndex: 0,
  onNavigate: vi.fn(),
  onPreviousUserMessage: vi.fn(),
  onNextUserMessage: vi.fn(),
  hasPreviousUserMessage: true,
  hasNextUserMessage: true,
  onScrollToBottom: vi.fn(),
});

describe('MessageMap streaming performance', () => {
  beforeEach(() => {
    translate.mockClear();
  });

  it('does not rerender markers when streaming only changes text beyond the preview', () => {
    const props = createProps();
    const { rerender } = render(<MessageMap {...props} />);
    expect(markerRenderCount()).toBe(4);
    translate.mockClear();

    for (let chunk = 1; chunk <= 20; chunk++) {
      rerender(<MessageMap {...props} messages={createMessages('x'.repeat(280) + ' chunk'.repeat(chunk))} />);
    }

    expect(markerRenderCount()).toBe(0);
  });

  it('rerenders only the assistant marker whose streaming preview changes', () => {
    const props = { ...createProps(), messages: createMessages('Partial') };
    const { rerender } = render(<MessageMap {...props} />);
    translate.mockClear();

    rerender(<MessageMap {...props} messages={createMessages('Partial answer')} />);

    expect(markerRenderCount()).toBe(1);
  });

  it('rerenders only the two user markers when the active turn changes', () => {
    const props = createProps();
    const { rerender } = render(<MessageMap {...props} />);
    translate.mockClear();

    rerender(<MessageMap {...props} visibleIndex={3} />);

    expect(markerRenderCount()).toBe(2);
    expect(screen.getAllByRole('button', { current: true })).toHaveLength(1);
  });

  it('uses the updated rendered index after messages are inserted', () => {
    const props = createProps();
    const { rerender } = render(<MessageMap {...props} />);
    const nextMessages: Message[] = [props.messages[0], { id: 'tool', type: 'tool', content: '' }, ...props.messages.slice(1)];

    rerender(<MessageMap {...props} messages={nextMessages} />);
    fireEvent.click(screen.getByRole('button', { name: 'messages.map.goToMessage messages.map.assistantReply 2' }));

    expect(props.onNavigate).toHaveBeenCalledExactlyOnceWith(4, false);
  });

  it('uses a replacement navigation callback without retaining stale closures', () => {
    const props = createProps();
    const { rerender } = render(<MessageMap {...props} />);
    const onNavigate = vi.fn();

    rerender(<MessageMap {...props} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: 'messages.map.goToMessage messages.map.assistantReply 2' }));

    expect(onNavigate).toHaveBeenCalledExactlyOnceWith(3, false);
    expect(props.onNavigate).not.toHaveBeenCalled();
  });
});

import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HotkeysProvider } from 'react-hotkeys-hook';
import { InputPromptData } from '@common/types';

import { InputPromptDialog } from '../InputPromptDialog';

import { useApi } from '@/contexts/ApiContext';

vi.mock('@/contexts/ApiContext', () => ({
  useApi: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { exists: (key: string) => key.startsWith('common.') || key.startsWith('git.') },
  }),
}));

vi.mock('focus-trap-react', () => ({
  FocusTrap: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('InputPromptDialog', () => {
  let promptCallback: ((data: InputPromptData) => void) | null = null;
  const mockRespondInputPrompt = vi.fn().mockResolvedValue(undefined);
  const mockOnInputPrompt = vi.fn((callback: (data: InputPromptData) => void) => {
    promptCallback = callback;
    return vi.fn();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    promptCallback = null;
    vi.mocked(useApi).mockReturnValue({
      onInputPrompt: mockOnInputPrompt,
      respondInputPrompt: mockRespondInputPrompt,
    } as unknown as ReturnType<typeof useApi>);
  });

  const renderComponent = () => {
    return render(
      <HotkeysProvider initiallyActiveScopes={['dialog']}>
        <InputPromptDialog />
      </HotkeysProvider>,
    );
  };

  it('does not display anything when there is no prompt', () => {
    renderComponent();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('renders password prompt and submits password', async () => {
    renderComponent();

    act(() => {
      promptCallback!({
        id: 'prompt-1',
        title: 'git.askpass.title',
        message: "Enter passphrase for key '/home/user/.ssh/id_ed25519':",
        type: 'password',
        allowRememberSession: true,
        rememberSessionLabel: 'git.askpass.rememberSession',
      });
    });

    expect(screen.getByText('git.askpass.title')).toBeInTheDocument();
    expect(screen.getByText("Enter passphrase for key '/home/user/.ssh/id_ed25519':")).toBeInTheDocument();

    const input = screen.getByPlaceholderText('common.enterPassword') as HTMLInputElement;
    expect(input.type).toBe('password');

    // Toggle show password
    const toggleButton = screen.getByRole('button', { name: 'common.showPassword' });
    act(() => {
      fireEvent.click(toggleButton);
    });
    expect(input.type).toBe('text');

    // Enter password
    act(() => {
      fireEvent.change(input, { target: { value: 'my-passphrase' } });
    });

    // Check remember session
    const rememberCheckbox = screen.getByText('git.askpass.rememberSession');
    act(() => {
      fireEvent.click(rememberCheckbox);
    });

    // Submit
    const submitButton = screen.getByText('common.confirm');
    act(() => {
      fireEvent.click(submitButton);
    });

    expect(mockRespondInputPrompt).toHaveBeenCalledWith('prompt-1', 'my-passphrase', true);
  });

  it('cancels prompt and sends null', async () => {
    renderComponent();

    act(() => {
      promptCallback!({
        id: 'prompt-2',
        title: 'git.askpass.title',
        message: 'Enter passphrase:',
        type: 'password',
      });
    });

    const cancelButton = screen.getByText('common.cancel');
    act(() => {
      fireEvent.click(cancelButton);
    });

    expect(mockRespondInputPrompt).toHaveBeenCalledWith('prompt-2', null);
  });

  it('renders confirmation prompt with Yes and No buttons', async () => {
    renderComponent();

    act(() => {
      promptCallback!({
        id: 'prompt-3',
        title: 'git.askpass.confirmationTitle',
        message: 'Are you sure you want to continue connecting (yes/no)?',
        type: 'confirmation',
      });
    });

    expect(screen.getByText('git.askpass.confirmationTitle')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to continue connecting (yes/no)?')).toBeInTheDocument();

    const yesButton = screen.getByText('common.yes');
    act(() => {
      fireEvent.click(yesButton);
    });

    expect(mockRespondInputPrompt).toHaveBeenCalledWith('prompt-3', 'yes');
  });

  it('submits on Enter key in input field', async () => {
    renderComponent();

    act(() => {
      promptCallback!({
        id: 'prompt-4',
        message: 'API Key:',
        type: 'text',
        placeholder: 'Enter your API key',
      });
    });

    const input = screen.getByPlaceholderText('Enter your API key');
    act(() => {
      fireEvent.change(input, { target: { value: 'sk-123456789' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    expect(mockRespondInputPrompt).toHaveBeenCalledWith('prompt-4', 'sk-123456789', false);
  });
});

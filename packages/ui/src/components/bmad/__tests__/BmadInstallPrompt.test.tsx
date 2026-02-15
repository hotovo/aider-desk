import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { BmadInstallPrompt } from '../BmadInstallPrompt';
import { useBmadState } from '../useBmadState';

import { useApi } from '@/contexts/ApiContext';
import * as notifications from '@/utils/notifications';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { returnObjects?: boolean }) => {
      if (key === 'bmad.install.benefits' && options?.returnObjects) {
        return [
          'Structured workflows from brainstorming to implementation',
          'Automatic context preparation (50-80% cost savings)',
          'No context-switching between tools',
          'Smart next-step recommendations',
        ];
      }
      return key;
    },
  }),
}));

// Mock contexts
vi.mock('@/contexts/ApiContext', () => ({
  useApi: vi.fn(),
}));

// Mock useBmadState
vi.mock('../useBmadState', () => ({
  useBmadState: vi.fn(),
}));

// Mock notifications
vi.mock('@/utils/notifications', () => ({
  showSuccessNotification: vi.fn(),
  showErrorNotification: vi.fn(),
}));

describe('BmadInstallPrompt', () => {
  const mockInstallBmad = vi.fn();
  const mockRefresh = vi.fn();

  const renderComponent = () => {
    return render(
      <TooltipProvider>
        <BmadInstallPrompt refreshState={mockRefresh} projectDir="/test/project" />
      </TooltipProvider>,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useApi).mockReturnValue({
      installBmad: mockInstallBmad,
    } as unknown as ReturnType<typeof useApi>);
    vi.mocked(useBmadState).mockReturnValue({
      status: null,
      suggestedWorkflows: [],
      isLoading: false,
      error: null,
      refresh: mockRefresh,
    });
  });

  it('renders install button and welcome content', () => {
    renderComponent();

    expect(screen.getByText('bmad.welcome.title')).toBeInTheDocument();
    expect(screen.getByText('bmad.welcome.subtitle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bmad.install.button/ })).toBeInTheDocument();
  });

  it('renders benefits list', () => {
    renderComponent();

    expect(screen.getByText(/Structured workflows/)).toBeInTheDocument();
    expect(screen.getByText(/Automatic context preparation/)).toBeInTheDocument();
  });

  it('calls installBmad API on button click', async () => {
    mockInstallBmad.mockResolvedValue({
      success: true,
      version: '6.0.0-Beta.7',
      message: 'BMAD installed successfully',
    });

    renderComponent();

    const button = screen.getByRole('button', { name: /bmad.install.button/ });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockInstallBmad).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(notifications.showSuccessNotification).toHaveBeenCalledWith(expect.stringContaining('BMAD installed successfully'));
    });

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('shows loading state during installation', async () => {
    mockInstallBmad.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100)));

    renderComponent();

    const button = screen.getByRole('button', { name: /bmad.install.button/ });
    fireEvent.click(button);

    expect(screen.getByText('bmad.install.installing')).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it('shows error toast on failed installation', async () => {
    mockInstallBmad.mockResolvedValue({
      success: false,
      message: 'Installation failed',
    });

    renderComponent();

    const button = screen.getByRole('button');
    await fireEvent.click(button);

    await waitFor(
      () => {
        expect(notifications.showErrorNotification).toHaveBeenCalledWith(expect.stringContaining('Installation failed'));
      },
      { timeout: 1000 },
    );
  });

  it('shows error toast when installation throws', async () => {
    mockInstallBmad.mockRejectedValue(new Error('Network error'));

    renderComponent();

    const button = screen.getByRole('button');
    await fireEvent.click(button);

    await waitFor(
      () => {
        expect(notifications.showErrorNotification).toHaveBeenCalledWith('bmad.install.error: Network error');
      },
      { timeout: 1000 },
    );
  });

  it('renders manual install section with copiable command', () => {
    renderComponent();

    expect(screen.getByText('npx -y bmad-method install')).toBeInTheDocument();
    expect(screen.getByText('bmad.install.commandLabel')).toBeInTheDocument();
    expect(screen.getByText('bmad.install.manualInstallTitle')).toBeInTheDocument();
    expect(screen.getByText('bmad.install.manualInstallNote')).toBeInTheDocument();
  });

  it('renders auto install note', () => {
    renderComponent();

    expect(screen.getByText('bmad.install.autoInstallNote')).toBeInTheDocument();
  });
});

import { ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Model, ProviderProfile } from '@common/types';

import { ModelLibrary } from '../ModelLibrary';

import { useModelProviders } from '@/contexts/ModelProviderContext';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock useModelProviders context
vi.mock('@/contexts/ModelProviderContext', () => ({
  useModelProviders: vi.fn(),
}));

// Mock components
vi.mock('../ModelDialog', () => ({
  ModelDialog: ({ onCancel }: { onCancel: () => void }) => (
    <div data-testid="model-dialog">
      <button onClick={onCancel}>Cancel Model Dialog</button>
    </div>
  ),
}));

vi.mock('../ProviderSelection', () => ({
  ProviderSelection: ({ onSelectProvider }: { onSelectProvider: (provider: string) => void }) => (
    <div data-testid="provider-selection">
      <button onClick={() => onSelectProvider('openai')}>Select OpenAI</button>
    </div>
  ),
}));

vi.mock('../ProviderProfileForm', () => ({
  ProviderProfileForm: ({ onCancel }: { onCancel: () => void }) => (
    <div data-testid="provider-profile-form">
      <button onClick={onCancel}>Cancel Profile Form</button>
    </div>
  ),
}));

vi.mock('../../common/ModalOverlayLayout', () => ({
  ModalOverlayLayout: ({ children, title, onClose }: { children: ReactNode; title: string; onClose: () => void }) => (
    <div data-testid="modal-overlay">
      <h1>{title}</h1>
      <button onClick={onClose}>Close Overlay</button>
      {children}
    </div>
  ),
}));

vi.mock('../ProviderHeader', () => ({
  ProviderHeader: () => <div data-testid="provider-header" />,
}));

vi.mock('../ModelTableSection', () => ({
  ModelTableSection: ({ onAddModel }: { onAddModel: () => void }) => (
    <div data-testid="model-table-section">
      <button onClick={onAddModel}>Add Model</button>
    </div>
  ),
}));

describe('ModelLibrary', () => {
  const mockContext = {
    models: [] as Model[],
    providers: [] as ProviderProfile[],
    saveProvider: vi.fn(),
    deleteProvider: vi.fn(),
    upsertModel: vi.fn(),
    deleteModel: vi.fn(),
    updateModels: vi.fn(),
    errors: {},
    refresh: vi.fn(),
    modelsLoading: false,
    providersLoading: false,
  };

  beforeEach(() => {
    vi.mocked(useModelProviders).mockReturnValue(mockContext);
  });

  it('renders ProviderSelection when no profiles are present', () => {
    render(<ModelLibrary isVisible={true} onClose={vi.fn()} />);
    expect(screen.getByTestId('provider-selection')).toBeInTheDocument();
  });

  it('renders ProviderProfileForm when a provider is selected', () => {
    render(<ModelLibrary isVisible={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Select OpenAI'));
    expect(screen.getByTestId('provider-profile-form')).toBeInTheDocument();
  });

  it('renders main view when profiles are present', () => {
    vi.mocked(useModelProviders).mockReturnValue({
      ...mockContext,
      providers: [{ id: '1', name: 'OpenAI', provider: { name: 'openai' } } as unknown as ProviderProfile],
    });

    render(<ModelLibrary isVisible={true} onClose={vi.fn()} />);
    expect(screen.queryByTestId('provider-selection')).not.toBeInTheDocument();
    expect(screen.getByText('modelLibrary.title')).toBeInTheDocument();
  });

  it('opens ModelDialog when Add Model is clicked', () => {
    vi.mocked(useModelProviders).mockReturnValue({
      ...mockContext,
      providers: [{ id: '1', name: 'OpenAI', provider: { name: 'openai' } } as unknown as ProviderProfile],
    });

    render(<ModelLibrary isVisible={true} onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('Add Model'));
    expect(screen.getByTestId('model-dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel Model Dialog'));
    expect(screen.queryByTestId('model-dialog')).not.toBeInTheDocument();
  });
});

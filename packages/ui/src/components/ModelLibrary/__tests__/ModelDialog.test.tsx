import { ReactNode } from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Model, ProviderProfile } from '@aider-desk/common/types';
import { LlmProvider } from '@aider-desk/common/agent';

import { ModelDialog } from '../ModelDialog';

import { render } from '@/__tests__/render';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

interface BaseDialogProps {
  children: ReactNode;
  title: string;
  onClose: () => void;
  footer?: ReactNode;
}

// Mock BaseDialog
vi.mock('../../common/BaseDialog', () => ({
  BaseDialog: ({ children, title, onClose, footer }: BaseDialogProps) => (
    <div data-testid="base-dialog">
      <h1>{title}</h1>
      <div data-testid="dialog-content">{children}</div>
      <div data-testid="dialog-footer">{footer || <button onClick={onClose}>common.cancel</button>}</div>
    </div>
  ),
}));

const mockProviders: ProviderProfile[] = [
  {
    id: 'provider-1',
    name: 'openai',
    provider: { name: 'openai' } as LlmProvider,
  },
];

describe('ModelDialog', () => {
  it('renders for adding a new model', () => {
    render(<ModelDialog providers={mockProviders} onSave={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText('modelLibrary.addModel')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('modelLibrary.modelIdPlaceholder')).toBeInTheDocument();
  });

  it('renders for editing an existing model', () => {
    const model: Model = {
      id: 'gpt-4',
      providerId: 'provider-1',
      isCustom: true,
    };
    render(<ModelDialog model={model} providers={mockProviders} onSave={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText('modelLibrary.editModel')).toBeInTheDocument();
    expect(screen.getByDisplayValue('gpt-4')).toBeInTheDocument();
  });

  it('calls onSave with model data when save is clicked', () => {
    const onSave = vi.fn();
    render(<ModelDialog providers={mockProviders} onSave={onSave} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('modelLibrary.modelIdPlaceholder'), {
      target: { value: 'new-model' },
    });

    fireEvent.click(screen.getByText('common.confirm'));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'new-model',
        providerId: 'provider-1',
      }),
    );
  });

  it('calls onCancel when cancel is clicked', () => {
    const onCancel = vi.fn();
    render(<ModelDialog providers={mockProviders} onSave={vi.fn()} onCancel={onCancel} />);

    fireEvent.click(screen.getByText('common.cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  describe('Cost Input Fields', () => {
    const getCostInputs = () => {
      const allInputs = screen.getAllByRole('spinbutton');
      const inputs = allInputs.filter((input) => (input as HTMLInputElement).type === 'number');
      return {
        inputCost: inputs[2],
        outputCost: inputs[3],
        cacheReadCost: inputs[4],
        cacheWriteCost: inputs[5],
      };
    };

    it('allows typing values without reformatting during typing', () => {
      const onSave = vi.fn();
      render(<ModelDialog providers={mockProviders} onSave={onSave} onCancel={vi.fn()} />);

      const { inputCost } = getCostInputs();

      fireEvent.change(inputCost, { target: { value: '0' } });
      expect(inputCost).toHaveValue(0);

      fireEvent.change(inputCost, { target: { value: '0.1' } });
      expect(inputCost).toHaveValue(0.1);

      fireEvent.change(inputCost, { target: { value: '0.10' } });
      expect(inputCost).toHaveValue(0.1);

      fireEvent.change(inputCost, { target: { value: '0.1000' } });
      expect(inputCost).toHaveValue(0.1);
    });

    it('formats value on blur with 4 decimal places', () => {
      render(<ModelDialog providers={mockProviders} onSave={vi.fn()} onCancel={vi.fn()} />);

      const { inputCost } = getCostInputs();

      fireEvent.change(inputCost, { target: { value: '0.5' } });
      expect(inputCost).toHaveValue(0.5);

      fireEvent.blur(inputCost);
      expect(inputCost).toHaveValue(0.5);
    });

    it('initializes cost fields from existing model data', () => {
      const model: Model = {
        id: 'gpt-4',
        providerId: 'provider-1',
        isCustom: true,
        inputCostPerToken: 0.0000015,
        outputCostPerToken: 0.000002,
      };
      render(<ModelDialog model={model} providers={mockProviders} onSave={vi.fn()} onCancel={vi.fn()} />);

      const { inputCost, outputCost } = getCostInputs();
      expect(inputCost).toHaveValue(1.5);
      expect(outputCost).toHaveValue(2);
    });

    it('correctly calculates and saves cost values on submit', () => {
      const onSave = vi.fn();
      render(<ModelDialog providers={mockProviders} onSave={onSave} onCancel={vi.fn()} />);

      const { inputCost, outputCost } = getCostInputs();

      fireEvent.change(inputCost, { target: { value: '0.5' } });
      fireEvent.change(outputCost, { target: { value: '1.25' } });

      fireEvent.change(screen.getByPlaceholderText('modelLibrary.modelIdPlaceholder'), {
        target: { value: 'new-model' },
      });

      fireEvent.click(screen.getByText('common.confirm'));

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          inputCostPerToken: 0.0000005,
          outputCostPerToken: 0.00000125,
        }),
      );
    });

    it('handles cache cost inputs correctly', () => {
      const onSave = vi.fn();
      render(<ModelDialog providers={mockProviders} onSave={onSave} onCancel={vi.fn()} />);

      const { cacheReadCost, cacheWriteCost } = getCostInputs();

      fireEvent.change(cacheReadCost, { target: { value: '0.1' } });
      fireEvent.change(cacheWriteCost, { target: { value: '0.2' } });

      fireEvent.blur(cacheReadCost);
      fireEvent.blur(cacheWriteCost);

      expect(cacheReadCost).toHaveValue(0.1);
      expect(cacheWriteCost).toHaveValue(0.2);
    });

    it('allows typing leading zero without immediate reformat', () => {
      render(<ModelDialog providers={mockProviders} onSave={vi.fn()} onCancel={vi.fn()} />);

      const { inputCost } = getCostInputs();

      fireEvent.change(inputCost, { target: { value: '0' } });
      expect(inputCost).toHaveValue(0);

      fireEvent.change(inputCost, { target: { value: '0.' } });
      expect(inputCost).toHaveValue(null);

      fireEvent.change(inputCost, { target: { value: '0.1' } });
      expect(inputCost).toHaveValue(0.1);
    });

    it('handles empty cost values correctly', () => {
      const onSave = vi.fn();
      render(<ModelDialog providers={mockProviders} onSave={onSave} onCancel={vi.fn()} />);

      const { inputCost } = getCostInputs();

      fireEvent.change(inputCost, { target: { value: '1.5' } });
      fireEvent.blur(inputCost);
      expect(inputCost).toHaveValue(1.5);

      fireEvent.change(inputCost, { target: { value: '' } });
      expect(inputCost).toHaveValue(null);
    });
  });
});

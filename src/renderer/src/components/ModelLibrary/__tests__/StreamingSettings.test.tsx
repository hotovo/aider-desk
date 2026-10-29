import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { StreamingSettings } from '../StreamingSettings';
import { ModelParameterOverrides } from '../ModelParameterOverrides';

import { render } from '@/__tests__/render';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('StreamingSettings', () => {
  it('clears disabled streaming when streaming becomes required', () => {
    const onChange = vi.fn();
    render(<StreamingSettings value={{ disableStreaming: true }} onChange={onChange} />);
    fireEvent.click(screen.getByText('modelLibrary.requireStreaming'));
    expect(onChange).toHaveBeenCalledWith({ disableStreaming: false, requireStreaming: true });
  });

  it('clears required streaming when streaming becomes disabled', () => {
    const onChange = vi.fn();
    render(<StreamingSettings value={{ requireStreaming: true }} onChange={onChange} />);
    fireEvent.click(screen.getByText('modelLibrary.disableStreaming'));
    expect(onChange).toHaveBeenCalledWith({ disableStreaming: true, requireStreaming: false });
  });

  it('can explicitly turn off required streaming', () => {
    const onChange = vi.fn();
    render(<StreamingSettings value={{ requireStreaming: true }} onChange={onChange} />);
    fireEvent.click(screen.getByText('modelLibrary.requireStreaming'));
    expect(onChange).toHaveBeenCalledWith({ disableStreaming: false, requireStreaming: false });
  });

  it('normalizes contradictory stored flags like the backend', () => {
    render(<StreamingSettings value={{ requireStreaming: true, disableStreaming: true }} onChange={vi.fn()} />);
    expect(screen.getAllByRole('checkbox')[0]).not.toBeChecked();
    expect(screen.getAllByRole('checkbox')[1]).toBeChecked();
  });
});

describe('model streaming overrides', () => {
  it('supports extension providers and preserves other overrides', () => {
    const onChange = vi.fn();
    render(
      <ModelParameterOverrides provider={{ name: 'custom-extension', disableStreaming: true }} overrides={{ customOption: 'keep' }} onChange={onChange} />,
    );
    fireEvent.click(screen.getByText('modelLibrary.overrides.title'));
    fireEvent.click(screen.getByText('modelLibrary.requireStreaming'));
    expect(onChange).toHaveBeenCalledWith({ customOption: 'keep', disableStreaming: false, requireStreaming: true });
  });

  it('displays model-declared streaming requirements', () => {
    render(<ModelParameterOverrides provider={{ name: 'custom-extension' }} model={{ requireStreaming: true }} overrides={{}} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('modelLibrary.overrides.title'));
    const requireLabel = screen.getByText('modelLibrary.requireStreaming');
    expect(requireLabel.parentElement?.querySelector('input')).toBeChecked();
  });

  it('preserves streaming overrides when editing provider-specific parameters', () => {
    const onChange = vi.fn();
    render(<ModelParameterOverrides provider={{ name: 'openai', apiKey: '' }} overrides={{ requireStreaming: true }} onChange={onChange} />);
    fireEvent.click(screen.getByText('modelLibrary.overrides.title'));
    fireEvent.click(screen.getByText('modelLibrary.disableToolCallStreaming'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ requireStreaming: true, disableToolCallStreaming: true }));
  });

  it('reset removes explicit streaming overrides and restores defaults', () => {
    const onChange = vi.fn();
    render(
      <ModelParameterOverrides provider={{ name: 'custom-extension' }} overrides={{ requireStreaming: true, disableStreaming: false }} onChange={onChange} />,
    );
    fireEvent.click(screen.getByText('modelLibrary.overrides.resetToDefaults'));
    expect(onChange).toHaveBeenCalledWith({});
  });
});

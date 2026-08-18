import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OpenAiCompatibleProvider } from '@common/agent';

import { TlsSettings } from '../providers/TlsSettings';

import { render } from '@/__tests__/render';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const openTlsAccordion = () => {
  fireEvent.click(screen.getByRole('button', { name: /providerTls.title/ }));
};

describe('TlsSettings', () => {
  it('renders unchecked by default and flips sslVerify when toggled', () => {
    const provider: OpenAiCompatibleProvider = { name: 'openai-compatible', apiKey: 'key', baseUrl: 'https://llm.local' };
    const onChange = vi.fn();

    render(<TlsSettings provider={provider} onChange={onChange} />);
    openTlsAccordion();

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ sslVerify: false }));
  });

  it('shows checked state when certificate verification is disabled', () => {
    const provider: OpenAiCompatibleProvider = { name: 'openai-compatible', apiKey: 'key', baseUrl: 'https://llm.local', sslVerify: false };
    const onChange = vi.fn();

    render(<TlsSettings provider={provider} onChange={onChange} />);
    openTlsAccordion();

    expect(screen.getByRole('checkbox')).toBeChecked();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ sslVerify: true }));
  });

  it('updates caCertPath from the input', () => {
    const provider: OpenAiCompatibleProvider = { name: 'openai-compatible', apiKey: 'key', baseUrl: 'https://llm.local' };
    const onChange = vi.fn();

    render(<TlsSettings provider={provider} onChange={onChange} />);
    openTlsAccordion();

    fireEvent.change(screen.getByPlaceholderText('providerTls.caCertPathPlaceholder'), { target: { value: '/ca/cert.pem' } });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ caCertPath: '/ca/cert.pem' }));
  });

  it('disables caCertPath input when certificate verification is disabled', () => {
    const provider: OpenAiCompatibleProvider = { name: 'openai-compatible', apiKey: 'key', baseUrl: 'https://llm.local', sslVerify: false };
    const onChange = vi.fn();

    render(<TlsSettings provider={provider} onChange={onChange} />);
    openTlsAccordion();

    expect(screen.getByPlaceholderText('providerTls.caCertPathPlaceholder')).toBeDisabled();
  });

  it('keeps caCertPath input enabled when verification is on', () => {
    const provider: OpenAiCompatibleProvider = { name: 'openai-compatible', apiKey: 'key', baseUrl: 'https://llm.local', caCertPath: '/ca/cert.pem' };
    const onChange = vi.fn();

    render(<TlsSettings provider={provider} onChange={onChange} />);
    openTlsAccordion();

    expect(screen.getByPlaceholderText('providerTls.caCertPathPlaceholder')).toBeEnabled();
  });
});

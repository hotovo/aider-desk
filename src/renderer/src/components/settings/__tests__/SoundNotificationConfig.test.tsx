import * as React from 'react';
import { ComponentType, InputHTMLAttributes } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { transform } from 'sucrase';
import { describe, expect, it, vi } from 'vitest';

import configSource from '../../../../../../../packages/extensions/extensions/sound-notification/ConfigComponent.jsx?raw';

const compiled = transform(`module.exports = ${configSource}`, { transforms: ['jsx'] }).code;
const componentModule: { exports?: ComponentType<Record<string, unknown>> } = {};
new Function('React', 'module', compiled)(React, componentModule);
const Config = componentModule.exports!;

const Select = ({ label, value, onChange, options, disabled }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) => {
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => onChange(event.target.value);
  return <label>{label}<select value={value} onChange={handleChange} disabled={disabled}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
};
const Input = ({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) => <label>{label}<input {...props} /></label>;
const IconButton = ({ tooltip, onClick, disabled }: { tooltip: string; onClick: () => void; disabled?: boolean }) => <button onClick={onClick} disabled={disabled}>{tooltip}</button>;
const Icon = () => null;

const initialConfig = {
  agentFinished: { pack: 'peasant', sound: 'PeasantJobDone' },
  questionAsked: { pack: 'peasant', sound: '' },
  packs: [{ name: 'peasant', displayName: 'Peasant', sounds: [{ file: 'sounds/PeasantJobDone.wav' }] }],
};

const renderConfig = (executeExtensionAction = vi.fn()) => {
  const Wrapper = () => {
    const [config, updateConfig] = React.useState(initialConfig);
    return <Config config={config} updateConfig={updateConfig} executeExtensionAction={executeExtensionAction} ui={{ Select, Input, IconButton }} icons={{ Fi: { FiPlay: Icon, FiRefreshCw: Icon } }} />;
  };
  render(<Wrapper />);
  return executeExtensionAction;
};

describe('sound notification settings', () => {
  it('preserves legacy pack settings and previews them', async () => {
    const execute = renderConfig(vi.fn().mockResolvedValue({ success: true }));
    expect(screen.getAllByLabelText('Sound source')[0]).toHaveValue('pack');
    expect(screen.getAllByLabelText('Sound')[0]).toHaveValue('PeasantJobDone');
    fireEvent.click(screen.getAllByRole('button', { name: 'Play' })[0]);
    await waitFor(() => expect(execute).toHaveBeenCalledWith('play-sound', 'peasant', 'PeasantJobDone'));
  });

  it('allows an independent manual audio path and preview for each event', async () => {
    const execute = renderConfig(vi.fn().mockResolvedValue({ success: true }));
    fireEvent.change(screen.getAllByLabelText('Sound source')[0], { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText('Audio file path'), { target: { value: '/audio/finished.wav' } });
    fireEvent.change(screen.getAllByLabelText('Sound source')[1], { target: { value: 'custom' } });
    fireEvent.change(screen.getAllByLabelText('Audio file path')[1], { target: { value: '/audio/question.mp3' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Play' })[1]);
    await waitFor(() => expect(execute).toHaveBeenCalledWith('play-custom-sound', '/audio/question.mp3'));
    expect(screen.getAllByLabelText('Audio file path')[0]).toHaveValue('/audio/finished.wav');
    fireEvent.change(screen.getAllByLabelText('Sound source')[0], { target: { value: 'pack' } });
    expect(screen.getByLabelText('Sound')).toHaveValue('PeasantJobDone');
  });

  it('uploads a selected file and uses the returned persistent path', async () => {
    const execute = renderConfig(vi.fn().mockResolvedValue({ success: true, filePath: '/persistent/audio/hash.wav' }));
    fireEvent.change(screen.getAllByLabelText('Sound source')[1], { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText('Upload audio file (up to 10 MB)'), { target: { files: [new File(['audio'], 'my.wav', { type: 'audio/wav' })] } });
    await waitFor(() => expect(screen.getByLabelText('Audio file path')).toHaveValue('/persistent/audio/hash.wav'));
    expect(execute).toHaveBeenCalledWith('upload-audio', 'my.wav', 'YXVkaW8=');
    expect(screen.getByLabelText('Sound')).toHaveValue('PeasantJobDone');
  });

  it('shows upload errors without discarding the configured path', async () => {
    renderConfig(vi.fn().mockResolvedValue({ success: false }));
    fireEvent.change(screen.getAllByLabelText('Sound source')[0], { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText('Audio file path'), { target: { value: '/audio/old.wav' } });
    fireEvent.change(screen.getByLabelText('Upload audio file (up to 10 MB)'), { target: { files: [new File(['audio'], 'bad.txt')] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not upload');
    expect(screen.getByLabelText('Audio file path')).toHaveValue('/audio/old.wav');
  });

  it('rejects oversized files without sending an upload action', () => {
    const execute = renderConfig();
    fireEvent.change(screen.getAllByLabelText('Sound source')[0], { target: { value: 'custom' } });
    const file = new File(['audio'], 'large.wav');
    Object.defineProperty(file, 'size', { value: 10 * 1024 * 1024 + 1 });
    fireEvent.change(screen.getByLabelText('Upload audio file (up to 10 MB)'), { target: { files: [file] } });
    expect(screen.getByRole('alert')).toHaveTextContent('10 MB');
    expect(execute).not.toHaveBeenCalled();
  });

  it('shows custom playback errors', async () => {
    renderConfig(vi.fn().mockResolvedValue({ success: false }));
    fireEvent.change(screen.getAllByLabelText('Sound source')[0], { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText('Audio file path'), { target: { value: '/audio/missing.wav' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Play' })[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not play');
  });
});
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Model, ProviderProfile, SettingsData } from '@common/types';

import { ModelSelectorWrapper } from '../ModelSelectorWrapper';

import { useSettingsStore } from '@/stores/settingsStore';
import { globalMockApi } from '@/__tests__/mocks/api';

const imageModel: Model = { providerId: 'local', id: 'image' };
const otherImageModel: Model = { providerId: 'local', id: 'other-image' };
const chatModel: Model = { providerId: 'local', id: 'chat' };
const models = [imageModel, chatModel, otherImageModel];
const providers: ProviderProfile[] = [{ id: 'local', name: 'Local catalog', provider: { name: 'openai' } }];

vi.mock('@/contexts/ModelProviderContext', () => ({
  useModelProviders: () => ({ models, providers }),
}));
vi.mock('@/contexts/ApiContext', () => ({
  useApi: () => globalMockApi,
}));

const openSelector = () => fireEvent.click(screen.getAllByRole('button')[0]);
const removeFavorite = () => fireEvent.click(screen.getByTitle('modelSelector.removePreferred'));
const selectImage = () => fireEvent.click(screen.getByRole('button', { name: 'image' }));

describe('ModelSelectorWrapper catalogs and preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({ settings: { preferredModels: ['local/chat', 'local/unknown'] } as SettingsData });
  });

  it('defaults to the core catalog and preserves unknown favorites', () => {
    render(<ModelSelectorWrapper selectedModelId={null} onChange={vi.fn()} />);
    openSelector();
    expect(screen.getByRole('button', { name: 'unknown (Local catalog)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'chat' })).toBeInTheDocument();
  });

  it('keeps legacy core favorite updates on selection', async () => {
    const onChange = vi.fn();
    render(<ModelSelectorWrapper selectedModelId={null} onChange={onChange} />);
    openSelector();
    selectImage();
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(imageModel));
    expect(globalMockApi.saveSettings).toHaveBeenCalledWith({ preferredModels: ['local/image', 'local/chat', 'local/unknown'] });
  });

  it('keeps legacy core removal behavior', async () => {
    useSettingsStore.setState({ settings: { preferredModels: ['local/chat'] } as SettingsData });
    render(<ModelSelectorWrapper selectedModelId={null} onChange={vi.fn()} />);
    openSelector();
    removeFavorite();
    await waitFor(() => expect(globalMockApi.saveSettings).toHaveBeenCalledWith({ preferredModels: [] }));
  });

  it('restricts global favorites to a custom catalog and uses provider overrides', () => {
    render(
      <ModelSelectorWrapper selectedModelId={null} onChange={vi.fn()} models={[imageModel]} providers={[{ ...providers[0], name: 'Extension catalog' }]} />,
    );
    openSelector();
    expect(screen.getByText('Extension catalog')).toBeInTheDocument();
    expect(screen.queryByText(/chat|unknown/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'image' })).toBeInTheDocument();
  });

  it.each([false, true])('restricts controlled favorites to the custom catalog (portal: %s)', (usePortal) => {
    render(
      <ModelSelectorWrapper
        selectedModelId={null}
        onChange={vi.fn()}
        models={[imageModel]}
        preferredModels={['local/chat', 'local/image', 'local/unknown']}
        onPreferredModelsChange={vi.fn()}
        usePortal={usePortal}
      />,
    );
    openSelector();
    expect(screen.queryByText(/chat|unknown/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'image (Local catalog)' })).toBeInTheDocument();
  });

  it('treats an empty catalog as no models, including favorites and keyboard selection', () => {
    const onChange = vi.fn();
    render(<ModelSelectorWrapper selectedModelId={null} onChange={onChange} models={[]} />);
    openSelector();
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(screen.queryByText(/chat|unknown/)).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(globalMockApi.saveSettings).not.toHaveBeenCalled();
  });

  it('treats empty controlled preferences as independent and emits selection without core writes', async () => {
    const onChange = vi.fn();
    const onPreferredModelsChange = vi.fn();
    render(<ModelSelectorWrapper selectedModelId={null} onChange={onChange} preferredModels={[]} onPreferredModelsChange={onPreferredModelsChange} />);
    openSelector();
    expect(screen.queryByTitle('modelSelector.removePreferred')).not.toBeInTheDocument();
    selectImage();
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(imageModel));
    expect(onPreferredModelsChange).toHaveBeenCalledWith(['local/image']);
    expect(globalMockApi.saveSettings).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().settings?.preferredModels).toEqual(['local/chat', 'local/unknown']);
  });

  it('moves selected favorites to the front without duplicates and retains out-of-catalog preferences', async () => {
    const onPreferredModelsChange = vi.fn();
    render(
      <ModelSelectorWrapper
        selectedModelId={null}
        onChange={vi.fn()}
        models={[imageModel, otherImageModel]}
        preferredModels={['local/chat', 'local/other-image', 'local/image']}
        onPreferredModelsChange={onPreferredModelsChange}
      />,
    );
    openSelector();
    selectImage();
    await waitFor(() => expect(onPreferredModelsChange).toHaveBeenCalledWith(['local/image', 'local/chat', 'local/other-image']));
    expect(globalMockApi.saveSettings).not.toHaveBeenCalled();
  });

  it('emits removal without core writes and waits for controlled props to change', () => {
    const onPreferredModelsChange = vi.fn();
    const props = { selectedModelId: null, onChange: vi.fn(), models: [imageModel], onPreferredModelsChange };
    const { rerender } = render(<ModelSelectorWrapper {...props} preferredModels={['local/chat', 'local/image']} />);
    openSelector();
    removeFavorite();
    expect(onPreferredModelsChange).toHaveBeenCalledWith(['local/chat']);
    expect(screen.getByRole('button', { name: 'image (Local catalog)' })).toBeInTheDocument();
    rerender(<ModelSelectorWrapper {...props} preferredModels={['local/chat']} />);
    expect(screen.queryByTitle('modelSelector.removePreferred')).not.toBeInTheDocument();
    expect(globalMockApi.saveSettings).not.toHaveBeenCalled();
  });

  it('makes controlled preferences read-only without a callback, including on selection', async () => {
    const onChange = vi.fn();
    render(<ModelSelectorWrapper selectedModelId={null} onChange={onChange} preferredModels={['local/image']} />);
    openSelector();
    expect(screen.queryByTitle('modelSelector.removePreferred')).not.toBeInTheDocument();
    selectImage();
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(imageModel));
    expect(globalMockApi.saveSettings).not.toHaveBeenCalled();
  });

  it('skipPreferredModelsUpdate suppresses selection updates but permits explicit removal', async () => {
    const onChange = vi.fn();
    const onPreferredModelsChange = vi.fn();
    render(
      <ModelSelectorWrapper
        selectedModelId={null}
        onChange={onChange}
        preferredModels={['local/other-image']}
        onPreferredModelsChange={onPreferredModelsChange}
        skipPreferredModelsUpdate
      />,
    );
    openSelector();
    selectImage();
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(imageModel));
    expect(onPreferredModelsChange).not.toHaveBeenCalled();
    openSelector();
    removeFavorite();
    expect(onPreferredModelsChange).toHaveBeenCalledWith([]);
    expect(globalMockApi.saveSettings).not.toHaveBeenCalled();
  });

  it('uses the controlled list even before core settings have loaded', async () => {
    useSettingsStore.setState({ settings: null });
    const onPreferredModelsChange = vi.fn();
    render(<ModelSelectorWrapper selectedModelId={null} onChange={vi.fn()} preferredModels={[]} onPreferredModelsChange={onPreferredModelsChange} />);
    openSelector();
    selectImage();
    await waitFor(() => expect(onPreferredModelsChange).toHaveBeenCalledWith(['local/image']));
    expect(globalMockApi.saveSettings).not.toHaveBeenCalled();
  });

  it('does not adopt a callback alone as controlled mode', async () => {
    const onPreferredModelsChange = vi.fn();
    render(<ModelSelectorWrapper selectedModelId={null} onChange={vi.fn()} onPreferredModelsChange={onPreferredModelsChange} />);
    openSelector();
    selectImage();
    await waitFor(() => expect(globalMockApi.saveSettings).toHaveBeenCalled());
    expect(onPreferredModelsChange).not.toHaveBeenCalled();
  });

  it('selects only catalog entries via the keyboard when unrelated favorites exist', async () => {
    const onChange = vi.fn();
    render(<ModelSelectorWrapper selectedModelId={null} onChange={onChange} models={[imageModel]} preferredModels={['local/chat']} />);
    openSelector();
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(imageModel));
    expect(globalMockApi.saveSettings).not.toHaveBeenCalled();
  });

  it('clears selection without updating controlled or core favorites', async () => {
    const onChange = vi.fn();
    const onPreferredModelsChange = vi.fn();
    render(
      <ModelSelectorWrapper
        selectedModelId="local/image"
        onChange={onChange}
        preferredModels={[]}
        onPreferredModelsChange={onPreferredModelsChange}
        labelOnNull="None"
      />,
    );
    openSelector();
    fireEvent.click(screen.getByRole('button', { name: 'None' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(null));
    expect(onPreferredModelsChange).not.toHaveBeenCalled();
    expect(globalMockApi.saveSettings).not.toHaveBeenCalled();
  });
});

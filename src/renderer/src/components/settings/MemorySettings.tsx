import { AGENT_MEMORY_SCOPE_PREFIX, getAgentMemoryScopeId } from '@common/agent';
import { AgentProfile, MemoryEmbeddingProgress, MemoryEmbeddingProgressPhase, MemoryEmbeddingProvider, MemoryEntry, SettingsData } from '@common/types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaFolderOpen, FaRobot, FaTrash } from 'react-icons/fa';
import { useMount } from '@reactuses/core';

import { Checkbox } from '../common/Checkbox';
import { Select } from '../common/Select';
import { Section } from '../common/Section';

import { useApi } from '@/contexts/ApiContext';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { IconButton } from '@/components/common/IconButton';
import { CodeInline } from '@/components/common/CodeInline';
import { Slider } from '@/components/common/Slider';
import { InfoIcon } from '@/components/common/InfoIcon';

const EMBEDDING_PROVIDERS = [{ value: 'sentence-transformers', label: 'Local' }];

const ALL_SCOPES = '__all__';

const LOCAL_MODELS = [
  {
    value: 'Xenova/all-MiniLM-L6-v2',
    label: 'MiniLM-L6 (Fast, ~90MB)',
    description: 'Fast and lightweight model',
  },
  {
    value: 'BAAI/bge-small-en-v1.5',
    label: 'BGE-Small (Good, ~130MB)',
    description: 'Good balance of speed and quality',
  },
  {
    value: 'BAAI/bge-base-en-v1.5',
    label: 'BGE-Base (Better, ~400MB)',
    description: 'Better quality for complex tasks',
  },
];

type Props = {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
};

export const MemorySettings = ({ settings, setSettings }: Props) => {
  const { t } = useTranslation();
  const api = useApi();

  const [memories, setMemories] = useState<MemoryEntry[] | null>(null);
  const [agentProfiles, setAgentProfiles] = useState<AgentProfile[]>([]);
  const [selectedScopeId, setSelectedScopeId] = useState<string>(ALL_SCOPES);
  const [memoryToDelete, setMemoryToDelete] = useState<MemoryEntry | null>(null);
  const [isDeleteScopeDialogOpen, setIsDeleteScopeDialogOpen] = useState(false);

  const [embeddingProgress, setEmbeddingProgress] = useState<MemoryEmbeddingProgress | null>(null);

  const loadMemories = useCallback(async () => {
    const all = await api.listAllMemories();
    setMemories(all);
  }, [api]);

  useMount(() => {
    void loadMemories();
    void api.getAllAgentProfiles().then(setAgentProfiles);
  });

  useEffect(() => {
    let timeoutId: number | null = null;
    let isCancelled = false;

    const poll = async () => {
      try {
        const progress = await api.getMemoryEmbeddingProgress();
        if (isCancelled) {
          return;
        }
        setEmbeddingProgress(progress);

        if (!progress.finished) {
          timeoutId = window.setTimeout(() => {
            void poll();
          }, 1000);
        }
      } catch {
        if (isCancelled) {
          return;
        }
        timeoutId = window.setTimeout(() => {
          void poll();
        }, 2000);
      }
    };

    void poll();

    return () => {
      isCancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [api, settings.memory.model, settings.memory.provider]);

  const isAgentScopeSelected = selectedScopeId.startsWith(AGENT_MEMORY_SCOPE_PREFIX);

  const getScopeLabel = (scopeId: string): string => {
    if (scopeId.startsWith(AGENT_MEMORY_SCOPE_PREFIX)) {
      const profile = agentProfiles.find((p) => getAgentMemoryScopeId(p.id) === scopeId);
      return profile?.name ?? scopeId;
    }
    return scopeId;
  };

  const scopeOptions = useMemo(() => {
    const memoryScopeIds = Array.from(new Set((memories ?? []).map((m) => m.projectId).filter((id): id is string => Boolean(id))));

    const isolatedProfiles = agentProfiles.filter((p) => p.useAgentMemoryScope);
    const isolatedProfileScopes = new Set(isolatedProfiles.map((p) => getAgentMemoryScopeId(p.id)));

    const projectScopes = memoryScopeIds.filter((id) => !id.startsWith(AGENT_MEMORY_SCOPE_PREFIX)).sort((a, b) => a.localeCompare(b));
    // agent scopes with memories but no matching isolated profile (e.g. the flag was turned off) stay visible for cleanup
    const orphanAgentScopes = memoryScopeIds
      .filter((id) => id.startsWith(AGENT_MEMORY_SCOPE_PREFIX) && !isolatedProfileScopes.has(id))
      .sort((a, b) => a.localeCompare(b));

    return [
      { value: ALL_SCOPES, label: t('settings.memory.memories.all') },
      ...projectScopes.map((id) => ({
        value: id,
        label: (
          <span className="flex items-center gap-1.5">
            <FaFolderOpen className="h-3 w-3 flex-shrink-0" />
            {id.split('/').pop() || id}
          </span>
        ),
      })),
      ...isolatedProfiles.map((p) => ({
        value: getAgentMemoryScopeId(p.id),
        label: (
          <span className="flex items-center gap-1.5">
            <FaRobot className="h-3 w-3 flex-shrink-0" />
            {p.name}
          </span>
        ),
      })),
      ...orphanAgentScopes.map((id) => ({ value: id, label: id })),
    ];
  }, [memories, agentProfiles, t]);

  const filteredMemories = useMemo(() => {
    if (!memories) {
      return null;
    }
    if (selectedScopeId === ALL_SCOPES) {
      return memories;
    }
    return memories.filter((m) => m.projectId === selectedScopeId);
  }, [memories, selectedScopeId]);

  const handleDeleteMemory = async () => {
    if (!memoryToDelete) {
      return;
    }
    await api.deleteMemory(memoryToDelete.id);
    setMemoryToDelete(null);
    await loadMemories();
  };

  const handleDeleteScopeMemories = async () => {
    if (selectedScopeId === ALL_SCOPES) {
      return;
    }
    await api.deleteScopeMemories(selectedScopeId);
    setIsDeleteScopeDialogOpen(false);
    await loadMemories();
  };

  const handleEnabledChange = (enabled: boolean) => {
    setSettings({
      ...settings,
      memory: {
        ...settings.memory,
        enabled,
      },
    });
  };

  const handleModelChange = (model: string) => {
    setSettings({
      ...settings,
      memory: {
        ...settings.memory,
        model,
      },
    });
  };

  const handleProviderChange = (provider: string) => {
    setSettings({
      ...settings,
      memory: {
        ...settings.memory,
        provider: provider as MemoryEmbeddingProvider,
      },
    });
  };

  const handleMaxDistanceChange = (value: number) => {
    setSettings({
      ...settings,
      memory: {
        ...settings.memory,
        maxDistance: value,
      },
    });
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <Section id="memory-general" title={t('settings.memory.configuration')}>
        <div className="px-4 py-5 space-y-4">
          <div className="text-xs py-2">{t('settings.memory.description')}</div>

          <Checkbox label={t('settings.memory.enabled.label')} checked={settings.memory.enabled} onChange={handleEnabledChange} size="md" />

          {settings.memory.enabled && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              <div>
                <Select
                  label={t('settings.memory.provider.label')}
                  value={settings.memory.provider}
                  onChange={handleProviderChange}
                  options={EMBEDDING_PROVIDERS.map((provider) => ({
                    value: provider.value,
                    label: provider.label,
                  }))}
                  className="w-full"
                />
                <p className="text-xs text-text-secondary mt-1">{t('settings.memory.provider.description')}</p>
              </div>

              <div>
                <Select
                  label={t('settings.memory.model.label')}
                  value={settings.memory.model}
                  onChange={handleModelChange}
                  options={LOCAL_MODELS.map((model) => ({
                    value: model.value,
                    label: model.label,
                  }))}
                  className="w-full"
                />
                <p className="text-xs text-text-secondary mt-1">{LOCAL_MODELS.find((m) => m.value === settings.memory.model)?.description}</p>
              </div>

              <div>
                <Slider
                  label={
                    <div className="flex items-center text-xs gap-1">
                      <span>{t('settings.memory.maxDistance.label')}</span>
                      <InfoIcon tooltip={t('settings.memory.maxDistance.description')} className="ml-1" />
                    </div>
                  }
                  min={0}
                  max={2}
                  step={0.05}
                  value={settings.memory.maxDistance}
                  onChange={handleMaxDistanceChange}
                />
              </div>
            </div>
          )}
          {embeddingProgress && embeddingProgress.phase !== MemoryEmbeddingProgressPhase.Idle && (
            <div className="text-2xs text-text-muted">
              {embeddingProgress.phase === MemoryEmbeddingProgressPhase.LoadingModel && (
                <span>
                  {t('settings.memory.embeddingProgress.loadingModel', {
                    status: embeddingProgress.status || '-',
                  })}
                </span>
              )}
              {embeddingProgress.phase === MemoryEmbeddingProgressPhase.ReEmbedding && (
                <span>
                  {t('settings.memory.embeddingProgress.reEmbedding', {
                    done: embeddingProgress.done,
                    total: embeddingProgress.total,
                  })}
                </span>
              )}
              {embeddingProgress.phase === MemoryEmbeddingProgressPhase.Error && (
                <span className="text-error">
                  {t('settings.memory.embeddingProgress.error', {
                    error: embeddingProgress.error || '',
                  })}
                </span>
              )}
            </div>
          )}
        </div>
      </Section>

      <Section id="memory-memories" title={t('settings.memory.memories.title')} className="flex-1 min-h-0 flex flex-col">
        <div className="px-4 py-5 space-y-4 flex-1 min-h-0 flex flex-col">
          <div className="flex items-end justify-between gap-4">
            <Select
              label={t('settings.memory.memories.scope')}
              value={selectedScopeId}
              onChange={(value) => setSelectedScopeId(value)}
              options={scopeOptions}
              className="min-w-[400px]"
            />

            {selectedScopeId !== ALL_SCOPES && (
              <Button variant="contained" onClick={() => setIsDeleteScopeDialogOpen(true)} size="sm" color="danger">
                {isAgentScopeSelected ? t('settings.memory.memories.deleteAllForAgent') : t('settings.memory.memories.deleteAllForProject')}
              </Button>
            )}
          </div>

          <div className="border border-border-default-dark rounded-md overflow-hidden flex-1 min-h-0">
            {!filteredMemories ? (
              <div className="px-4 py-3 text-xs text-text-secondary bg-bg-secondary">{t('settings.memory.memories.loading')}</div>
            ) : filteredMemories.length === 0 ? (
              <div className="px-4 py-3 text-xs text-text-secondary bg-bg-secondary">{t('settings.memory.memories.empty')}</div>
            ) : (
              <div className="h-full overflow-y-auto scrollbar-thin scrollbar-track-bg-secondary-light scrollbar-thumb-bg-fourth hover:scrollbar-thumb-bg-tertiary">
                <div className="divide-y divide-border-default-dark">
                  {filteredMemories
                    .slice()
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .map((m) => (
                      <div key={m.id} className="px-3 py-2.5 bg-bg-secondary flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs text-text-muted flex flex-wrap gap-x-1 gap-y-0.5 leading-4">
                            {m.projectId && (
                              <span>
                                <CodeInline>{getScopeLabel(m.projectId)}</CodeInline>
                              </span>
                            )}
                            <span>
                              <CodeInline>{m.type}</CodeInline>
                            </span>
                          </div>
                          <div className="text-2xs text-text-primary mt-1 whitespace-pre-wrap break-words">{m.content}</div>
                        </div>

                        <div className="flex-shrink-0">
                          <IconButton
                            icon={<FaTrash className="w-3.5 h-3.5" />}
                            onClick={() => setMemoryToDelete(m)}
                            className="p-1.5 hover:bg-bg-tertiary hover:text-error rounded-md"
                            tooltip={t('settings.memory.memories.delete')}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </Section>

      {memoryToDelete && (
        <ConfirmDialog
          title={t('settings.memory.memories.deleteDialogTitle')}
          onConfirm={handleDeleteMemory}
          onCancel={() => setMemoryToDelete(null)}
          confirmButtonText={t('settings.memory.memories.delete')}
          confirmButtonClass="bg-error hover:bg-error"
        >
          <div className="text-sm text-text-secondary space-y-2">
            <div>
              {t('settings.memory.memories.deleteDialogText')} <CodeInline>{memoryToDelete.id}</CodeInline>
            </div>
          </div>
        </ConfirmDialog>
      )}

      {isDeleteScopeDialogOpen && selectedScopeId !== ALL_SCOPES && (
        <ConfirmDialog
          title={isAgentScopeSelected ? t('settings.memory.memories.deleteAgentMemoriesDialogTitle') : t('settings.memory.memories.deleteProjectDialogTitle')}
          onConfirm={handleDeleteScopeMemories}
          onCancel={() => setIsDeleteScopeDialogOpen(false)}
          confirmButtonText={isAgentScopeSelected ? t('settings.memory.memories.deleteAllForAgent') : t('settings.memory.memories.deleteAllForProject')}
          confirmButtonClass="bg-error hover:bg-error"
        >
          <div className="text-sm text-text-secondary space-y-2">
            <div>
              {isAgentScopeSelected ? t('settings.memory.memories.deleteAgentMemoriesDialogText') : t('settings.memory.memories.deleteProjectDialogText')}{' '}
              <CodeInline>{getScopeLabel(selectedScopeId)}</CodeInline>
            </div>
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
};

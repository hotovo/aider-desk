import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState, useOptimistic, startTransition } from 'react';
import { Model, ProviderProfile } from '@common/types';

import { useApi } from '@/context/ApiContext';

type ModelProviderContextType = {
  refresh: () => void;
  models: Model[];
  providers: ProviderProfile[];
  saveProvider: (profile: ProviderProfile) => Promise<void>;
  deleteProvider: (profileId: string) => Promise<void>;
  upsertModel: (providerId: string, modelId: string, model: Model) => Promise<void>;
  deleteModel: (providerId: string, modelId: string) => Promise<void>;
  modelsLoading: boolean;
  providersLoading: boolean;
  errors: Record<string, string>;
};

const ModelProviderContext = createContext<ModelProviderContextType | null>(null);

export const ModelProviderProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const api = useApi();
  const [modelsLoading, setModelsLoading] = useState(true);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [models, setModels] = useState<Model[]>([]);
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [optimisticProviders, setOptimisticProviders] = useOptimistic(providers);
  const [optimisticModels, setOptimisticModels] = useOptimistic(models);

  const sortedProviders = [...optimisticProviders].sort((a, b) => a.id.localeCompare(b.id));

  const sortedModels = [...optimisticModels].sort((a, b) => {
    if (a.providerId !== b.providerId) {
      return a.providerId.localeCompare(b.providerId);
    }
    return a.id.localeCompare(b.id);
  });

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      const { models, errors } = await api.getProviderModels();
      setModels(models!);
      setErrors(errors || {});
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load models:', error);
    } finally {
      setModelsLoading(false);
    }
  }, [api]);

  const loadProviders = useCallback(async () => {
    try {
      setProvidersLoading(true);
      const data = await api.getProviders();
      setProviders(data);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load providers:', error);
    } finally {
      setProvidersLoading(false);
    }
  }, [api]);

  const refresh = useCallback(() => {
    void loadModels();
    void loadProviders();
  }, [loadModels, loadProviders]);

  const saveProvider = useCallback(
    async (profile: ProviderProfile) => {
      const updated = providers.some((p) => p.id === profile.id) ? providers.map((p) => (p.id === profile.id ? profile : p)) : [...providers, profile];

      startTransition(async () => {
        setOptimisticProviders(updated);
        setProviders(await api.updateProviders(updated));
      });
    },
    [api, providers, setOptimisticProviders],
  );

  const deleteProvider = useCallback(
    async (profileId: string) => {
      const updated = providers.filter((p) => p.id !== profileId);

      startTransition(async () => {
        setOptimisticProviders(updated);
        setProviders(await api.updateProviders(updated));
      });
    },
    [api, providers, setOptimisticProviders],
  );

  const upsertModel = useCallback(
    async (providerId: string, modelId: string, model: Model) => {
      const updated = models.some((m) => m.id === modelId && m.providerId === providerId)
        ? models.map((m) => (m.id === modelId && m.providerId === providerId ? model : m))
        : [...models, model];

      startTransition(async () => {
        setOptimisticModels(updated);
        await api.upsertModel(providerId, modelId, model);
      });
    },
    [api, models, setOptimisticModels],
  );

  const deleteModel = useCallback(
    async (providerId: string, modelId: string) => {
      const updated = models.filter((m) => !(m.id === modelId && m.providerId === providerId));

      startTransition(async () => {
        setOptimisticModels(updated);
        await api.deleteModel(providerId, modelId);
      });
    },
    [api, models, setOptimisticModels],
  );

  useEffect(() => {
    void loadModels();
    void loadProviders();
  }, [loadModels, loadProviders]);

  useEffect(() => {
    return api.addProviderModelsUpdatedListener(({ models, loading, errors }) => {
      console.log('Provider models updated', models, loading, errors);
      if (models) {
        setModels(models);
      }
      if (loading !== undefined) {
        setModelsLoading(loading);
      }
      if (errors !== undefined) {
        setErrors(errors);
      }
    });
  }, [api]);

  useEffect(() => {
    return api.addProvidersUpdatedListener((data) => {
      setProviders(data.providers);
    });
  }, [api]);

  return (
    <ModelProviderContext.Provider
      value={{
        modelsLoading,
        providersLoading,
        errors,
        refresh,
        models: sortedModels,
        providers: sortedProviders,
        saveProvider,
        deleteProvider,
        upsertModel,
        deleteModel,
      }}
    >
      {children}
    </ModelProviderContext.Provider>
  );
};

export const useModelProviders = (): ModelProviderContextType => {
  const context = useContext(ModelProviderContext);
  if (!context) {
    throw new Error('useModelProviders must be used within a ModelProviderProvider');
  }
  return context;
};

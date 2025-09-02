import { EnvironmentVariable } from '@common/types';
import { useEffect, useState } from 'react';

import { useApi } from '@/context/ApiContext';

type UseEffectiveEnvironmentVariableResult = {
  environmentVariable: EnvironmentVariable | null;
  loading: boolean;
  error: string | null;
};

export const useEffectiveEnvironmentVariable = (key: string, baseDir?: string): UseEffectiveEnvironmentVariableResult => {
  const [environmentVariable, setEnvironmentVariable] = useState<EnvironmentVariable | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const api = useApi();

  useEffect(() => {
    const fetchEnvironmentVariable = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await api.getEffectiveEnvironmentVariable(key, baseDir);
        setEnvironmentVariable(result || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch environment variable');
        setEnvironmentVariable(null);
      } finally {
        setLoading(false);
      }
    };

    void fetchEnvironmentVariable();
  }, [key, baseDir, api]);

  return { environmentVariable, loading, error };
};

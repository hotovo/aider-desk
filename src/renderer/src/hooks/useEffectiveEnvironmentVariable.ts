import { EnvironmentVariable } from '@common/types';
import { useEffect, useState } from 'react';

type UseEffectiveEnvironmentVariableResult = {
  environmentVariable: EnvironmentVariable | null;
  loading: boolean;
  error: string | null;
};

export const useEffectiveEnvironmentVariable = (key: string, baseDir?: string): UseEffectiveEnvironmentVariableResult => {
  const [environmentVariable, setEnvironmentVariable] = useState<EnvironmentVariable | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEnvironmentVariable = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await window.api.getEffectiveEnvironmentVariable(key, baseDir);
        setEnvironmentVariable(result || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch environment variable');
        setEnvironmentVariable(null);
      } finally {
        setLoading(false);
      }
    };

    void fetchEnvironmentVariable();
  }, [key, baseDir]);

  return { environmentVariable, loading, error };
};

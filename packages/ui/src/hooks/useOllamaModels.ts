import { useEffect, useState } from 'react';
import axios from 'axios';

export const useOllamaModels = (baseUrl: string) => {
  const [models, setModels] = useState<string[]>([]);

  useEffect(() => {
    const loadModels = async () => {
      if (!baseUrl) {
        setModels([]);
        return;
      }
      try {
        let normalized = baseUrl.replace(/\/+$/, ''); // Remove all trailing slashes
        if (!normalized.endsWith('/api')) {
          normalized = `${normalized}/api`;
        }
        const response = await axios.get(`${normalized}/tags`);
        setModels(response.data?.models?.map((m: { name: string }) => m.name) || []);
      } catch {
        setModels([]);
      }
    };

    void loadModels();
  }, [baseUrl]);

  return models;
};

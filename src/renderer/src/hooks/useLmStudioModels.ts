import { useEffect, useState } from 'react';
import axios from 'axios';

export const useLmStudioModels = (baseUrl: string) => {
  const [models, setModels] = useState<string[]>([]);

  useEffect(() => {
    const loadModels = async () => {
      if (!baseUrl) {
        setModels([]);
        return;
      }
      try {
        const normalized = baseUrl.replace(/\/+$/g, ''); // Remove all trailing slashes
        const response = await axios.get(`${normalized}/models`);
        setModels(response.data?.data?.map((m: { id: string }) => m.id) || []);
      } catch {
        setModels([]);
      }
    };

    void loadModels();
  }, [baseUrl]);

  return models;
};

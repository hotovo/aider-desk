import { useEffect, useState } from 'react';

interface OpenRouterModel {
  id: string;
  // others not needed
}

interface OpenRouterResponse {
  data: OpenRouterModel[];
}

export const useOpenRouterModels = (apiKey: string) => {
  const [models, setModels] = useState<string[]>([]);

  useEffect(() => {
    const fetchModels = async () => {
      if (!apiKey) {
        setModels([]);
        return;
      }

      try {
        const response = await fetch('https://openrouter.ai/api/v1/models', {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: OpenRouterResponse = await response.json();

        const modelIds = data.data?.map((model: { id: string }) => model.id) || [];
        modelIds.sort();
        setModels(modelIds);
      } catch (err) {
        console.error('Error fetching OpenRouter models:', err);
        setModels([]);
      }
    };

    fetchModels();
  }, [apiKey]);

  return models;
};

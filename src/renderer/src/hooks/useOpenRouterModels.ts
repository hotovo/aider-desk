import { useEffect, useState } from 'react';

export const useOpenRouterModels = (apiKey: string) => {
  const [toSelectModels, setToSelectModels] = useState<string[]>([]);

  useEffect(() => {
    const fetchModels = async () => {
      if (!apiKey) {
        setToSelectModels([]);
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

        const data = await response.json();
        const modelIds = data.data?.map((model: { id: string }) => model.id) || [];
        setToSelectModels(modelIds);
      } catch (err) {
        console.error('Error fetching OpenRouter models:', err);
        setToSelectModels([]);
      }
    };

    fetchModels();
  }, [apiKey]);

  return { toSelectModels };
};

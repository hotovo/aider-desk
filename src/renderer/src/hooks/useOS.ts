import { OS } from '@common/types';
import { useEffect, useState } from 'react';

import { useApi } from '@/contexts/ApiContext';

export const useOS = (): OS | null => {
  const [os, setOS] = useState<OS | null>(null);
  const api = useApi();

  useEffect(() => {
    const fetchOS = async () => {
      try {
        const currentOS = await api.getOS();
        setOS(currentOS);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to fetch OS:', error);
        setOS(null); // Set to null or a default/unknown state in case of error
      }
    };

    void fetchOS();
  }, [api]);

  return os;
};

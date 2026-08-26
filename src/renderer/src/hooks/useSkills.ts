import { SkillDefinition } from '@common/types';
import { useEffect, useState } from 'react';

import { useApi } from '@/contexts/ApiContext';

export const useSkills = (baseDir: string, taskId?: string) => {
  const [skills, setSkills] = useState<SkillDefinition[]>([]);
  const api = useApi();

  useEffect(() => {
    if (!taskId) {
      return;
    }

    // Load initial skills
    api
      .getSkills(baseDir, taskId)
      .then(setSkills)
      .catch(() => setSkills([]));

    // Listen for skills updates
    const removeListener = api.addSkillsUpdatedListener(baseDir, taskId, (data) => {
      setSkills(data.skills);
    });

    return () => {
      removeListener();
    };
  }, [baseDir, taskId, api]);

  return skills;
};

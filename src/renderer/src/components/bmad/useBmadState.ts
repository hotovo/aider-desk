import { useCallback, useEffect, useMemo, useState } from 'react';
import { BmadStatus } from '@common/bmad-types';
import { TaskData } from '@common/types';

import { isResponseMessage, Message } from '@/types/message';
import { useApi } from '@/contexts/ApiContext';
import { useTaskMessages } from '@/stores/taskStore';
import { generateSuggestions } from '@/utils/bmad-suggestions';

export interface BmadAction {
  actionLetter: string;
  actionName: string;
}

const BMAD_ACTIONS: Array<{ letter: string; label: string }> = [
  { letter: 'Y', label: 'Yes' },
  { letter: 'N', label: 'No' },
  { letter: 'C', label: 'Continue' },
  { letter: 'E', label: 'Edit' },
  { letter: 'Q', label: 'Questions' },
  { letter: 'A', label: 'Advanced Elicitation' },
  { letter: 'P', label: 'Party Mode' },
];

export const extractBmadActions = (lastAssistantMessage: Message | undefined): BmadAction[] | undefined => {
  if (!lastAssistantMessage) {
    return undefined;
  }

  const lines = lastAssistantMessage.content.split('\n');
  const lastTenLines = lines.slice(-10);

  const extractedActions: BmadAction[] = [];

  for (const line of lastTenLines) {
    for (const action of BMAD_ACTIONS) {
      if (line.toLowerCase().includes(`[${action.letter}] ${action.label}`.toLowerCase())) {
        extractedActions.push({
          actionLetter: action.letter,
          actionName: action.label,
        });
      }
    }
  }

  return extractedActions.length > 0 ? extractedActions : undefined;
};

type Result = {
  status: BmadStatus | null;
  suggestedWorkflows: string[];
  bmadActions?: BmadAction[];
  isLoading: boolean;
  error: string | null;
  refresh: (loading?: boolean) => Promise<void>;
};

type UseBmadStateParams = {
  projectDir?: string;
  task?: TaskData | null;
};

export const useBmadState = ({ projectDir, task }: UseBmadStateParams): Result => {
  const [status, setStatus] = useState<BmadStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const api = useApi();
  const messages = useTaskMessages(task?.id || '');

  const suggestedWorkflows = useMemo(() => {
    if (!status) {
      return [];
    }
    return generateSuggestions(status.completedWorkflows, status.detectedArtifacts, status.sprintStatus, task?.metadata);
  }, [status, task?.metadata]);

  const bmadActions = useMemo(() => {
    if (!task) {
      return undefined;
    }

    const lastAssistantMessage = messages
      .slice()
      .reverse()
      .find((message) => isResponseMessage(message));

    return extractBmadActions(lastAssistantMessage);
  }, [messages, task]);

  const loadBmadStatus = useCallback(
    async (loading = true) => {
      if (!projectDir) {
        setStatus(null);
        setIsLoading(false);
        return;
      }

      if (loading) {
        setStatus(null);
        setError(null);
        setIsLoading(true);
      }

      try {
        const bmadStatus = await api.getBmadStatus(projectDir);
        setStatus(bmadStatus);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to fetch BMAD status:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    },
    [api, projectDir],
  );

  const refresh = useCallback(
    async (loading = true) => {
      await loadBmadStatus(loading);
    },
    [loadBmadStatus],
  );

  useEffect(() => {
    void loadBmadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectDir]);

  useEffect(() => {
    if (!projectDir) {
      return;
    }

    const unsubscribe = api.addBmadStatusChangedListener(projectDir, (newStatus) => {
      setStatus(newStatus);
      setError(null);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [api, projectDir]);

  return {
    status,
    suggestedWorkflows,
    bmadActions,
    isLoading,
    error,
    refresh,
  };
};

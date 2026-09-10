import { useCallback, useEffect, useState } from 'react';
import { InputPromptData } from '@common/types';

import { useApi } from '@/contexts/ApiContext';
import { InputPromptModal } from '@/components/common/InputPromptModal';

type Props = {
  promptData?: InputPromptData | null;
  onRespond?: (id: string, value: string | null, rememberSession?: boolean) => void;
};

export const InputPromptDialog = ({ promptData: controlledPromptData, onRespond }: Props) => {
  const api = useApi();
  const [internalPromptData, setInternalPromptData] = useState<InputPromptData | null>(null);

  const activePromptData = controlledPromptData !== undefined ? controlledPromptData : internalPromptData;

  useEffect(() => {
    if (controlledPromptData !== undefined) {
      return;
    }

    return api.onInputPrompt((data) => {
      setInternalPromptData(data);
    });
  }, [api, controlledPromptData]);

  const handleRespond = useCallback(
    (id: string, value: string | null, rememberSession?: boolean) => {
      if (onRespond) {
        if (rememberSession !== undefined) {
          onRespond(id, value, rememberSession);
        } else {
          onRespond(id, value);
        }
      } else {
        if (rememberSession !== undefined) {
          void api.respondInputPrompt(id, value, rememberSession);
        } else {
          void api.respondInputPrompt(id, value);
        }
      }
      setInternalPromptData(null);
    },
    [api, onRespond],
  );

  if (!activePromptData) {
    return null;
  }

  return <InputPromptModal key={activePromptData.id} promptData={activePromptData} onRespond={handleRespond} />;
};

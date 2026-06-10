import { useMemo } from 'react';

import { parseMessageContent } from '@/components/message/utils';

export const useParsedContent = (
  baseDir: string,
  content: string | null | undefined,
  allFiles: string[],
  renderMarkdown?: boolean,
  renderThinking?: boolean,
  reasoning?: string | null,
) => {
  return useMemo(() => {
    if (!content && !reasoning) {
      return null;
    }
    return parseMessageContent(baseDir, content || '', allFiles, renderMarkdown, renderThinking, reasoning);
    // we use allFiles.length to re-evaluate if the array content might have changed
    // even if the array reference itself hasn't.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseDir, content, reasoning, renderMarkdown, renderThinking, allFiles.length]);
};

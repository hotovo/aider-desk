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
  }, [baseDir, content, reasoning, renderMarkdown, renderThinking, allFiles]);
};

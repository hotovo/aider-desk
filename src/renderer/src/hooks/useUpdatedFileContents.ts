import { useCallback, useState } from 'react';
import { UpdatedFile } from '@common/types';

import { useApi } from '@/contexts/ApiContext';

type LoadedContents = {
  key: string;
  data: { oldContent: string; newContent: string };
};

/**
 * Lazily fetches full old/new file contents for expandable context diffs on demand.
 * Nothing is fetched until load() is called. Contents are tied to the file they were
 * loaded for — changing the file invalidates them automatically.
 */
export const useUpdatedFileContents = (baseDir: string, taskId: string, file: UpdatedFile | null | undefined) => {
  const api = useApi();
  const [loaded, setLoaded] = useState<LoadedContents | null>(null);
  const [loading, setLoading] = useState(false);

  const key = file ? `${file.commitHash ?? 'uncommitted'}:${file.path}` : null;
  const contents = loaded?.key === key ? loaded.data : null;

  const load = useCallback(() => {
    if (!file || !taskId || !baseDir) {
      return;
    }
    const fileKey = `${file.commitHash ?? 'uncommitted'}:${file.path}`;
    if (loaded?.key === fileKey || loading) {
      return;
    }
    setLoading(true);
    api
      .getUpdatedFileContents(baseDir, taskId, file.path, file.commitHash)
      .then((data) => setLoaded({ key: fileKey, data }))
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to fetch file contents:', error);
        setLoaded(null);
      })
      .finally(() => setLoading(false));
  }, [api, baseDir, taskId, file, loaded, loading]);

  return { contents, loading, load };
};

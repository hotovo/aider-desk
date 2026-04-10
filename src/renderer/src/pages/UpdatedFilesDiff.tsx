import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { UpdatedFile } from '@common/types';

import { groupFilesByCommit } from '@/components/ContextFiles/group-files';
import { UpdatedFilesDiffModal } from '@/components/ContextFiles/UpdatedFilesDiffModal';
import { useApi } from '@/contexts/ApiContext';
import { URL_PARAMS, decodeBaseDir } from '@/utils/routes';

export const UpdatedFilesDiff = () => {
  const { t } = useTranslation();
  const api = useApi();
  const [searchParams] = useSearchParams();

  const projectParam = searchParams.get(URL_PARAMS.PROJECT);
  const taskParam = searchParams.get(URL_PARAMS.TASK);
  const baseDir = projectParam ? decodeBaseDir(projectParam) : '';
  const taskId = taskParam || '';

  const [files, setFiles] = useState<UpdatedFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadFiles = async () => {
      if (!baseDir || !taskId) {
        setIsLoading(false);
        return;
      }

      try {
        const updatedFiles = await api.getUpdatedFiles(baseDir, taskId);
        setFiles(updatedFiles);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to load updated files:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadFiles();
  }, [api, baseDir, taskId]);

  const groups = useMemo(() => groupFilesByCommit(files), [files]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full p-[4px] bg-gradient-to-b from-bg-primary to-bg-primary-light">
        <div className="flex flex-col h-full border-2 border-border-default relative">
          <div className="flex items-center justify-center h-full">
            <span className="text-sm text-text-secondary">{t('common.loading')}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!baseDir || !taskId || files.length === 0) {
    return (
      <div className="flex flex-col h-full p-[4px] bg-gradient-to-b from-bg-primary to-bg-primary-light">
        <title>{t('contextFiles.updatedFiles')}</title>
        <div className="flex flex-col h-full border-2 border-border-default relative">
          <div className="flex items-center justify-center h-full">
            <span className="text-sm text-text-secondary">{t('contextFiles.noFiles')}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-[4px] bg-gradient-to-b from-bg-primary to-bg-primary-light">
      <title>{t('contextFiles.updatedFiles')}</title>
      <div className="flex flex-col h-full border-2 border-border-default relative">
        <UpdatedFilesDiffModal groups={groups} initialFile={files[0]} baseDir={baseDir} taskId={taskId} onClose={() => window.close()} />
      </div>
    </div>
  );
};

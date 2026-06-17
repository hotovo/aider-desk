import { RiFileEditLine } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';

import { CodeInline } from '@/components/common/CodeInline';
import { Tooltip } from '@/components/ui/Tooltip';

type Props = {
  filePath: string;
};

export const CompactionSnippetBlock = ({ filePath }: Props) => {
  const { t } = useTranslation();
  const fileName = filePath.split(/[/\\]/).pop() || filePath;

  return (
    <div className="my-2 inline-flex items-center gap-2 px-2 py-1 rounded-md border border-border-dark-light bg-bg-primary-light">
      <div className="text-text-muted">
        <RiFileEditLine className="w-3.5 h-3.5" />
      </div>
      <span className="text-2xs text-text-secondary">{t('compaction.fileEdited')}</span>
      <Tooltip content={filePath}>
        <span>
          <CodeInline className="bg-bg-secondary-light">{fileName}</CodeInline>
        </span>
      </Tooltip>
    </div>
  );
};

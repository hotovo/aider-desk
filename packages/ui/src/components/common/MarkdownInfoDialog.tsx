import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';

import { BaseDialog } from '@/components/common/BaseDialog';

type Props = {
  title: string;
  text: string;
  onClose: () => void;
};

export const MarkdownInfoDialog = ({ title, text, onClose }: Props) => {
  const { t } = useTranslation();

  return (
    <BaseDialog title={title} onClose={onClose} width={640} closeOnEscape={true} closeButtonText={t('common.close')}>
      <div className="prose prose-sm prose-invert max-w-none">
        <ReactMarkdown>{text}</ReactMarkdown>
      </div>
    </BaseDialog>
  );
};

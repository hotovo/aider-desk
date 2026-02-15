import { useTranslation } from 'react-i18next';

import { BaseDialog } from '@/components/common/BaseDialog';

type Props = {
  title: string;
  text: string;
  onClose: () => void;
};

export const HtmlInfoDialog = ({ title, text, onClose }: Props) => {
  const { t } = useTranslation();

  return (
    <BaseDialog title={title} onClose={onClose} width={800} closeOnEscape={true} closeButtonText={t('common.close')}>
      <div className="prose prose-sm prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: text }} />
    </BaseDialog>
  );
};

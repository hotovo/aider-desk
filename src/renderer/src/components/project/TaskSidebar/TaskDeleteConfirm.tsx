import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/common/Button';

type Props = {
  taskId: string;
  getAllSubtasksCount: (taskId: string) => number;
  onConfirm: (taskId: string) => Promise<void>;
  onCancel: () => void;
};

export const TaskDeleteConfirm = ({ taskId, getAllSubtasksCount, onConfirm, onCancel }: Props) => {
  const { t } = useTranslation();
  const [allSubtasksCount] = useState(() => getAllSubtasksCount(taskId));

  const handleConfirm = () => {
    void onConfirm(taskId);
  };

  return (
    <div className="m-2 p-2 bg-bg-primary border border-border-default rounded-md">
      <div className="text-2xs text-text-primary mb-2">
        {allSubtasksCount > 0 ? t('taskSidebar.deleteConfirmWithSubtasks', { count: allSubtasksCount }) : t('taskSidebar.deleteConfirm')}
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="text" size="xs" color="tertiary" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button variant="contained" color="danger" size="xs" onClick={handleConfirm}>
          {t('common.confirm')}
        </Button>
      </div>
    </div>
  );
};

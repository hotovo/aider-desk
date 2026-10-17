import { ProjectCheckResult } from '@common/types';
import { useTranslation } from 'react-i18next';

import { BaseDialog } from '@/components/common/BaseDialog';
import { Button } from '@/components/common/Button';

type Props = {
  projectPath: string;
  inventory: ProjectCheckResult;
  onTrust: () => void;
  onCancel: () => void;
};

export const ProjectTrustDialog = ({ projectPath, inventory, onTrust, onCancel }: Props) => {
  const { t } = useTranslation();
  const groups = [
    { title: t('projectTrust.agents'), items: inventory.agents },
    { title: t('projectTrust.mcpServers'), items: inventory.mcpServers },
    { title: t('projectTrust.extensions'), items: inventory.extensions },
  ];

  return (
    <BaseDialog
      title={t('projectTrust.title')}
      onClose={onCancel}
      width={650}
      footer={
        <>
          <Button onClick={onCancel} variant="text" autoFocus>
            {t('common.cancel')}
          </Button>
          <Button onClick={onTrust} color="danger">
            {t('projectTrust.confirm')}
          </Button>
        </>
      }
    >
      <p className="text-sm text-text-primary mb-3">{t('projectTrust.warning')}</p>
      <p className="text-xs text-text-secondary break-all mb-3">{projectPath}</p>
      {groups.map(({ title, items }) =>
        items.length > 0 ? (
          <section key={title} className="mb-3">
            <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
            <ul className="text-xs text-text-secondary space-y-2 mt-2">
              {items.map((item) => (
                <li key={`${item.path}:${item.name}`} className="break-all">
                  <span className="text-text-primary">{item.name}</span>
                  <div>{item.path}</div>
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
      <p className="text-sm text-text-primary">{t('projectTrust.review')}</p>
    </BaseDialog>
  );
};

import { useTranslation } from 'react-i18next';
import { LuArrowRight, LuCircleHelp } from 'react-icons/lu';
import { Model } from '@common/types';

import { MODALITY_ICONS } from './ModelModalitiesEditor';

import { Tooltip } from '@/components/ui/Tooltip';

type Props = {
  value: Model['modalities'];
};

export const ModelModalitiesCell = ({ value }: Props) => {
  const { t } = useTranslation();
  if (value === undefined) {
    return (
      <Tooltip content={t('modelLibrary.modalities.unknownTooltip')}>
        <span className="flex items-center text-text-muted" role="img" aria-label={t('modelLibrary.modalities.unknown')}>
          <LuCircleHelp className="w-3.5 h-3.5" />
        </span>
      </Tooltip>
    );
  }
  const modalities = value;

  const renderGroup = (direction: 'input' | 'output') => {
    const entries = modalities[direction];
    if (entries.length === 0) {
      return <span className="text-text-muted-dark">—</span>;
    }
    return entries.map((modality) => {
      const Icon = MODALITY_ICONS[modality];
      const label = `${t(`modelLibrary.modalities.${direction}`)}: ${t(`modelLibrary.modalities.${modality}`)}`;
      return (
        <Tooltip key={`${direction}-${modality}`} content={label}>
          <span className="flex items-center justify-center text-text-secondary">
            <Icon className="w-3.5 h-3.5" />
          </span>
        </Tooltip>
      );
    });
  };

  return (
    <div className="flex items-center gap-1 min-w-0">
      <div className="flex items-center gap-1">{renderGroup('input')}</div>
      <LuArrowRight className="w-3 h-3 text-text-muted-dark shrink-0" />
      <div className="flex items-center gap-1">{renderGroup('output')}</div>
    </div>
  );
};

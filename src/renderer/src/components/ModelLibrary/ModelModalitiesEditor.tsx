import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { LuAudioLines, LuFileText, LuImage, LuType, LuVideo } from 'react-icons/lu';
import { Model, ModelModality } from '@common/types';

import type { IconType } from 'react-icons';

import { InfoIcon } from '@/components/common/InfoIcon';
import { Tooltip } from '@/components/ui/Tooltip';

type Props = {
  value: Model['modalities'];
  onChange: (value: Model['modalities']) => void;
};

export const MODALITY_ICONS: Record<ModelModality, IconType> = {
  [ModelModality.Text]: LuType,
  [ModelModality.Image]: LuImage,
  [ModelModality.Audio]: LuAudioLines,
  [ModelModality.Video]: LuVideo,
  [ModelModality.Pdf]: LuFileText,
};

export const ModelModalitiesEditor = ({ value, onChange }: Props) => {
  const { t } = useTranslation();

  const modalities = value ?? { input: [], output: [] };

  const handleToggle = (direction: 'input' | 'output', modality: ModelModality) => {
    const enabled = modalities[direction].includes(modality);
    onChange({
      ...modalities,
      [direction]: enabled ? modalities[direction].filter((entry) => entry !== modality) : [...modalities[direction], modality],
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center">
        <span className="text-sm text-text-primary">{t('modelLibrary.modalities.label')}</span>
        <InfoIcon tooltip={t('modelLibrary.modalities.description')} size="sm" tooltipMaxWidth={360} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {(['input', 'output'] as const).map((direction) => (
          <div key={direction} className="space-y-1.5">
            <div className="flex items-center">
              <span className="text-xs text-text-secondary">{t(`modelLibrary.modalities.${direction}`)}</span>
              <InfoIcon tooltip={t(`modelLibrary.modalities.${direction}Tooltip`)} size="sm" />
            </div>
            <div className="flex items-center gap-1.5">
              {Object.values(ModelModality).map((modality) => {
                const Icon = MODALITY_ICONS[modality];
                const label = t(`modelLibrary.modalities.${modality}`);
                const active = modalities[direction].includes(modality);
                const handleClick = () => handleToggle(direction, modality);
                return (
                  <Tooltip key={modality} content={label}>
                    <button
                      type="button"
                      aria-label={`${t(`modelLibrary.modalities.${direction}`)}: ${label}`}
                      aria-pressed={active}
                      onClick={handleClick}
                      className={clsx(
                        'flex items-center justify-center w-8 h-8 rounded-md border transition focus:outline-none',
                        active
                          ? 'bg-bg-primary-light-strong border-border text-primary'
                          : 'bg-transparent border-border-default text-text-muted opacity-40 hover:opacity-100 focus-visible:opacity-100 hover:text-text-tertiary hover:border-border-light',
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

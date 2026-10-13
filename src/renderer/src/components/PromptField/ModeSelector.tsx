import { memo } from 'react';
import { Mode } from '@common/types';

import { ItemSelector } from '@/components/common/ItemSelector';
import { useModes } from '@/hooks/useModes';
import { useModeSwitchCommands } from '@/hooks/useModeSwitchCommands';

type Props = {
  baseDir: string;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
};

export const ModeSelector = memo(({ baseDir, mode, onModeChange }: Props) => {
  const modeItems = useModes(baseDir);
  useModeSwitchCommands({ baseDir, mode, onModeChange });

  return <ItemSelector items={modeItems} selectedValue={mode} onChange={onModeChange} />;
});

ModeSelector.displayName = 'ModeSelector';

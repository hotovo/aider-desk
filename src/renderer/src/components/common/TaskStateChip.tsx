import { useTranslation } from 'react-i18next';
import { twMerge } from 'tailwind-merge';
import { DefaultTaskState } from '@common/types';

import type { TFunction } from 'i18next';

type Props = {
  state: string;
  className?: string;
};

const getStateTextClass = (state: string): string => {
  switch (state) {
    case DefaultTaskState.Interrupted:
      return 'text-button-danger';
    case DefaultTaskState.Todo:
      return 'text-text-primary';
    case DefaultTaskState.Done:
      return 'text-text-muted-light';
    case DefaultTaskState.MoreInfoNeeded:
      return 'text-error';
    case DefaultTaskState.ReadyForReview:
      return 'text-success-light';
    case DefaultTaskState.ReadyForImplementation:
      return 'text-info-light';
    case DefaultTaskState.InProgress:
      return 'text-button-primary';
    default:
      return 'text-text-primary';
  }
};

export const getTaskStateLabel = (t: TFunction, state: string) => {
  return t(`taskState.${state}`, { defaultValue: state.replace(/[-_]/g, ' ') });
};

export const TaskStateChip = ({ state, className = '' }: Props) => {
  const { t } = useTranslation();

  const stateTextClass = getStateTextClass(state);

  return (
    <span className={twMerge('text-4xs px-1 rounded border border-border-dark-light bg-bg-tertiary-emphasis whitespace-nowrap', stateTextClass, className)}>
      {getTaskStateLabel(t, state)}
    </span>
  );
};

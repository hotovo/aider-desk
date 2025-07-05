import { useTranslation } from 'react-i18next';
import { ReactNode } from 'react';

type Props = {
  command: string;
  description?: ReactNode;
};

export const CommandSuggestion = ({ command, description }: Props) => {
  const { t } = useTranslation();
  return (
    <div className="flex justify-between items-center w-full">
      <span className="text-xs text-neutral-100">/{command}</span>
      <span className="ml-10 text-neutral-400 text-2xs">{description || t(`commands.${command}`)}</span>
    </div>
  );
};

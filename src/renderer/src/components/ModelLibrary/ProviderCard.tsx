import { ReactNode } from 'react';

type Props = {
  name: string;
  icon: ReactNode;
  onClick: () => void;
};

export const ProviderCard = ({ name, icon, onClick }: Props) => {
  return (
    <div
      className="flex flex-col items-center justify-center p-2 pt-4 border-2 border-border-dark-light rounded-lg cursor-pointer hover:bg-bg-secondary transition-colors"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className="w-8 h-8 mb-2 flex items-center justify-center">{icon}</div>
      <span className="text-sm font-medium">{name}</span>
    </div>
  );
};

import { ReactNode } from 'react';
import { clsx } from 'clsx';

export type TabItem = {
  id: string;
  label: ReactNode;
};

type Props = {
  tabs: TabItem[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  className?: string;
};

export const Tabs = ({ tabs, activeTabId, onTabChange, className }: Props) => {
  return (
    <div className={clsx('flex items-center gap-1 p-1 bg-bg-secondary rounded-md', className)}>
      {tabs.map((tab) => {
        const handleClick = () => {
          onTabChange(tab.id);
        };

        return (
          <button
            key={tab.id}
            onClick={handleClick}
            className={clsx(
              'flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors',
              activeTabId === tab.id ? 'bg-bg-fourth text-text-primary' : 'text-text-muted-light hover:text-text-secondary hover:bg-bg-tertiary',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

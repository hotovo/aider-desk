import { ContextFile } from '@common/types';
import { Activity, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MdOutlinePublic } from 'react-icons/md';
import { RiRobot2Line } from 'react-icons/ri';
import { VscFileCode } from 'react-icons/vsc';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

import { SectionHeader } from './SectionHeader';

import { Tooltip } from '@/components/ui/Tooltip';
import { TriStateCheckbox } from '@/components/common/TriStateCheckbox';
import { useProjectSettings } from '@/contexts/ProjectSettingsContext';

const getFileName = (filePath: string) => {
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1];
};

const getRuleSourceIcon = (source: string, t: (key: string) => string) => {
  if (source === 'global-rule') {
    return (
      <Tooltip content={t('contextFiles.globalRule')}>
        <MdOutlinePublic className="w-4 h-4 text-text-muted-light flex-shrink-0" />
      </Tooltip>
    );
  }
  if (source === 'project-rule') {
    return (
      <Tooltip content={t('contextFiles.projectRule')}>
        <VscFileCode className="w-4 h-4 text-text-muted-light flex-shrink-0" />
      </Tooltip>
    );
  }
  if (source === 'agent-rule') {
    return (
      <Tooltip content={t('contextFiles.agentRule')}>
        <RiRobot2Line className="w-4 h-4 text-text-muted-light flex-shrink-0" />
      </Tooltip>
    );
  }
  return null;
};

type Props = {
  rulesFiles: ContextFile[];
  isOpen: boolean;
  totalStats: { additions: number; deletions: number };
  visitedSections: Set<'updated' | 'project' | 'context' | 'rules'>;
  onToggle: () => void;
};

export const RulesSection = ({ rulesFiles, isOpen, totalStats, visitedSections, onToggle }: Props) => {
  const { t } = useTranslation();
  const { projectSettings, saveProjectSettings } = useProjectSettings();

  const disabledRuleFiles = useMemo(() => projectSettings?.disabledRuleFiles ?? [], [projectSettings?.disabledRuleFiles]);

  const sortedRulesFiles = useMemo(() => {
    return [...rulesFiles].sort((a, b) => a.path.localeCompare(b.path));
  }, [rulesFiles]);

  const handleToggleRuleFile = useCallback(
    (filePath: string, disable: boolean) => {
      const current = new Set(disabledRuleFiles);
      if (disable) {
        current.add(filePath);
      } else {
        current.delete(filePath);
      }
      void saveProjectSettings({ disabledRuleFiles: Array.from(current) });
    },
    [disabledRuleFiles, saveProjectSettings],
  );

  const enabledRuleCount = useMemo(() => rulesFiles.filter((f) => !disabledRuleFiles.includes(f.path)).length, [rulesFiles, disabledRuleFiles]);

  const hasContent = visitedSections.has('rules') && sortedRulesFiles.length > 0;

  return (
    <motion.div
      className={clsx('flex flex-col flex-grow overflow-hidden min-h-[40px]', 'border-t border-border-dark-light')}
      initial={false}
      animate={{
        flexGrow: isOpen ? 1 : 0,
        flexShrink: isOpen ? 1 : 0,
      }}
      transition={{ duration: 0.3, ease: 'easeIn' }}
    >
      <SectionHeader
        section="rules"
        title={t('contextFiles.rules')}
        count={enabledRuleCount}
        totalCount={rulesFiles.length}
        isOpen={isOpen}
        totalStats={totalStats}
        onToggle={onToggle}
      />
      <Activity mode={isOpen ? 'visible' : 'hidden'}>
        <motion.div
          className="flex-grow w-full overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-bg-tertiary scrollbar-track-bg-primary-light scrollbar-rounded pl-1 py-1 bg-bg-primary-light-strong relative"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {hasContent ? (
            sortedRulesFiles.map((file) => {
              const isDisabled = disabledRuleFiles.includes(file.path);
              return (
                <div key={file.path} className="flex items-center w-full px-1 h-6 group/item">
                  <div className="flex items-center flex-grow min-w-0 gap-1">
                    <Tooltip content={file.path} delayDuration={1000}>
                      <span className="select-none text-2xs overflow-hidden whitespace-nowrap overflow-ellipsis text-text-primary cursor-default">
                        {getFileName(file.path)}
                      </span>
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {file.source && getRuleSourceIcon(file.source, t)}
                    <TriStateCheckbox state={isDisabled ? 'unchecked' : 'checked'} onChange={() => handleToggleRuleFile(file.path, !isDisabled)} />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-center text-text-muted text-2xs">{t('common.noFiles')}</div>
          )}
        </motion.div>
      </Activity>
    </motion.div>
  );
};

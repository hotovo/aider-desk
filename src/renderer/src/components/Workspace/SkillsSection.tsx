import { SkillDefinition } from '@common/types';
import { Activity, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HiX } from 'react-icons/hi';
import { MdOutlinePublic, MdOutlineRefresh } from 'react-icons/md';
import { RiPlayCircleLine, RiRocketLine, RiRobot2Line } from 'react-icons/ri';
import { VscFileCode } from 'react-icons/vsc';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

import { SectionHeader } from './SectionHeader';

import { Tooltip } from '@/components/ui/Tooltip';
import { useApi } from '@/contexts/ApiContext';

const getSkillLocationIcon = (location: string, t: (key: string) => string) => {
  if (location === 'global') {
    return (
      <Tooltip content={t('contextFiles.globalSkill')}>
        <MdOutlinePublic className="w-3.5 h-3.5 text-text-muted-light flex-shrink-0" />
      </Tooltip>
    );
  }
  if (location === 'project') {
    return (
      <Tooltip content={t('contextFiles.projectSkill')}>
        <VscFileCode className="w-3.5 h-3.5 text-text-muted-light flex-shrink-0" />
      </Tooltip>
    );
  }
  if (location === 'builtin') {
    return (
      <Tooltip content={t('contextFiles.builtinSkill')}>
        <RiRobot2Line className="w-3.5 h-3.5 text-text-muted-light flex-shrink-0" />
      </Tooltip>
    );
  }
  if (location === 'extension') {
    return (
      <Tooltip content={t('contextFiles.extensionSkill')}>
        <RiRocketLine className="w-3.5 h-3.5 text-text-muted-light flex-shrink-0" />
      </Tooltip>
    );
  }
  return null;
};

type Props = {
  baseDir: string;
  taskId: string;
  isOpen: boolean;
  totalStats: { additions: number; deletions: number };
  visitedSections: Set<string>;
  onToggle: () => void;
  editMode?: boolean;
  isHidden?: boolean;
  onToggleHidden?: () => void;
  showBorderTop?: boolean;
};

export const SkillsSection = ({ baseDir, taskId, isOpen, totalStats, visitedSections, onToggle, editMode, isHidden, onToggleHidden, showBorderTop }: Props) => {
  const { t } = useTranslation();
  const api = useApi();
  const [skills, setSkills] = useState<SkillDefinition[]>([]);
  const [activating, setActivating] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadSkills = useCallback(async () => {
    try {
      const result = await api.getSkills(baseDir, taskId);
      setSkills(result);
    } catch {
      setSkills([]);
    }
  }, [api, baseDir, taskId]);

  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  useEffect(() => {
    const unsubscribe = api.addSkillsUpdatedListener(baseDir, taskId, (data) => {
      setSkills(data.skills);
    });
    return () => {
      unsubscribe();
    };
  }, [api, baseDir, taskId]);

  const sortedSkills = useMemo(() => {
    return [...skills].sort((a, b) => a.name.localeCompare(b.name));
  }, [skills]);

  const activatedCount = useMemo(() => skills.filter((s) => s.activated).length, [skills]);

  const handleActivate = useCallback(
    (skillName: string) => {
      setActivating(skillName);
      api
        .activateSkill(baseDir, taskId, skillName)
        .then(() => {
          void loadSkills();
        })
        .finally(() => {
          setActivating(null);
        });
    },
    [api, baseDir, taskId, loadSkills],
  );

  const handleDeactivate = useCallback(
    (skillName: string) => {
      setDeactivating(skillName);
      api
        .deactivateSkill(baseDir, taskId, skillName)
        .then(() => {
          void loadSkills();
        })
        .finally(() => {
          setDeactivating(null);
        });
    },
    [api, baseDir, taskId, loadSkills],
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadSkills();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadSkills]);

  const actions = useMemo(
    () => (
      <Tooltip content={t('contextFiles.refresh')}>
        <button className="p-1.5 rounded-md hover:bg-bg-tertiary transition-colors" onClick={handleRefresh} disabled={isRefreshing}>
          <MdOutlineRefresh className={clsx('w-4 h-4', isRefreshing && 'animate-spin')} />
        </button>
      </Tooltip>
    ),
    [t, handleRefresh, isRefreshing],
  );

  const hasContent = visitedSections.has('skills') && sortedSkills.length > 0;

  return (
    <motion.div
      className={clsx('flex flex-col overflow-hidden min-h-[40px]', showBorderTop && 'border-t border-border-dark-light')}
      initial={false}
      animate={editMode ? { flexGrow: 0, flexShrink: 0 } : { flexGrow: isOpen ? 1 : 0, flexShrink: isOpen ? 1 : 0 }}
      transition={{ duration: 0.3, ease: 'easeIn' }}
    >
      <SectionHeader
        section="skills"
        title={t('contextFiles.skills')}
        count={activatedCount}
        totalCount={skills.length}
        isOpen={isOpen}
        totalStats={totalStats}
        onToggle={onToggle}
        actions={actions}
        editMode={editMode}
        isHidden={isHidden}
        onToggleHidden={onToggleHidden}
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
            sortedSkills.map((skill) => (
              <div key={skill.name} className="flex items-center w-full px-1 h-7 group/item">
                <div className="flex items-center flex-grow min-w-0 gap-1">
                  <Tooltip content={skill.description} delayDuration={500}>
                    <span
                      className={clsx(
                        'select-none text-2xs overflow-hidden whitespace-nowrap overflow-ellipsis cursor-default',
                        skill.activated ? 'text-text-primary' : 'text-text-muted',
                      )}
                    >
                      {skill.name}
                    </span>
                  </Tooltip>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {getSkillLocationIcon(skill.location, t)}
                  {skill.activated ? (
                    <Tooltip content={t('contextFiles.skillDeactivate')}>
                      <button
                        onClick={() => handleDeactivate(skill.name)}
                        disabled={deactivating === skill.name}
                        className={clsx(
                          'p-0.5 rounded transition-colors',
                          deactivating === skill.name
                            ? 'bg-bg-tertiary text-text-muted cursor-wait'
                            : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary cursor-pointer',
                        )}
                      >
                        <HiX className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                  ) : (
                    <Tooltip content={t('contextFiles.skillActivate')}>
                      <button
                        onClick={() => handleActivate(skill.name)}
                        disabled={activating === skill.name}
                        className={clsx(
                          'p-0.5 rounded transition-colors',
                          activating === skill.name ? 'bg-bg-tertiary text-text-muted cursor-wait' : 'text-text-primary hover:bg-bg-tertiary cursor-pointer',
                        )}
                      >
                        <RiPlayCircleLine className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-center text-text-muted text-2xs">{t('contextFiles.noSkills')}</div>
          )}
        </motion.div>
      </Activity>
    </motion.div>
  );
};

import { ContextFile, OS, TokensInfoData } from '@common/types';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ContextFilesSection } from './ContextFilesSection';
import { createFileTree } from './types';

import type { TreeItem } from './types';

import { useProjectSettings } from '@/contexts/ProjectSettingsContext';

type Props = {
  rulesFiles: ContextFile[];
  isOpen: boolean;
  totalStats: { additions: number; deletions: number };
  tokensInfo?: TokensInfoData | null;
  os: OS | null;
  contextFilesMap: Map<string, ContextFile>;
  visitedSections: Set<'updated' | 'project' | 'context' | 'rules'>;
  onToggle: () => void;
};

export const RulesSection = ({ rulesFiles, isOpen, totalStats, tokensInfo, os, contextFilesMap, visitedSections, onToggle }: Props) => {
  const { t } = useTranslation();
  const { projectSettings, saveProjectSettings } = useProjectSettings();

  const [rulesExpandedItems, setRulesExpandedItems] = useState<string[]>([]);

  const disabledRuleFiles = useMemo(() => projectSettings?.disabledRuleFiles ?? [], [projectSettings?.disabledRuleFiles]);

  const sortedRulesFiles = useMemo(() => {
    return [...rulesFiles].sort((a, b) => a.path.localeCompare(b.path));
  }, [rulesFiles]);

  const rulesTreeData = useMemo(() => {
    if (!visitedSections.has('rules')) {
      return { root: { index: 'root', children: [], isFolder: true, data: 'root' } as TreeItem };
    }
    return createFileTree(sortedRulesFiles, 'root');
  }, [visitedSections, sortedRulesFiles]);

  useEffect(() => {
    if (Object.keys(rulesTreeData).length > 1) {
      const allFolders = Object.keys(rulesTreeData).filter((key) => rulesTreeData[key].isFolder);
      setRulesExpandedItems(Array.from(new Set([...rulesExpandedItems, ...allFolders])));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rulesTreeData]);

  const handleToggleRuleFiles = useCallback(
    (filePaths: string[], disable: boolean) => {
      const current = new Set(disabledRuleFiles);
      for (const filePath of filePaths) {
        if (disable) {
          current.add(filePath);
        } else {
          current.delete(filePath);
        }
      }
      void saveProjectSettings({ disabledRuleFiles: Array.from(current) });
    },
    [disabledRuleFiles, saveProjectSettings],
  );

  const dropFile = useCallback(
    (_item: TreeItem) => (_e: React.MouseEvent<HTMLButtonElement>) => {
      _e.stopPropagation();
    },
    [],
  );

  const addFile = useCallback((_item: TreeItem) => (_event: React.MouseEvent<HTMLButtonElement>) => {}, []);

  const enabledRuleCount = useMemo(() => rulesFiles.filter((f) => !disabledRuleFiles.includes(f.path)).length, [rulesFiles, disabledRuleFiles]);

  return (
    <ContextFilesSection
      section="rules"
      title={t('contextFiles.rules')}
      count={enabledRuleCount}
      totalRuleCount={rulesFiles.length}
      isOpen={isOpen}
      totalStats={totalStats}
      treeData={rulesTreeData}
      expandedItems={rulesExpandedItems}
      setExpandedItems={setRulesExpandedItems}
      contextFilesMap={contextFilesMap}
      updatedFiles={[]}
      tokensInfo={tokensInfo}
      os={os}
      disabledRuleFiles={disabledRuleFiles}
      onToggleRuleFile={handleToggleRuleFiles}
      showBorderTop
      onToggle={onToggle}
      onFileDiffClick={() => {}}
      onFilePreviewClick={() => {}}
      onRevertFile={() => {}}
      onDropFile={dropFile}
      onAddFile={addFile}
    />
  );
};

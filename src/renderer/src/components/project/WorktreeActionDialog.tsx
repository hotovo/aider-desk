import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BranchInfo } from '@common/types';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useApi } from '@/contexts/ApiContext';
import Select from '@/components/common/Select';
import { Input } from '@/components/common/Input';

type Props = {
  baseDir: string;
  title: string;
  message?: string;
  confirmButtonText: string;
  defaultBranch?: string;
  showCommitMessage?: boolean;
  initialCommitMessage?: string;
  onCancel: () => void;
  onConfirm: (branch: string, commitMessage?: string) => void;
};

export const WorktreeActionDialog = ({
  baseDir,
  title,
  message,
  confirmButtonText,
  defaultBranch,
  showCommitMessage,
  initialCommitMessage,
  onCancel,
  onConfirm,
}: Props) => {
  const { t } = useTranslation();
  const api = useApi();
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>(defaultBranch || '');
  const [commitMessage, setCommitMessage] = useState<string>(initialCommitMessage || '');
  const commitMessageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialCommitMessage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCommitMessage(initialCommitMessage);
      commitMessageInputRef.current?.select();
      commitMessageInputRef.current?.focus();
    }
  }, [initialCommitMessage]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const list = await api.listBranches(baseDir);
        if (cancelled) {
          return;
        }

        setBranches(list);

        if (!selectedBranch) {
          const current = list.find((b) => b.isCurrent)?.name;
          setSelectedBranch(defaultBranch || current || list[0]?.name || '');
        }
      } catch {
        if (!cancelled) {
          setBranches([]);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [api, baseDir, defaultBranch, selectedBranch]);

  const options = useMemo(() => {
    return branches.map((b) => ({
      value: b.name,
      label: `${b.name}${b.hasWorktree ? ` (${t('worktree.branchHasWorktree')})` : ''}`,
    }));
  }, [branches, t]);

  const handleConfirm = () => {
    if (selectedBranch) {
      onConfirm(selectedBranch, showCommitMessage ? commitMessage : undefined);
    }
  };

  const handleBranchChange = (value: string) => {
    setSelectedBranch(value);
  };

  const handleCommitMessageChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCommitMessage(e.target.value);
  };

  return (
    <ConfirmDialog title={title} onConfirm={handleConfirm} onCancel={onCancel} confirmButtonText={confirmButtonText} closeOnEscape>
      {message && <p className="text-sm mb-3">{message}</p>}

      <div className="flex flex-col gap-3">
        {showCommitMessage && (
          <Input
            ref={commitMessageInputRef}
            label={<span className="text-xs text-text-muted-light">{t('worktree.commitMessage')}</span>}
            value={commitMessage}
            onChange={handleCommitMessageChange}
            size="sm"
            placeholder={t('worktree.commitMessagePlaceholder')}
          />
        )}

        <div className="flex flex-col gap-2">
          <Select
            label={<span className="text-xs text-text-muted-light">{t('worktree.selectBranch')}</span>}
            value={selectedBranch}
            onChange={handleBranchChange}
            options={options}
            size="sm"
          />
        </div>
      </div>
    </ConfirmDialog>
  );
};

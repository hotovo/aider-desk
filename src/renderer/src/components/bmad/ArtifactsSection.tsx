import { DetectedArtifacts } from '@common/bmad-types';
import { useState, MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FiFile, FiExternalLink, FiChevronDown } from 'react-icons/fi';
import { clsx } from 'clsx';

import { useApi } from '@/contexts/ApiContext';

type Props = {
  detectedArtifacts: DetectedArtifacts;
};

export const ArtifactsSection = ({ detectedArtifacts }: Props) => {
  const { t } = useTranslation();
  const api = useApi();
  const [isExpanded, setIsExpanded] = useState(false);

  const artifactEntries = Object.entries(detectedArtifacts).filter(([, artifact]) => artifact.path);

  if (artifactEntries.length === 0) {
    return null;
  }

  const handleOpenArtifact = async (e: MouseEvent<HTMLButtonElement>, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    await api.openPath(path);
  };

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  const getFileName = (path: string) => {
    const parts = path.split('/');
    return parts[parts.length - 1];
  };

  return (
    <div className="border-t border-border-dark-light">
      <button onClick={handleToggle} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-bg-tertiary/50 transition-colors">
        <FiChevronDown className={clsx('w-3 h-3 transition-transform', isExpanded ? 'rotate-0' : '-rotate-90')} />
        <span>{t('bmad.taskActions.outputArtifacts')}</span>
        <span className="text-2xs text-text-tertiary">({artifactEntries.length})</span>
      </button>
      {isExpanded && (
        <div className="px-3 pb-2 space-y-1">
          {artifactEntries.map(([workflowId, artifact]) => (
            <button
              key={workflowId}
              onClick={(e) => handleOpenArtifact(e, artifact.path)}
              className="w-full flex items-center gap-2 px-2 py-1 rounded text-2xs text-accent-primary hover:text-accent-secondary hover:bg-bg-tertiary/50 transition-colors group text-left"
            >
              <FiFile className="w-3 h-3 flex-shrink-0" />
              <span className="flex-1 truncate underline decoration-dotted underline-offset-2">{getFileName(artifact.path)}</span>
              <FiExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

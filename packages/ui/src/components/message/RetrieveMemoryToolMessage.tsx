import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaBrain, FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaTrash } from 'react-icons/fa';
import { CgSpinner } from 'react-icons/cg';

import { ToolMessage } from '@/types/message';
import { ExpandableMessageBlock } from '@/components/message/ExpandableMessageBlock';
import { IconButton } from '@/components/common/IconButton';
import { Tooltip } from '@/components/ui/Tooltip';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useApi } from '@/contexts/ApiContext';

type Props = {
  message: ToolMessage;
  onRemove?: () => void;
  compact?: boolean;
  onFork?: () => void;
  onRemoveUpTo?: () => void;
  hideMessageBar?: boolean;
};

export const RetrieveMemoryToolMessage = ({ message, onRemove, compact = false, onFork, onRemoveUpTo, hideMessageBar }: Props) => {
  const { t } = useTranslation();
  const api = useApi();

  const query = message.args.query as string;
  const limit = (message.args.limit as number) ?? 5;
  const content = message.content && JSON.parse(message.content);
  const isError = content && typeof content === 'string' && content.startsWith('Failed to retrieve memories');
  const isDenied = content && typeof content === 'string' && content.includes('denied');
  const memoryCount = Array.isArray(content) ? content.length : 0;

  const [currentMemories, setCurrentMemories] = useState<Set<string>>(new Set());
  const [memoryToDelete, setMemoryToDelete] = useState<{ id: string; content: string } | null>(null);

  useEffect(() => {
    const loadMemories = async () => {
      try {
        const allMemories = await api.listAllMemories();
        setCurrentMemories(new Set(allMemories.map((m) => m.id)));
      } catch {
        // Ignore errors loading memories
      }
    };
    void loadMemories();
  }, [api]);

  const handleDeleteMemory = async () => {
    if (!memoryToDelete) {
      return;
    }
    await api.deleteMemory(memoryToDelete.id);
    setMemoryToDelete(null);
    try {
      const allMemories = await api.listAllMemories();
      setCurrentMemories(new Set(allMemories.map((m) => m.id)));
    } catch {
      // Ignore errors loading memories
    }
  };

  const title = (
    <div className="flex items-center gap-2 w-full text-left">
      <div className="text-text-muted">
        <FaBrain className="w-4 h-4" />
      </div>
      <div className="text-xs text-text-primary flex flex-wrap gap-1">
        {!content ? (
          <span>{t('toolMessage.memory.retrievingMemories')}</span>
        ) : isError || isDenied ? (
          <span>{t('toolMessage.memory.retrievingMemories')}</span>
        ) : (
          <span>{memoryCount > 0 ? t('toolMessage.memory.foundMemories', { count: memoryCount }) : t('toolMessage.memory.noMemoriesFound')}</span>
        )}
      </div>
      {!content && <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light flex-shrink-0" />}
      {content &&
        (isError ? (
          <Tooltip content={content}>
            <FaExclamationTriangle className="w-3 h-3 text-error" />
          </Tooltip>
        ) : isDenied ? (
          <Tooltip content={content}>
            <FaTimesCircle className="w-3 h-3 text-warning" />
          </Tooltip>
        ) : (
          <FaCheckCircle className="w-3 h-3 text-success flex-shrink-0" />
        ))}
    </div>
  );

  const renderContent = () => {
    if (!content) {
      return (
        <div className="p-3 text-2xs text-text-tertiary bg-bg-secondary">
          <div className="flex items-center gap-2">
            <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light" />
            <span>{t('toolMessage.memory.retrievingMemories')}</span>
          </div>
        </div>
      );
    }

    if (isError || isDenied) {
      return (
        <div className="p-3 text-2xs text-text-tertiary bg-bg-secondary">
          <div className={`${isDenied ? 'text-warning' : 'text-error'}`}>
            <pre className="whitespace-pre-wrap bg-bg-primary-light p-3 rounded text-2xs max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth font-mono">
              {content}
            </pre>
          </div>
        </div>
      );
    }

    if (Array.isArray(content)) {
      return (
        <div className="px-4 py-1 text-2xs text-text-tertiary bg-bg-secondary">
          <div className="space-y-3">
            {/* Query parameters */}
            <div className="border border-border-dark-light rounded bg-bg-primary-light px-3 py-2 space-y-1">
              <div className="text-3xs">
                <span className="text-text-muted">{t('toolMessage.memory.query')}:</span> {query}
              </div>
              <div className="text-3xs">
                <span className="text-text-muted">{t('toolMessage.memory.limit')}:</span> {limit}
              </div>
            </div>
            {/* Memory List */}
            {content.length > 0 ? (
              <div className="space-y-2">
                {content.map((memory) => {
                  const memoryExists = currentMemories.has(memory.id);
                  return (
                    <div key={memory.id} className={`border border-border-dark-light rounded bg-bg-primary-light p-3 ${!memoryExists ? 'opacity-50' : ''}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-3xs text-text-muted bg-bg-secondary px-2 py-1 rounded">
                          {memoryExists ? memory.type : `${memory.type} (${t('toolMessage.memory.memoryNotFound')})`}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-3xs text-text-muted">{new Date(memory.timestamp).toLocaleDateString()}</span>
                          {memoryExists && (
                            <IconButton
                              icon={<FaTrash className="w-3.5 h-3.5" />}
                              onClick={() => setMemoryToDelete({ id: memory.id, content: memory.content })}
                              tooltip={t('toolMessage.memory.delete')}
                              className="p-1.5 hover:bg-bg-tertiary hover:text-error rounded-md"
                            />
                          )}
                        </div>
                      </div>
                      <pre className="whitespace-pre-wrap text-2xs text-text-primary max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth">
                        {memory.content}
                      </pre>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-2xs text-text-tertiary bg-bg-secondary">
                <div className="border border-border-dark-light rounded bg-bg-primary-light px-3 py-2">
                  <div className="text-text-muted">{t('toolMessage.memory.noRelevantMemories')}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Fallback for unexpected content (backward compatibility)
    return (
      <div className="p-3 text-2xs text-text-tertiary bg-bg-secondary">
        <pre className="whitespace-pre-wrap bg-bg-primary-light p-3 rounded text-2xs max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth font-mono">
          {typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
        </pre>
      </div>
    );
  };

  if (compact) {
    return title;
  }

  return (
    <>
      <ExpandableMessageBlock
        title={title}
        content={renderContent()}
        usageReport={message.usageReport}
        onRemove={onRemove}
        onFork={onFork}
        onRemoveUpTo={onRemoveUpTo}
        hideMessageBar={hideMessageBar}
      />
      {memoryToDelete && (
        <ConfirmDialog
          title={t('toolMessage.memory.deleteDialogTitle')}
          onConfirm={handleDeleteMemory}
          onCancel={() => setMemoryToDelete(null)}
          confirmButtonText={t('toolMessage.memory.delete')}
          confirmButtonClass="bg-error hover:bg-error"
        >
          <div className="text-sm text-text-secondary space-y-2">
            <div>{t('toolMessage.memory.deleteDialogText')}</div>
            <pre className="whitespace-pre-wrap bg-bg-secondary p-3 rounded text-xs max-h-[150px] overflow-y-auto scrollbar-thin scrollbar-track-bg-secondary scrollbar-thumb-bg-tertiary">
              {memoryToDelete.content}
            </pre>
          </div>
        </ConfirmDialog>
      )}
    </>
  );
};

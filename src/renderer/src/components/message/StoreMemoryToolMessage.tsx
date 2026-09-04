import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaBrain, FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaTrash } from 'react-icons/fa';
import { CgSpinner } from 'react-icons/cg';
import { ToolMessage } from '@common/types';

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

type StoredMemoryResult = {
  success: boolean;
  id: string;
};

const tryParseJson = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

export const StoreMemoryToolMessage = ({ message, onRemove, compact = false, onFork, onRemoveUpTo, hideMessageBar }: Props) => {
  const { t } = useTranslation();
  const api = useApi();

  const type = (message.args.type as string) || '';
  const parsedContent = message.content && JSON.parse(message.content);
  // Tool results are stored JSON-stringified; versions that returned a JSON string from the tool are stored double-encoded
  const unwrapped =
    typeof parsedContent === 'object' && parsedContent !== null
      ? parsedContent
      : typeof parsedContent === 'string' && parsedContent.startsWith('{')
        ? tryParseJson(parsedContent)
        : undefined;
  const result = unwrapped && typeof unwrapped.success === 'boolean' ? (unwrapped as StoredMemoryResult) : undefined;
  const messageText = typeof parsedContent === 'string' && !result ? parsedContent : undefined;
  const isError = messageText ? messageText.startsWith('Failed to store memory') : false;
  const isDenied = messageText ? messageText.includes('denied') : false;
  const memoryId = result?.success ? result.id : undefined;

  console.log(
    '[StoreMemoryToolMessage] raw content:',
    message.content,
    '| parsed:',
    parsedContent,
    '| unwrapped:',
    unwrapped,
    '| result:',
    result,
    '| messageText:',
    messageText,
    '| memoryId:',
    memoryId,
  );

  const [currentMemories, setCurrentMemories] = useState<Set<string>>(new Set());
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

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
    setIsDeleteDialogOpen(false);
    if (!memoryId) {
      return;
    }
    await api.deleteMemory(memoryId);
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
        {!parsedContent ? (
          <span>{t('toolMessage.memory.storingMemory')}</span>
        ) : isError || isDenied ? (
          <span>{t('toolMessage.memory.memoryStored')}</span>
        ) : (
          <span>{t('toolMessage.memory.memoryStored')}</span>
        )}
      </div>
      {!parsedContent && <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light flex-shrink-0" />}
      {parsedContent &&
        (isError ? (
          <Tooltip content={messageText}>
            <FaExclamationTriangle className="w-3 h-3 text-error" />
          </Tooltip>
        ) : isDenied ? (
          <Tooltip content={messageText}>
            <FaTimesCircle className="w-3 h-3 text-warning" />
          </Tooltip>
        ) : (
          <FaCheckCircle className="w-3 h-3 text-success flex-shrink-0" />
        ))}
    </div>
  );

  const renderContent = () => {
    if (!parsedContent) {
      return (
        <div className="p-3 text-2xs text-text-tertiary bg-bg-secondary">
          <div className="flex items-center gap-2">
            <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light" />
            <span>{t('toolMessage.memory.storingMemory')}</span>
          </div>
        </div>
      );
    }

    if (isError || isDenied) {
      return (
        <div className="p-3 text-2xs text-text-tertiary bg-bg-secondary">
          <div className={`${isDenied ? 'text-warning' : 'text-error'}`}>
            <pre className="whitespace-pre-wrap bg-bg-primary-light p-3 rounded text-2xs max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth font-mono">
              {messageText}
            </pre>
          </div>
        </div>
      );
    }

    const memoryExists = memoryId ? currentMemories.has(memoryId) : true;

    return (
      <div className="px-4 py-1 text-2xs text-text-tertiary bg-bg-secondary">
        <div className="space-y-3">
          {/* Memory Details */}
          <div className="space-y-2">
            <div className={`border border-border-dark-light rounded bg-bg-primary-light px-3 py-2 space-y-1 ${!memoryExists ? 'opacity-50' : ''}`}>
              <div className="text-3xs flex items-center justify-between">
                <span>
                  <span className="text-text-muted">{t('toolMessage.memory.type')}:</span>{' '}
                  {memoryExists ? type : `${type} (${t('toolMessage.memory.memoryNotFound')})`}
                </span>
                {memoryId && memoryExists && (
                  <IconButton
                    icon={<FaTrash className="w-3.5 h-3.5" />}
                    onClick={() => setIsDeleteDialogOpen(true)}
                    tooltip={t('toolMessage.memory.delete')}
                    className="p-1.5 hover:bg-bg-tertiary hover:text-error rounded-md"
                  />
                )}
              </div>
              <div className="mt-1 p-2 bg-bg-secondary rounded border border-border-dark-light">
                <pre className="whitespace-pre-wrap text-2xs text-text-primary max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth">
                  {(message.args.content as string) || ''}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (compact) {
    return title;
  }

  return (
    <>
      <ExpandableMessageBlock
        message={message}
        title={title}
        content={renderContent()}
        usageReport={message.usageReport}
        onRemove={onRemove}
        onFork={onFork}
        onRemoveUpTo={onRemoveUpTo}
        hideMessageBar={hideMessageBar}
      />
      {isDeleteDialogOpen && (
        <ConfirmDialog
          title={t('toolMessage.memory.deleteDialogTitle')}
          onConfirm={handleDeleteMemory}
          onCancel={() => setIsDeleteDialogOpen(false)}
          confirmButtonText={t('toolMessage.memory.delete')}
          confirmButtonClass="bg-error hover:bg-error"
        >
          <div className="text-sm text-text-secondary space-y-2">
            <div>{t('toolMessage.memory.deleteDialogText')}</div>
            <pre className="whitespace-pre-wrap bg-bg-secondary p-3 rounded text-xs max-h-[150px] overflow-y-auto scrollbar-thin scrollbar-track-bg-secondary scrollbar-thumb-bg-tertiary">
              {(message.args.content as string) || ''}
            </pre>
          </div>
        </ConfirmDialog>
      )}
    </>
  );
};

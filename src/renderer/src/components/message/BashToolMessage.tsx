import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { RiTerminalLine, RiErrorWarningFill, RiCheckboxCircleFill, RiCloseCircleFill } from 'react-icons/ri';
import { CgSpinner } from 'react-icons/cg';
import { MdKeyboardDoubleArrowDown } from 'react-icons/md';

import { ToolMessage } from '@/types/message';
import { CodeInline } from '@/components/common/CodeInline';
import { ExpandableMessageBlock } from '@/components/message/ExpandableMessageBlock';
import { Tooltip } from '@/components/ui/Tooltip';
import { CopyMessageButton } from '@/components/message/CopyMessageButton';
import { IconButton } from '@/components/common/IconButton';
import { useScrollingPaused } from '@/hooks/useScrollingPaused';

type Props = {
  message: ToolMessage;
  onRemove?: () => void;
  compact?: boolean;
  onFork?: () => void;
  onRemoveUpTo?: () => void;
  hideMessageBar?: boolean;
};

const isStandardBashOutput = (obj: unknown): obj is { stdout?: string; stderr?: string; exitCode?: number } => {
  return typeof obj === 'object' && obj !== null && ('stdout' in obj || 'stderr' in obj || 'exitCode' in obj);
};

const hasErrorProperty = (obj: unknown): obj is { error: string } => {
  return typeof obj === 'object' && obj !== null && 'error' in obj;
};

const hasDeniedProperty = (obj: unknown): obj is { denied: string } => {
  return typeof obj === 'object' && obj !== null && 'denied' in obj;
};

export const BashToolMessage = ({ message, onRemove, compact = false, onFork, onRemoveUpTo, hideMessageBar }: Props) => {
  const { t } = useTranslation();

  const command = message.args.command as string;
  const timeout = message.args.timeout as number | undefined;
  const content = message.content && JSON.parse(message.content);
  const isStandardOutput = isStandardBashOutput(content);
  const hasError = hasErrorProperty(content);
  const hasDenied = hasDeniedProperty(content);
  const isError = (isStandardOutput && content.exitCode !== 0) || hasError;
  const isDenied =
    (typeof content === 'string' && content.startsWith('Bash command execution denied by ')) ||
    hasDenied ||
    (typeof content === 'string' && content.startsWith('Bash command execution denied by user'));
  const isCustomOutput = content && typeof content === 'object' && !isStandardOutput && !hasError && !hasDenied;
  const isFinished = message.finished !== false;

  const stdoutRef = useRef<HTMLDivElement>(null);
  const stderrRef = useRef<HTMLDivElement>(null);

  const handleScrollToBottom = () => {
    if (stdoutRef.current) {
      stdoutRef.current.scrollTo({ top: stdoutRef.current.scrollHeight, behavior: 'smooth' });
    }
    if (stderrRef.current) {
      stderrRef.current.scrollTo({ top: stderrRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  const { scrollingPaused, scrollToBottom, eventHandlers, setScrollingPaused } = useScrollingPaused({
    onAutoScroll: handleScrollToBottom,
  });

  useEffect(() => {
    if (!scrollingPaused) {
      handleScrollToBottom();
    }
  }, [content, scrollingPaused]);

  const handleExpandedChange = (open: boolean) => {
    if (open) {
      setTimeout(() => {
        handleScrollToBottom();
        setScrollingPaused(false);
      }, 100);
    }
  };

  const title = (
    <div className="flex items-center gap-2 w-full text-left">
      <div className="text-text-muted">
        <RiTerminalLine className="w-4 h-4" />
      </div>
      <div className="text-xs text-text-primary flex flex-wrap gap-1">
        <span>{t('toolMessage.power.bash.title')}</span>
        <span>
          <CodeInline className="bg-bg-primary-light">{command}</CodeInline>
        </span>
        <CopyMessageButton content={command} alwaysShow={true} className="w-3.5 h-3.5" />
      </div>
      {!isFinished && <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light flex-shrink-0" />}
      {isFinished &&
        content &&
        (isError ? (
          <Tooltip content={typeof content === 'string' ? content : hasError ? content.error : content.stderr || t('toolMessage.power.bash.commandFailed')}>
            <RiErrorWarningFill className="w-3 h-3 text-error" />
          </Tooltip>
        ) : isDenied ? (
          <Tooltip content={typeof content === 'string' ? content : hasDenied ? content.denied : ''}>
            <RiCloseCircleFill className="w-3 h-3 text-warning" />
          </Tooltip>
        ) : (
          <RiCheckboxCircleFill className="w-3 h-3 text-success flex-shrink-0" />
        ))}
    </div>
  );

  const renderContent = () => {
    return (
      <div className="p-3 text-2xs text-text-tertiary bg-bg-secondary">
        <div className="space-y-2">
          {content && typeof content === 'string' ? (
            <div className={isDenied ? 'text-warning' : 'text-error'}>
              <div className="whitespace-pre-wrap bg-bg-primary-light p-3 rounded text-2xs max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth font-mono">
                {content}
              </div>
            </div>
          ) : hasError ? (
            <div className="text-error">
              <div className="whitespace-pre-wrap bg-bg-primary-light p-3 rounded text-2xs max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth font-mono">
                {content.error}
              </div>
            </div>
          ) : hasDenied ? (
            <div className="text-warning">
              <div className="whitespace-pre-wrap bg-bg-primary-light p-3 rounded text-2xs max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth font-mono">
                {content.denied}
              </div>
            </div>
          ) : isCustomOutput ? (
            <div className="whitespace-pre-wrap bg-bg-primary-light p-3 rounded text-2xs text-text-secondary max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth font-mono">
              <pre className="whitespace-pre-wrap">{JSON.stringify(content, null, 2)}</pre>
            </div>
          ) : (
            <>
              {isStandardOutput && content.stdout && (
                <div className="relative">
                  <div
                    ref={stdoutRef}
                    {...eventHandlers}
                    className="whitespace-pre-wrap bg-bg-primary-light p-3 rounded text-2xs text-text-secondary max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth font-mono"
                  >
                    {content.stdout}
                  </div>
                  {scrollingPaused && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
                      <IconButton
                        icon={<MdKeyboardDoubleArrowDown className="h-4 w-4" />}
                        onClick={scrollToBottom}
                        tooltip={t('messages.scrollToBottom')}
                        className="bg-bg-primary-light border border-border-default shadow-lg hover:bg-bg-secondary transition-colors duration-200"
                        aria-label={t('messages.scrollToBottom')}
                      />
                    </div>
                  )}
                </div>
              )}
              {isStandardOutput && content.stderr && (
                <div className="relative">
                  <div
                    ref={stderrRef}
                    className="whitespace-pre-wrap bg-bg-primary-light p-3 rounded text-2xs text-error max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth font-mono"
                    {...eventHandlers}
                  >
                    {content.stderr}
                  </div>
                  {scrollingPaused && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
                      <IconButton
                        icon={<MdKeyboardDoubleArrowDown className="h-4 w-4" />}
                        onClick={scrollToBottom}
                        tooltip={t('messages.scrollToBottom')}
                        className="bg-bg-primary-light border border-border-default shadow-lg hover:bg-bg-secondary transition-colors duration-200"
                        aria-label={t('messages.scrollToBottom')}
                      />
                    </div>
                  )}
                </div>
              )}
              {timeout !== undefined && timeout !== null && (
                <div className="flex items-center gap-2">
                  <div className="font-semibold text-text-secondary">{t('toolMessage.power.bash.timeout')}:</div>
                  <div>{timeout}ms</div>
                </div>
              )}
              {isFinished && isStandardOutput && content.exitCode !== null && content.exitCode !== undefined && (
                <div className="flex items-center gap-2">
                  <div className="font-semibold text-text-secondary">{t('toolMessage.power.bash.exitCode')}:</div>
                  <div>{content.exitCode}</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  if (compact) {
    return title;
  }

  return (
    <ExpandableMessageBlock
      title={title}
      content={renderContent()}
      usageReport={message.usageReport}
      onRemove={onRemove}
      onOpenChange={handleExpandedChange}
      onFork={onFork}
      onRemoveUpTo={onRemoveUpTo}
      hideMessageBar={hideMessageBar}
    />
  );
};

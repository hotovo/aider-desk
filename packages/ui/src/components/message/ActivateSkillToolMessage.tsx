import { MdPsychology } from 'react-icons/md';
import { CgSpinner } from 'react-icons/cg';
import { useTranslation } from 'react-i18next';
import { VscError } from 'react-icons/vsc';
import { clsx } from 'clsx';

import { CopyMessageButton } from './CopyMessageButton';
import { ExpandableMessageBlock } from './ExpandableMessageBlock';
import { parseToolContent } from './utils';

import { ToolMessage } from '@/types/message';

type Props = {
  message: ToolMessage;
  onRemove?: () => void;
  compact?: boolean;
  onFork?: () => void;
  onRemoveUpTo?: () => void;
  hideMessageBar?: boolean;
};

export const ActivateSkillToolMessage = ({ message, onRemove, compact = false, onFork, onRemoveUpTo, hideMessageBar }: Props) => {
  const { t } = useTranslation();
  const skillName = (message.args.skill as string) || '';
  const isExecuting = message.content === '';
  const parsedResult = !isExecuting ? parseToolContent(message.content) : null;

  const title = (
    <div className="flex items-center gap-2 w-full text-left">
      <div className={clsx('text-text-muted', { 'animate-pulse': isExecuting })}>
        <MdPsychology className="w-4 h-4" />
      </div>
      <div className="text-xs text-text-primary flex flex-wrap gap-1 items-center">
        {isExecuting ? (
          <span>{t('settings.agent.skills.activating', { name: skillName })}</span>
        ) : (
          <span>{t('settings.agent.skills.activated', { name: skillName })}</span>
        )}
        {isExecuting && <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light flex-shrink-0" />}
        {!isExecuting && parsedResult?.isError === true && <VscError className="text-error" />}
      </div>
    </div>
  );

  if (compact) {
    return title;
  }

  const renderContent = () => {
    if (isExecuting) {
      return (
        <div className="p-3 text-2xs text-text-tertiary bg-bg-secondary">
          <div className="flex items-center gap-2">
            <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light" />
            <span>{t('settings.agent.skills.activating', { name: skillName })}</span>
          </div>
        </div>
      );
    }

    const content = parsedResult?.extractedText || parsedResult?.rawContent || '';

    return (
      <div className="text-2xs whitespace-pre-wrap text-text-tertiary bg-bg-secondary relative p-3">
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-2 font-semibold text-text-secondary">
            {t('settings.agent.skills.skill')}
            {parsedResult?.isError === true && (
              <span className="flex items-center gap-1 text-error text-xs font-normal">
                <VscError /> {t('toolMessage.error')}
              </span>
            )}
          </div>
          <CopyMessageButton content={content} className="text-text-muted-dark hover:text-text-tertiary" />
        </div>
        <pre className="whitespace-pre-wrap max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth bg-bg-primary-light p-2 rounded text-[11px]">
          {content}
        </pre>
      </div>
    );
  };

  const copyContent = JSON.stringify({ args: message.args, result: message.content && JSON.parse(message.content) }, null, 2);

  return (
    <ExpandableMessageBlock
      title={title}
      content={renderContent()}
      copyContent={copyContent}
      usageReport={message.usageReport}
      onRemove={onRemove}
      onFork={onFork}
      onRemoveUpTo={onRemoveUpTo}
      hideMessageBar={hideMessageBar}
    />
  );
};

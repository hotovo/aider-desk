import { useTranslation } from 'react-i18next';
import { RiAlertLine, RiPauseCircleFill } from 'react-icons/ri';
import { ToolMessage } from '@common/types';
import { isToolRecoveryNotice } from '@common/tool-recovery';

import { ExpandableMessageBlock } from './ExpandableMessageBlock';
import { getToolRecoveryCodes, localizeToolRecoveryContent } from './localize-tool-recovery';
import { formatName } from './utils';

type Props = {
  message: ToolMessage;
  compact?: boolean;
  onRemove?: () => void;
  onFork?: () => void;
  onRemoveUpTo?: () => void;
  hideMessageBar?: boolean;
};

const NOTICE_KEYS = ['aiderDeskRecovery', 'message', 'error'];

const isPureNotice = (value: unknown): boolean => isToolRecoveryNotice(value) && Object.keys(value).every((key) => NOTICE_KEYS.includes(key));

export const RecoveryToolMessage = ({ message, compact = false, onRemove, onFork, onRemoveUpTo, hideMessageBar }: Props) => {
  const { t } = useTranslation();
  const codes = getToolRecoveryCodes(message.content);
  const localized = localizeToolRecoveryContent(message.content, t);

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(localized);
  } catch {
    parsed = null;
  }
  const hasDetails = parsed !== null && !isPureNotice(parsed);
  const hasArgs = Object.keys(message.args).length > 0;

  const title = (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <RiPauseCircleFill className="text-warning flex-shrink-0 w-3.5 h-3.5" />
        <span className="font-semibold text-text-primary">
          {t('toolMessage.toolLabel', { server: formatName(message.serverName), tool: formatName(message.toolName) })}
        </span>
        {codes.map((code) => (
          <span key={code} className="text-3xs uppercase tracking-wide px-1.5 py-0.5 rounded bg-warning-subtle text-warning font-semibold">
            {t('durability.labels.' + code)}
          </span>
        ))}
      </div>
      <div role="status" className="flex items-start gap-1.5 rounded border-l-2 border-l-warning bg-warning-subtle px-2 py-1 text-2xs text-warning">
        <RiAlertLine className="flex-shrink-0 mt-[1px]" />
        <span>{codes.map((code) => t('durability.notices.' + code)).join(' ')}</span>
      </div>
    </div>
  );

  const content = (
    <div className="px-4 py-3 text-2xs bg-bg-secondary space-y-3">
      {hasArgs && (
        <div>
          <div className="font-semibold mb-1 text-text-secondary">{t('toolMessage.arguments')}</div>
          <pre className="whitespace-pre-wrap max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth bg-bg-primary-light p-2 rounded text-text-secondary text-2xs">
            {JSON.stringify(message.args, null, 2)}
          </pre>
        </div>
      )}
      <div>
        <div className="font-semibold mb-1 text-text-secondary">{t('durability.recovery.detailsTitle')}</div>
        {hasDetails ? (
          <pre className="whitespace-pre-wrap max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth bg-bg-primary-light p-2 rounded text-text-secondary text-2xs">
            {JSON.stringify(parsed, null, 2)}
          </pre>
        ) : (
          <div className="italic text-text-muted-light">{t('durability.recovery.noOutput')}</div>
        )}
      </div>
    </div>
  );

  if (compact) {
    return title;
  }

  return (
    <ExpandableMessageBlock
      message={message}
      title={title}
      content={content}
      usageReport={message.usageReport}
      copyContent={message.content}
      onRemove={onRemove}
      onFork={onFork}
      onRemoveUpTo={onRemoveUpTo}
      hideMessageBar={hideMessageBar}
    />
  );
};

import { useTranslation } from 'react-i18next';
import { ClaudeAgentSdkProvider } from '@aider-desk/common/agent';

type Props = {
  provider: ClaudeAgentSdkProvider;
  onChange: (updated: ClaudeAgentSdkProvider) => void;
};

export const ClaudeAgentSdkParameters = ({ provider: _provider }: Props) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <div className="rounded-md border border-border-default-dark p-3 text-xs text-text-primary">{t('modelLibrary.claudeAgentSdkAuthRequired')}</div>
      <div className="rounded-md border border-border-default-dark p-3 text-xs text-text-primary">{t('modelLibrary.claudeAgentSdkAgentOnly')}</div>
    </div>
  );
};

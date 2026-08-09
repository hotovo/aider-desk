import { useTranslation } from 'react-i18next';
import { McpTool } from '@common/types';

type Props = {
  tool: McpTool;
};

export const McpToolCard = ({ tool }: Props) => {
  const { t } = useTranslation();

  return (
    <div className="border border-border-default-dark rounded p-3">
      <div className="text-sm font-semibold text-text-primary break-all">{tool.name}</div>
      <div className="text-xs text-text-muted-light mt-1.5 leading-relaxed whitespace-pre-wrap break-words">
        {tool.description?.trim() || t('tool.noDescription')}
      </div>
    </div>
  );
};

import { useState, ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { FiEdit2, FiTrash2, FiMic } from 'react-icons/fi';
import { clsx } from 'clsx';
import { ProviderProfile } from '@common/types';
import { LlmProviderName } from '@common/agent';
import { FaExclamationCircle } from 'react-icons/fa';

import { IconButton } from '@/components/common/IconButton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import {
  AnthropicIcon,
  AnthropicCompatibleIcon,
  AzureIcon,
  BedrockIcon,
  CerebrasIcon,
  ClaudeAgentSdkIcon,
  DeepseekIcon,
  GeminiCliIcon,
  GeminiIcon,
  GpustackIcon,
  GroqIcon,
  LitellmIcon,
  LmStudioIcon,
  MinimaxIcon,
  OllamaIcon,
  OpenAiCompatibleIcon,
  OpenAiIcon,
  OpenCodeIcon,
  OpenRouterIcon,
  RequestyIcon,
  SyntheticIcon,
  VertexAiIcon,
  ZaiPlanIcon,
} from '@/icons';
import { useResponsive } from '@/hooks/useResponsive';
import { Tooltip } from '@/components/ui/Tooltip';
import { KimiPlanIcon } from '@/icons/KimiPlanIcon';

const PROVIDER_ICON_MAP: Record<LlmProviderName, ComponentType<{ width?: number; height?: number; className?: string }>> = {
  anthropic: AnthropicIcon,
  'anthropic-compatible': AnthropicCompatibleIcon,
  azure: AzureIcon,
  bedrock: BedrockIcon,
  cerebras: CerebrasIcon,
  'claude-agent-sdk': ClaudeAgentSdkIcon,
  deepseek: DeepseekIcon,
  'gemini-cli': GeminiCliIcon,
  gemini: GeminiIcon,
  gpustack: GpustackIcon,
  groq: GroqIcon,
  'kimi-plan': KimiPlanIcon,
  litellm: LitellmIcon,
  lmstudio: LmStudioIcon,
  minimax: MinimaxIcon,
  ollama: OllamaIcon,
  openai: OpenAiIcon,
  'openai-compatible': OpenAiCompatibleIcon,
  opencode: OpenCodeIcon,
  openrouter: OpenRouterIcon,
  requesty: RequestyIcon,
  synthetic: SyntheticIcon,
  'vertex-ai': VertexAiIcon,
  'zai-plan': ZaiPlanIcon,
};

type Props = {
  provider: ProviderProfile;
  error?: string;
  isSelected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export const ProviderProfileCard = ({ provider, error, isSelected, onToggleSelect, onEdit, onDelete }: Props) => {
  const { t } = useTranslation();
  const { isMobile } = useResponsive();
  const [showActions, setShowActions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const IconComponent = PROVIDER_ICON_MAP[provider.provider.name];
  const name = provider.name || t(`providers.${provider.provider.name}`);

  const handleCardClick = () => {
    if (isMobile) {
      if (isSelected && !showActions) {
        // If already selected and no actions showing, show actions (mobile behavior)
        setShowActions(true);
      } else {
        // Otherwise, toggle selection (mobile behavior)
        onToggleSelect();
        setShowActions(false);
      }
    } else {
      onToggleSelect();
    }
  };

  const handleEdit = () => {
    onEdit();
    setShowActions(false);
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
    setShowActions(false);
  };

  return (
    <>
      <div
        className={clsx(
          'relative flex items-center p-3 pr-6 border-2 rounded-lg cursor-pointer transition-all duration-200 group',
          'hover:bg-bg-secondary',
          isSelected ? 'border-accent bg-bg-secondary shadow-sm' : 'border-border-dark-light hover:border-border-light',
          provider.disabled ? 'opacity-50' : '',
        )}
        onClick={handleCardClick}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div className="flex-shrink-0 relative">
            {IconComponent && <IconComponent width={24} height={24} />}
            {error && (
              <div className="absolute -bottom-3 -right-3 bg-bg-secondary rounded-full p-0.5">
                <Tooltip content={error}>
                  <FaExclamationCircle className="w-5 h-5 text-text-error" />
                </Tooltip>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate flex items-center gap-3">
              {name}
              {provider.provider.voiceEnabled && (
                <Tooltip content={t('modelLibrary.voiceEnabled')}>
                  <FiMic className="w-4 h-4 text-text-secondary" />
                </Tooltip>
              )}
            </div>
            <div className="text-xs text-text-secondary truncate">{provider.id}</div>
          </div>
        </div>

        {/* Action buttons - shown on hover (desktop) or when showActions is true (mobile) */}
        <div
          className={clsx(
            'flex flex-col items-center h-full space-y-3 transition-all duration-200',
            showActions ? 'opacity-100 translate-x-6' : 'opacity-0 translate-x-4 pointer-events-none',
            'md:group-hover:opacity-100 md:group-hover:translate-x-4 md:group-hover:pointer-events-auto',
          )}
        >
          <IconButton icon={<FiEdit2 />} onClick={handleEdit} />
          <IconButton icon={<FiTrash2 />} onClick={handleDelete} className="text-error hover:text-error-light" />
        </div>
      </div>
      {showDeleteConfirm && (
        <ConfirmDialog
          title={t('modelLibrary.deleteProfileTitle')}
          onConfirm={() => {
            onDelete();
            setShowDeleteConfirm(false);
          }}
          onCancel={() => setShowDeleteConfirm(false)}
          confirmButtonText={t('common.delete')}
        >
          <p className="text-sm">{t('modelLibrary.deleteProfileConfirm', { name })}</p>
        </ConfirmDialog>
      )}
    </>
  );
};

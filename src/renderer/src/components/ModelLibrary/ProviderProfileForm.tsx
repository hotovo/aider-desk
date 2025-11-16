import { getDefaultProviderParams, LlmProvider, LlmProviderName } from '@common/agent';
import { ProviderProfile } from '@common/types';
import { useTranslation } from 'react-i18next';
import { ComponentType, ReactNode, forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FaPlus, FaTrash } from 'react-icons/fa';

import { DisableStreaming } from './DisableStreaming';

import {
  AnthropicParameters,
  AzureParameters,
  BedrockParameters,
  DeepseekParameters,
  GeminiParameters,
  GpustackParameters,
  GroqParameters,
  LmStudioParameters,
  MinimaxParameters,
  OllamaParameters,
  OpenAiCompatibleParameters,
  OpenAiParameters,
  OpenRouterParameters,
  RequestyParameters,
  VertexAIParameters,
  ZaiPlanParameters,
} from '@/components/ModelLibrary/providers';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { Accordion } from '@/components/common/Accordion';

type ProviderParametersProps<T extends LlmProvider> = {
  provider: T;
  onChange: (updated: T) => void;
};

// @ts-expect-error using LlmProvider as type
const PROVIDER_PARAMETERS_MAP: Record<LlmProviderName, ComponentType<ProviderParametersProps>> = {
  anthropic: AnthropicParameters,
  azure: AzureParameters,
  bedrock: BedrockParameters,
  deepseek: DeepseekParameters,
  gemini: GeminiParameters,
  gpustack: GpustackParameters,
  groq: GroqParameters,
  lmstudio: LmStudioParameters,
  minimax: MinimaxParameters,
  ollama: OllamaParameters,
  openai: OpenAiParameters,
  'openai-compatible': OpenAiCompatibleParameters,
  openrouter: OpenRouterParameters,
  requesty: RequestyParameters,
  'vertex-ai': VertexAIParameters,
  'zai-plan': ZaiPlanParameters,
};

type Header = { id: string; key: string; value: string };

type Props = {
  provider: LlmProviderName;
  editProfile?: ProviderProfile; // for editing
  providers: ProviderProfile[];
  onSave: (profile: ProviderProfile) => void;
  onCancel: () => void;
  hideActions?: boolean;
  onChange?: (profile: ProviderProfile) => void;
};

export type ProviderProfileFormRef = {
  submit: () => void;
};

export const ProviderProfileForm = forwardRef<ProviderProfileFormRef, Props>(
  ({ provider, editProfile, providers, onSave, onCancel, hideActions = false, onChange }, ref) => {
    const { t } = useTranslation();

    const [id, setId] = useState('');
    const [name, setName] = useState('');
    const [parameters, setParameters] = useState<LlmProvider | null>(null);
    const [headers, setHeaders] = useState<Header[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const buildDraftProfile = (draftId: string, draftName: string, draftParameters: LlmProvider | null, draftHeaders: Header[]): ProviderProfile | null => {
      if (!draftParameters) {
        return null;
      }

      const headersObject = draftHeaders.reduce(
        (acc, header) => {
          if (header.key) {
            acc[header.key] = header.value;
          }
          return acc;
        },
        {} as Record<string, string>,
      );

      return {
        id: draftId,
        name: draftName,
        provider: draftParameters,
        headers: headersObject,
      };
    };

    useEffect(() => {
      if (!onChange) {
        return;
      }

      const draftProfile = buildDraftProfile(id, name, parameters, headers);
      if (draftProfile) {
        onChange(draftProfile);
      }
    }, [id, name, parameters, headers, onChange]);

    useEffect(() => {
      if (editProfile) {
        setId(editProfile.id);
        setName(editProfile.name || '');
        setParameters(editProfile.provider);
        const initialHeaders = editProfile.headers
          ? Object.entries(editProfile.headers).map(([key, value]) => ({
              id: uuidv4(),
              key,
              value,
            }))
          : [];
        setHeaders(initialHeaders);
      } else {
        // Set defaults for new profile
        setId(provider);
        setName('');
        setParameters(getDefaultProviderParams(provider));
        setHeaders([]);
      }
    }, [editProfile, provider]);

    const handleIdChange = (value: string) => {
      setId(value);

      // Clear error when user starts typing
      if (errors.id) {
        setErrors((prev) => ({ ...prev, id: '' }));
      }
    };

    const handleHeaderChange = (id: string, field: 'key' | 'value', value: string) => {
      setHeaders(headers.map((h) => (h.id === id ? { ...h, [field]: value } : h)));
    };

    const addHeader = () => {
      setHeaders([...headers, { id: uuidv4(), key: '', value: '' }]);
    };

    const removeHeader = (id: string) => {
      setHeaders(headers.filter((h) => h.id !== id));
    };

    const handleDisableStreamingChange = (disableStreaming: boolean) => {
      if (parameters) {
        setParameters({ ...parameters, disableStreaming });
      }
    };

    const handleResetParameters = () => {
      setParameters(getDefaultProviderParams(provider));
    };

    const validateForm = (): boolean => {
      const newErrors: Record<string, string> = {};

      // Check for duplicate IDs
      const existingIds = providers.filter((p) => (editProfile ? p.id !== editProfile.id : true)).map((p) => p.id);
      if (existingIds.includes(id)) {
        newErrors.id = t('modelLibrary.errors.duplicateId');
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    };

    const handleSave = () => {
      if (!parameters) {
        return;
      }

      if (!validateForm()) {
        return;
      }

      const draftProfile = buildDraftProfile(id, name, parameters, headers);
      if (!draftProfile) {
        return;
      }

      onSave(draftProfile);
    };

    useImperativeHandle(ref, () => ({
      submit: () => {
        handleSave();
      },
    }));

    const ParametersComponent = PROVIDER_PARAMETERS_MAP[provider];

    const renderSectionAccordion = (title: ReactNode, children: ReactNode, open?: boolean, setOpen?: (open: boolean) => void) => (
      <Accordion
        title={<div className="flex-1 text-left text-sm font-medium px-2">{title}</div>}
        chevronPosition="right"
        className="mb-2 border rounded-md border-border-default-dark"
        isOpen={open}
        onOpenChange={setOpen}
      >
        <div className="p-4 pt-2">{children}</div>
      </Accordion>
    );

    return (
      <div className="p-4 py-10 overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-tertiary">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-md font-bold mb-4 capitalize">
            {t('modelLibrary.profileForm.title', {
              provider: t(`providers.${provider}`),
            })}
          </h2>
          <div className="flex justify-end mb-2">
            <Button onClick={handleResetParameters} variant="text" size="sm">
              {t('modelLibrary.overrides.resetToDefaults')}
            </Button>
          </div>
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <Input
                wrapperClassName="w-full"
                label={t('modelLibrary.profileForm.name')}
                placeholder={t(`providers.${provider}`)}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div className="w-full">
                <Input
                  wrapperClassName="w-full"
                  label={t('modelLibrary.profileForm.id')}
                  value={id}
                  onChange={(e) => handleIdChange(e.target.value)}
                  disabled={!!editProfile}
                />
                {errors.id && <p className="text-error text-2xs mt-1">{errors.id}</p>}
              </div>
            </div>

            {ParametersComponent && parameters && <ParametersComponent provider={parameters} onChange={setParameters} />}

            {renderSectionAccordion(
              t('modelLibrary.profileForm.headers'),
              <div className="space-y-2">
                {headers.map((header) => (
                  <div key={header.id} className="flex items-center space-x-2 w-full">
                    <Input
                      placeholder={t('modelLibrary.profileForm.headerKey')}
                      value={header.key}
                      onChange={(e) => handleHeaderChange(header.id, 'key', e.target.value)}
                      wrapperClassName="flex-1"
                    />
                    <Input
                      placeholder={t('modelLibrary.profileForm.headerValue')}
                      value={header.value}
                      onChange={(e) => handleHeaderChange(header.id, 'value', e.target.value)}
                      wrapperClassName="flex-1"
                    />
                    <IconButton icon={<FaTrash />} onClick={() => removeHeader(header.id)} className="p-2" />
                  </div>
                ))}
                <Button onClick={addHeader} variant="text" className="mt-2 mx-auto" size="sm">
                  <FaPlus className="mr-2 w-2 h-2" />
                  {t('modelLibrary.profileForm.addHeader')}
                </Button>
              </div>,
            )}
          </div>

          {/* Disable streaming checkbox */}
          {parameters && (
            <div className="mt-4 mx-2">
              <DisableStreaming checked={parameters.disableStreaming ?? false} onChange={handleDisableStreamingChange} />
            </div>
          )}

          {!hideActions && (
            <div className="flex justify-end space-x-4 mt-8">
              <Button onClick={onCancel} variant="text">
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSave}>{t('common.save')}</Button>
            </div>
          )}
        </div>
      </div>
    );
  },
);

ProviderProfileForm.displayName = 'ProviderProfileForm';

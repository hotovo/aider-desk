import { getDefaultProviderParams, LlmProvider, LlmProviderName } from '@common/agent';
import { ProviderProfile } from '@common/types';
import { useTranslation } from 'react-i18next';
import { ComponentType, ReactNode, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FaPlus, FaTrash } from 'react-icons/fa';

import {
  AnthropicParameters,
  AzureParameters,
  BedrockParameters,
  DeepseekParameters,
  GeminiParameters,
  GroqParameters,
  LmStudioParameters,
  OllamaParameters,
  OpenAiCompatibleParameters,
  OpenAiParameters,
  OpenRouterParameters,
  RequestyParameters,
  VertexAIParameters,
} from '@/components/settings/agent/providers';
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
  groq: GroqParameters,
  lmstudio: LmStudioParameters,
  ollama: OllamaParameters,
  openai: OpenAiParameters,
  'openai-compatible': OpenAiCompatibleParameters,
  openrouter: OpenRouterParameters,
  requesty: RequestyParameters,
  'vertex-ai': VertexAIParameters,
};

type Header = { id: string; key: string; value: string };

type Props = {
  provider: LlmProviderName;
  editProfile?: ProviderProfile; // for editing
  providers: ProviderProfile[];
  onSave: (profile: ProviderProfile) => void;
  onCancel: () => void;
};

export const ProviderProfileForm = ({ provider, editProfile, providers, onSave, onCancel }: Props) => {
  const { t } = useTranslation();

  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [parameters, setParameters] = useState<LlmProvider | null>(null);
  const [headers, setHeaders] = useState<Header[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

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

    const headersObject = headers.reduce(
      (acc, h) => {
        if (h.key) {
          acc[h.key] = h.value;
        }
        return acc;
      },
      {} as Record<string, string>,
    );

    const finalProfile: ProviderProfile = {
      id,
      name,
      provider: parameters,
      headers: headersObject,
    };
    onSave(finalProfile);
  };

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
        <div className="flex justify-end space-x-4 mt-8">
          <Button onClick={onCancel} variant="text">
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave}>{t('common.save')}</Button>
        </div>
      </div>
    </div>
  );
};

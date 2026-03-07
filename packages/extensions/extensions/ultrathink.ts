/**
 * Ultrathink Extension
 *
 * Automatically increases reasoning effort when the prompt contains trigger phrases
 * like 'ultrathink', 'think hard', etc. Works with OpenAI and OpenAI-compatible providers.
 *
 * - Models ending with '-max' get 'xhigh' reasoning effort
 * - Other models get 'high' reasoning effort
 */

import type { Extension, ExtensionContext, AgentStartedEvent } from '@aiderdesk/extensions';

const TRIGGER_PHRASES = ['ultrathink', 'think hard', 'think deeply', 'think carefully', 'think thoroughly', 'extra thinking', 'deep think'];

const SUPPORTED_PROVIDERS = ['openai', 'openai-compatible'];

export default class UltrathinkExtension implements Extension {
  static metadata = {
    name: 'Ultrathink Extension',
    version: '1.0.0',
    description: 'Automatically increases reasoning effort when prompts contain thinking-related trigger phrases',
    author: 'wladimiiir',
    capabilities: ['optimization'],
  };

  async onLoad(context: ExtensionContext) {
    context.log('Ultrathink Extension loaded', 'info');
  }

  async onAgentStarted(event: AgentStartedEvent, context: ExtensionContext): Promise<void | Partial<AgentStartedEvent>> {
    const prompt = event.prompt?.toLowerCase() ?? '';
    const providerName = event.providerProfile.provider.name;

    if (!SUPPORTED_PROVIDERS.includes(providerName)) {
      return undefined;
    }

    const hasTriggerPhrase = TRIGGER_PHRASES.some((phrase) => prompt.includes(phrase));
    if (!hasTriggerPhrase) {
      return undefined;
    }

    const model = event.model.toLowerCase();
    const reasoningEffort = model.endsWith('-max') ? 'xhigh' : 'high';

    context.log(`Ultrathink triggered: setting reasoningEffort to '${reasoningEffort}' for model '${event.model}'`, 'info');

    return {
      providerProfile: {
        ...event.providerProfile,
        provider: {
          ...event.providerProfile.provider,
          name: providerName as any,
          reasoningEffort: reasoningEffort as any,
        },
      },
    };
  }
}

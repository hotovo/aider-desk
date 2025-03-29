// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const migrateSettingsV0toV1 = (settings: any): any => {
  let mcpConfig = settings.mcpConfig;

  if (typeof mcpConfig?.provider === 'string') {
    // Create base providers array
    const providers = [
      {
        name: 'openai',
        apiKey: mcpConfig.openAiApiKey || '',
        model: 'gpt-4o-mini',
        active: mcpConfig.provider === 'openai',
      },
      {
        name: 'anthropic',
        apiKey: mcpConfig.anthropicApiKey || '',
        model: 'claude-3-7-sonnet-20250219',
        active: mcpConfig.provider === 'anthropic',
      },
      {
        name: 'gemini',
        apiKey: mcpConfig.geminiApiKey || '',
        model: 'gemini-2.0-flash',
        active: mcpConfig.provider === 'gemini',
      },
    ];

    mcpConfig = {
      ...mcpConfig,
      providers,
      provider: undefined,
      openAiApiKey: undefined,
      anthropicApiKey: undefined,
      geminiApiKey: undefined,
    };

    settings = {
      ...settings,
      mcpConfig: mcpConfig,
    };
  }

  settings = {
    ...settings,
    mcpConfig: {
      ...settings.mcpConfig,
      systemPrompt: `You can use tools available to get context related to the user input. Do NOT force any tools, if not specifically mentioned to use some tool.

IMPORTANT RULE FOR 'aider' TOOL:
- The 'aider' tool is SPECIFICALLY for performing coding tasks on various programming languages.
- STRICTLY FORBIDDEN: Do NOT mention ANY programming language names (like Python, JavaScript, Java, C++, etc.) in the prompt.
- Do NOT reference language-specific features, libraries, or syntax in the prompt.
- When a coding task is required, use the Aider tool as the FINAL response, when no other tool is available to perform such task.
- Do NOT use Aider tool when there is other tool that can perform the coding task.
- After using the Aider tool, NO further responses are allowed.
- The Aider tool's prompt should contain the complete instructions for the coding task based on the user input.
- Do NOT suggest implementation details specific to any programming language.
- Do NOT post any code with the task - use only natural language to describe task if not mentioned in the user input.

Never ask any additional questions.`,
    },
  };

  return settings;
};

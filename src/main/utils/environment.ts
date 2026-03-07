import fs from 'fs';
import path from 'path';

import { parse } from '@dotenvx/dotenvx';
import YAML from 'yaml';
import { DEFAULT_AGENT_PROFILE, DEFAULT_AIDER_MAIN_MODEL, DEFAULT_PROVIDER_MODELS } from '@common/agent';
import { EnvironmentVariable, Model, ProjectSettings, ProviderProfile, SettingsData } from '@common/types';

import logger from '@/logger';
import { getLangfuseEnvironmentVariables } from '@/telemetry';
import { Store } from '@/store';

const readEnvFile = (filePath: string): Record<string, string> | null => {
  try {
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const parsed = parse(fileContent);
      logger.debug(`Loaded environment variables from ${filePath}`);
      return parsed;
    }
  } catch (error) {
    logger.warn(`Failed to read or parse env file: ${filePath}`, error);
  }
  return null;
};

const readPropertyFromConfFile = (filePath: string, property: string): string | undefined => {
  try {
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const config = YAML.parse(fileContent);
      if (config && typeof config === 'object' && property in config) {
        return config[property] as string;
      }
    }
  } catch (e) {
    logger.warn(`Failed to read or parse .aider.conf.yml at ${filePath} for property '${property}':`, e);
  }
  return undefined;
};

const readApiKeyFromConfFile = (filePath: string, envVarName: string): string | undefined => {
  try {
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const config = YAML.parse(fileContent);
      if (config && typeof config === 'object' && 'api-key' in config) {
        const apiKeyValue = config['api-key'];

        // Map environment variable names to provider names used in api-key property
        // GOOGLE_API_KEY maps to 'gemini' in the api-key property
        const envVarToProviderName: Record<string, string[]> = {
          GOOGLE_API_KEY: ['gemini', 'google'],
          OPENAI_API_KEY: ['openai'],
          ANTHROPIC_API_KEY: ['anthropic', 'anthropic-compatible'],
          GROQ_API_KEY: ['groq'],
          ALIBABA_PLAN_API_KEY: ['alibaba-plan'],
          KIMI_PLAN_API_KEY: ['kimi-plan'],
          DEEPSEEK_API_KEY: ['deepseek'],
          OPENROUTER_API_KEY: ['openrouter'],
          CEREBRAS_API_KEY: ['cerebras'],
          OPENCODE_API_KEY: ['opencode'],
          REQUESTY_API_KEY: ['requesty'],
          SYNTHETIC_API_KEY: ['synthetic'],
        };

        const providerNames = envVarToProviderName[envVarName] || [envVarName.replace(/_API_KEY$/, '').toLowerCase()];

        // Normalize apiKeyValue to array for unified processing
        const apiKeys = Array.isArray(apiKeyValue) ? apiKeyValue : [apiKeyValue];

        for (const item of apiKeys) {
          if (typeof item === 'string') {
            for (const providerName of providerNames) {
              const match = item.match(new RegExp(`^${providerName}=(.+)$`, 'i'));
              if (match) {
                logger.debug(`Found API key for ${envVarName} using provider name '${providerName}' in ${filePath}`);
                return match[1];
              }
            }
          }
        }
      }
    }
  } catch (e) {
    logger.warn(`Failed to read or parse api-key from .aider.conf.yml at ${filePath}:`, e);
  }
  return undefined;
};

export const getEffectiveEnvironmentVariable = (key: string, settings?: SettingsData, projectDir?: string): EnvironmentVariable | undefined => {
  // 1. From settings.aider.environmentVariables
  if (settings) {
    const aiderEnvVars = parse(settings.aider.environmentVariables);
    if (aiderEnvVars[key] !== undefined) {
      return {
        value: aiderEnvVars[key],
        source: 'Settings -> Aider -> Env Vars',
      };
    }

    // 2. From --env-file in settings.aider.options
    const envFileMatch = settings.aider.options.match(/--(?:env|env-file)\s+([^\s]+)/);
    if (envFileMatch && envFileMatch[1]) {
      const envFilePath = envFileMatch[1];
      const envFileVars = readEnvFile(envFilePath);
      if (envFileVars && envFileVars[key] !== undefined) {
        return { value: envFileVars[key], source: envFilePath };
      }
    }
  }

  const kebabCaseKey = key.toLowerCase().replace(/_/g, '-');

  if (projectDir) {
    // 3. from `env-file` in $projectDir/.aider.conf.yml
    const projectAiderConfPath = path.join(projectDir, '.aider.conf.yml');
    const envFileFromConf = readPropertyFromConfFile(projectAiderConfPath, 'env-file');
    if (envFileFromConf) {
      const resolvedPath = path.isAbsolute(envFileFromConf) ? envFileFromConf : path.join(projectDir, envFileFromConf);
      const envFileVars = readEnvFile(resolvedPath);
      if (envFileVars && envFileVars[key] !== undefined) {
        return { value: envFileVars[key], source: resolvedPath };
      }
    }

    // 4. from $projectDir/.env
    const projectEnvPath = path.join(projectDir, '.env');
    const projectEnvVars = readEnvFile(projectEnvPath);
    if (projectEnvVars && projectEnvVars[key] !== undefined) {
      return { value: projectEnvVars[key], source: projectEnvPath };
    }

    // 5. from api-key property in $projectDir/.aider.conf.yml
    const projectApiKey = readApiKeyFromConfFile(projectAiderConfPath, key);
    if (projectApiKey !== undefined) {
      return { value: projectApiKey, source: projectAiderConfPath };
    }

    // 6. from kebab-case property in $projectDir/.aider.conf.yml
    const projectKebabValue = readPropertyFromConfFile(projectAiderConfPath, kebabCaseKey);
    if (projectKebabValue !== undefined) {
      return { value: projectKebabValue, source: projectAiderConfPath };
    }
  }

  // Home dir related checks
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (homeDir) {
    // 7. from `env-file` in $HOME/.aider.conf.yml
    const homeAiderConfPath = path.join(homeDir, '.aider.conf.yml');
    const envFileFromConf = readPropertyFromConfFile(homeAiderConfPath, 'env-file');
    if (envFileFromConf) {
      const resolvedPath = path.isAbsolute(envFileFromConf) ? envFileFromConf : path.join(homeDir, envFileFromConf);
      const envFileVars = readEnvFile(resolvedPath);
      if (envFileVars && envFileVars[key] !== undefined) {
        return { value: envFileVars[key], source: resolvedPath };
      }
    }

    // 8. from $HOME/.env
    const homeEnvPath = path.join(homeDir, '.env');
    const homeEnvVars = readEnvFile(homeEnvPath);
    if (homeEnvVars && homeEnvVars[key] !== undefined) {
      return { value: homeEnvVars[key], source: homeEnvPath };
    }

    // 9. from api-key property in $HOME/.aider.conf.yml
    const homeApiKey = readApiKeyFromConfFile(homeAiderConfPath, key);
    if (homeApiKey !== undefined) {
      return { value: homeApiKey, source: homeAiderConfPath };
    }

    // 10. from kebab-case property in $HOME/.aider.conf.yml
    const homeKebabValue = readPropertyFromConfFile(homeAiderConfPath, kebabCaseKey);
    if (homeKebabValue !== undefined) {
      return { value: homeKebabValue, source: homeAiderConfPath };
    }
  }

  // 11. From process.env
  if (process.env[key] !== undefined) {
    return { value: process.env[key] as string, source: 'process.env' };
  }

  // Not found
  return undefined;
};

export const parseAiderEnv = (settings: SettingsData): Record<string, string> => {
  // Parse Aider environment variables from settings
  const aiderEnvVars = parse(settings.aider.environmentVariables);
  const aiderOptions = settings.aider.options;
  let fileEnv: Record<string, string> | null = null;

  // Check for --env or --env-file in aider options
  const envFileMatch = aiderOptions.match(/--(?:env|env-file)\s+([^\s]+)/);
  if (envFileMatch && envFileMatch[1]) {
    const envFilePath = envFileMatch[1];
    try {
      const fileContent = fs.readFileSync(envFilePath, 'utf8');
      fileEnv = parse(fileContent);
      logger.debug(`Loaded environment variables from Aider env file: ${envFilePath}`);
    } catch (error) {
      logger.error(`Failed to read or parse Aider env file: ${envFilePath}`, error);
      return {};
    }
  }

  return {
    ...aiderEnvVars, // Start with settings env
    ...(fileEnv ?? {}), // Override with file env if it exists
  };
};

export const readAiderConfProperty = (baseDir: string, property: string): string | undefined => {
  const projectConfigPath = path.join(baseDir, '.aider.conf.yml');
  const projectProperty = readPropertyFromConfFile(projectConfigPath, property);
  if (projectProperty) {
    return projectProperty;
  }

  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (homeDir) {
    const homeConfigPath = path.join(homeDir, '.aider.conf.yml');
    const homeProperty = readPropertyFromConfFile(homeConfigPath, property);
    if (homeProperty) {
      return homeProperty;
    }
  }

  return undefined;
};

export const determineWeakModel = (baseDir: string): string | undefined => {
  return readAiderConfProperty(baseDir, 'weak-model');
};

export const determineMainModel = (settings: SettingsData, providers: ProviderProfile[], providerModels: Model[], baseDir: string): string => {
  // Check for --model in aider options
  const modelOptionIndex = settings.aider.options.indexOf('--model ');
  if (modelOptionIndex !== -1) {
    const modelStartIndex = modelOptionIndex + '--model '.length;
    let modelEndIndex = settings.aider.options.indexOf(' ', modelStartIndex);
    if (modelEndIndex === -1) {
      modelEndIndex = settings.aider.options.length;
    }
    const modelName = settings.aider.options.substring(modelStartIndex, modelEndIndex).trim();
    if (modelName) {
      return modelName;
    }
  }

  const projectModel = readAiderConfProperty(baseDir, 'model');
  if (projectModel) {
    return projectModel;
  }

  for (const provider of providers) {
    const models = providerModels.filter((model) => model.providerId === provider.id);
    const defaultModel = DEFAULT_PROVIDER_MODELS[provider.provider.name];
    if (defaultModel || models.length > 0) {
      return `${provider.id}/${defaultModel || models[0].id}`;
    }
  }

  // Default model if no other condition is met
  return DEFAULT_AIDER_MAIN_MODEL;
};

export const getEnvironmentVariablesForAider = (settings: SettingsData, baseDir: string): Record<string, unknown> => {
  return {
    ...parse(settings.aider.environmentVariables),
    ...getTelemetryEnvironmentVariablesForAider(settings, baseDir),
  };
};

const getTelemetryEnvironmentVariablesForAider = (settings: SettingsData, baseDir: string): Record<string, unknown> => {
  return {
    ...getLangfuseEnvironmentVariables(baseDir, settings),
  };
};

export const getDefaultProjectSettings = (
  store: Store,
  providerModels: Model[],
  baseDir: string,
  defaultAgentProfileId = DEFAULT_AGENT_PROFILE.id,
): ProjectSettings => {
  const openProjects = store.getOpenProjects();
  const activeProject = openProjects.find((p) => p.active);

  if (activeProject) {
    return {
      ...activeProject.settings,
    };
  }

  return {
    mainModel: determineMainModel(store.getSettings(), store.getProviders(), providerModels, baseDir),
    weakModel: determineWeakModel(baseDir),
    modelEditFormats: {},
    currentMode: 'agent',
    agentProfileId: defaultAgentProfileId,
    autoApproveLocked: false,
  };
};

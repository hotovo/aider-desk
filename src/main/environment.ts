import fs from 'fs';
import path from 'path';

import { parse } from '@dotenvx/dotenvx';
import YAML from 'yaml';
import { LlmProviderName } from '@common/agent';
import { SettingsData } from '@common/types';

import logger from './logger';

export const SONNET_MODEL = 'anthropic/claude-sonnet-4-20250514';
export const GEMINI_MODEL = 'gemini/gemini-2.5-pro';
export const OPEN_AI_DEFAULT_MODEL = 'openai/gpt-4.1';
export const DEEPSEEK_MODEL = 'deepseek/deepseek-chat';

export const DEFAULT_MAIN_MODEL = SONNET_MODEL;

export type EnvironmentVariable = {
  value: string | null;
  source: string | null;
};

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

export const getEffectiveEnvironmentVariable = (key: string, projectDir?: string, settings?: SettingsData): EnvironmentVariable | undefined => {
  // 1. From settings.aider.environmentVariables
  if (settings) {
    const aiderEnvVars = parse(settings.aider.environmentVariables);
    if (aiderEnvVars[key] !== undefined) {
      return { value: aiderEnvVars[key], source: 'aider-desk' };
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

    // 5. from kebab-case property in $projectDir/.aider.conf.yml
    const projectKebabValue = readPropertyFromConfFile(projectAiderConfPath, kebabCaseKey);
    if (projectKebabValue !== undefined) {
      return { value: projectKebabValue, source: projectAiderConfPath };
    }
  }

  // Home dir related checks
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (homeDir) {
    // 6. from `env-file` in $HOME/.aider.conf.yml
    const homeAiderConfPath = path.join(homeDir, '.aider.conf.yml');
    const envFileFromConf = readPropertyFromConfFile(homeAiderConfPath, 'env-file');
    if (envFileFromConf) {
      const resolvedPath = path.isAbsolute(envFileFromConf) ? envFileFromConf : path.join(homeDir, envFileFromConf);
      const envFileVars = readEnvFile(resolvedPath);
      if (envFileVars && envFileVars[key] !== undefined) {
        return { value: envFileVars[key], source: resolvedPath };
      }
    }

    // 7. from $HOME/.env
    const homeEnvPath = path.join(homeDir, '.env');
    const homeEnvVars = readEnvFile(homeEnvPath);
    if (homeEnvVars && homeEnvVars[key] !== undefined) {
      return { value: homeEnvVars[key], source: homeEnvPath };
    }

    // 8. from kebab-case property in $HOME/.aider.conf.yml
    const homeKebabValue = readPropertyFromConfFile(homeAiderConfPath, kebabCaseKey);
    if (homeKebabValue !== undefined) {
      return { value: homeKebabValue, source: homeAiderConfPath };
    }
  }

  // 9. From process.env
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

export const determineMainModel = (settings: SettingsData, baseDir: string): string => {
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

  const env = {
    ...process.env,
    ...parseAiderEnv(settings),
  };
  // Check environment variables in order
  if (env.ANTHROPIC_API_KEY) {
    return SONNET_MODEL;
  } else if (env.GEMINI_API_KEY) {
    return GEMINI_MODEL;
  } else if (env.OPENAI_API_KEY && !env.OPENAI_API_BASE) {
    return OPEN_AI_DEFAULT_MODEL;
  } else if (env.DEEPSEEK_API_KEY) {
    return DEEPSEEK_MODEL;
  } else if (env.OPENROUTER_API_KEY) {
    return 'openrouter/google/gemini-2.5-pro';
  }

  // Default model if no other condition is met
  return DEFAULT_MAIN_MODEL;
};

export const determineAgentProvider = (projectDir?: string, settings?: SettingsData): LlmProviderName | undefined => {
  if (getEffectiveEnvironmentVariable('ANTHROPIC_API_KEY', projectDir, settings)) {
    return 'anthropic';
  }
  if (getEffectiveEnvironmentVariable('GEMINI_API_KEY', projectDir, settings)) {
    return 'gemini';
  }
  if (getEffectiveEnvironmentVariable('OPENAI_API_KEY', projectDir, settings)) {
    return 'openai';
  }
  if (getEffectiveEnvironmentVariable('DEEPSEEK_API_KEY', projectDir, settings)) {
    return 'deepseek';
  }
  if (getEffectiveEnvironmentVariable('OPENROUTER_API_KEY', projectDir, settings)) {
    return 'openrouter';
  }
  if (getEffectiveEnvironmentVariable('REQUESTY_API_KEY', projectDir, settings)) {
    return 'requesty';
  }
  return undefined;
};

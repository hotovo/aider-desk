export enum SystemPromptPlaceholder {
  ProjectDir = 'projectDir',
  TaskDir = 'taskDir',
  CurrentDate = 'currentDate',
  OsName = 'osName',
  ProjectGitRootDirectory = 'projectGitRootDirectory',
}

export const SYSTEM_PROMPT_PLACEHOLDERS = Object.values(SystemPromptPlaceholder);

export const formatSystemPromptPlaceholder = (name: SystemPromptPlaceholder): string => `{{${name}}}`;

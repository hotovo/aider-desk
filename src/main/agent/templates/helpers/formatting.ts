import Handlebars from 'handlebars';

/**
 * Helper to indent text by specified number of spaces
 * Usage: {{indent text 4}}
 */
export const indent = (text: unknown, spaces: number = 2): string => {
  if (typeof text !== 'string') {
    return '';
  }
  const indentStr = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => (line ? indentStr + line : line))
    .join('\n');
};

/**
 * Helper to escape XML characters
 * Usage: {{xmlEscape text}}
 */
export const xmlEscape = (text: unknown): string => {
  if (typeof text !== 'string') {
    return '';
  }
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

/**
 * Helper to join array with separator
 * Usage: {{join items ", "}}
 */
export const join = (array: unknown[], separator: string = ', '): string => {
  if (!Array.isArray(array)) {
    return '';
  }
  return array.join(separator);
};

/**
 * Helper to capitalize first letter
 * Usage: {{capitalize text}}
 */
export const capitalize = (text: unknown): string => {
  if (typeof text !== 'string') {
    return '';
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * Helper to convert to kebab-case
 * Usage: {{kebabCase text}}
 */
export const kebabCase = (text: unknown): string => {
  if (typeof text !== 'string') {
    return '';
  }
  return text
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
};

/**
 * Helper to format tool names consistently
 * Usage: {{formatToolName "toolGroupName"}}
 */
export const formatToolName = (toolName: unknown): string => {
  if (typeof toolName !== 'string') {
    return '';
  }
  return toolName.replace(/([A-Z])/g, ' $1').trim();
};

/**
 * Helper to create XML comment
 * Usage: {{xmlComment "text"}}
 */
export const xmlComment = (text: unknown): string => {
  if (typeof text !== 'string') {
    return '';
  }
  return `<!-- ${text} -->`;
};

/**
 * Helper to create CDATA section
 * Usage: {{cdata text}}
 */
export const cdata = (text: unknown): string => {
  if (typeof text !== 'string') {
    return '';
  }
  return `<![CDATA[\n${text}\n]]>`;
};

export const registerFormattingHelpers = (): void => {
  Handlebars.registerHelper('indent', indent);
  Handlebars.registerHelper('xmlEscape', xmlEscape);
  Handlebars.registerHelper('join', join);
  Handlebars.registerHelper('capitalize', capitalize);
  Handlebars.registerHelper('kebabCase', kebabCase);
  Handlebars.registerHelper('formatToolName', formatToolName);
  Handlebars.registerHelper('xmlComment', xmlComment);
  Handlebars.registerHelper('cdata', cdata);
};

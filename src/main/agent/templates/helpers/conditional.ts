import Handlebars from 'handlebars';
import { ToolApprovalState } from '@common/types';

/**
 * Helper to check if any items in an array meet a condition
 * Usage: {{#ifAny items property="value"}}...{{/ifAny}}
 */
export const ifAny = (array: unknown[], options: Handlebars.HelperOptions): string => {
  if (!Array.isArray(array)) {
    return options.inverse(this);
  }

  const property = options.hash.property;
  const value = options.hash.value;

  const hasMatch = array.some((item) => {
    if (typeof item === 'object' && item !== null) {
      return (item as Record<string, unknown>)[property] === value;
    }
    return false;
  });
  return hasMatch ? options.fn(this) : options.inverse(this);
};

/**
 * Helper to check if all items in an array meet a condition
 * Usage: {{#ifAll items property="value"}}...{{/ifAll}}
 */
export const ifAll = (array: unknown[], options: Handlebars.HelperOptions): string => {
  if (!Array.isArray(array)) {
    return options.inverse(this);
  }

  const property = options.hash.property;
  const value = options.hash.value;

  const allMatch = array.every((item) => {
    if (typeof item === 'object' && item !== null) {
      return (item as Record<string, unknown>)[property] === value;
    }
    return false;
  });
  return allMatch ? options.fn(this) : options.inverse(this);
};

/**
 * Helper for simple equality comparison
 * Usage: {{#equals value1 value2}}...{{/equals}}
 */
export const equals = (value1: unknown, value2: unknown, options: Handlebars.HelperOptions): string => {
  return value1 === value2 ? options.fn(this) : options.inverse(this);
};

/**
 * Helper for negation
 * Usage: {{#not value}}...{{/not}}
 */
export const not = (value: unknown, options: Handlebars.HelperOptions): string => {
  return !value ? options.fn(this) : options.inverse(this);
};

/**
 * Helper to check if array includes value
 * Usage: {{#includes array value}}...{{/includes}}
 */
export const includes = (array: unknown[], value: unknown, options: Handlebars.HelperOptions): string => {
  return Array.isArray(array) && array.includes(value) ? options.fn(this) : options.inverse(this);
};

/**
 * Helper to check if tool is enabled in profile
 * Usage: {{#toolEnabled toolName}}...{{/toolEnabled}}
 */
export const toolEnabled = (toolName: string, options: Handlebars.HelperOptions): string => {
  const agentProfile = options.data.root.agentProfile;
  if (!agentProfile) {
    return options.inverse(this);
  }

  // Check various tool categories
  switch (toolName) {
    case 'aider':
      return agentProfile.useAiderTools ? options.fn(this) : options.inverse(this);
    case 'power':
      return agentProfile.usePowerTools ? options.fn(this) : options.inverse(this);
    case 'todo':
      return agentProfile.useTodoTools ? options.fn(this) : options.inverse(this);
    case 'subagents':
      return agentProfile.useSubagents ? options.fn(this) : options.inverse(this);
    default:
      return options.inverse(this);
  }
};

/**
 * Helper to get tool approval state
 * Usage: {{toolApproval "toolGroupName.toolName"}}
 */
export const toolApproval = (toolPath: string, options: Handlebars.HelperOptions): ToolApprovalState => {
  const agentProfile = options.data.root.agentProfile;
  if (!agentProfile || !agentProfile.toolApprovals) {
    return ToolApprovalState.Ask;
  }

  return agentProfile.toolApprovals[toolPath] || ToolApprovalState.Ask;
};

export const registerConditionalHelpers = (): void => {
  Handlebars.registerHelper('ifAny', ifAny);
  Handlebars.registerHelper('ifAll', ifAll);
  Handlebars.registerHelper('equals', equals);
  Handlebars.registerHelper('not', not);
  Handlebars.registerHelper('includes', includes);
  Handlebars.registerHelper('toolEnabled', toolEnabled);
  Handlebars.registerHelper('toolApproval', toolApproval);
};

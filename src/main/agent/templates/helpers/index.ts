import Handlebars from 'handlebars';

import { registerConditionalHelpers } from './conditional';
import { registerFormattingHelpers } from './formatting';

/**
 * Register all Handlebars helpers for prompt templates
 */
export const registerAllHelpers = (): void => {
  registerConditionalHelpers();
  registerFormattingHelpers();

  // Additional utility helpers can be registered here
  Handlebars.registerHelper('json', function (context: unknown) {
    return JSON.stringify(context, null, 2);
  });

  Handlebars.registerHelper('default', function (value: unknown, defaultValue: unknown) {
    return value !== undefined && value !== null ? value : defaultValue;
  });
};

export { Handlebars };

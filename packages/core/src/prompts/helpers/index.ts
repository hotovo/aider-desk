import { registerConditionalHelpers } from './conditional';
import { registerFileHelpers } from './file';
import { registerFormattingHelpers } from './formatting';

import logger from '@/logger';

export const registerAllHelpers = (): void => {
  logger.info('Registering all Handlebars helpers');
  registerConditionalHelpers();
  registerFileHelpers();
  registerFormattingHelpers();
};

import Handlebars from 'handlebars';
import { ToolApprovalState } from '@aider-desk/common/types';

export const registerConditionalHelpers = (): void => {
  Handlebars.registerHelper('equals', (v1, v2) => v1 === v2);
  Handlebars.registerHelper('not', (v) => !v);
  Handlebars.registerHelper('toolApprovalNotNever', (profile, toolPath) => {
    if (!profile?.toolApprovals) {
      return true;
    }
    return profile.toolApprovals[toolPath] !== ToolApprovalState.Never;
  });

  Handlebars.registerHelper('assign', function (varName, varValue, options) {
    if (!options.data.root) {
      options.data.root = {};
    }
    options.data.root[varName] = varValue;
  });

  Handlebars.registerHelper('increment', function (varName, options) {
    const root = options.data.root;
    if (root[varName] !== undefined) {
      root[varName]++;
    }
  });
};

import { transform } from 'sucrase';

type SucraseOptions = {
  transforms?: Array<'jsx' | 'typescript' | 'imports' | 'flow' | 'react-hot-loader' | 'jest'>;
  production?: boolean;
  [key: string]: unknown;
};

const REACT_IMPORT = 'import React from "react";';
const REACT_IMPORT_COMMENT = '//import React from "react";';

export const prependCode = (template: string): string => {
  return `${REACT_IMPORT}\nexport default ${template}`;
};

export const postpendCode = (transpiled: string): string => {
  return transpiled
    .replace('export default', 'export default (React)=>')
    .replace(REACT_IMPORT, REACT_IMPORT_COMMENT);
};

export const transpileJsxString = (template: string, options: SucraseOptions = {}): string => {
  const transforms = options.transforms || ['jsx', 'typescript'];
  const production = options.production !== undefined ? options.production : true;

  const prepended = prependCode(template);
  const result = transform(prepended, { transforms, production });
  return postpendCode(result.code);
};

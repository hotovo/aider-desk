import Handlebars from 'handlebars';

export const registerFormattingHelpers = (): void => {
  Handlebars.registerHelper('indent', (text, spaces) => {
    if (typeof text !== 'string') {
      return '';
    }
    const indentStr = ' '.repeat(spaces);
    return text
      .split('\n')
      .map((line) => (line ? indentStr + line : line))
      .join('\n');
  });

  Handlebars.registerHelper('cdata', (text) => {
    if (typeof text !== 'string') {
      return '';
    }
    return `<![CDATA[\n${text}\n]]>`;
  });
};

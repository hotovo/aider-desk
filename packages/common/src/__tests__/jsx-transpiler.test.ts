import { describe, it, expect } from 'vitest';

import { prependCode, postpendCode, transpileJsxString } from '../jsx-transpiler';

import React from 'react';

describe('prependCode', () => {
  it('should prepend React import and export default', () => {
    const result = prependCode('({ name }) => <div>{name}</div>');
    expect(result).toBe('import React from "react";\nexport default ({ name }) => <div>{name}</div>');
  });
});

describe('postpendCode', () => {
  it('should wrap export default as React factory and comment out React import', () => {
    const transpiled = 'import React from "react";\nexport default ({ name }) => React.createElement("div", null, name)';
    const result = postpendCode(transpiled);
    expect(result).toBe(
      '//import React from "react";\nexport default (React)=> ({ name }) => React.createElement("div", null, name)',
    );
  });
});

describe('transpileJsxString', () => {
  it('should transpile simple JSX to React.createElement calls', () => {
    const result = transpileJsxString('({ name }) => <div>{name}</div>');
    expect(result).toContain('React.createElement');
    expect(result).toContain('export default (React)=>');
    expect(result).not.toContain('\nimport React from "react";');
    expect(result).toContain('//import React from "react";');
  });

  it('should produce code that can be executed into a working component', () => {
    const result = transpileJsxString('({ name }) => <div>{name}</div>');
    const fn = new Function('React', result.replace('//import React from "react";\nexport default (React)=> ', 'return '));
    const Component = fn(React);
    const element = Component({ name: 'World' });
    expect(element.type).toBe('div');
    expect(element.props.children).toContain('World');
  });

  it('should produce code that supports React hooks', () => {
    const template = '() => { const [count, setCount] = React.useState(0); return <div>{count}</div>; }';
    const result = transpileJsxString(template);
    expect(result).toContain('React.useState');
    expect(result).toContain('React.createElement');
    expect(result).toContain('export default (React)=>');
  });

  it('should use production mode by default (no __self/__source)', () => {
    const result = transpileJsxString('() => <div>test</div>');
    expect(result).not.toContain('__self');
    expect(result).not.toContain('__source');
  });

  it('should include __self/__source when production is false', () => {
    const result = transpileJsxString('() => <div>test</div>', { production: false });
    expect(result).toContain('__self');
    expect(result).toContain('__source');
  });

  it('should handle TypeScript type annotations', () => {
    const template = '({ x }: { x: number }) => <div>{x}</div>';
    const result = transpileJsxString(template);
    expect(result).toContain('React.createElement');
    expect(result).not.toContain(': number');
  });
});

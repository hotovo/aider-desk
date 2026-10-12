import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { transpileJsxString } from '../../../../common/src/jsx-transpiler';

// Sanity check for the production transpilation path of the plan-review
// component: the RAW (unmodified) file contents must transpile into a module
// whose default export produces a callable component — the same two-step
// loading the renderer performs (StringToReactComponent). Behavioral coverage
// lives in inline-plan-review.test.ts.
describe('PlanReviewComponent transpilation', () => {
  it('transpiles into a module exporting a component that renders the plan', async () => {
    const jsx = readFileSync(join(__dirname, '../PlanReviewComponent.jsx'), 'utf-8');
    const transpiled = transpileJsxString(jsx);

    expect(transpiled).toBeTruthy();
    // Classic React runtime with the component exported from the arrow factory.
    expect(transpiled).toContain('export default (React)=>');

    const modulePath = resolve(tmpdir(), `plannotator-transpile-${process.pid}-${Date.now()}.mjs`);
    writeFileSync(modulePath, transpiled, 'utf-8');
    try {
      const loaded = (await import(pathToFileURL(modulePath).href)) as {
        default: (react: unknown) => (props: Record<string, unknown>) => { children?: unknown[] } | null;
      };
      const Component = loaded.default({
        createElement: (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]) => ({
          type,
          props,
          children,
        }),
        useState: (initial: unknown) => [initial, () => undefined],
        useCallback: (fn: unknown) => fn,
      });
      expect(typeof Component).toBe('function');

      const element = Component({
        data: { kind: 'plan', plan: 'XX' },
        message: null,
        ui: { Button: () => null, TextArea: () => null },
        executeExtensionAction: () => undefined,
      });

      expect(element).not.toBeNull();
      expect(JSON.stringify(element)).toContain('Plan Review');
      expect(JSON.stringify(element)).toContain('Approve');
    } finally {
      unlinkSync(modulePath);
    }
  });
});

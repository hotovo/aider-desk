import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

const newline = String.fromCharCode(10);
const projectDir = fileURLToPath(new URL('../../', import.meta.url));
const source = await readFile(new URL('../../node_modules/@legendapp/list/react.mjs', import.meta.url), 'utf8');
const patch = await readFile(new URL('../../patches/@legendapp+list+3.6.0.patch', import.meta.url), 'utf8');

const reversePatch = (input) => {
  const section = patch.split('diff --git a/node_modules/@legendapp/list/react.mjs ')[1];
  assert.ok(section, 'Missing react.mjs patch');
  let result = input;
  for (const hunk of section.split(/^@@.*@@.*$/m).slice(1)) {
    const lines = hunk.split(newline).filter((line) => [' ', '+', '-'].includes(line[0]));
    const before = lines
      .filter((line) => !line.startsWith('+'))
      .map((line) => line.slice(1))
      .join(newline);
    const after = lines
      .filter((line) => !line.startsWith('-'))
      .map((line) => line.slice(1))
      .join(newline);
    assert.ok(result.includes(after), 'Installed source does not match patch; run npm install first');
    result = result.replace(after, before);
  }
  return result;
};

const unpatched = reversePatch(source);
assert.ok(!source.includes('itemSizeFlipHistory'), 'Installed source still contains the faulty guard; reapply the repaired patch');
const flipGuard = [
  '    if (itemSizeFlipHistory.size > 1024) itemSizeFlipHistory.clear();',
  '    const flipHistory = itemSizeFlipHistory.get(itemKey);',
  '    if (flipHistory !== void 0 && (flipHistory.last === size || flipHistory.prev === size)) {',
  '      return 0;',
  '    }',
  '    itemSizeFlipHistory.set(itemKey, { prev: size, last: flipHistory !== void 0 ? flipHistory.prev : void 0 });',
].join(newline);
const baselineDeclaration = 'var lastContainerMeasureAt = /* @__PURE__ */ new WeakMap();';
const sizeUpdate = '    setSize(ctx, itemKey, size, notifyTotalSize);';
assert.equal(source.split(baselineDeclaration).length, 2, 'Missing deferral declaration');
assert.equal(source.split(sizeUpdate).length, 2, 'Ambiguous size-update insertion point');
const faulty = source
  .replace(baselineDeclaration, baselineDeclaration + newline + 'var itemSizeFlipHistory = /* @__PURE__ */ new Map();')
  .replace(sizeUpdate, flipGuard + newline + sizeUpdate);
const variants = { unpatched, 'flip-guard': faulty, patched: source };
const bundles = new Map();

for (const [name, variant] of Object.entries(variants)) {
  const instrumented = variant.replace(
    ['    updateItemSizesBatch(ctx, measurements);', '  }', '}', 'var typedForwardRef'].join(newline),
    [
      '    updateItemSizesBatch(ctx, measurements);',
      "    Object.defineProperty(window.legendListRepro, 'snapshot', {",
      '      configurable: true,',
      '      get: () => ({',
      "        known: ctx.state.sizesKnown.get('message-1'),",
      "        applied: ctx.state.sizes.get('message-1'),",
      '        totalSize: ctx.state.totalSize',
      '      })',
      '    });',
      '  }',
      '}',
      'var typedForwardRef',
    ].join(newline),
  );
  assert.notEqual(instrumented, variant, 'Missing measurement instrumentation point');
  const result = await build({
    absWorkingDir: projectDir,
    entryPoints: ['e2e/diagnostics/LegendListRepro.tsx'],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [
      {
        name: 'isolated-legend-list',
        setup: (builder) => {
          builder.onResolve({ filter: new RegExp('^@legendapp/list/react$') }, () => ({ path: name, namespace: 'legend-repro' }));
          builder.onLoad({ filter: /.*/, namespace: 'legend-repro' }, () => ({
            contents: instrumented,
            loader: 'js',
            resolveDir: projectDir,
          }));
        },
      },
    ],
  });
  bundles.set(name, result.outputFiles[0].text);
}

const server = createServer((request, response) => {
  const path = new URL(request.url ?? '/', 'http://localhost').pathname;
  if (path.endsWith('.js')) {
    const bundle = bundles.get(path.slice(1, -3));
    response.writeHead(bundle ? 200 : 404, {
      'Content-Type': 'application/javascript',
    });
    response.end(bundle ?? '');
  } else {
    const name = path.slice(1);
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<!doctype html><html><body><div id="root"></div><script src="/' + name + '.js"></script></body></html>');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
assert.ok(address && typeof address !== 'string');
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const results = [];
  for (const name of Object.keys(variants)) {
    for (const scenario of ['feedback', 'visibility', 'remount']) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto('http://127.0.0.1:' + address.port + '/' + name + '?scenario=' + scenario);
      await page.waitForFunction(() => !!window.legendListRepro?.snapshot);
      if (scenario === 'feedback') {
        await page
          .waitForFunction(() => window.legendListRepro?.updates === 80, null, {
            timeout: 3000,
          })
          .catch((error) => {
            assert.equal(error.name, 'TimeoutError');
          });
      } else if (scenario === 'visibility') {
        await page.evaluate(() => window.legendListRepro.setHidden(true));
        await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-repro-item]').closest('#root > div')).display === 'none');
        await page.evaluate(() => window.legendListRepro.refresh());
        await page.waitForFunction(() => window.legendListRepro.snapshot.known === 0);
        await page.evaluate(() => window.legendListRepro.setHidden(false));
        await page.waitForFunction(() => document.querySelector('[data-repro-item]')?.getBoundingClientRect().height === 800);
        await page.evaluate(() => window.legendListRepro.refresh());
        await page.waitForFunction(() => window.legendListRepro.snapshot.known === 800);
      } else {
        await page.evaluate(() => {
          delete window.legendListRepro.snapshot;
          window.legendListRepro.remount();
        });
        await page.waitForFunction(() => window.legendListRepro.snapshot?.known === 800);
      }
      if (name === 'patched' && scenario === 'feedback') {
        await page.waitForFunction(() => {
          const snapshot = window.legendListRepro.snapshot;
          const height = document.querySelector('[data-repro-item]')?.getBoundingClientRect().height;
          return snapshot.known === height && snapshot.applied === height && snapshot.totalSize === height;
        });
      }
      const state = await page.evaluate(() => ({
        updates: window.legendListRepro.updates,
        snapshot: window.legendListRepro.snapshot,
        actualHeight: document.querySelector('[data-repro-item]')?.getBoundingClientRect().height,
      }));
      results.push({ variant: name, scenario, errors, ...state });
      await page.close();
    }
  }
  console.log(JSON.stringify(results, null, 2));
  const findResult = (variant, scenario) => {
    const result = results.find((entry) => entry.variant === variant && entry.scenario === scenario);
    assert.ok(result, 'Missing reproduction result');
    return result;
  };
  const originalCrash = findResult('unpatched', 'feedback');
  assert.ok(
    originalCrash.errors.some((error) => error.includes('Maximum update depth exceeded')),
    'Unpatched baseline did not reproduce the crash',
  );
  for (const scenario of ['feedback', 'visibility', 'remount']) {
    const faulty = findResult('flip-guard', scenario);
    assert.deepEqual(faulty.errors, [], 'Faulty guard baseline crashed');
    assert.notEqual(faulty.snapshot.applied, faulty.actualHeight, 'Faulty guard baseline did not reproduce inconsistent sizing');
    const deferred = findResult('patched', scenario);
    assert.deepEqual(deferred.errors, [], 'Repaired patch crashed');
    assert.equal(deferred.snapshot.known, deferred.actualHeight, 'Known height differs from DOM');
    assert.equal(deferred.snapshot.applied, deferred.actualHeight, 'Applied height differs from DOM');
    assert.equal(deferred.snapshot.totalSize, deferred.actualHeight, 'Total height differs from DOM');
  }
  assert.equal(findResult('patched', 'feedback').updates, 80, 'Repaired patch did not complete the feedback sequence');
  for (const scenario of ['visibility', 'remount']) {
    const original = findResult('unpatched', scenario);
    assert.deepEqual(original.errors, []);
    assert.equal(original.snapshot.applied, original.actualHeight, 'Unpatched control failed to recover its size');
  }
  console.log('All reproduction assertions passed.');
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { build, createServer } from 'vite';
import { describe, expect, it, vi } from 'vitest';

import { rendererStartupPlugin } from '../../../../scripts/renderer-startup-plugin';

vi.unmock('node:fs');
vi.unmock('node:path');

describe('renderer startup development', () => {
  it('injects an external pre-React loader only into the main dev page', async () => {
    const server = await createServer({
      configFile: false,
      logLevel: 'silent',
      plugins: [rendererStartupPlugin()],
      server: { middlewareMode: true, watch: null, ws: false },
    });
    try {
      const html = await server.transformIndexHtml('/index.html', '<html><body><div id="startup" hidden></div></body></html>');
      expect(html).toContain('<script src="/@aiderdesk/startup.js"></script>');
      const progress = await server.transformIndexHtml('/progress.html', '<html><body>Progress</body></html>');
      expect(progress).not.toContain('/@aiderdesk/startup.js');
    } finally {
      await server.close();
    }
  });
});

describe('renderer startup build', () => {
  it('tracks only initial dependencies, defers styles, and leaves the progress window untouched', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'aiderdesk-startup-'));
    try {
      await writeFile(
        path.join(directory, 'index.html'),
        '<html><head></head><body><div id="startup"></div><script type="module" src="/main.js"></script></body></html>',
      );
      await writeFile(path.join(directory, 'progress.html'), '<html><body><script type="module" src="/progress.js"></script></body></html>');
      await writeFile(
        path.join(directory, 'main.js'),
        'import "./style.css"; import { value } from "./shared.js"; console.log(value); window.loadLater = () => import("./later.js");',
      );
      await writeFile(path.join(directory, 'progress.js'), 'import { value } from "./shared.js"; console.log(value);');
      await writeFile(path.join(directory, 'shared.js'), 'export const value = "shared dependency";');
      await writeFile(path.join(directory, 'later.js'), 'console.log("lazy module");');
      await writeFile(path.join(directory, 'style.css'), 'body { color: red; }');
      const result = await build({
        configFile: false,
        root: directory,
        base: './',
        logLevel: 'silent',
        plugins: [rendererStartupPlugin()],
        build: { write: false, rollupOptions: { input: { index: path.join(directory, 'index.html'), progress: path.join(directory, 'progress.html') } } },
      });
      if (Array.isArray(result) || !('output' in result)) {
        throw new Error('Expected a single output bundle');
      }
      const html = result.output.find((output) => output.fileName === 'index.html');
      const progress = result.output.find((output) => output.fileName === 'progress.html');
      const loader = result.output.find((output) => output.fileName.includes('startup-loader-'));
      if (html?.type !== 'asset' || progress?.type !== 'asset' || loader?.type !== 'asset') {
        throw new Error('Missing generated HTML or loader');
      }
      expect(String(html.source)).toContain('startup-loader-');
      expect(String(html.source)).not.toContain('type="module"');
      expect(String(html.source)).not.toContain('rel="stylesheet"');
      expect(String(html.source)).not.toContain('rel="modulepreload"');
      expect(String(progress.source)).toContain('type="module"');
      expect(String(progress.source)).not.toContain('startup-loader-');
      const config = JSON.parse(String(loader.source).match(/const startup = (.+);\n/)![1]) as {
        entry: string;
        styles: string[];
        assets: { file: string; size: number }[];
        translations: Record<string, { downloading: string }>;
      };
      expect(config.entry).toMatch(/^assets\/index-/);
      expect(config.styles).toHaveLength(1);
      expect(config.assets).toHaveLength(3);
      expect(config.assets.some((asset) => asset.file.includes('later-'))).toBe(false);
      expect(config.translations.de.downloading).toBeTruthy();
      for (const asset of config.assets) {
        const output = result.output.find((output) => output.fileName === asset.file)!;
        expect(asset.size).toBe(Buffer.byteLength(output.type === 'chunk' ? output.code : output.source));
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

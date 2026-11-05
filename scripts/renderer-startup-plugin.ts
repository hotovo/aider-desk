import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Plugin } from 'vite';

export const rendererStartupPlugin = (): Plugin => ({
  name: 'renderer-startup',
  enforce: 'post',
  configureServer(server) {
    server.middlewares.use('/@aiderdesk/startup.js', (_request, response) => {
      response.setHeader('Content-Type', 'application/javascript');
      response.setHeader('Cache-Control', 'no-store');
      response.end(readFileSync(resolve('src/renderer/startup-dev.js'), 'utf8'));
    });
  },
  transformIndexHtml(html, context) {
    if (!context.server || !html.includes('id="startup"')) {
      return;
    }
    return [{ tag: 'script', attrs: { src: '/@aiderdesk/startup.js' }, injectTo: 'body' }];
  },
  generateBundle: {
    order: 'post',
    handler(_options, bundle) {
      const html = bundle['index.html'];
      if (!html || html.type !== 'asset') {
        throw new Error('Missing renderer index.html');
      }
      const source = String(html.source);
      const script = source.match(/<script\b[^>]*type="module"[^>]*src="([^"]+)"[^>]*><\/script>/);
      if (!script) {
        throw new Error('Missing renderer entry script');
      }
      const entry = script[1].replace(/^\.\//, '');
      const files = new Set<string>();
      const visit = (file: string) => {
        if (files.has(file)) {
          return;
        }
        files.add(file);
        const chunk = bundle[file];
        if (chunk?.type === 'chunk') {
          chunk.imports.forEach(visit);
        }
      };
      visit(entry);
      const styles = [...source.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)].map((match) => match[1].replace(/^\.\//, ''));
      styles.forEach((file) => files.add(file));
      const assets = [...files].map((file) => {
        const output = bundle[file];
        if (!output) {
          throw new Error(`Missing startup asset: ${file}`);
        }
        return {
          file,
          size: Buffer.byteLength(output.type === 'chunk' ? output.code : output.source),
        };
      });
      const translations = Object.fromEntries(
        ['en', 'de', 'it', 'ko', 'ru', 'zh'].map((language) => {
          const locale = JSON.parse(readFileSync(resolve(`packages/common/src/locales/${language}.json`), 'utf8'));
          return [language, locale.startup];
        }),
      );
      const loader = readFileSync(resolve('src/renderer/startup-loader.js'), 'utf8');
      const reference = this.emitFile({
        type: 'asset',
        name: 'startup-loader.js',
        source: `(() => { const startup = ${JSON.stringify({ entry, styles, assets, translations })};\n${loader}\n})();`,
      });
      html.source = source
        .replace(script[0], '')
        .replace(/<link\b[^>]*rel="(?:stylesheet|modulepreload)"[^>]*>/g, '')
        .replace('</body>', `<script src="./${this.getFileName(reference)}" defer></script></body>`);
    },
  },
});

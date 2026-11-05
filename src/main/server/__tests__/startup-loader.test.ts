import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.unmock('node:fs');

const source = readFileSync('src/renderer/startup-loader.js', 'utf8');
const messages = {
  downloading: 'Downloading application…',
  starting: 'Starting application…',
  error: 'Unable to load AiderDesk.',
  retry: 'Try again',
};
let dom: JSDOM;

const setup = (fetcher = vi.fn().mockResolvedValue(new Response('1234567890')), url = 'https://example.com/', language?: string) => {
  dom = new JSDOM(
    '<div id="startup" hidden><span id="startup-status" hidden></span><div id="startup-progress-row"><progress id="startup-progress" max="100" value="0"></progress><span id="startup-percentage">0%</span></div><button id="startup-retry" hidden></button></div>',
    { url },
  );
  Object.defineProperty(dom.window.document, 'currentScript', { value: { src: new URL('./assets/startup-loader-abcdefgh.js', url).href } });
  if (language && url.startsWith('https:')) {
    dom.window.localStorage.setItem('i18nextLng', language);
  }
  const context = createContext({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    location: dom.window.location,
    get localStorage() {
      return dom.window.localStorage;
    },
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: fetcher,
    startup: {
      entry: 'assets/app-abcdefgh.js',
      styles: ['assets/app-abcdefgh.css'],
      assets: [{ file: 'assets/app-abcdefgh.js', size: 10 }],
      translations: { en: messages, de: { ...messages, downloading: 'Herunterladen…' } },
    },
  });
  runInContext(`(() => { ${source} })()`, context);
  return fetcher;
};
const status = () => dom.window.document.getElementById('startup-status')!;
const scripts = () => dom.window.document.querySelectorAll('script[type="module"]');

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  dom.window.close();
  vi.useRealTimers();
});

describe('development startup loader', () => {
  it.each([false, true])('only reveals the loading screen for a browser (Electron: %s)', (electron) => {
    dom = new JSDOM('<div id="startup" hidden><progress id="startup-progress" value="0"></progress><span id="startup-percentage">0%</span></div>');
    const context = createContext({ window: { api: electron ? {} : undefined }, document: dom.window.document });
    runInContext(readFileSync('src/renderer/startup-dev.js', 'utf8'), context);
    const shell = dom.window.document.getElementById('startup');
    if (electron) {
      expect(shell).toBeNull();
    } else {
      expect(shell!.hidden).toBe(false);
      expect(dom.window.document.querySelector('progress')!.hasAttribute('value')).toBe(false);
      expect(dom.window.document.getElementById('startup-percentage')!.textContent).toBe('');
    }
  });
});

describe('pre-React startup loader', () => {
  it('shows real streamed byte progress before executing the application', async () => {
    let streamController: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        streamController = controller;
      },
    });
    const fetcher = setup(vi.fn().mockResolvedValue(new Response(stream)));
    await vi.advanceTimersByTimeAsync(0);
    expect(scripts()).toHaveLength(0);
    expect(dom.window.document.getElementById('startup')!.hidden).toBe(false);
    streamController!.enqueue(new Uint8Array(4));
    await vi.advanceTimersByTimeAsync(0);
    expect(dom.window.document.getElementById('startup-percentage')!.textContent).toBe('40%');
    expect(status().hidden).toBe(true);
    expect(status().textContent).toBe('');
    expect(dom.window.document.querySelector('progress')!.value).toBe(40);
    streamController!.enqueue(new Uint8Array(6));
    streamController!.close();
    await vi.advanceTimersByTimeAsync(0);
    expect(status().textContent).toBe(messages.starting);
    expect(scripts()[0].getAttribute('src')).toBe('https://example.com/assets/app-abcdefgh.js');
    expect(dom.window.document.querySelector('link')!.href).toBe('https://example.com/assets/app-abcdefgh.css');
    expect(dom.window.document.querySelector('progress')!.hasAttribute('value')).toBe(false);
    expect(fetcher).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ cache: 'force-cache', credentials: 'same-origin', mode: 'cors' }));
  });

  it('uses the stored language before React and i18next have loaded', () => {
    setup(vi.fn().mockReturnValue(new Promise(() => {})), 'https://example.com/', 'de-DE');
    expect(dom.window.document.querySelector('progress')!.getAttribute('aria-label')).toBe('Herunterladen…');
    expect(status().hidden).toBe(true);
  });

  it('loads Electron assets without showing the loading screen or starting a timeout', () => {
    const fetcher = setup(vi.fn(), 'file:///app/renderer/index.html');
    expect(fetcher).not.toHaveBeenCalled();
    expect(scripts()).toHaveLength(1);
    expect(scripts()[0].getAttribute('src')).toBe('file:///app/renderer/assets/app-abcdefgh.js');
    expect(dom.window.document.querySelector('link')!.href).toBe('file:///app/renderer/assets/app-abcdefgh.css');
    expect(dom.window.document.getElementById('startup')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([new Response('missing', { status: 404 }), new Response('unauthorized', { status: 401 })])('shows retry on an HTTP error', async (response) => {
    setup(vi.fn().mockResolvedValue(response));
    await vi.advanceTimersByTimeAsync(0);
    expect(status().textContent).toBe(messages.error);
    expect(dom.window.document.querySelector('button')!.hidden).toBe(false);
    expect(dom.window.document.getElementById('startup-progress-row')!.hidden).toBe(true);
    expect(status().hidden).toBe(false);
    expect(scripts()).toHaveLength(0);
  });

  it('shows retry on a failed connection', async () => {
    setup(vi.fn().mockRejectedValue(new TypeError('Network error')));
    await vi.advanceTimersByTimeAsync(0);
    expect(status().textContent).toBe(messages.error);
  });

  it('aborts stalled downloads instead of leaving a frozen progress bar', async () => {
    const fetcher = setup(vi.fn().mockReturnValue(new Promise(() => {})));
    await vi.advanceTimersByTimeAsync(60000);
    expect(status().textContent).toBe(messages.error);
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it('shows retry on a module load error', async () => {
    setup();
    await vi.advanceTimersByTimeAsync(0);
    scripts()[0].dispatchEvent(new dom.window.Event('error'));
    expect(status().textContent).toBe(messages.error);
  });

  it('clears the startup timeout once React signals readiness', async () => {
    setup();
    await vi.advanceTimersByTimeAsync(0);
    dom.window.dispatchEvent(new dom.window.Event('aiderdesk:ready'));
    await vi.advanceTimersByTimeAsync(90000);
    expect(status().textContent).toBe(messages.starting);
  });

  it('shows retry if application initialization stalls', async () => {
    setup();
    await vi.advanceTimersByTimeAsync(90000);
    expect(status().textContent).toBe(messages.error);
  });
});

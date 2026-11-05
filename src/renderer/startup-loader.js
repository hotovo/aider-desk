const shell = document.getElementById('startup');
const status = document.getElementById('startup-status');
const progress = document.getElementById('startup-progress');
const progressRow = document.getElementById('startup-progress-row');
const percentage = document.getElementById('startup-percentage');
const retry = document.getElementById('startup-retry');
const base = new URL('../', document.currentScript.src);
let language;
try {
  language = localStorage.getItem('i18nextLng');
} catch {
  language = null;
}
const candidates = [language, ...(navigator.languages || [navigator.language])].filter(Boolean);
const selected = candidates.map((value) => value.split('-')[0]).find((value) => startup.translations[value]);
const messages = startup.translations[selected || 'en'];
progress.setAttribute('aria-label', messages.downloading);
retry.textContent = messages.retry;
retry.addEventListener('click', () => location.reload());
const controller = new AbortController();
let startupTimeout;
let failed = false;
const fail = () => {
  if (!shell.isConnected || failed) {
    return;
  }
  failed = true;
  controller.abort();
  clearTimeout(startupTimeout);
  status.textContent = messages.error;
  status.hidden = false;
  progressRow.hidden = true;
  retry.hidden = false;
};
window.addEventListener('aiderdesk:ready', () => clearTimeout(startupTimeout), {
  once: true,
});
const startApplication = () => {
  status.textContent = messages.starting;
  status.hidden = false;
  percentage.textContent = '';
  progress.removeAttribute('value');
  if (shell.isConnected) {
    startupTimeout = setTimeout(fail, 90000);
  }
  for (const file of startup.styles) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.crossOrigin = 'anonymous';
    link.href = new URL(file, base).href;
    link.onerror = fail;
    document.head.appendChild(link);
  }
  const script = document.createElement('script');
  script.type = 'module';
  script.crossOrigin = 'anonymous';
  script.src = new URL(startup.entry, base).href;
  script.onerror = fail;
  document.head.appendChild(script);
};
const download = async () => {
  const total = startup.assets.reduce((sum, asset) => sum + asset.size, 0);
  let loaded = 0;
  const update = (bytes) => {
    loaded += bytes;
    const percent = Math.min(100, Math.floor((loaded / total) * 100));
    progress.value = percent;
    percentage.textContent = `${percent}%`;
  };
  await Promise.all(
    startup.assets.map(async (asset) => {
      let timeout;
      const resetTimeout = () => {
        clearTimeout(timeout);
        timeout = setTimeout(fail, 60000);
      };
      resetTimeout();
      try {
        // Match module/style requests so they reuse these downloads from the HTTP cache.
        const response = await fetch(new URL(asset.file, base), {
          credentials: 'same-origin',
          mode: 'cors',
          cache: 'force-cache',
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Startup download failed: ${response.status}`);
        }
        if (response.body) {
          const reader = response.body.getReader();
          while (true) {
            const result = await reader.read();
            if (result.done) {
              break;
            }
            // Streams expose decoded bytes, matching the build's uncompressed asset sizes.
            update(result.value.byteLength);
            resetTimeout();
          }
        } else {
          update((await response.arrayBuffer()).byteLength);
        }
      } finally {
        clearTimeout(timeout);
      }
    }),
  );
  if (!failed) {
    startApplication();
  }
};
if (location.protocol === 'file:') {
  shell.remove();
  startApplication();
} else {
  shell.hidden = false;
  download().catch(fail);
}

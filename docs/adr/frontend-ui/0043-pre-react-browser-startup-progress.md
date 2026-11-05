# ADR-0043: Pre-React Browser Startup Progress

## Status

Accepted (2026-11-05)

## Context

Browser and mobile-wrapper clients load the same renderer as Electron, but remote connections can spend significant time downloading JavaScript before React can render anything. A React loading component cannot cover that interval. Electron loads packaged assets locally and should not flash a remote-download loading screen.

The startup implementation spans `src/renderer/index.html`, `scripts/renderer-startup-plugin.ts`, `src/renderer/startup-loader.js`, and `src/main/server/renderer-assets.ts`. Development uses Vite's module graph rather than a production bundle, so the two serving modes cannot report progress in the same way.

## Decision Drivers

- **Must** provide browser loading feedback before React and the main stylesheet load.
- **Must** distinguish downloaded bytes from JavaScript execution and application initialization; percentages must not imply overall application readiness.
- **Must** preserve Electron startup, existing authentication, the content security policy, and streaming API responses.
- **Should** reuse browser HTTP caching rather than add a second persistent asset cache.
- **Should** reduce transfer size and keep the loading shell independent of application fonts and dependencies.

## Considered Options

### Option A — React-only loading indicator

- **Pros**: Fits existing component and localization patterns.
- **Cons**: Cannot appear until the renderer bundle has downloaded and executed, missing the interval that needs feedback.

### Option B — Lightweight HTML shell with a generated bootstrap loader

- **Pros**: Appears before React, supports byte-based production download progress, and retains normal module execution and HTTP caching.
- **Cons**: Requires a small build plugin and separate development behavior; cache reuse depends on matching requests and server headers.

### Option C — Service-worker interception and asset caching

- **Pros**: Could centralize fetch tracking and support offline caching.
- **Cons**: Adds first-install, activation, invalidation, and request-interception complexity. It also conflicts with the current pass-through network design: even forwarding intercepted requests adds a service-worker round trip and can amplify transient network failures.

## Decision

Use a dependency-free, pre-React loading shell for browser clients, with build-generated startup asset metadata and streamed downloads in production. Skip the shell in Electron, use indeterminate feedback for development browsers, and optimize production delivery through renderer minification, static compression, and HTTP caching without service-worker fetch interception.

### Production browser startup

1. `index.html` contains the initially hidden shell, inline styles, a small WebP app icon, a progress bar, and a fixed-width percentage slot. It does not need the React bundle or app fonts to render.
2. `rendererStartupPlugin()` runs after Vite generates the production bundle. It collects the main entry's static JavaScript dependencies, linked stylesheets, and uncompressed byte sizes. Dynamic imports are excluded. It embeds startup translations from all supported locale files in a small external loader, replacing the main page's eager module, stylesheet, and module-preload tags. The separate progress-window entry is left intact.
3. `startup-loader.js` reveals the shell and streams the startup assets with same-origin credentials, CORS mode, and `cache: 'force-cache'`. Progress compares decoded response bytes against build-time uncompressed sizes, not `Content-Length`, which can describe compressed transfer bytes.
4. After downloads finish, the loader adds normal module and stylesheet elements, using anonymous CORS to align their requests with the tracked downloads. It clears the percentage and shows indeterminate feedback with the localized starting message while the application initializes.
5. `App.tsx` calls `finishStartup()` once browser bootstrap loading settles. This removes the shell and dispatches `aiderdesk:ready`; it does not mean every settings request or lazy feature has loaded. `AppErrorBoundary` also removes the shell so it cannot obscure the React crash fallback.

The loader offers reload-based retry on download or resource-load failures, after 60 seconds without download activity, or after 90 seconds waiting for application startup. Startup strings come from the existing locale files; language selection uses the stored i18next language, browser preferences, and English fallback.

### Electron and development

- **Packaged Electron (`file://`)**: keep the shell hidden from the initial HTML, remove it before starting the application, skip HTTP download tracking, and load local module/style assets without a loading-screen timeout.
- **Development browser (`npm run dev`)**: the plugin injects an external script served at `/@aiderdesk/startup.js` with `no-store`. `startup-dev.js` reveals an indeterminate bar without a fabricated percentage. Vite continues loading modules normally; this path does not provide the production loader's retry or timeout handling.
- **Development Electron**: use the preload-provided `window.api` to distinguish Electron from browsers even though both use the HTTP dev server. Remove the shell instead of showing it.

### Asset delivery

`electron.vite.config.ts` enables esbuild renderer minification. After API routes and the existing access middleware, `server-controller.ts` mounts `serveRendererAssets()` for production static delivery. Its compression middleware therefore does not wrap already-handled API event streams.

Hashed assets receive `Cache-Control: private, max-age=31536000, immutable`; other static files, including the HTML and service worker, receive `no-cache` for revalidation. Private caching avoids explicitly permitting shared caches to retain authenticated assets. The service worker in `src/renderer/public/sw.js` remains limited to PWA lifecycle support: no fetch interception and no asset cache.

## Rationale

The HTML shell covers the otherwise blank interval without pulling React, theme styles, or fonts into the critical path. Generated sizes keep the percentage tied to the emitted assets, including when compression changes transfer size. Normal module execution avoids reconstructing module graphs through blobs or weakening the content security policy. HTTP cache reuse avoids deliberately downloading the same startup assets again for execution.

Development modules do not have a stable aggregate download size, and local Electron downloads do not justify a transient loading overlay. Treating these paths explicitly avoids misleading percentages and desktop startup flashes.

## Consequences

### Positive

- Remote clients receive feedback while the production renderer downloads, with localized failure/retry handling.
- Minification, compression, and immutable hashed-asset caching reduce transfer costs without changing API streaming behavior.
- Branding stays lightweight and independent of application fonts; Electron does not show an unnecessary startup overlay.

### Negative

- The loader adds a dependency on the generated HTML/asset structure and must evolve with Vite output changes.
- The percentage covers initial JavaScript and linked CSS only, not fonts, images, workers, lazy chunks, backend requests, parsing, or execution.
- Startup downloads complete before normal module execution begins, and main styles are intentionally deferred until that point.
- Development feedback is less detailed than production feedback.

### Risks & Mitigations

- Risk: cache policy or request-mode changes cause duplicate transfers — Mitigation: preserve aligned fetch/module/style request options and verify real network traffic after changes. Reuse was observed in Chromium; native mobile WebViews and proxy configurations still require device-specific validation.
- Risk: build changes omit dependencies or accidentally include lazy features — Mitigation: maintain build integration tests covering static imports, CSS, dynamic imports, and the separate progress window.
- Risk: the loader obscures a crash or remains visible indefinitely — Mitigation: retain production timeout/error handling and readiness cleanup, including the React error boundary. Failure to download the tiny bootstrap script itself is not covered by its retry handler.
- Risk: pre-React styling drifts from the app — Mitigation: treat the shell as an intentionally self-contained surface; it currently uses fixed colors, not the user's selected theme.

## Guardrails for Agents

### Do

- Keep the shell and bootstrap independent of React, app styles, fonts, and heavy dependencies.
- Derive production download totals from emitted startup assets; count decoded stream bytes against uncompressed sizes.
- Keep the shell hidden in the HTML until browser loading explicitly reveals it; preserve both the `file://` and dev `window.api` Electron exclusions.
- Preserve the fixed-width percentage slot and distinguish download completion from application initialization.
- Keep compression scoped after API handling and retain revalidation for HTML and non-hashed assets.
- Test production browser progress, stalled/failed requests, React readiness, dev browsers, and Electron independently. Check HTTP-cache reuse in a real browser when changing delivery behavior.

### Don't

- Do not show a simulated percentage for Vite development modules or JavaScript execution.
- Do not track all lazy chunks as required startup downloads.
- Do not add inline bootstrap JavaScript, blob-based module execution, or relax the content security policy for this loader.
- Do not introduce service-worker fetch interception or an offline cache as an incidental loading-screen change.
- Do not replace hashed asset names without updating their contents, cache policy, and startup metadata together.
- Do not claim that a successful React handoff proves the entire UI or backend is ready.

## Related Decisions

- [ADR-0002: Preload IPC Bridge and Shared API Contract](../core-architecture/0002-preload-ipc-bridge-and-api-contract.md) — preload detection and browser/Electron separation.
- [ADR-0020: Remote Access: Tunnel and Readonly Mode](../api-surface/0020-remote-access-tunnel-and-readonly-mode.md) — remote clients share the renderer and serving stack.
- [ADR-0023: Internationalization for All User-Facing Strings](0023-i18n-all-locales.md) — startup translations come from the existing locale resources.
- [ADR-0040: electron-vite Build System](../testing-tooling/0040-electron-vite-build-system.md) — refines renderer startup using a focused Vite plugin without changing the multi-target build system.

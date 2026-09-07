/**
 * Node-compatible servers for Plannotator Pi extension.
 *
 * Pi loads extensions via jiti (Node.js), so we can't use Bun.serve().
 * These are lightweight node:http servers implementing just the routes
 * each UI needs — plan review, code review, and markdown annotation.
 */

import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { StringDecoder } from "node:string_decoder";
import os from "node:os";
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, basename } from "node:path";

// ── Helpers ──────────────────────────────────────────────────────────────

// ── Request body parsing ──────────────────────────────────────────────────
// POST bodies are tiny JSON objects ({ feedback, reviewId } / { diffType }).
// The parser caps the accumulated payload and settles on request error,
// abort and inactivity timeout instead of hanging forever — previously an
// unbounded `data +=` let a peer exhaust memory, and a client that aborted
// mid-body or dribbled bytes kept the promise pending, which on the
// approve/deny/feedback endpoints permanently pinned the pending decision.
//
// The settle outcome DISTINGUISHES an interrupted request (error, client
// abort, connection closed without a body, inactivity timeout) from a
// successfully delivered empty body: an interrupted request carries no valid
// decision payload, so the approve/deny/feedback endpoints must NOT derive a
// decision from it — previously every interruption settled as `{}`, which
// resolved a pending review as approved/rejected out of thin air.

const MAX_BODY_BYTES = 64 * 1024; // far above any legitimate review payload
const BODY_TIMEOUT_MS = 10_000;

const normalizeFeedback = (value: unknown): string | undefined =>
  typeof value === "string" ? value.trim() : undefined;

interface ParsedBody {
  body: Record<string, unknown>;
  /** True when the payload exceeded MAX_BODY_BYTES and was discarded. */
  tooLarge: boolean;
  /** True when the request was interrupted (error, abort, close without a
   *  completed body, or inactivity timeout) — no valid payload was delivered
   *  and no decision may be derived from the (empty) body. */
  interrupted: boolean;
}

const parseBody = (req: IncomingMessage, res: ServerResponse): Promise<ParsedBody> => {
  return new Promise((resolve) => {
    // Accumulate as UTF-8 via StringDecoder instead of per-chunk
    // `chunk.toString()`: the default decoder would flush each chunk
    // independently, replacing a multi-byte character split across a network
    // chunk boundary with U+FFFD garbage and corrupting the payload.
    const decoder = new StringDecoder("utf-8");
    let data = "";
    let byteLength = 0;
    let settled = false;
    let tooLarge = false;

    const settle = (
      body: Record<string, unknown>,
      wasInterrupted = false,
    ): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      req.off("data", onData);
      req.off("end", onEnd);
      req.off("error", onError);
      req.off("aborted", onAborted);
      req.off("close", onClose);
      resolve({ body, tooLarge, interrupted: wasInterrupted });
    };

    const timeout = setTimeout(() => {
      settle({}, true);
      // Stop a slow-loris trickle: the endpoint gets an interrupted body.
      req.destroy();
    }, BODY_TIMEOUT_MS);
    timeout.unref?.();

    const onData = (chunk: Buffer | string): void => {
      if (settled) {
        return;
      }
      // StringDecoder buffers incomplete trailing multi-byte sequences until
      // the next chunk (or end) arrives, preserving exact UTF-8 text.
      data += decoder.write(chunk);
      // Enforce the cap by UTF-8 byte length, not JS character length: a
      // multibyte payload can stay under the character budget while exceeding
      // the byte budget (Buffer.byteLength handles both string and Buffer).
      byteLength += Buffer.byteLength(chunk);
      if (byteLength > MAX_BODY_BYTES) {
        tooLarge = true;
        settle({}); // payload dropped; the endpoint rejects with 413
        // Stop reading and holding the socket: drain (discard) the remainder
        // so backpressure cannot park data, and tear the connection down once
        // the 413 error response has been fully sent. Without this an
        // oversized request can retain its connection indefinitely
        // (audit: oversized bodies leave the socket open).
        req.resume();
        res.once("finish", () => {
          req.destroy();
        });
      }
    };
    const onEnd = (): void => {
      if (settled) {
        return;
      }
      // Flush any incomplete trailing multi-byte sequence held by the decoder
      // (replaced per WHATWG spec) before parsing so a body ending mid-run is
      // handled by the malformed-JSON path rather than being dropped silently.
      data += decoder.end();
      try {
        const parsed: unknown = JSON.parse(data);
        settle(
          parsed !== null &&
            typeof parsed === "object" &&
            !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : {},
        );
      } catch {
        settle({});
      }
    };
    const onError = (): void => settle({}, true);
    const onAborted = (): void => settle({}, true);
    // 'close' also fires after a normal completion (settled guards the no-op)
    // and covers streams destroyed without an explicit 'end'/'error' event:
    // a close that gets here first means the stream died mid-body.
    const onClose = (): void => settle({}, true);

    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
    req.on("aborted", onAborted);
    req.on("close", onClose);
  });
};

const json = (
  res: ServerResponse,
  data: unknown,
  status = 200,
): void => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
};

const html = (res: ServerResponse, content: string): void => {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(content);
};

// ── Page-token authentication ───────────────────────────────────────────
// The review servers expose actionable endpoints (approve/deny/feedback) and
// sensitive content (plans, diffs). A per-server random token gates every
// /api request. The token is delivered OUT-OF-BAND via the URL fragment of
// the review URL (`...#token=...`): fragments are never sent to the server,
// so the HTML is served unauthenticated and does NOT contain the token. The
// bootstrap script reads the token from location.hash on page load and
// attaches it to every API fetch, while callers who merely know the base URL
// — or who fetch the HTML — cannot read data or resolve a pending review
// without the fragment-provided token.

const PAGE_TOKEN_HEADER = "x-plannotator-token";

const makePageToken = (): string => randomBytes(24).toString("hex");

/** Append the page token as a URL fragment (out-of-band, never sent to the server). */
const urlWithToken = (base: string, token: string): string =>
  `${base}#token=${token}`;

/**
 * Timing-safe token comparison: both the provided header and the expected
 * token are hashed to a fixed-length digest before comparing, so the
 * comparison runs in constant time over equal-length buffers regardless of
 * the provided value's length — no length or prefix early-exit can leak the
 * expected token through response timing.
 */
const isAuthorized = (req: IncomingMessage, token: string): boolean => {
  const provided = req.headers[PAGE_TOKEN_HEADER];
  if (typeof provided !== "string") {
    return false;
  }
  const providedHash = createHash("sha256").update(provided).digest();
  const expectedHash = createHash("sha256").update(token).digest();
  return timingSafeEqual(providedHash, expectedHash);
};

const unauthorized = (res: ServerResponse): void => {
  json(res, { error: "Unauthorized" }, 403);
};

const gateApi = (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  token: string,
): boolean => {
  if (url.pathname.startsWith("/api/") && !isAuthorized(req, token)) {
    unauthorized(res);
    return true;
  }
  return false;
};

// ── Request-handler containment ─────────────────────────────────────────
// The servers run INSIDE the AiderDesk main process. Two failure modes must
// never escape the request handler:
// 1. `new URL(req.url)` on a malformed request target (a hand-rolled client
//    can send `GET http:// HTTP/1.1` — the HTTP parser accepts it, the URL
//    constructor rejects it). Previously that rejection escaped the async
//    handler as an unhandled rejection and crashed the whole main process.
//    It must degrade to a 400 instead.
// 2. Any other unexpected error thrown inside an async handler. Previously
//    it became a floating unhandled rejection; it must become a logged 500.
// Additionally, an unhandled 'error' event on the server itself (EADDRINUSE,
// unexpected socket errors, ...) would throw synchronously — a listener is
// required to keep the server alive.

const safeParseRequestTarget = (rawUrl: string): URL | null => {
  try {
    return new URL(rawUrl, "http://localhost");
  } catch {
    return null;
  }
};

const logServerError = (message: string, error: unknown): void => {
  // No ExtensionContext is available inside the bare servers — use the module
  // console; the extension host captures it alongside task logs.
  console.error(`[plannotator] ${message}`, error);
};

type GatedHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
) => void | Promise<void>;

export const createGatedServer = (
  pageToken: string,
  handler: GatedHandler,
): Server => {
  const server = createServer((req, res) => {
    void (async () => {
      // Malformed request targets must yield 400, not an escapee TypeError.
      const url = safeParseRequestTarget(req.url ?? "/");
      if (!url) {
        json(res, { error: "Invalid request target" }, 400);
        return;
      }
      if (gateApi(req, res, url, pageToken)) {
        return;
      }
      await handler(req, res, url);
    })().catch((error) => {
      logServerError("request handler failed:", error);
      try {
        json(res, { error: "Internal server error" }, 500);
      } catch {
        // The response/socket is already gone — nothing else to do.
      }
    });
  });
  // Without this listener an 'error' event (e.g. EADDRINUSE) tears the
  // process down; log and keep serving unaffected connections instead.
  server.on("error", (error) => {
    logServerError("server error:", error);
  });
  return server;
};

const withTokenBootstrap = (htmlContent: string): string => {
  // The token arrives via the URL fragment (#token=...) and is never present
  // in the served HTML itself. The wrapped fetch attaches it ONLY to
  // same-origin requests (page-relative or same-origin absolute URLs and
  // Request objects) — cross-origin requests must never carry the page token.
  // Existing headers are preserved: when the init does not declare its own
  // headers, the input Request's headers are used as the basis, so wrapping
  // never drops caller-supplied headers.
  const script = `<script>(function(){var m=/[&#]token=([A-Za-z0-9_-]+)/.exec(location.hash||'');if(!m||!window.fetch)return;var T=m[1];var o=window.fetch.bind(window);window.fetch=function(i,x){var u=(i&&typeof i.url==='string')?i.url:String(i==null?'':i);var d=null;try{d=new URL(u,location.href)}catch(e){}if(!d||d.origin!==location.origin)return o(i,x);x=x?Object.assign({},x):{};var h=x.headers!==undefined?x.headers:(i&&i.headers?i.headers:undefined);x.headers=new Headers(h||{});x.headers.set('${PAGE_TOKEN_HEADER}',T);return o(i,x)};})();</script>`;
  const headMatch = htmlContent.match(/<head[^>]*>/i);
  if (headMatch?.index !== undefined) {
    const at = headMatch.index + headMatch[0].length;
    return htmlContent.slice(0, at) + script + htmlContent.slice(at);
  }
  return script + htmlContent;
};

const listenOnRandomPort = (server: Server): number => {
  server.listen(0);
  const addr = server.address() as { port: number };
  return addr.port;
};

/** Build an idempotent stop() for a review server: the command teardown and
 *  task-close/unload disposal may both call it, and close() on an
 *  already-closed server raises ERR_SERVER_NOT_RUNNING. */
const makeStop = (server: Server): (() => void) => {
  let stopped = false;
  return () => {
    if (stopped) {
      return;
    }
    stopped = true;
    server.close((error) => {
      if (error) {
        logServerError("error while closing review server:", error);
      }
    });
  };
};

/**
 * Validate a bare (unbracketed) IPv6 literal. Used to decide whether a
 * multi-colon host can safely be bracketed as an IPv6 literal; anything
 * malformed (too many groups, invalid hex groups, a second `::`, a bad
 * IPv4-mapped tail, ...) must never be emitted into a review URL.
 */
const isValidIpv6Literal = (host: string): boolean => {
  const hexGroup = /^[0-9a-fA-F]{1,4}$/;

  // Optional IPv4-mapped tail (`::ffff:192.168.0.1`): the dotted quad
  // occupies the last 32 bits (the final two groups).
  const v4Match = host.match(/^(.*):(\d{1,3}(?:\.\d{1,3}){3})$/);
  let v4Budget = 8;
  if (v4Match) {
    const octets = v4Match[2].split(".");
    if (!octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255)) {
      return false;
    }
    host = v4Match[1];
    v4Budget = 6;
  }

  const expand = (part: string): string[] | null => {
    if (part === "") {
      return [];
    }
    const groups = part.split(":");
    return groups.every((group) => hexGroup.test(group)) ? groups : null;
  };

  if (!host.includes("::")) {
    const groups = expand(host);
    return groups !== null && groups.length === v4Budget;
  }
  // Compressed form: at most one `::`, which must stand for at least one
  // group; no interior empty groups survive `expand`'s hex check.
  const split = host.split("::");
  if (split.length !== 2) {
    return false;
  }
  const head = expand(split[0]);
  const tail = expand(split[1]);
  if (head === null || tail === null) {
    return false;
  }
  return head.length + tail.length < v4Budget;
};

/**
 * Build the base URL for a plannotator HTTP server. In local/Electron use the
 * server is reached on the same machine (`localhost`), but when AiderDesk runs
 * as a remote/headless server the browser must be pointed at the server's
 * reachable host instead. `host` may be:
 * - a bare hostname/IP — gets `http://` plus the dynamic port appended
 *   (e.g. `localhost` → `http://localhost:41475`);
 * - a bare IPv6 literal — bracketed, plus the dynamic port
 *   (e.g. `::1` → `http://[::1]:41475`);
 * - a bare `host:port` (no scheme) — the explicit port is kept verbatim and
 *   no dynamic port is appended (e.g. `localhost:8080` → `http://localhost:8080`);
 * - a full origin — kept verbatim (origin-only), since these are typically
 *   reverse-proxied endpoints on a fixed port (80/443): appending the random
 *   review port would make the review UI unreachable.
 *
 * The review servers are served at the ORIGIN ROOT; no reverse-proxy path
 * prefix routing is supported. Any path/query/hash carried by the configured
 * host is therefore ignored — the emitted URL is always origin-only (the
 * documented origin-only fallback for path-prefixed hosts).
 *
 * Only `http://` / `https://` schemes are honored; anything else (or an empty
 * host) falls back to the default localhost endpoint so an unsafe or malformed
 * configured scheme can never reach the webview / overlay.
 */
export const buildServerUrl = (
  host: string | undefined,
  port: number,
): string => {
  const trimmed = host?.trim() || "localhost";
  // Guard against unsafe/unsupported scheme-like values (`javascript:...`,
  // `ftp://...`): only http/https are honored — anything else must never reach
  // the webview/overlay, so fall back to the default localhost endpoint.
  const schemeLike = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):(.+)$/);
  if (
    schemeLike &&
    !/^https?$/i.test(schemeLike[1]) &&
    !/^\d+([/?#].*)?$/.test(schemeLike[2])
  ) {
    return `http://localhost:${port}`;
  }
  const looksLikeUrl = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed);
  const base = looksLikeUrl
    ? trimmed
    : trimmed.replace(/\/+$/, "") || "localhost";
  if (looksLikeUrl && !/^https?:\/\//i.test(base)) {
    return `http://localhost:${port}`;
  }
  // Normalize bare input (hostname, IPv4, IPv6 literal, host:port, or values
  // carrying a path like `example.com/app`) to a scheme-prefixed URL, then
  // parse scheme / authority / path uniformly. The path is parsed only so the
  // authority extraction cannot be confused by delimiters — it is never echoed
  // (origin-only fallback, see the doc comment above).
  const withScheme = base.includes("://") ? base : `http://${base}`;
  const match = withScheme.match(
    /^([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^/?#]*)(.*)$/,
  );
  if (!match) {
    // Unparseable scheme/authority split — never echo the raw value into the
    // emitted review URL (which gets logged and opened in browsers/webviews).
    return `http://localhost:${port}`;
  }
  const [, scheme, authority] = match;
  // A backslash in the raw authority can splice userinfo-style tails
  // (`foo\@evil.com` strips to `evil.com` via lastIndexOf("@")), silently
  // redirecting the emitted review URL — and the page token in its
  // fragment — to an attacker origin. Reject the whole authority outright
  // (lastIndexOf-based stripping cannot be made backslash-safe).
  if (authority.includes(String.fromCharCode(92))) {
    return `http://localhost:${port}`;
  }
  // Strip userinfo (credentials) — they must never be echoed into the emitted
  // review URL (which gets logged and opened in browsers/webviews).
  const hostPart = authority.includes("@")
    ? authority.slice(authority.lastIndexOf("@") + 1)
    : authority;
  if (!hostPart) {
    // Empty authority (`https://`, user info only, ...): the review servers
    // are plain-HTTP, so an https scheme cannot be paired with the localhost
    // fallback — emit the default plain-HTTP endpoint instead.
    return `http://localhost:${port}`;
  }
  // Encoded or whitespace-bearing authorities are invalid input: percent-
  // escapes (`%65xample.com`) can smuggle delimiters (`@`, `:`, `/`) past this
  // validation when the URL is decoded by the consumer, and whitespace /
  // control characters can never appear inside a real authority. Never echo
  // such hostnames into the emitted review URL — fall back to the default
  // localhost endpoint instead.
  if (/[%\s\u0000-\u001f\u007f\u0080-\u009f\\]/.test(hostPart)) {
    return `http://localhost:${port}`;
  }
  // Bracketed IPv6 authority: keep an explicit port verbatim, else add one.
  // Checked first so `[::1]` never reaches the raw multi-colon logic below.
  // An unbalanced / empty / non-IPv6 bracket parse (or an out-of-range
  // explicit port) falls back to the default endpoint rather than emitting a
  // malformed URL.
  if (hostPart.startsWith("[")) {
    const bracketed = hostPart.match(/^\[([0-9a-fA-F:.]+)\](?::(\d+))?$/);
    if (bracketed) {
      if (bracketed[2]) {
        const parsedPort = parseInt(bracketed[2], 10);
        return parsedPort >= 1 && parsedPort <= 65535
          ? `${scheme}${hostPart}`
          : `http://localhost:${port}`;
      }
      // A full origin never gets the dynamic port appended (reverse-proxy
      // endpoints are already resolved on a fixed port). Bare input does.
      return looksLikeUrl
        ? `${scheme}[${bracketed[1]}]`
        : `${scheme}[${bracketed[1]}]:${port}`;
    }
    return `http://localhost:${port}`;
  }
  // Multiple colons in a bare (unbracketed) host → IPv6 literal (`::1`):
  // bracket it and add the port — but only if it is actually a valid IPv6
  // literal. Malformed multi-colon hosts (`a::b::c`, `1:2:3:4:5:6:7:8:9`,
  // `gg::1`, ...) must never be emitted as-is into a review URL: fall back
  // to the default localhost endpoint instead of producing a broken link.
  if (hostPart.split(":").length > 2) {
    if (!isValidIpv6Literal(hostPart)) {
      return `http://localhost:${port}`;
    }
    // Full origin → verbatim (no dynamic port); bare input → append the port.
    return looksLikeUrl
      ? `${scheme}[${hostPart}]`
      : `${scheme}[${hostPart}]:${port}`;
  }
  if (hostPart.startsWith(":") || hostPart.endsWith(":")) {
    // Malformed authority (empty host before the port, dangling colon, ...):
    // default endpoint instead of emitting a malformed URL.
    return `http://localhost:${port}`;
  }
  // Numeric `host:port` (userinfo already stripped) is already resolved:
  // verbatim host and explicit port, but only with a valid TCP port —
  // out-of-range ports cannot exist, so they fall back to the default endpoint.
  const explicitPort = hostPart.match(/[^:]+:(\d+)$/);
  if (explicitPort) {
    const parsedPort = parseInt(explicitPort[1], 10);
    return parsedPort >= 1 && parsedPort <= 65535
      ? `${scheme}${hostPart}`
      : `http://localhost:${port}`;
  }
  if (hostPart.includes(":")) {
    // Bare host whose single colon does not introduce a valid numeric port
    // (`localhost:8080x`, `foo:bar`) is a malformed non-IPv6 host: fall back
    // to the default endpoint instead of emitting a malformed URL.
    return `http://localhost:${port}`;
  }
  // A full origin (the input carried a scheme) is typically exposed through a
  // reverse proxy on a fixed port (80/443), so return it as-is — appending a
  // random plannotator port would make the review UI unreachable. Bare hosts
  // still get the dynamic review port appended. Either way the URL is
  // origin-only: path/query/hash and userinfo were already stripped above.
  if (looksLikeUrl) {
    return `${scheme}${hostPart}`;
  }
  return `${scheme}${hostPart}:${port}`;
};

// ── Version History (Node-compatible, duplicated from packages/server) ──

const sanitizeTag = (name: string): string | null => {
  if (!name || typeof name !== "string") {
    return null;
  }
  const sanitized = name
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
  return sanitized.length >= 2 ? sanitized : null;
};

const extractFirstHeading = (markdown: string): string | null => {
  const match = markdown.match(/^#\s+(.+)$/m);
  if (!match) {
    return null;
  }
  return match[1].trim();
};

const generateSlug = (plan: string): string => {
  const date = new Date().toISOString().split("T")[0];
  const heading = extractFirstHeading(plan);
  const slug = heading ? sanitizeTag(heading) : null;
  return slug ? `${slug}-${date}` : `plan-${date}`;
};

const detectProjectName = (): string => {
  try {
    const toplevel = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    const name = basename(toplevel);
    return sanitizeTag(name) ?? "_unknown";
  } catch {
    // Not a git repo — fall back to cwd
  }
  try {
    const name = basename(process.cwd());
    return sanitizeTag(name) ?? "_unknown";
  } catch {
    return "_unknown";
  }
};

const getHistoryDir = (project: string, slug: string): string => {
  const historyDir = join(
    os.homedir(),
    ".plannotator",
    "history",
    project,
    slug,
  );
  mkdirSync(historyDir, { recursive: true });
  return historyDir;
};

const getNextVersionNumber = (historyDir: string): number => {
  try {
    const entries = readdirSync(historyDir);
    let max = 0;
    for (const entry of entries) {
      const match = entry.match(/^(\d+)\.md$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > max) {
          max = num;
        }
      }
    }
    return max + 1;
  } catch {
    return 1;
  }
};

const saveToHistory = (
  project: string,
  slug: string,
  plan: string,
): { version: number; path: string; isNew: boolean } => {
  const historyDir = getHistoryDir(project, slug);

  // Concurrency (audit): version selection is made atomic at the filesystem
  // level via exclusive-create writes ('wx' flag). Two writers racing on the
  // same next version can no longer both succeed and overwrite each other —
  // exactly one wins the create, the loser recomputes the next version and
  // retries. The retry cap is a defensive backstop, not the primary bound.
  let candidate = getNextVersionNumber(historyDir);
  let attempts = 0;
  while (attempts < 1000) {
    attempts += 1;
    if (candidate > 1) {
      const latestPath = join(
        historyDir,
        `${String(candidate - 1).padStart(3, "0")}.md`,
      );
      try {
        const existing = readFileSync(latestPath, "utf-8");
        if (existing === plan) {
          return { version: candidate - 1, path: latestPath, isNew: false };
        }
      } catch {
        /* proceed with saving */
      }
    }
    const filePath = join(historyDir, `${String(candidate).padStart(3, "0")}.md`);
    try {
      writeFileSync(filePath, plan, { encoding: "utf-8", flag: "wx" });
      return { version: candidate, path: filePath, isNew: true };
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== "EEXIST") {
        throw error;
      }
      // A concurrent writer claimed this version first — recompute and retry.
      candidate = getNextVersionNumber(historyDir);
    }
  }
  throw new Error(
    `Plannotator: could not reserve a new plan history version for ${project}/${slug}`,
  );
};

const getPlanVersion = (
  project: string,
  slug: string,
  version: number,
): string | null => {
  const historyDir = join(
    os.homedir(),
    ".plannotator",
    "history",
    project,
    slug,
  );
  const fileName = `${String(version).padStart(3, "0")}.md`;
  const filePath = join(historyDir, fileName);
  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
};

const getVersionCount = (project: string, slug: string): number => {
  const historyDir = join(
    os.homedir(),
    ".plannotator",
    "history",
    project,
    slug,
  );
  try {
    const entries = readdirSync(historyDir);
    return entries.filter((e) => /^\d+\.md$/.test(e)).length;
  } catch {
    return 0;
  }
};

const listVersions = (
  project: string,
  slug: string,
): Array<{ version: number; timestamp: string }> => {
  const historyDir = join(
    os.homedir(),
    ".plannotator",
    "history",
    project,
    slug,
  );
  try {
    const entries = readdirSync(historyDir);
    const versions: Array<{ version: number; timestamp: string }> = [];
    for (const entry of entries) {
      const match = entry.match(/^(\d+)\.md$/);
      if (match) {
        const version = parseInt(match[1], 10);
        const filePath = join(historyDir, entry);
        try {
          const stat = statSync(filePath);
          versions.push({ version, timestamp: stat.mtime.toISOString() });
        } catch {
          versions.push({ version, timestamp: "" });
        }
      }
    }
    return versions.sort((a, b) => a.version - b.version);
  } catch {
    return [];
  }
};

const listProjectPlans = (
  project: string,
): Array<{ slug: string; versions: number; lastModified: string }> => {
  const projectDir = join(os.homedir(), ".plannotator", "history", project);
  try {
    const entries = readdirSync(projectDir, { withFileTypes: true });
    const plans: Array<{
      slug: string;
      versions: number;
      lastModified: string;
    }> = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const slugDir = join(projectDir, entry.name);
      const files = readdirSync(slugDir).filter((f) => /^\d+\.md$/.test(f));
      if (files.length === 0) {
        continue;
      }
      let latest = 0;
      for (const file of files) {
        try {
          const mtime = statSync(join(slugDir, file)).mtime.getTime();
          if (mtime > latest) {
            latest = mtime;
          }
        } catch {
          /* skip */
        }
      }
      plans.push({
        slug: entry.name,
        versions: files.length,
        lastModified: latest ? new Date(latest).toISOString() : "",
      });
    }
    return plans.sort((a, b) => b.lastModified.localeCompare(a.lastModified));
  } catch {
    return [];
  }
};

// ── Plan Review Server ──────────────────────────────────────────────────

export interface PlanServerResult {
  port: number;
  url: string;
  waitForDecision: () => Promise<{ approved: boolean; feedback?: string }>;
  stop: () => void;
}

export const startPlanReviewServer = (options: {
  plan: string;
  htmlContent: string;
  origin?: string;
  host?: string;
}): PlanServerResult => {
  // Version history
  const slug = generateSlug(options.plan);
  const project = detectProjectName();
  const historyResult = saveToHistory(project, slug, options.plan);
  const previousPlan =
    historyResult.version > 1
      ? getPlanVersion(project, slug, historyResult.version - 1)
      : null;
  const versionInfo = {
    version: historyResult.version,
    totalVersions: getVersionCount(project, slug),
    project,
  };

  let resolveDecision!: (result: {
    approved: boolean;
    feedback?: string;
  }) => void;
  const decisionPromise = new Promise<{ approved: boolean; feedback?: string }>(
    (r) => {
      resolveDecision = r;
    },
  );

  const pageToken = makePageToken();
  const server = createGatedServer(pageToken, async (req, res, url) => {
    if (url.pathname === "/api/plan/version") {
      const vParam = url.searchParams.get("v");
      if (!vParam) {
        json(res, { error: "Missing v parameter" }, 400);
        return;
      }
      const v = parseInt(vParam, 10);
      if (isNaN(v) || v < 1) {
        json(res, { error: "Invalid version number" }, 400);
        return;
      }
      const content = getPlanVersion(project, slug, v);
      if (content === null) {
        json(res, { error: "Version not found" }, 404);
        return;
      }
      json(res, { plan: content, version: v });
    } else if (url.pathname === "/api/plan/versions") {
      json(res, { project, slug, versions: listVersions(project, slug) });
    } else if (url.pathname === "/api/plan/history") {
      json(res, { project, plans: listProjectPlans(project) });
    } else if (url.pathname === "/api/plan") {
      json(res, {
        plan: options.plan,
        origin: options.origin ?? "pi",
        previousPlan,
        versionInfo,
      });
    } else if (url.pathname === "/api/approve" && req.method === "POST") {
      const { body, tooLarge, interrupted } = await parseBody(req, res);
      if (interrupted) {
        // Aborted/errored/destroyed request (or inactivity timeout): no valid
        // payload was delivered, so no decision may be derived from the empty
        // body — leave the pending review unresolved.
        return;
      }
      if (tooLarge) {
        json(res, { error: "Request body too large" }, 413);
        return;
      }
      // Audit hardening: the body is a parsed JSON blob whose shape the
      // endpoint does not control — only actual strings may flow into the
      // resolved decision (and later prompt interpolation).
      resolveDecision({
        approved: true,
        feedback: normalizeFeedback(body.feedback),
      });
      json(res, { ok: true });
    } else if (url.pathname === "/api/deny" && req.method === "POST") {
      const { body, tooLarge, interrupted } = await parseBody(req, res);
      if (interrupted) {
        // See /api/approve: an interrupted request resolves nothing.
        return;
      }
      if (tooLarge) {
        json(res, { error: "Request body too large" }, 413);
        return;
      }
      resolveDecision({
        approved: false,
        feedback: normalizeFeedback(body.feedback) || "Plan rejected",
      });
      json(res, { ok: true });
    } else {
      html(res, withTokenBootstrap(options.htmlContent));
    }
  });

  const port = listenOnRandomPort(server);
  const stop = makeStop(server);

  return {
    port,
    url: urlWithToken(buildServerUrl(options.host, port), pageToken),
    waitForDecision: () => decisionPromise,
    stop,
  };
};

// ── Code Review Server ──────────────────────────────────────────────────

export type DiffType =
  | "uncommitted"
  | "staged"
  | "unstaged"
  | "last-commit"
  | "branch";

const SUPPORTED_DIFF_TYPES = new Set<DiffType>([
  "uncommitted",
  "staged",
  "unstaged",
  "last-commit",
  "branch",
]);

const isDiffType = (value: unknown): value is DiffType =>
  typeof value === "string" && SUPPORTED_DIFF_TYPES.has(value as DiffType);

export interface DiffOption {
  id: DiffType | "separator";
  label: string;
}

export interface GitContext {
  currentBranch: string;
  defaultBranch: string;
  diffOptions: DiffOption[];
}

export interface ReviewServerResult {
  port: number;
  url: string;
  /** `aborted: true` when the decision was settled by server shutdown
   *  (task close / unload) rather than by user feedback. */
  waitForDecision: () => Promise<{ feedback: string; aborted?: boolean }>;
  stop: () => void;
}

/** Run a git command and return stdout (empty string on error). */
const git = (cmd: string, cwd?: string): string => {
  try {
    // execFileSync with an argv array: no shell parses the command string, so
    // a hostile branch name or ref (which flows into `runGitDiff` from
    // config/remotes as `diff <defaultBranch>..HEAD ...`) cannot inject shell
    // metacharacters into the AiderDesk main process (audit).
    return execFileSync("git", cmd.split(/\s+/), {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      cwd,
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large diffs
    }).trim();
  } catch {
    return "";
  }
};

/**
 * Guard for refs interpolated into the git helper's command string (which is
 * split on whitespace into an execFileSync argv — no shell, so shell
 * metacharacters are already inert). A ref must additionally not lead with
 * `-`: git's parseopt would read an option-leading argv token as an option
 * even without a shell — e.g. a plumbing-configured refs/remotes/origin/HEAD
 * pointing at `--output=/tmp/x` would turn `diff <ref>..HEAD` into a file
 * write instead of a diff (audit). Embedded whitespace is rejected too: it
 * would synthesize extra argv tokens. Refs that fail this check produce an
 * empty diff instead of a git invocation.
 */
const isSafeGitRef = (ref: string): boolean =>
  ref.length > 0 && ref[0] !== "-" && !/\s/.test(ref);

export const getGitContext = (cwd?: string): GitContext => {
  const currentBranch = git("rev-parse --abbrev-ref HEAD", cwd) || "HEAD";

  let defaultBranch = "";
  const symRef = git("symbolic-ref refs/remotes/origin/HEAD", cwd);
  if (symRef) {
    defaultBranch = symRef.replace("refs/remotes/origin/", "");
  }
  if (!defaultBranch) {
    const hasMain = git("show-ref --verify refs/heads/main", cwd);
    defaultBranch = hasMain ? "main" : "master";
  }

  const diffOptions: DiffOption[] = [
    { id: "uncommitted", label: "Uncommitted changes" },
    { id: "last-commit", label: "Last commit" },
  ];
  if (currentBranch !== defaultBranch) {
    diffOptions.push({ id: "branch", label: `vs ${defaultBranch}` });
  }

  return { currentBranch, defaultBranch, diffOptions };
};

export const runGitDiff = (
  diffType: DiffType,
  defaultBranch = "main",
  cwd?: string,
): { patch: string; label: string } => {
  switch (diffType) {
    case "uncommitted":
      return {
        patch: git("diff HEAD --src-prefix=a/ --dst-prefix=b/", cwd),
        label: "Uncommitted changes",
      };
    case "staged":
      return {
        patch: git("diff --staged --src-prefix=a/ --dst-prefix=b/", cwd),
        label: "Staged changes",
      };
    case "unstaged":
      return {
        patch: git("diff --src-prefix=a/ --dst-prefix=b/", cwd),
        label: "Unstaged changes",
      };
    case "last-commit":
      return {
        patch: git("diff HEAD~1..HEAD --src-prefix=a/ --dst-prefix=b/", cwd),
        label: "Last commit",
      };
    case "branch":
      // defaultBranch flows from git plumbing (refs/remotes/origin/HEAD,
      // i.e. repository configuration) and runGitDiff also accepts
      // caller-supplied values, so re-validate before argv interpolation
      // (audit: option injection via a hostile ref).
      if (!isSafeGitRef(defaultBranch)) {
        return { patch: "", label: `Changes vs ${defaultBranch}` };
      }
      return {
        patch: git(
          `diff ${defaultBranch}..HEAD --src-prefix=a/ --dst-prefix=b/`,
          cwd,
        ),
        label: `Changes vs ${defaultBranch}`,
      };
    default:
      return { patch: "", label: "Unknown diff type" };
  }
};

export const startReviewServer = (options: {
  rawPatch: string;
  gitRef: string;
  htmlContent: string;
  origin?: string;
  diffType?: DiffType;
  gitContext?: GitContext;
  cwd?: string;
  host?: string;
}): ReviewServerResult => {
  let currentPatch = options.rawPatch;
  let currentGitRef = options.gitRef;
  let currentDiffType: DiffType = options.diffType || "uncommitted";

  let resolveDecision!: (result: {
    feedback: string;
    aborted?: boolean;
  }) => void;
  const decisionPromise = new Promise<{ feedback: string }>((r) => {
    resolveDecision = r;
  });

  const pageToken = makePageToken();
  const server = createGatedServer(pageToken, async (req, res, url) => {
    if (url.pathname === "/api/diff" && req.method === "GET") {
      json(res, {
        rawPatch: currentPatch,
        gitRef: currentGitRef,
        origin: options.origin ?? "pi",
        diffType: currentDiffType,
        gitContext: options.gitContext,
      });
    } else if (url.pathname === "/api/diff/switch" && req.method === "POST") {
      const { body, tooLarge, interrupted } = await parseBody(req, res);
      if (interrupted) {
        // Client is gone — do not write to a dead socket.
        return;
      }
      if (tooLarge) {
        json(res, { error: "Request body too large" }, 413);
        return;
      }
      const newType = body.diffType;
      if (newType === undefined) {
        json(res, { error: "Missing diffType" }, 400);
        return;
      }
      if (!isDiffType(newType)) {
        json(res, { error: "Unsupported diffType" }, 400);
        return;
      }
      const defaultBranch = options.gitContext?.defaultBranch || "main";
      const result = runGitDiff(newType, defaultBranch, options.cwd);
      currentPatch = result.patch;
      currentGitRef = result.label;
      currentDiffType = newType;
      json(res, {
        rawPatch: currentPatch,
        gitRef: currentGitRef,
        diffType: currentDiffType,
      });
    } else if (url.pathname === "/api/feedback" && req.method === "POST") {
      const { body, tooLarge, interrupted } = await parseBody(req, res);
      if (interrupted) {
        // See the plan server's approve/deny endpoints: an interrupted request
        // (physical close, error, or timeout) delivers no decision payload and
        // must not resolve the pending review decision.
        return;
      }
      if (tooLarge) {
        json(res, { error: "Request body too large" }, 413);
        return;
      }
      resolveDecision({
        feedback: normalizeFeedback(body.feedback) ?? "",
      });
      json(res, { ok: true });
    } else {
      html(res, withTokenBootstrap(options.htmlContent));
    }
  });

  const port = listenOnRandomPort(server);
  const stop = makeStop(server);

  return {
    port,
    url: urlWithToken(buildServerUrl(options.host, port), pageToken),
    waitForDecision: () => decisionPromise,
    stop: () => {
      // Closing the server must also unwind a pending decision await: the
      // command waits on waitForDecision() and a task close or extension
      // unload stops the server without feedback — the settled empty record
      // lets that command finish instead of hanging for the process
      // lifetime (audit). An already-settled decision is unaffected
      // (double-resolve is a no-op).
      resolveDecision({ feedback: "", aborted: true });
      stop();
    },
  };
};

// ── Annotate Server ─────────────────────────────────────────────────────

export interface AnnotateServerResult {
  port: number;
  url: string;
  waitForDecision: () => Promise<{ feedback: string }>;
  stop: () => void;
}

export const startAnnotateServer = (options: {
  markdown: string;
  filePath: string;
  htmlContent: string;
  origin?: string;
  host?: string;
}): AnnotateServerResult => {
  let resolveDecision!: (result: {
    feedback: string;
    aborted?: boolean;
  }) => void;
  const decisionPromise = new Promise<{ feedback: string }>((r) => {
    resolveDecision = r;
  });

  const pageToken = makePageToken();
  const server = createGatedServer(pageToken, async (req, res, url) => {
    if (url.pathname === "/api/plan" && req.method === "GET") {
      json(res, {
        plan: options.markdown,
        origin: options.origin ?? "pi",
        mode: "annotate",
        filePath: options.filePath,
      });
    } else if (url.pathname === "/api/feedback" && req.method === "POST") {
      const { body, tooLarge, interrupted } = await parseBody(req, res);
      if (interrupted) {
        // See the plan server's approve/deny endpoints: an interrupted
        // request delivers no decision payload and resolves nothing.
        return;
      }
      if (tooLarge) {
        json(res, { error: "Request body too large" }, 413);
        return;
      }
      resolveDecision({
        feedback: normalizeFeedback(body.feedback) ?? "",
      });
      json(res, { ok: true });
    } else {
      html(res, withTokenBootstrap(options.htmlContent));
    }
  });

  const port = listenOnRandomPort(server);
  const stop = makeStop(server);

  return {
    port,
    url: urlWithToken(buildServerUrl(options.host, port), pageToken),
    waitForDecision: () => decisionPromise,
    stop: () => {
      // Closing the server must also unwind a pending decision await: the
      // command waits on waitForDecision() and a task close or extension
      // unload stops the server without feedback — the settled empty record
      // lets that command finish instead of hanging for the process
      // lifetime (audit). An already-settled decision is unaffected
      // (double-resolve is a no-op).
      resolveDecision({ feedback: "", aborted: true });
      stop();
    },
  };
};

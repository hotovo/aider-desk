import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runInNewContext } from "node:vm";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { startPlanReviewServer } from "../server";

// startPlanReviewServer persists the plan into ~/.plannotator/history via
// os.homedir(). Point homedir at a throwaway directory so tests never touch
// the developer's real HOME, and remove it after the suite.
const mockHome = vi.hoisted(() => ({ home: "" }));

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return {
    ...actual,
    default: { ...actual.default, homedir: () => mockHome.home },
  };
});

beforeAll(() => {
  mockHome.home = mkdtempSync(join(tmpdir(), "plannotator-auth-test-"));
});

afterAll(() => {
  rmSync(mockHome.home, { recursive: true, force: true });
});

interface PlanServer {
  port: number;
  url: string;
  waitForDecision: () => Promise<{ approved: boolean; feedback?: string }>;
  stop: () => void;
}

const waitFor = async (ms: number): Promise<void> =>
  new Promise((resolveAwait) => setTimeout(resolveAwait, ms));

/** Base URL without the out-of-band #token fragment (for hitting API paths). */
const baseUrlOf = (url: string): string => url.split("#")[0];

/**
 * Runs the token-bootstrap script exactly as the browser would (same-origin
 * `location`, real URL/Headers/Request globals) and records what the wrapped
 * `window.fetch` hands to the original fetch. Used for the audit-driven
 * same-origin/cross-origin guarantees directly against the SERVED HTML.
 */
const runBootstrapInBrowserLikeContext = (bootstrapScript: string, reviewUrl: string) => {
  const target = new URL(reviewUrl.split("#")[0]);
  const underlyingCalls: Array<{ input: unknown; init: unknown; headers: Headers }> = [];

  const sandbox: Record<string, unknown> = {
    URL,
    Headers,
    Request,
    location: {
      hash: reviewUrl.slice(reviewUrl.indexOf("#")),
      href: reviewUrl.split("#")[0],
      origin: target.origin,
    },
    window: {} as Record<string, unknown>,
  };
  sandbox.this = sandbox;
  // The bootstrap rebinds the ORIGINAL window.fetch as its passthrough `o`.
  (sandbox.window as Record<string, unknown>).fetch = (input: unknown, init?: RequestInit) => {
    const headers = new Headers(
      (typeof init === "object" && init !== null && "headers" in init
        ? (init as { headers: HeadersInit }).headers
        : undefined) ?? (input instanceof Request ? input.headers : undefined),
    );
    underlyingCalls.push({ input, init, headers });
    return Promise.resolve(new Response("{}"));
  };

  runInNewContext(bootstrapScript, sandbox);

  const wrappedFetch = (sandbox.window as { fetch?: unknown }).fetch;
  expect(typeof wrappedFetch).toBe("function");

  return {
    fetch: wrappedFetch as (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
    underlyingCalls,
  };
};

describe("plan review server page-token authentication", () => {
  it("rejects /api requests without the token and does not resolve the decision", async () => {
    const server = startPlanReviewServer({
      plan: "# Plan",
      htmlContent: "<html><head><title>t</title></head><body>ok</body></html>",
    }) as PlanServer;

    const baseUrl = baseUrlOf(server.url);

    try {
      const decision = server.waitForDecision();
      let settled = false;
      void decision.then(() => {
        settled = true;
      });

      // An unauthenticated caller who knows the URL cannot read the plan...
      const planResponse = await fetch(`${baseUrl}/api/plan`);
      expect(planResponse.status).toBe(403);

      // ...nor resolve the pending review as approved.
      const approveResponse = await fetch(`${baseUrl}/api/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      expect(approveResponse.status).toBe(403);

      await waitFor(100);
      expect(settled).toBe(false);
    } finally {
      server.stop();
    }
  });

  it("never exposes the token in the served HTML; the token travels only via the URL fragment", async () => {
    const server = startPlanReviewServer({
      plan: "# Plan secret-plan-content",
      htmlContent: "<html><head><title>t</title></head><body>ok</body></html>",
    }) as PlanServer;

    const baseUrl = baseUrlOf(server.url);

    try {
      const decision = server.waitForDecision();
      let settled = false;
      void decision.then(() => {
        settled = true;
      });

      // The token is delivered out-of-band as a URL fragment on the review URL.
      const token = server.url.match(/#token=([0-9a-f]+)$/)?.[1];
      expect(token).toBeTruthy();

      // The HTML is served unauthenticated (fragments never reach the server)
      // and must NOT contain the token anywhere — no embedded bootstrap var,
      // no token echo — so any reachable client fetching the page learns nothing.
      const page = await (await fetch(server.url)).text();
      expect(page).not.toContain(token!);
      expect(page).toMatch(/location\.hash/);
      expect(page).not.toMatch(/var T="/);

      // GET / serving HTML stays unauthenticated/read-only by design; the
      // sensitive API still requires the token.
      const planResponse = await fetch(`${baseUrl}/api/plan`);
      expect(planResponse.status).toBe(403);
      await waitFor(100);
      expect(settled).toBe(false);
    } finally {
      server.stop();
    }
  });

  it("the API still works when authorized with the fragment-provided token", async () => {
    const server = startPlanReviewServer({
      plan: "# Plan",
      htmlContent: "<html><head><title>t</title></head><body>ok</body></html>",
    }) as PlanServer;

    const baseUrl = baseUrlOf(server.url);

    try {
      const decision = server.waitForDecision();

      // Extract the token from the review URL fragment (as the bootstrap does
      // from location.hash in the browser) and use it to authorize API calls.
      const token = server.url.match(/#token=([0-9a-f]+)$/)?.[1];
      expect(token).toBeTruthy();

      const planResponse = await fetch(`${baseUrl}/api/plan`, {
        headers: { "x-plannotator-token": token! },
      });
      expect(planResponse.status).toBe(200);
      const plan = (await planResponse.json()) as { plan: string };
      expect(plan.plan).toBe("# Plan");

      const approveResponse = await fetch(`${baseUrl}/api/approve`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-plannotator-token": token!,
        },
        body: "{}",
      });
      expect(approveResponse.status).toBe(200);
      await expect(decision).resolves.toEqual({
        approved: true,
        feedback: undefined,
      });
    } finally {
      server.stop();
    }
  });

  it("the injected fetch wrapper attaches the token to same-origin requests only", async () => {
    const server = startPlanReviewServer({
      plan: "# Plan",
      htmlContent: "<html><head><title>t</title></head><body>ok</body></html>",
    }) as PlanServer;

    try {
      // The wrapper is exercised exactly as the browser would: the script is
      // extracted from the SERVED HTML and run against a same-origin location.
      const page = await (await fetch(server.url)).text();
      const scriptMatch = page.match(/<script>([\s\S]*?)<\/script>/);
      expect(scriptMatch).toBeTruthy();

      const env = runBootstrapInBrowserLikeContext(scriptMatch![1], server.url);
      const baseUrl = baseUrlOf(server.url);

      // Same-origin absolute request: init lacks headers entirely, so the
      // wrapper must add a Headers object carrying the token.
      await env.fetch(`${baseUrl}/api/approve`, { method: "POST" });
      let captured = env.underlyingCalls.at(-1)!;
      expect(captured.headers.get("x-plannotator-token")).toBe(
        server.url.match(/#token=([0-9a-f]+)$/)?.[1],
      );

      // Same-origin relative request resolves against location.href.
      await env.fetch("/api/plan");
      captured = env.underlyingCalls.at(-1)!;
      expect(captured.headers.get("x-plannotator-token")).toBeTruthy();

      // Same-origin Request object: existing headers are preserved and the
      // token is added — wrapping never clobbers caller-supplied headers.
      await env.fetch(new Request(`${baseUrl}/api/approve`, { headers: { "keep-me": "yes" } }));
      captured = env.underlyingCalls.at(-1)!;
      expect(captured.headers.get("keep-me")).toBe("yes");
      expect(captured.headers.get("x-plannotator-token")).toBeTruthy();

      // Cross-origin request: the token must NEVER leave the page — the call
      // is passed through untouched and no token header may appear.
      const evilUrl = "http://attacker.example/api/approve";
      await env.fetch(evilUrl, { method: "POST", headers: { "keep-me": "yes" } });
      captured = env.underlyingCalls.at(-1)!;
      expect(captured.input).toBe(evilUrl);
      expect(captured.headers.has("x-plannotator-token")).toBe(false);
      // The caller's own headers are not stripped either.
      expect(captured.headers.get("keep-me")).toBe("yes");
    } finally {
      server.stop();
    }
  });
});

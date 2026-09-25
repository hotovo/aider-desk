import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { startAnnotateServer, startPlanReviewServer, startReviewServer } from "../server";

describe("review server shutdown unwinds a pending decision", () => {
  it("resolves waitForDecision after stop() instead of hanging the caller", async () => {
    const server = startReviewServer({
      rawPatch: "diff --git a/x b/x",
      gitRef: "uncommitted",
      htmlContent: "<html><head><title>t</title></head><body>ok</body></html>",
    });

    const pending = server.waitForDecision();
    // No user feedback: the caller (task close / unload path) stops the
    // server — the pending await must settle with an empty, ABORTED record
    // (no decision was ever submitted) instead of keeping the command
    // suspended for the process lifetime (audit).
    server.stop();
    await expect(pending).resolves.toEqual({ feedback: "", aborted: true });
  });

  it("keeps a decided promise stable when stop() runs afterwards", async () => {
    const server = startReviewServer({
      rawPatch: "diff --git a/x b/x",
      gitRef: "uncommitted",
      htmlContent: "<html><head><title>t</title></head><body>ok</body></html>",
    });
    const pending = server.waitForDecision();
    await fetch(`${baseUrlOf(server.url)}/api/feedback`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-plannotator-token": tokenOf(server.url),
      },
      body: JSON.stringify({ feedback: "final" }),
    });
    await expect(pending).resolves.toEqual({ feedback: "final" });
    server.stop();
    await expect(server.waitForDecision()).resolves.toEqual({ feedback: "final" });
  });
});

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
  mockHome.home = mkdtempSync(join(tmpdir(), "plannotator-feedback-test-"));
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

interface ReviewServer {
  port: number;
  url: string;
  waitForDecision: () => Promise<{ feedback: string }>;
  stop: () => void;
}

interface AnnotateServer {
  port: number;
  url: string;
  waitForDecision: () => Promise<{ feedback: string }>;
  stop: () => void;
}

const tokenOf = (url: string): string => url.match(/#token=([0-9a-f]+)$/)?.[1] ?? "";
const baseUrlOf = (url: string): string => url.split("#")[0];

const post = async (serverUrl: string, path: string, body: string): Promise<Response> =>
  fetch(`${baseUrlOf(serverUrl)}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-plannotator-token": tokenOf(serverUrl),
    },
    body,
  });

describe("plan review server feedback payload validation", () => {
  it("normalizes a non-string feedback on approve to undefined instead of leaking it into the decision", async () => {
    const server = startPlanReviewServer({
      plan: "# Plan",
      htmlContent: "<html><head><title>t</title></head><body>ok</body></html>",
    }) as PlanServer;

    try {
      const pending = server.waitForDecision();
      const res = await post(server.url, "/api/approve", JSON.stringify({ feedback: 12345 }));
      expect(res.status).toBe(200);

      // Audit regression: a numeric/object payload must not be forwarded
      // verbatim into the resolved decision (and later prompt interpolation).
      await expect(pending).resolves.toEqual({ approved: true, feedback: undefined });
    } finally {
      server.stop();
    }
  });

  it("resolves approve with string feedback unchanged", async () => {
    const server = startPlanReviewServer({
      plan: "# Plan",
      htmlContent: "<html><head><title>t</title></head><body>ok</body></html>",
    }) as PlanServer;

    try {
      const pending = server.waitForDecision();
      await post(server.url, "/api/approve", JSON.stringify({ feedback: "  ship it  " }));
      await expect(pending).resolves.toEqual({ approved: true, feedback: "ship it" });
    } finally {
      server.stop();
    }
  });

  it.each([
    [12345, "Plan rejected"],
    [0, "Plan rejected"],
    [null, "Plan rejected"],
    [{ forged: true }, "Plan rejected"],
    ["", "Plan rejected"],
  ])("normalizes non-string/empty deny feedback %j to the default label", async (badFeedback, expected) => {
    const server = startPlanReviewServer({
      plan: "# Plan",
      htmlContent: "<html><head><title>t</title></head><body>ok</body></html>",
    }) as PlanServer;

    try {
      const pending = server.waitForDecision();
      const res = await post(server.url, "/api/deny", JSON.stringify({ feedback: badFeedback }));
      expect(res.status).toBe(200);
      await expect(pending).resolves.toEqual({ approved: false, feedback: expected });
    } finally {
      server.stop();
    }
  });

  it("passes a real deny feedback string through unchanged", async () => {
    const server = startPlanReviewServer({
      plan: "# Plan",
      htmlContent: "<html><head><title>t</title></head><body>ok</body></html>",
    }) as PlanServer;

    try {
      const pending = server.waitForDecision();
      await post(server.url, "/api/deny", JSON.stringify({ feedback: "  missing tests  " }));
      await expect(pending).resolves.toEqual({ approved: false, feedback: "missing tests" });
    } finally {
      server.stop();
    }
  });
});

describe("annotate server feedback payload validation", () => {
  it("trims string feedback and normalizes non-string feedback", async () => {
    const server = startAnnotateServer({
      markdown: "# Notes",
      filePath: "notes.md",
      htmlContent: "<html><body>ok</body></html>",
    }) as AnnotateServer;

    try {
      const pending = server.waitForDecision();
      const res = await post(server.url, "/api/feedback", JSON.stringify({ feedback: "  review notes  " }));
      expect(res.status).toBe(200);
      await expect(pending).resolves.toEqual({ feedback: "review notes" });
    } finally {
      server.stop();
    }
  });

  it("normalizes a non-string feedback value before processing it", async () => {
    const server = startAnnotateServer({
      markdown: "# Notes",
      filePath: "notes.md",
      htmlContent: "<html><body>ok</body></html>",
    }) as AnnotateServer;

    try {
      const pending = server.waitForDecision();
      const res = await post(server.url, "/api/feedback", JSON.stringify({ feedback: { forged: true } }));
      expect(res.status).toBe(200);
      await expect(pending).resolves.toEqual({ feedback: "" });
    } finally {
      server.stop();
    }
  });
});

describe("review server feedback payload validation", () => {
  it.each([
    [12345, ""],
    [null, ""],
    [{ object: true }, ""],
    ["", ""],
  ])("normalizes non-string/empty /api/feedback body %j to an empty string", async (badFeedback, expected) => {
    const server = startReviewServer({
      rawPatch: "diff --git a/x b/x",
      gitRef: "uncommitted",
      htmlContent: "<html><head><title>t</title></head><body>ok</body></html>",
    }) as ReviewServer;

    try {
      const pending = server.waitForDecision();
      const res = await post(server.url, "/api/feedback", JSON.stringify({ feedback: badFeedback }));
      expect(res.status).toBe(200);
      await expect(pending).resolves.toEqual({ feedback: expected });
    } finally {
      server.stop();
    }
  });

  it("passes a real feedback string through unchanged", async () => {
    const server = startReviewServer({
      rawPatch: "diff --git a/x b/x",
      gitRef: "uncommitted",
      htmlContent: "<html><head><title>t</title></head><body>ok</body></html>",
    }) as ReviewServer;

    try {
      const pending = server.waitForDecision();
      await post(server.url, "/api/feedback", JSON.stringify({ feedback: "  rename this helper  " }));
      await expect(pending).resolves.toEqual({ feedback: "rename this helper" });
    } finally {
      server.stop();
    }
  });
});

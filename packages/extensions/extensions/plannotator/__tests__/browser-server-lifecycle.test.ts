import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import PlannotatorExtension, {
  BROWSER_REVIEW_MAX_OPEN_TIMEOUT_MS,
} from "../index";

// The browser plan-review server persists the plan into ~/.plannotator/history
// via os.homedir(). Point homedir at a throwaway directory so tests never
// touch the developer's real HOME, and remove it after the suite.
const mockHome = vi.hoisted(() => ({ home: "" }));

// The source checkout does not ship plannotator.html/review-editor.html (they
// are only present in installed copies) — stub them so the browser review
// path is exercisable: the module reads its HTML assets at import time.
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  const original = actual.readFileSync;
  const patchedReadFileSync = (path: Parameters<typeof original>[0], ...rest: unknown[]) => {
    try {
      return original(path, ...(rest as []));
    } catch (error) {
      const requested = String(path);
      if (requested.endsWith("plannotator.html")) {
        return "<html><head><title>p</title></head><body>ok</body></html>";
      }
      if (requested.endsWith("review-editor.html")) {
        return "<html><head><title>r</title></head><body>ok</body></html>";
      }
      throw error;
    }
  };
  return {
    ...actual,
    readFileSync: patchedReadFileSync,
    default: {
      ...actual.default,
      readFileSync: patchedReadFileSync,
    },
  };
});

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return {
    ...actual,
    default: { ...actual.default, homedir: () => mockHome.home },
  };
});

beforeAll(() => {
  mockHome.home = mkdtempSync(join(tmpdir(), "plannotator-browser-lifecycle-"));
});

afterAll(() => {
  rmSync(mockHome.home, { recursive: true, force: true });
});

const makeContext = () =>
  ({
    getTaskContext: () => ({ data: { id: "task-1" } }),
    openUrl: async () => undefined,
    log: () => undefined,
    triggerUIDataRefresh: () => undefined,
  }) as never;

describe("browser plan review server lifecycle", () => {
  it("tracks the server for task-close disposal and unwinds the review as aborted", async () => {
    const extension = new PlannotatorExtension();
    const context = makeContext();

    const runBrowserPlanReview = (
      extension as unknown as {
        runBrowserPlanReview: (
          context: never,
          plan: string,
          signal?: AbortSignal,
        ) => Promise<unknown>;
      }
    ).runBrowserPlanReview.bind(extension);

    const pending = runBrowserPlanReview(context, "# Plan", undefined);

    // The server must be tracked under the task id, or a task close that
    // fails to propagate the tool's abort signal leaves it listening with a
    // valid page token (audit: lifecycle gap).
    const trackedServers = (
      extension as unknown as {
        activeReviewServers: Map<string, Set<{ stop: () => void }>>;
      }
    ).activeReviewServers;

    await vi.waitFor(() => {
      expect(trackedServers.get("task-1")?.size).toBe(1);
    });

    const finalizeTracked = (
      extension as unknown as {
        activeBrowserReviewFinalizers: Map<string, Set<() => void>>;
      }
    ).activeBrowserReviewFinalizers;
    await vi.waitFor(() => {
      expect(finalizeTracked.get("task-1")?.size).toBe(1);
    });

    // Task closes: the tracked server is stopped, the finalizer unwinds the
    // waiting tool call as "aborted", and the tracking is cleaned up.
    await (
      extension as unknown as {
        onTaskClosed: (event: unknown, context: never) => Promise<void>;
      }
    ).onTaskClosed({ task: { id: "task-1" } } as never, context);

    expect(trackedServers.has("task-1")).toBe(false);
    expect(finalizeTracked.has("task-1")).toBe(false);
    await expect(pending).resolves.toBe("aborted");
  });

  it("stops and untracks the server when the review is aborted", async () => {
    const extension = new PlannotatorExtension();
    const context = makeContext();

    const runBrowserPlanReview = (
      extension as unknown as {
        runBrowserPlanReview: (
          context: never,
          plan: string,
          signal?: AbortSignal,
        ) => Promise<unknown>;
      }
    ).runBrowserPlanReview.bind(extension);

    const controller = new AbortController();
    const pending = runBrowserPlanReview(context, "# Plan", controller.signal);
    controller.abort();

    await expect(pending).resolves.toBe("aborted");

    const trackedServers = (
      extension as unknown as {
        activeReviewServers: Map<string, Set<unknown>>;
      }
    ).activeReviewServers;
    expect(trackedServers.has("task-1")).toBe(false);
  });

  it("never aborts an active review on humanly-plausible timescales (regression: the old 30s cap did)", async () => {
    vi.useFakeTimers();
    try {
      const extension = new PlannotatorExtension();
      const context = makeContext();

      let resolved = false;
      const pending = (
        extension as unknown as {
          runBrowserPlanReview: (context: never, plan: string) => Promise<unknown>;
        }
      ).runBrowserPlanReview(context, "# Plan");
      void pending.then(() => {
        resolved = true;
      });

      // Hours into an active review — far beyond the old 30s cap — the
      // review must still be pending and its server must not have been
      // stopped or untracked.
      await vi.advanceTimersByTimeAsync(2 * 60 * 60 * 1000);
      await Promise.resolve();
      expect(resolved).toBe(false);

      const trackedServers = (
        extension as unknown as {
          activeReviewServers: Map<string, Set<unknown>>;
        }
      ).activeReviewServers;
      expect(trackedServers.get("task-1")?.size).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("bounds a dismissed modal so the server cannot leak indefinitely", async () => {
    vi.useFakeTimers();
    try {
      const extension = new PlannotatorExtension();
      const context = makeContext();
      const pending = (
        extension as unknown as {
          runBrowserPlanReview: (context: never, plan: string) => Promise<unknown>;
        }
      ).runBrowserPlanReview(context, "# Plan");

      // The cap is deliberately long (24h): event-driven cleanup handles
      // task abort/close/unload, the timer only bounds a server whose page
      // never posts a decision.
      await vi.advanceTimersByTimeAsync(BROWSER_REVIEW_MAX_OPEN_TIMEOUT_MS + 1);

      await expect(pending).resolves.toBe("aborted");
      const trackedServers = (
        extension as unknown as {
          activeReviewServers: Map<string, Set<unknown>>;
        }
      ).activeReviewServers;
      expect(trackedServers.size).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("unloads resolve a pending browser review as aborted (no tool-call hang)", async () => {
    const extension = new PlannotatorExtension();
    const context = makeContext();

    const pending = (
      extension as unknown as {
        runBrowserPlanReview: (context: never, plan: string) => Promise<unknown>;
      }
    ).runBrowserPlanReview(context, "# Plan");

    const trackedServers = (
      extension as unknown as {
        activeReviewServers: Map<string, Set<unknown>>;
      }
    ).activeReviewServers;
    const finalizers = (
      extension as unknown as {
        activeBrowserReviewFinalizers: Map<string, Set<() => void>>;
      }
    ).activeBrowserReviewFinalizers;
    await vi.waitFor(() => {
      expect(trackedServers.get("task-1")?.size).toBe(1);
      expect(finalizers.get("task-1")?.size).toBe(1);
    });

    await (
      extension as unknown as {
        onUnload: (context: never) => Promise<void>;
      }
    ).onUnload(context as never);

    // Unload must unwind (not just stop): the waiting tool call resolves as
    // "aborted" and both tracking maps are emptied (audit: unload hang).
    await expect(pending).resolves.toBe("aborted");
    expect(trackedServers.size).toBe(0);
    expect(finalizers.size).toBe(0);
  });
});

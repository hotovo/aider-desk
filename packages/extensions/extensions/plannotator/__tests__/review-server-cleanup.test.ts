import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { ExtensionContext } from "@aiderdesk/extensions";

import PlannotatorExtension, {
  BROWSER_REVIEW_MAX_OPEN_TIMEOUT_MS,
} from "../index";

// Control the server module: the review command starts a review server via
// startReviewServer, which we replace with a stub whose lifecycle (stop) we
// can observe.
const { startReviewServerMock, stopMock } = vi.hoisted(() => ({
  startReviewServerMock: vi.fn(),
  stopMock: vi.fn(),
}));

vi.mock("../server", () => ({
  startPlanReviewServer: vi.fn(),
  startReviewServer: startReviewServerMock,
  getGitContext: vi.fn(() => ({
    currentBranch: "main",
    defaultBranch: "main",
    diffOptions: [],
  })),
  runGitDiff: vi.fn(() => ({
    patch: "diff --git a/x b/x",
    label: "Uncommitted changes",
  })),
}));

// The review command only reaches the server path with browserReview enabled;
// provide a fake config.json and fake review HTML instead of relying on files
// that only exist in an installed extension bundle.
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    default: actual.default,
    existsSync: (path: unknown): boolean =>
      typeof path === "string" && path.endsWith("config.json")
        ? true
        : (actual.existsSync as (p: string) => boolean)(path as string),
    readFileSync: (path: Parameters<typeof actual.readFileSync>[0], ...rest) => {
      if (typeof path === "string" && path.endsWith("config.json")) {
        return JSON.stringify({ browserReview: true });
      }
      if (typeof path === "string" && path.endsWith("review-editor.html")) {
        return "<html><head><title>t</title></head><body>review</body></html>";
      }
      return actual.readFileSync(path, ...rest);
    },
  };
});

// No history is written by the code-review path, but keep homedir sandboxed
// anyway so any incidental write lands in a throwaway directory.
const mockHome = vi.hoisted(() => ({ home: "" }));
vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return {
    ...actual,
    default: { ...actual.default, homedir: () => mockHome.home },
  };
});

beforeAll(() => {
  mockHome.home = mkdtempSync(join(tmpdir(), "plannotator-cleanup-test-"));
});

afterAll(() => {
  rmSync(mockHome.home, { recursive: true, force: true });
});

const makeContext = (
  openUrl: () => Promise<void>,
): ExtensionContext => {
  const taskContext = { addLogMessage: vi.fn() };
  return {
    log: vi.fn(),
    getProjectContext: () => ({ baseDir: "/tmp/plannotator-test-project" }),
    getTaskContext: () => taskContext,
    openUrl,
    runPrompt: vi.fn(),
  } as unknown as ExtensionContext;
};

const reviewCommand = () => {
  const extension = new PlannotatorExtension();
  const command = extension
    .getCommands()
    .find((c) => c.name === "plannotator-review");
  if (!command) {
    throw new Error("plannotator-review command not found");
  }
  return command;
};

describe("plannotator-review server lifecycle", () => {
  it("stops the review server when openUrl rejects instead of leaving it listening", async () => {
    startReviewServerMock.mockImplementation(() => ({
      port: 1,
      url: "http://localhost:1/#token=abc",
      waitForDecision: () => new Promise(() => {}),
      stop: stopMock,
    }));

    const context = makeContext(() =>
      Promise.reject(new Error("browser unavailable")),
    );

    const command = reviewCommand();
    await command.execute([], context);

    expect(startReviewServerMock).toHaveBeenCalledTimes(1);
    // The server must be shut down: a failed open can never deliver a
    // decision, so leaving it running would leak a listening socket.
    expect(stopMock).toHaveBeenCalledTimes(1);
    expect(context.log).toHaveBeenCalledWith(
      expect.stringContaining("Failed to open code review UI"),
      "error",
    );
  });

  it("bounds an abandoned review server with the long max-open timeout (never a short review cap)", async () => {
    vi.useFakeTimers();
    try {
      stopMock.mockClear();
      startReviewServerMock.mockImplementation(() => ({
        port: 1,
        url: "http://localhost:1/#token=abc",
        waitForDecision: () => new Promise(() => {}),
        stop: stopMock,
      }));

      const context = makeContext(() => Promise.resolve());
      const execution = reviewCommand().execute([], context);

      // Hours into an active review the command must still be awaiting the
      // decision — a short cap must not abort it (regression: the old 30s
      // cap auto-aborted reviews that took longer) and the server must not
      // be stopped or untracked while the user is still reviewing.
      await vi.advanceTimersByTimeAsync(2 * 60 * 60 * 1000);
      expect(stopMock).not.toHaveBeenCalled();

      // The long cap still eventually bounds a server whose page never
      // posts a decision back (dismissed modal / abandoned browser tab).
      await vi.advanceTimersByTimeAsync(BROWSER_REVIEW_MAX_OPEN_TIMEOUT_MS);
      await execution;

      expect(stopMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("skips the success log and change-request prompt when the review is abandoned (aborted)", async () => {
    // An abandoned review (task closed / extension unloaded while the tool
    // call was awaiting feedback) settles waitForDecision via server stop
    // with the aborted marker: no decision was ever submitted, so neither
    // the "Code review completed." log nor a runPrompt may fire (audit).
    stopMock.mockClear();
    const runPromptMock = vi.fn();
    startReviewServerMock.mockImplementation(() => ({
      port: 1,
      url: "http://localhost:1/#token=abc",
      waitForDecision: () => Promise.resolve({ feedback: "", aborted: true }),
      stop: stopMock,
    }));

    const context = makeContext(() => undefined);
    (context.getTaskContext() as { runPrompt: () => void }).runPrompt =
      runPromptMock;
    const addLogMessages = (
      context.getTaskContext() as unknown as {
        addLogMessage: ReturnType<typeof vi.fn>;
      }
    ).addLogMessage;

    const command = reviewCommand();
    await command.execute([], context);

    expect(runPromptMock).not.toHaveBeenCalled();
    expect(addLogMessages).not.toHaveBeenCalledWith(
      "info",
      "Code review completed.",
    );
    // The unwinding finally block must still dispose of the server.
    expect(stopMock).toHaveBeenCalledTimes(1);
  });
});

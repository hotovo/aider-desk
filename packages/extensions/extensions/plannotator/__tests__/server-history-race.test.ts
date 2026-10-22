import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { startPlanReviewServer } from "../server";

// Replays the concurrent-writer race deterministically. The mocked node:fs
// hides `claimedPaths` (version files a concurrent writer created between the
// saver's readdir and its writeFileSync) from directory reads, and a write to
// a claimed path fails with EEXIST — exactly the real-filesystem semantics a
// racing writer experiences. After the EEXIST the claim "becomes visible",
// like it would on a real reread.
const claimedPaths = new Set<string>();

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();

  const mockedReaddirSync = (
    path: Parameters<typeof actual.readdirSync>[0],
    ...rest: unknown[]
  ): ReturnType<typeof actual.readdirSync> => {
    const target = String(path);
    const entries = actual.readdirSync(path, ...(rest as [])) as string[];
    if (claimedPaths.size > 0) {
      const visible = entries.filter((entry) => !claimedPaths.has(join(target, entry)));
      return visible as ReturnType<typeof actual.readdirSync>;
    }
    return entries as ReturnType<typeof actual.readdirSync>;
  };

  const mockedWriteFileSync = (
    path: Parameters<typeof actual.writeFileSync>[0],
    ...rest: unknown[]
  ): void => {
    if (claimedPaths.has(String(path))) {
      // A concurrent writer claimed this version between our lookup and our
      // write: real semantics fail with EEXIST, then the claim becomes
      // visible to subsequent directory reads.
      claimedPaths.delete(String(path));
      const err = new Error("EEXIST: file already exists, open") as Error & {
        code?: string;
      };
      err.code = "EEXIST";
      throw err;
    }
    (actual.writeFileSync as unknown as (...args: unknown[]) => void)(path, ...rest);
  };

  return {
    ...actual,
    readdirSync: mockedReaddirSync,
    writeFileSync: mockedWriteFileSync,
  };
});

// startPlanReviewServer persists the plan into ~/.plannotator/history via
// os.homedir(). Point homedir at a throwaway directory.
const mockHome = vi.hoisted(() => ({ home: "" }));

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return {
    ...actual,
    default: { ...actual.default, homedir: () => mockHome.home },
  };
});

beforeAll(() => {
  mockHome.home = mkdtempSync(join(tmpdir(), "plannotator-history-test-"));
});

afterAll(() => {
  rmSync(mockHome.home, { recursive: true, force: true });
});

const HTML = "<html><head><title>t</title></head><body>ok</body></html>";

const dirForPlan = (heading: string): string => {
  const historyRoot = join(mockHome.home, ".plannotator", "history");
  for (const project of readdirSync(historyRoot)) {
    for (const slug of readdirSync(join(historyRoot, project))) {
      const dir = join(historyRoot, project, slug);
      for (const file of readdirSync(dir)) {
        if (readFileSync(join(dir, file), "utf-8").includes(heading)) {
          return dir;
        }
      }
    }
  }
  throw new Error(`history dir for plan ${heading} not found`);
};

describe("plan history version reservation under concurrent claims", () => {
  it("never overwrites a version claimed between lookup and write; retries on the next free version", () => {
    // Writer A saves version 1.
    const first = startPlanReviewServer({
      plan: "# Race Sim Alpha\n\nuser review notes v1",
      htmlContent: HTML,
    });
    first.stop();
    const dir = dirForPlan("# Race Sim Alpha");
    expect(readFileSync(join(dir, "001.md"), "utf-8")).toContain("v1");

    // A concurrent writer creates version 2 while the next saver has already
    // read the directory (the claim is invisible to its readdir).
    const CONCURRENT = "CONCURRENT WRITER PLAN — must survive untouched";
    writeFileSync(join(dir, "002.md"), CONCURRENT, "utf-8");
    claimedPaths.add(join(dir, "002.md"));

    // The racing saver computed next=2; its write hits EEXIST and must
    // advance to version 3. The old non-atomic code would have clobbered
    // 002.md with a plain writeFileSync.
    const second = startPlanReviewServer({
      plan: "# Race Sim Alpha\n\nuser review notes v2",
      htmlContent: HTML,
    });
    second.stop();

    expect(readFileSync(join(dir, "002.md"), "utf-8")).toBe(CONCURRENT);
    expect(readFileSync(join(dir, "003.md"), "utf-8")).toContain("v2");
    expect(readFileSync(join(dir, "001.md"), "utf-8")).toContain("v1");
  });

  it("skips several claimed versions and re-saving an identical plan dedupes", () => {
    const first = startPlanReviewServer({
      plan: "# Race Sim Beta\n\ninitial draft",
      htmlContent: HTML,
    });
    first.stop();
    const dir = dirForPlan("# Race Sim Beta");
    expect(readFileSync(join(dir, "001.md"), "utf-8")).toContain("initial draft");

    // 002 is visible to directory reads; 003 is written by a concurrent
    // writer after the saver's readdir (hidden until its write conflicts).
    writeFileSync(join(dir, "002.md"), "claim from writer B", "utf-8");
    writeFileSync(join(dir, "003.md"), "claim from writer C", "utf-8");
    claimedPaths.add(join(dir, "003.md"));

    const second = startPlanReviewServer({
      plan: "# Race Sim Beta\n\nuser review notes",
      htmlContent: HTML,
    });
    second.stop();

    expect(readFileSync(join(dir, "002.md"), "utf-8")).toBe("claim from writer B");
    expect(readFileSync(join(dir, "003.md"), "utf-8")).toBe("claim from writer C");
    expect(readFileSync(join(dir, "004.md"), "utf-8")).toContain("user review notes");

    claimedPaths.clear();

    // Re-saving an identical plan dedupes and creates no new version file.
    const third = startPlanReviewServer({
      plan: "# Race Sim Beta\n\nuser review notes",
      htmlContent: HTML,
    });
    third.stop();
    const files = readdirSync(dir)
      .filter((f) => /^\d+\.md$/.test(f))
      .sort();
    expect(files).toEqual(["001.md", "002.md", "003.md", "004.md"]);
  });
});

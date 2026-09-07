import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { runGitDiff } from "../server";

// A throwaway (non-git) directory: every git() call fails fast and the
// helper must fall back to an empty patch without ever spawning a shell.
const scratch = mkdtempSync(join(tmpdir(), "plannotator-git-injection-"));

// A throwaway REAL repository: proves the argv-array execution path still
// performs ordinary read-only diffs.
const repo = mkdtempSync(join(tmpdir(), "plannotator-git-injection-repo-"));

const gitIn = (cwd: string, ...args: string[]): void => {
  execFileSync("git", ["-C", cwd, ...args], { stdio: "ignore" });
};

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
  rmSync(repo, { recursive: true, force: true });
});

describe("git helper shell-injection hardening", () => {
  it("does not execute shell metacharacters supplied via the branch ref", () => {
    // A hostile ref flows into the branch diff command from git context /
    // configuration: `diff <defaultBranch>..HEAD ...`. The helper must pass
    // it through as a single argument (execFileSync argv), never through a
    // shell — otherwise this command would create the output file (audit).
    const marker = join(scratch, "pwned.txt");
    const { patch } = runGitDiff(
      "branch",
      "main; touch pwned.txt; echo injected",
      scratch,
    );

    // git rejects the bogus rev, so the patch is empty...
    expect(patch).toBe("");
    // ...and crucially, no shell side effect ever happened.
    expect(existsSync(marker)).toBe(false);
  });

  it("still collects ordinary diffs via the argv-array execution path", () => {
    writeFileSync(join(repo, "file.txt"), "before\n", "utf-8");
    gitIn(repo, "init");
    gitIn(repo, "config", "user.email", "test@test");
    gitIn(repo, "config", "user.name", "test");
    gitIn(repo, "add", ".");
    gitIn(repo, "commit", "-m", "init");
    writeFileSync(join(repo, "file.txt"), "after\n", "utf-8");

    const { patch } = runGitDiff("uncommitted", "main", repo);
    expect(patch).toContain("diff --git a/file.txt b/file.txt");
  });

  it("rejects option-leading branch refs instead of letting git parse them (regression: --output file write)", () => {
    // A plumbing-configured refs/remotes/origin/HEAD pointing at a branch
    // named like an option used to be interpolated verbatim into
    // `diff <ref>..HEAD ...`, where git's parseopt treats
    // `--output=<path>..HEAD` as an --output option — writing the diff to an
    // attacker-chosen file instead of diffing (audit). The helper must
    // refuse to build that argv entirely.
    const marker = join(scratch, "managed-by-ref-option");
    const { patch } = runGitDiff("branch", `--output=${marker}`, repo);

    // The unsafe ref must yield an empty patch...
    expect(patch).toBe("");
    // ...and crucially, git must never have written the output file.
    expect(existsSync(marker)).toBe(false);
  });

  it("rejects whitespace-containing branch refs (they would split into extra argv tokens)", () => {
    const { patch } = runGitDiff("branch", "main cruft", repo);
    expect(patch).toBe("");
  });

  it("still diffs a real branch range for a safe, validated ref", () => {
    const baseBranch = execFileSync(
      "git",
      ["-C", repo, "rev-parse", "--abbrev-ref", "HEAD"],
      { encoding: "utf-8" },
    ).trim();

    gitIn(repo, "checkout", "-b", "feature");
    writeFileSync(join(repo, "file.txt"), "feature\n", "utf-8");
    gitIn(repo, "add", ".");
    gitIn(repo, "commit", "-m", "feature");

    const { patch, label } = runGitDiff("branch", baseBranch, repo);
    expect(label).toBe(`Changes vs ${baseBranch}`);
    expect(patch).toContain("diff --git a/file.txt b/file.txt");
  });
});

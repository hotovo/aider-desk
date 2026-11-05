/**
 * Plannotator Extension - Plan-based development workflow with visual review
 *
 * Features:
 * - Planning mode with tool restrictions (read-only + PLAN.md writes)
 * - Context injection for planning workflow
 * - Execution tracking via checklist items
 * - Browser-based plan review UI
 * - Code review UI for git changes
 *
 * The extension tracks mode and phase per task, responding to mode changes
 * regardless of how they were triggered (command or UI).
 *
 * Commands:
 * - /plannotator - Toggle plannotator mode
 * - /plannotator-review - Open code review UI for current git changes
 *
 * Tools:
 * - exit_plan_mode - Exit planning phase and start execution
 */

import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import {
  startPlanReviewServer,
  startReviewServer,
  getGitContext,
  runGitDiff,
  type ReviewServerResult,
} from "./server.js";
import {
  parseChecklist,
  markCompletedSteps,
  getLocalAddress,
  type ChecklistItem,
} from "./utils.js";

import type {
  Extension,
  ExtensionContext,
  ModeDefinition,
  ToolDefinition,
  CommandDefinition,
  ToolCalledEvent,
  ToolApprovalEvent,
  AgentStartedEvent,
  AgentFinishedEvent,
  TaskInitializedEvent,
  TaskClosedEvent,
  ImportantRemindersEvent,
  AgentProfile,
  UIComponentDefinition,
} from "@aiderdesk/extensions";

// Load review HTML at module initialization
const __dirname = dirname(fileURLToPath(import.meta.url));
let planHtmlContent = "";
let reviewHtmlContent = "";
try {
  planHtmlContent = readFileSync(
    resolve(__dirname, "plannotator.html"),
    "utf-8",
  );
} catch {
  // HTML not found - plan review feature will be unavailable
}
try {
  reviewHtmlContent = readFileSync(
    resolve(__dirname, "review-editor.html"),
    "utf-8",
  );
} catch {
  // HTML not found - code review feature will be unavailable
}

// Load inline review UI components (single-file JSX rendered via string-to-react-component)
const CONFIG_PATH = join(__dirname, "config.json");
const PLAN_REVIEW_COMPONENT_ID = "plannotator-plan-review";
let configComponentJsx = "";
try {
  configComponentJsx = readFileSync(
    resolve(__dirname, "ConfigComponent.jsx"),
    "utf-8",
  );
} catch {
  // Config UI not found - configuration loads without a custom component
}

let planReviewComponentJsx = "";
try {
  planReviewComponentJsx = readFileSync(
    resolve(__dirname, "PlanReviewComponent.jsx"),
    "utf-8",
  );
} catch {
  // Inline review unavailable; falls back to no-op
}

/**
 * Strip the out-of-band page-token fragment (`#token=...`) from anything that
 * may be logged — the token must only reach the browser via the review URL,
 * never chat/task logs. The token fragment can be embedded INSIDE a longer
 * string, not just terminal: error messages wrap URLs in quotes
 * (`Command failed: "browser" "http://localhost:41475/#token=SECRET"`), so an
 * end-anchored pattern misses them and leaks the token. Match every fragment
 * occurrence, stopping at the usual string/URL delimiters.
 */
export const redactPageToken = (text: string): string =>
  text.replace(/#token=[^\s#&"'`)]+/g, "#token=<redacted>");

// Read-only bash allowlist for the planning phase. `git` is NOT treated as
// unconditionally read-only — mutation-capable subcommands (push, reset,
// clean, ...) must stay rejected even when the whole command starts with
// `git` (audit finding: the old prefix-only regex let `git push` through).
const PLANNING_BASH_READONLY_COMMANDS = new Set([
  "ls",
  "cat",
  "pwd",
  "echo",
  "which",
  "grep",
  "find",
  "head",
  "tail",
  "less",
  "wc",
  "tree",
  "curl",
  "git",
]);
// NOTE: `wget` is deliberately NOT allowed — a bare `wget URL` writes its
// output file into the working directory by default, so it is intrinsically
// write-capable regardless of flags. Use `curl` (stdout unless explicitly
// redirected, which the composition check rejects).

const PLANNING_GIT_READONLY_SUBCOMMANDS = new Set([
  "status",
  "log",
  "diff",
  "show",
  "rev-parse",
  "blame",
  "ls-files",
  "ls-remote",
  "describe",
  "shortlog",
  "reflog",
  "grep",
  "cat-file",
  "count-objects",
  "version",
  "help",
]);

// Per-command flags that WRITE to disk, execute arbitrary commands, or push
// LOCAL DATA to a remote (exfiltration) from an otherwise read-only-looking
// command line. Long flags are matched exactly and by `--flag=<file>` form;
// curl short flags are additionally matched by LETTER so bundles like
// `-so` (silent + output) and `-dO` cannot smuggle a denied flag inside.
const PLANNING_BASH_DENIED_LONG_FLAGS: Record<string, Set<string>> = {
  find: new Set([
    "-exec",
    "-execdir",
    "-ok",
    "-okdir",
    "-delete",
    "-fprint",
    "-fprint0",
    "-fprintf",
    "-fls",
  ]),
  // `--ext-diff`/`--textconv`/`--filters`/`--path` invoke configured external
  // diff/filter/textconv helpers — arbitrary commands from .gitattributes or
  // the local git config — so they are denied even though diff/show are
  // allowlisted (guards only ever inspect the command LINE, never git config).
  git: new Set([
    "--output",
    "--output-dir",
    "--ext-diff",
    "--textconv",
    "--filters",
    "--path",
    // `git grep -O<cmd>` / `--open-files-in-pager=<cmd>` execute arbitrary
    // pager commands; `git help --web` runs the configured web browser
    // command (audit: attacker-controlled pager / browser execution).
    "--open-files-in-pager",
    "--web",
    // Pagination invokes the repository-configured `core.pager` as a shell
    // command; `--paginate` forces it even without a TTY and `-p` (patch)
    // traverses the pager path too (audit: configured pager execution).
    "--paginate",
    "-p",
  ]),
  tree: new Set(["-o", "--output"]),
  curl: new Set([
    "-o",
    "--output",
    "--output-dir",
    "-O",
    "--remote-name",
    "--remote-name-all",
    "--remote-header-name",
    "-T",
    "--upload-file",
    "-K",
    "--config",
    "-D",
    "--dump-header",
    "--trace",
    "--trace-ascii",
    "--stderr",
    "-c",
    "--cookie-jar",
    "-C",
    "--continue-at",
    "--create-dirs",
    "-d",
    "--data",
    "--data-raw",
    "--data-binary",
    "--data-urlencode",
    "--json",
    "-F",
    "--form",
    "--form-string",
    // File-write / local-credential-file read flags (audit):
    // `--libcurl` writes generated C code, `--alt-svc`/`--etag-save` write
    // cache files, `--cookie`/`--netrc-file`/`--etag-compare` read local
    // credential/state files and can transmit them.
    "--libcurl",
    "--alt-svc",
    "--etag-save",
    "--etag-compare",
    "--cookie",
    "--netrc",
    "--netrc-file",
    // curl >= 8.11 explicit netrc opt-in: reads credentials from ~/.netrc
    // (or the configured netrc-file) and transmits them (audit).
    "--netrc-opt-in",
  ]),
};

// Short curl flags among the denyset above, checked per-letter inside short
// bundles: o (output), O (remote-name), T (upload), K (config), d (data),
// D (dump-header), F (form), J (with -O), c (cookie-jar), C (continue-at),
// n (netrc: reads credentials from ~/.netrc and transmits them).
const PLANNING_CURL_DENIED_SHORT_LETTERS = new Set(["o", "O", "T", "K", "d", "D", "F", "J", "c", "C", "b", "n"]);

// curl flags that accept `@file` operands (inline or as the following
// token): the file contents leave the machine as headers/query data —
// local-credential exfiltration in disguise (audit).
/**
 * Resolves a curl long-flag token against a known-flag set with the same
 * unambiguous-abbreviation semantics curl applies — conservatively: any
 * token that equals or prefixes a known flag is treated as that flag
 * (`--url-q` expands to `--url-query`, `--data-u` to `--data-...`) so an
 * abbreviation cannot walk past a denylist entry. curl long flags accept
 * unique prefixes; false blocks are acceptable, false allows are not.
 */
const resolveCurlFlag = (known: Set<string>, name: string): string | null => {
  if (known.has(name)) {
    return name;
  }
  for (const flag of known) {
    if (flag.startsWith(name)) {
      return flag;
    }
  }
  return null;
};

const PLANNING_CURL_FILE_OPERAND_FLAGS = new Set([
  "-H",
  "--header",
  "--proxy-header",
  "--url-query",
]);

const PLANNING_DENIED_SHORT_LETTERS_BY_COMMAND: Record<string, Set<string>> = {
  curl: PLANNING_CURL_DENIED_SHORT_LETTERS,
  // tree parses short options char-by-char: `-Fo` smuggles `-o` (output file)
  tree: new Set(["o"]),
};

// Subcommand-specific denied short flags (per letter, bundles included):
// `git grep -O<cmd>` runs the string as an open-files-in-pager command;
// `git help -w` launches the configured web browser command.
const PLANNING_GIT_DENIED_SHORT_LETTERS_BY_SUBCOMMAND: Record<string, Set<string>> = {
  grep: new Set(["O"]),
  help: new Set(["w"]),
};

const PLANNING_GIT_DENIED_GLOBAL_FLAGS = new Set([
  "-c",
  "--config",
  "--config-env",
  "--exec-path",
]);

/**
 * Removes shell quoting/escaping from a flag token BEFORE denylist matching,
 * so `-o` cannot hide as `-"o"`, `--'output'`, `-\o`, or inside `-e"xec"`.
 * Backticks/`$` never reach here (the composition check rejects them first).
 * Built without literal escapes deliberately: the denylist must not be
 *            bypassable and this file must not depend on fragile edits.
 */
const stripShellQuoting = (token: string): string => {
  const backslash = String.fromCharCode(92);
  const caret = String.fromCharCode(94); // cmd.exe escape character
  return token
    .split("")
    .filter((ch) => ch !== '"' && ch !== "'" && ch !== backslash && ch !== caret)
    .join("");
};

/**
 * True when a token contains an UNQUOTED, UNESCAPED glob metacharacter
 * (`*`, `?`, `[`) — such a token is expanded by the shell into (possibly
 * dash-prefixed) filenames, so its pre-expansion spelling proves nothing
 * about the eventual arguments. Quoting state is tracked per character:
 * partially-quoted tokens like `*-"o"` (audit: partial quoting bypass)
 * still carry an unquoted `*` and are rejected.
 */
const hasUnquotedGlobMetachar = (token: string): boolean => {
  const backslash = String.fromCharCode(92);
  let inQuote: string | null = null;
  let escaped = false;
  for (const ch of token) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === backslash) {
      escaped = true;
      continue;
    }
    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch;
      continue;
    }
    if (ch === "*" || ch === "?" || ch === "[") {
      return true;
    }
  }
  return false;
};

// Porcelain `git diff` / `git show` apply textconv helpers declared in
// .gitattributes BY DEFAULT — no command-line flag needed (audit: default
// textconv execution). The guard inspects only the command line, so allowed
// diff/show invocations are REWRITTEN to explicitly disable external helpers.
const PLANNING_GIT_TEXTCONV_RISKY_SUBCOMMANDS = new Set(["diff", "show"]);

/**
 * Returns the command rewritten to disable externally configured diff
 * helpers, or null when no rewrite is needed. The inserted flags sit right
 * after the subcommand, before all other tokens — always a valid position
 * for git options — and re-joining whitespace-separated tokens is
 * parse-equivalent for bash.
 */
export const hardenGitDiffCommand = (command: string): string | null => {
  const tokens = command.trim().split(/\s+/);
  if (tokens[0] !== "git") {
    return null;
  }
  const subcommandIndex = tokens.findIndex(
    (token, index) => index > 0 && !token.startsWith("-"),
  );
  if (subcommandIndex === -1) {
    return null;
  }
  const subcommand = tokens[subcommandIndex];
  if (!PLANNING_GIT_TEXTCONV_RISKY_SUBCOMMANDS.has(subcommand)) {
    return null;
  }
  return [
    ...tokens.slice(0, subcommandIndex + 1),
    "--no-ext-diff",
    "--no-textconv",
    ...tokens.slice(subcommandIndex + 1),
  ].join(" ");
};

// The browser review page fetches its final state after the user acts; keep
// the server alive briefly after a decision (merge-base behavior) instead of
// yanking it instantly. Abort/task-close cleanup stays immediate.
const BROWSER_REVIEW_STOP_GRACE_MS = 1500;

/**
 * Returns a human-readable refusal for a bash command that must not run
 * during the plannotator planning phase, or null when the command stays
 * within the read-only allowed set.
 *
 * Conservative by design: anything not explicitly allowed is blocked.
 * Compound shell syntax (`;`, `&&`, `||`, pipes, redirects, command
 * substitution, backgrounding, newlines) is rejected as a whole — it would
 * otherwise let a read-only-looking first token smuggle in mutating tail
 * commands (`ls; rm -rf ...`, `echo x > src/file.ts`) or fork execution
 * arbitrarily. `git` is further restricted to an explicit non-mutating
 * subcommand allowlist; flags that write or execute are blocked per command.
 */

/**
 * LAST-RESORT bound on how long an abandoned review server may stay
 * listening (e.g. the user dismisses the review modal and the page never
 * posts a decision back). Primary lifecycle cleanup is event-driven: task
 * abort / task close / extension unload each stop the server and unwind the
 * wait immediately.
 *
 * A short cap here (the previous 30s) auto-aborted ACTIVE human reviews
 * that simply took longer than the cap, so it must stay far beyond any
 * plausible review duration — 24h can never abort a normal review. Exported
 * for the lifecycle regression tests.
 */
export const BROWSER_REVIEW_MAX_OPEN_TIMEOUT_MS = 24 * 60 * 60 * 1000;

export const getPlanningBashBlockReason = (command: string): string | null => {
  const trimmed = command.trim();
  if (trimmed.length === 0) {
    return null;
  }
  // Command composition / redirection / substitution: reject before token
  // inspection so a read-only first token cannot smuggle extra commands.
  // Braces are rejected too: bash brace expansion (`{,-exec}`, `{,-o}`)
  // synthesizes new tokens AFTER validation (audit: brace expansion bypass).
  const compositionPattern = /[;&|<>`$(){}]|[\r\u2028\u2029\u000a\u000d]/;
  if (compositionPattern.test(trimmed)) {
    return "Only single read-only bash commands are allowed in planning phase (no pipes, redirects, command substitution, or command chaining).";
  }
  const tokens = trimmed.split(/\s+/);
  if (!PLANNING_BASH_READONLY_COMMANDS.has(tokens[0])) {
    return "Only read-only bash commands are allowed in planning phase (ls, cat, git, grep, etc.).";
  }
  if (tokens[0] === "git") {
    // The first content token after `git` is the subcommand. Option VALUE
    // forms like `git -C /path status` are blocked conservatively (the value
    // token would be misread as the subcommand) — false blocks are acceptable
    // here, false allows are not.
    const remaining = tokens.slice(1);
    // Git subcommands and global options are parsed by the shell before this
    // check. Reject quoting and escaping in git commands rather than trying to
    // reproduce shell tokenization, which could turn a harmless-looking token
    // such as `"push"` or `pu\u005csh` into a mutating subcommand.
    if (/["'\\^]/.test(trimmed)) {
      return "Shell quoting and escaping are not allowed in planning-phase git commands.";
    }
    const subcommandIndex = remaining.findIndex((token) => !token.startsWith("-"));
    const subcommand = subcommandIndex === -1 ? undefined : remaining[subcommandIndex];
    for (const rawToken of remaining.slice(0, subcommandIndex === -1 ? remaining.length : subcommandIndex)) {
      const token = stripShellQuoting(rawToken);
      const flagName = token.split("=", 1)[0];
      if (
        PLANNING_GIT_DENIED_GLOBAL_FLAGS.has(flagName) ||
        (token.startsWith("-c") && !token.startsWith("--") && token.length > 2)
      ) {
        return "Git configuration and execution-path options are not allowed in planning phase.";
      }
    }
    if (!subcommand || !PLANNING_GIT_READONLY_SUBCOMMANDS.has(subcommand)) {
      return "Only read-only git subcommands are allowed in planning phase (status, log, diff, show, etc.).";
    }
    // Nested subcommands: `git reflog` is read-only only bare or as an
    // explicit `show`/`list` — nested `expire`/`delete` destroy history
    // (audit: `git reflog expire --expire=now --all`).
    if (subcommand === "reflog" && subcommandIndex < remaining.length - 1) {
      const nested = remaining
        .slice(subcommandIndex + 1)
        .find((token) => !token.startsWith("-"));
      if (nested && nested !== "show" && nested !== "list") {
        return "Only read-only git subcommands are allowed in planning phase (status, log, diff, show, etc.).";
      }
    }
    // Subcommand-specific short flags that execute external commands
    // (`git grep -O<cmd>` opens a pager command, `git help -w` launches the
    // configured browser). Matched per letter so bundles cannot smuggle them.
    // `p` is denied globally (patches traverse the configured pager), layered
    // with the subcommand-specific letters (grep -O, help -w).
    const deniedShortLetters = new Set([
      "p",
      ...(PLANNING_GIT_DENIED_SHORT_LETTERS_BY_SUBCOMMAND[subcommand] ?? []),
    ]);
    if (deniedShortLetters.size > 0) {
      for (const token of remaining.slice(subcommandIndex + 1)) {
        const flag = stripShellQuoting(token);
        if (
          flag.startsWith("-") &&
          !flag.startsWith("--") &&
          [...flag.slice(1)].some((ch) => deniedShortLetters.has(ch))
        ) {
          return "Only read-only git flags are allowed in planning phase.";
        }
      }
    }
  }
  // Unquoted glob metacharacters expand BEFORE the command runs and can
  // resolve to filenames that BEGIN with a dash (`curl https://evil *` in a
  // directory containing a file named `-o`), injecting denied flags after
  // validation. Only read-only first-commands with dash-flag parsers need the
  // guard; legit glob use (find -name, rename patterns) is fine when quoted.
  if (
    tokens[0] === "find" ||
    tokens[0] === "curl" ||
    tokens[0] === "git" ||
    tokens[0] === "tree"
  ) {
    if (tokens.slice(1).some(hasUnquotedGlobMetachar)) {
      return "Unquoted glob metacharacters are not allowed in planning phase — quote the pattern.";
    }
  }
  const deniedLongFlags = PLANNING_BASH_DENIED_LONG_FLAGS[tokens[0]];
  if (deniedLongFlags) {
    let offending: string | undefined;
    for (const rawToken of tokens.slice(1)) {
      // Strip quoting/escaping BEFORE matching, so `-"o"`, `--'output'`,
      // `-\o`, and `-e"xec"` resolve to the actual flag the shell will see.
      const token = stripShellQuoting(rawToken);
      if (!token.startsWith("-") || token === "-" || token === "--") {
        continue;
      }
      // Git resolves unique long-option ABBREVIATIONS to their full flags
      // (`--open-files` runs as `--open-files-in-pager`, `--we` as `--web`),
      // so for git a flag name that prefixes any denied long flag must be
      // treated as that denied flag. curl/tree long flags do not abbreviate.
      const abbreviatesDenied =
        tokens[0] === "curl" || tokens[0] === "git"
          ? (name: string): boolean =>
              [...deniedLongFlags].some(
                (flag) => flag === name || flag.startsWith(name),
              )
          : (name: string): boolean => deniedLongFlags.has(name);
      if (abbreviatesDenied(token.split("=", 1)[0])) {
        offending = rawToken;
        break;
      }
      const deniedShortLetters =
        PLANNING_DENIED_SHORT_LETTERS_BY_COMMAND[tokens[0]];
      if (
        deniedShortLetters &&
        !token.startsWith("--") &&
        [...token.slice(1)].some((ch) => deniedShortLetters.has(ch))
      ) {
        offending = rawToken;
        break;
      }
    }
    if (offending) {
      return `Write/execute flags like ${offending} are not allowed in planning phase.`;
    }
  }
  // Header/query flags may read their value from a local file (`@/etc/passwd`)
  // and transmit it — deny the at-file operand spelling while preserving
  // literal inline headers such as -H 'Auth: Bearer x' (audit).
  if (tokens[0] === "curl") {
    const operands = tokens.slice(1).map(stripShellQuoting);
    for (let index = 0; index < operands.length; index++) {
      const token = operands[index];
      // Attached short-value spelling: curl accepts `-H@/tmp/secret` and
      // bundled `-sSH@/tmp/secret` — everything after the H letter IS the
      // header source, so an @-prefixed operand must be rejected there too
      // (audit: `-sSH@file` bypassed the following-token check).
      if (
        token.startsWith("-") &&
        !token.startsWith("--") &&
        token.includes("H") &&
        token.slice(token.indexOf("H") + 1).startsWith("@")
      ) {
        return "curl header/query operands from local files (@file) are not allowed in planning phase.";
      }
      const guardedFlag = resolveCurlFlag(
        PLANNING_CURL_FILE_OPERAND_FLAGS,
        token.split("=", 1)[0],
      );
      if (!guardedFlag) {
        continue;
      }
      const inlineOperand = token.includes("=") ? token.split("=", 2)[1] : undefined;
      const nextOperand = operands[index + 1];
      if (inlineOperand?.startsWith("@") || nextOperand?.startsWith("@")) {
        return "curl header/query operands from local files (@file) are not allowed in planning phase.";
      }
      // curl's `name@file` syntax embeds the @ INSIDE the operand: curl
      // sends the file contents as query data for `--url-query a@/tmp/x`.
      // Reject an @ within the NAME part (before the = delimiter) while
      // literal values like `--url-query 'x=1'` stay allowed (audit).
      if (guardedFlag === "--url-query") {
        const value = inlineOperand ?? nextOperand ?? "";
        if (value.split("=", 1)[0].includes("@")) {
          return "curl --url-query name@file operands are not allowed in planning phase.";
        }
      }
    }
  }
  return null;
};

interface PlannotatorConfig {
  /** Hostname or full origin the browser uses to reach this AiderDesk server. */
  host?: string;
  /** When true, open reviews in a browser/overlay via the local HTTP server. */
  browserReview?: boolean;
}

interface PendingDecision {
  kind: "plan";
  /** Unique ID for this review round. Emitted to the inline panel data and
   *  echoed back on panel actions, so a stale panel (superseded or closed
   *  review round) can be identified and its actions rejected. */
  reviewId: string;
  content: string;
  resolve: (result: { approved: boolean; feedback?: string }) => void;
  /** Detaches the abort handler and resolves the decision, e.g. as 'aborted'.
   *  Called when a superseding review replaces this entry or the task closes,
   *  so the waiting tool call never hangs on an orphaned decision. */
  dispose: () => void;
}

// Phase schema
type Phase = "idle" | "planning" | "executing";

interface TaskState {
  phase: Phase;
  planFile: string;
  checklistItems: ChecklistItem[];
}

// Planning instructions
const PLANNING_INSTRUCTIONS = `[PLANNOTATOR - PLANNING PHASE]
You are in plan mode. You MUST NOT make any changes to the codebase — no edits, no commits, no installs, no destructive commands. The ONLY file you may write to or edit is the plan file: {PLAN_PATH}

Available tools: file_read, glob, grep, bash (read-only), semantic_search, file_write ({PLAN_PATH} only), file_edit ({PLAN_PATH} only), exit_plan_mode

Do not run destructive bash commands (rm, git push, npm install, etc.) — focus on reading and exploring the codebase. Web fetching with curl (output to stdout only) is fine.

## Iterative Planning Workflow

You are pair-planning with the user. Explore the code to build context, then write your findings into PLAN.md as you go. The plan starts as a rough skeleton and gradually becomes the final plan.

### The Loop

Repeat this cycle until the plan is complete:

1. **Explore** — Use file_read, glob, grep, and bash to understand the codebase. Actively search for existing functions, utilities, and patterns that can be reused — avoid proposing new code when suitable implementations already exist.
2. **Update the plan file** — After each discovery, immediately capture what you learned in the plan file ({PLAN_PATH}). Don't wait until the end. Use file_write for the initial draft, then file_edit for all subsequent updates.
3. **Ask the user** — When you hit an ambiguity or decision you can't resolve from code alone, ask. Then go back to step 1.

### First Turn

Start by quickly scanning key files to form an initial understanding of the task scope. Then write a skeleton plan (headers and rough notes) and ask the user your first round of questions. Don't explore exhaustively before engaging the user.

### Asking Good Questions

- Never ask what you could find out by reading the code.
- Batch related questions together.
- Focus on things only the user can answer: requirements, preferences, tradeoffs, edge-case priorities.
- Scale depth to the task — a vague feature request needs many rounds; a focused bug fix may need one or none.

### Plan File Structure

Your plan file should use markdown with clear sections:
- **Context** — Why this change is being made: the problem, what prompted it, the intended outcome.
- **Approach** — Your recommended approach only, not all alternatives considered.
- **Files to modify** — List the critical file paths that will be changed.
- **Reuse** — Reference existing functions and utilities you found, with their file paths.
- **Steps** — Implementation checklist:
  - [ ] 1. Step 1 description
  - [ ] 2. Step 2 description
- **Verification** — How to test the changes end-to-end (run the code, run tests, manual checks).

Keep the plan concise enough to scan quickly, but detailed enough to execute effectively.

### When to Submit

Your plan is ready when you've addressed all ambiguities and it covers: what to change, which files to modify, what existing code to reuse, and how to verify. Call exit_plan_mode to submit for review.

### Revising After Feedback

When the user denies a plan with feedback:
1. Read {PLAN_PATH} to see the current plan.
2. Use the file_edit tool to make targeted changes addressing the feedback — do NOT rewrite the entire file.
3. Call exit_plan_mode again to resubmit.

### Ending Your Turn

Your turn should only end by either:
- Asking the user a question to gather more information.
- Calling exit_plan_mode when the plan is ready for review.`;

const EXECUTING_INSTRUCTIONS = `[PLANNOTATOR - EXECUTING PLAN]
Full tool access is enabled. Execute the plan from PLAN.md.

After completing each step, include [DONE:n] in your response where n is the step number.`;

export default class PlannotatorExtension implements Extension {
  static metadata = {
    name: "Plannotator",
    version: "1.3.0",
    description:
      "Plan-based development workflow with inline plan review, server/remote host support, and plan review utilizing plannotator.ai",
    author: "wladimiiir",
    iconUrl:
      "https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/plannotator/icon.png",
    capabilities: ["modes", "tools", "commands", "workflows"],
  };

  // Track state per task
  private taskStates: Map<string, TaskState> = new Map();

  // Pending inline review decisions keyed by task id (resolved from the UI component)
  private pendingDecisions: Map<string, PendingDecision> = new Map();

  // Active browser code-review servers keyed by task id. waitForDecision()
  // only settles when the user submits feedback, so a review that is
  // abandoned (task closed, extension unloaded, overlay dismissed without
  // acting) would otherwise leave a listening socket — and its page token —
  // alive until process exit. Tracked here for explicit disposal.
  private activeReviewServers: Map<string, Set<ReviewServerResult>> = new Map();

  private trackReviewServer(taskId: string, server: ReviewServerResult): void {
    let servers = this.activeReviewServers.get(taskId);
    if (!servers) {
      servers = new Set();
      this.activeReviewServers.set(taskId, servers);
    }
    servers.add(server);
  }

  private untrackReviewServer(
    taskId: string,
    server: ReviewServerResult,
  ): void {
    this.activeReviewServers.get(taskId)?.delete(server);
    if (this.activeReviewServers.get(taskId)?.size === 0) {
      this.activeReviewServers.delete(taskId);
    }
  }

  // Browser plan-review unwind finalizers keyed by task id: on task close the
  // pending browser review must resolve as "aborted" (and its server stop)
  // even when the tool's abort signal never propagates (audit: lifecycle gap).
  private activeBrowserReviewFinalizers: Map<string, Set<() => void>> =
    new Map();

  private trackBrowserReviewFinalizer(
    taskId: string,
    finalize: () => void,
  ): void {
    let finalizers = this.activeBrowserReviewFinalizers.get(taskId);
    if (!finalizers) {
      finalizers = new Set();
      this.activeBrowserReviewFinalizers.set(taskId, finalizers);
    }
    finalizers.add(finalize);
  }

  private untrackBrowserReviewFinalizer(
    taskId: string,
    finalize: () => void,
  ): void {
    this.activeBrowserReviewFinalizers.get(taskId)?.delete(finalize);
    if (this.activeBrowserReviewFinalizers.get(taskId)?.size === 0) {
      this.activeBrowserReviewFinalizers.delete(taskId);
    }
  }

  async onLoad(context: ExtensionContext) {
    context.log("Plannotator Extension loaded", "info");
  }

  async onUnload() {
    this.taskStates.clear();
    for (const pending of this.pendingDecisions.values()) {
      pending.dispose();
    }
    this.pendingDecisions.clear();
    // Shut down any still-listening review servers on the way out.
    for (const servers of this.activeReviewServers.values()) {
      for (const server of servers) {
        server.stop();
      }
    }
    this.activeReviewServers.clear();
    // Browser plan reviews: unwind any waiting tool call as "aborted" too, so
    // an unload/update while a review is open cannot hang the agent run.
    for (const finalizers of this.activeBrowserReviewFinalizers.values()) {
      for (const finalize of finalizers) {
        finalize();
      }
    }
    this.activeBrowserReviewFinalizers.clear();
  }

  // ── Configuration ────────────────────────────────────────────────────

  private getConfig(): PlannotatorConfig {
    try {
      if (existsSync(CONFIG_PATH)) {
        const data = JSON.parse(
          readFileSync(CONFIG_PATH, "utf-8"),
        ) as PlannotatorConfig;
        return {
          browserReview: data.browserReview === true,
          host: data.host || "",
        };
      }
    } catch {
      // Ignore malformed config, use defaults
    }
    return { browserReview: false, host: "" };
  }

  /**
   * Resolve the host to use for plannotator HTTP server URLs.
   * Priority: extension config setting → PLANNOTATOR_HOST env → auto-detected LAN address.
   */
  private getHost(): string {
    const configHost =
      typeof this.getConfig().host === "string"
        ? this.getConfig().host.trim()
        : "";
    const envHost =
      typeof process.env.PLANNOTATOR_HOST === "string"
        ? process.env.PLANNOTATOR_HOST.trim()
        : "";
    if (configHost) {
      return configHost;
    }
    if (envHost) {
      return envHost;
    }
    // Auto-detect the LAN address so browsers on other machines (e.g. remote/headless
    // AiderDesk setups) can reach the review server instead of hitting 'localhost'.
    return getLocalAddress();
  }

  getConfigComponent(): string {
    // Loaded defensively at module init (same as PlanReviewComponent.jsx): a
    // missing file (partial install/uninstall) must not throw here and crash
    // the host's configuration dispatch.
    return configComponentJsx;
  }

  async getConfigData(): Promise<PlannotatorConfig> {
    return this.getConfig();
  }

  async saveConfigData(configData: unknown): Promise<unknown> {
    const config = configData as PlannotatorConfig;
    writeFileSync(
      CONFIG_PATH,
      JSON.stringify(
        {
          host: typeof config.host === "string" ? config.host : "",
          browserReview: config.browserReview === true,
        },
        null,
        2,
      ),
      "utf-8",
    );
    return config;
  }

  // ── Inline Review UI ────────────────────────────────────────────────

  getUIComponents(): UIComponentDefinition[] {
    if (!planReviewComponentJsx) {
      return [];
    }
    // Rendered once at task level ('task-messages-top') instead of per-message
    // ('task-message-above'): renderer passes the `message` prop only for
    // FINISHED messages, but the pending plan-review data only exists while the
    // exit_plan_mode tool call is still running. Message-scoped gating would
    // therefore never match. Scoping/safety is preserved by only rendering when
    // the extension-supplied data is an active plan review (data.kind === 'plan').
    return [
      {
        id: PLAN_REVIEW_COMPONENT_ID,
        placement: "task-messages-top",
        name: "Plannotator Plan Review",
        loadData: true,
        noDataCache: true,
        jsx: planReviewComponentJsx,
      },
    ];
  }

  async getUIExtensionData(
    componentId: string,
    context: ExtensionContext,
  ): Promise<unknown> {
    if (componentId !== PLAN_REVIEW_COMPONENT_ID) {
      return null;
    }
    const taskContext = context.getTaskContext();
    if (!taskContext) {
      return null;
    }
    const pending = this.pendingDecisions.get(taskContext.data.id);
    if (!pending || pending.kind !== "plan") {
      return null;
    }
    return {
      kind: "plan" as const,
      plan: pending.content,
      reviewId: pending.reviewId,
    };
  }

  async executeUIExtensionAction(
    componentId: string,
    action: string,
    args: unknown[],
    context: ExtensionContext,
  ): Promise<unknown> {
    if (componentId !== PLAN_REVIEW_COMPONENT_ID) {
      return null;
    }
    const taskContext = context.getTaskContext();
    if (!taskContext) {
      return null;
    }
    const taskId = taskContext.data.id;
    const pending = this.pendingDecisions.get(taskId);
    if (!pending || pending.kind !== "plan") {
      return null;
    }

    if (action !== "approve" && action !== "deny") {
      return null;
    }
    const reviewArgs = args[0] as
      | { feedback?: string; reviewId?: string }
      | undefined;
    // Audit hardening: UI actions cross the component boundary untyped, so a
    // malformed payload (e.g. { feedback: 42 }) may arrive here. Only actual
    // strings may be trimmed and resolved into a decision — a non-string
    // feedback normalizes to empty instead of throwing on .trim() and
    // crashing the whole action dispatch.
    const feedback =
      typeof reviewArgs?.feedback === "string" ? reviewArgs.feedback.trim() : "";
    // Approve/deny MUST echo a NON-EMPTY reviewId matching the CURRENT
    // pending decision. A missing/empty/mismatched ID means the payload did
    // not come from the panel that rendered the current round (stale panel
    // rendered before the ID existed, forged payload, ...) — accepting it
    // would let such a payload resolve a superseded decision. Treat all three
    // cases identically as stale instead of normalizing a missing ID to null.
    const echoedReviewId = reviewArgs?.reviewId;
    if (
      typeof echoedReviewId !== "string" ||
      echoedReviewId.length === 0 ||
      echoedReviewId !== pending.reviewId
    ) {
      context.log(
        "Ignoring stale plan review action (review ID missing or mismatch)",
        "warn",
      );
      // The stale panel already rendered its "Review submitted..." state —
      // force a data refresh so it re-arms for the current round (or hides
      // once the pending data is gone) instead of staying stale.
      context.triggerUIDataRefresh(PLAN_REVIEW_COMPONENT_ID, taskId);
      return { ok: false, stale: true };
    }
    this.pendingDecisions.delete(taskId);
    pending.resolve(
      action === "approve"
        ? { approved: true, feedback }
        : { approved: false, feedback: feedback || "Plan rejected" },
    );
    // Refresh the panel so it picks up the removed pending data and hides.
    context.triggerUIDataRefresh(PLAN_REVIEW_COMPONENT_ID, taskId);
    context.log(
      action === "approve"
        ? "Plan approved via inline review"
        : "Plan rejected via inline review",
      "info",
    );
    return { ok: true };
  }

  // ── Modes ────────────────────────────────────────────────────────────

  getModes(): ModeDefinition[] {
    return [
      {
        name: "plannotator",
        label: "Plannotator",
        description: "Planning and execution workflow with tool restrictions",
        icon: "GoProjectRoadmap",
      },
    ];
  }

  // ── Commands ──────────────────────────────────────────────────────────

  getCommands(): CommandDefinition[] {
    return [
      {
        name: "plannotator",
        description: "Toggle plannotator mode",
        arguments: [
          {
            description: "Plan file path (default: PLAN.md)",
            required: false,
          },
        ],
        execute: async (args: string[], context: ExtensionContext) => {
          const taskContext = context.getTaskContext();
          if (!taskContext) {
            context.log("No task context available", "error");
            return;
          }

          const currentMode = taskContext.data.currentMode;
          const planFile = args[0] || "PLAN.md";

          if (currentMode === "plannotator") {
            // Exit plannotator mode
            await taskContext.updateTask({ currentMode: "agent" });
            taskContext.addLogMessage(
              "info",
              "Exited plannotator mode. Switched to agent mode.",
            );
          } else {
            // Enter plannotator mode
            await taskContext.updateTask({ currentMode: "plannotator" });

            // Initialize task state with planning phase
            const taskState = this.getTaskState(taskContext.data.id);
            taskState.phase = "planning";
            // Store the plan in AiderDesk's per-task directory so plans are organized
            // per-task and accessible to other extensions
            const taskDir = join(
              context.getProjectDir(),
              ".aider-desk",
              "tasks",
              taskContext.data.id,
            );
            mkdirSync(taskDir, { recursive: true });
            taskState.planFile = join(taskDir, planFile);

            const planRelative = taskState.planFile.replace(
              context.getProjectDir() + "/",
              "",
            );
            taskContext.addLogMessage(
              "info",
              `Entered plannotator mode. Create your plan in ${planRelative}`,
            );
          }
        },
      },
      {
        name: "plannotator-review",
        description: "Open code review UI for current git changes",
        arguments: [],
        execute: async (_args: string[], context: ExtensionContext) => {
          const taskContext = context.getTaskContext();
          const projectContext = context.getProjectContext();
          const cwd = projectContext?.baseDir;

          try {
            const gitContext = getGitContext(cwd);
            const { patch, label } = runGitDiff(
              "uncommitted",
              gitContext.defaultBranch,
              cwd,
            );

            if (!patch.trim()) {
              taskContext?.addLogMessage(
                "info",
                "No uncommitted changes to review.",
              );
              return;
            }

            if (!this.getConfig().browserReview) {
              await this.runInlineCodeReview(context, patch, label);
              return;
            }

            if (!reviewHtmlContent) {
              const errorMsg =
                "Error: Code review UI not available. review-editor.html file is missing.";
              context.log(errorMsg, "error");
              taskContext?.addLogMessage("error", errorMsg);
              return;
            }

            context.log("Starting code review server...", "info");
            const server = startReviewServer({
              rawPatch: patch,
              gitRef: label,
              htmlContent: reviewHtmlContent,
              origin: "aiderdesk",
              diffType: "uncommitted",
              gitContext,
              cwd,
              host: this.getHost(),
            });
            // waitForDecision() hangs until the user submits feedback, so an
            // abandoned review (throwing openUrl, task closed via
            // onTaskClosed, extension unloaded) must dispose of the server.
            // Track it and ALWAYS stop it when this command unwinds.
            const taskId = taskContext?.data?.id ?? "";
            this.trackReviewServer(taskId, server);
            try {
              context.log(
                `Opening code review UI at ${redactPageToken(server.url)}`,
                "info",
              );
              // Failures must not become floating unhandled rejections and
              // must not leave the review server listening on a decision that
              // can never arrive: stop it here, mirroring the plan review path.
              try {
                await context.openUrl(server.url, "modal-overlay");
              } catch (error) {
                context.log(
                  `Failed to open code review UI: ${redactPageToken(
                    error instanceof Error ? error.message : String(error),
                  )}`,
                  "error",
                );
                return;
              }

              // No short timeout that could abort an active review: the
              // wait is bounded only by the (very long) abandoned-server
              // cap and by event-driven task abort/close/unload cleanup.
              let openTimeout: ReturnType<typeof setTimeout> | undefined;
              const result = await Promise.race([
                server.waitForDecision(),
                new Promise<{ feedback: string; aborted: true }>((resolve) => {
                  openTimeout = setTimeout(
                    () => resolve({ feedback: "", aborted: true }),
                    BROWSER_REVIEW_MAX_OPEN_TIMEOUT_MS,
                  );
                  openTimeout.unref?.();
                }),
              ]);
              if (openTimeout) {
                clearTimeout(openTimeout);
              }

              // An abandoned review (task closed / extension unloaded while
              // awaiting feedback) settles via server stop with an aborted
              // marker: skip both the feedback prompt and the success log —
              // no decision was ever submitted (audit).
              if (result.aborted) {
                return;
              }

              // Grace period so the review page can render its final state
              // before the server (and the page token with it) goes away.
              await new Promise((resolve) => setTimeout(resolve, BROWSER_REVIEW_STOP_GRACE_MS));

              if (result.feedback) {
                void context
                  .getTaskContext()
                  ?.runPrompt(
                    `\`\`\`\n${result.feedback}\`\`\`\n\nAddress the Core Review Feedback.`,
                  );
              } else {
                taskContext?.addLogMessage("info", "Code review completed.");
              }
            } finally {
              this.untrackReviewServer(taskId, server);
              server.stop();
            }
          } catch (error) {
            const errorMsg =
              error instanceof Error
                ? error.message
                : "Unknown error starting code review";
            context.log(`${redactPageToken(errorMsg)}`, "error");
            taskContext?.addLogMessage("error", redactPageToken(errorMsg));
          }
        },
      },
    ];
  }

  // ── Tools ─────────────────────────────────────────────────────────────

  getTools(
    context: ExtensionContext,
    mode: string,
    agentProfile: AgentProfile,
  ): ToolDefinition[] {
    if (agentProfile.isSubagent || mode !== "plannotator") {
      return [];
    }
    return [
      {
        name: "exit_plan_mode",
        description:
          "Exit planning phase and proceed to execution. Call this after your plan file is ready for implementation.",
        inputSchema: z.object({
          summary: z.string().optional().describe("Brief summary of the plan"),
        }),
        execute: async (input, signal, context: ExtensionContext) => {
          const taskContext = context.getTaskContext();
          if (!taskContext) {
            return "Error: No task context available.";
          }

          const taskState = this.getTaskState(taskContext.data.id);

          if (taskState.phase !== "planning") {
            return "Error: Not in planning phase. Use /plannotator to enter plannotator mode first.";
          }

          const planPath = resolve(taskState.planFile);
          if (!existsSync(planPath)) {
            return `Error: ${taskState.planFile} does not exist. Write your plan first, then call exit_plan_mode again.`;
          }

          const planContent = readFileSync(planPath, "utf-8");
          if (planContent.trim().length === 0) {
            return `Error: ${taskState.planFile} is empty. Write your plan first, then call exit_plan_mode again.`;
          }

          // Parse checklist items
          taskState.checklistItems = parseChecklist(planContent);
          context.log(
            `Parsed ${taskState.checklistItems.length} checklist items`,
            "info",
          );

          // Always surface the plan in the chat so it is never lost, even without a browser
          taskContext.addLogMessage(
            "info",
            `Plan ready for review — approve or request changes${this.getConfig().browserReview ? " in the review window" : " using the inline review panel at the top of the task"}.`,
          );
          context.log("Plan ready for review", "info");

          const useInline =
            !!planReviewComponentJsx && !this.getConfig().browserReview;

          // Decide via inline UI component (default) or browser/server review
          const result = useInline
            ? await this.runInlinePlanReview(
                context,
                taskContext.data.id,
                planContent,
                signal,
              )
            : await this.runBrowserPlanReview(context, planContent, signal);

          // Handle abort and unavailable review UI distinctly: only a real
          // interruption is reported as user interruption.
          if (result === "aborted") {
            taskContext.addLogMessage(
              "info",
              "Plan review was interrupted by user",
            );
            return "Interrupted by user";
          }
          if (result === "unavailable") {
            taskContext.addLogMessage(
              "error",
              "Plan review UI is unavailable. plannotator.html is missing — reinstall or repair the plannotator extension.",
            );
            return "Error: plan review UI is unavailable (plannotator.html missing). Reinstall or repair the plannotator extension, then call exit_plan_mode again.";
          }

          if (result.approved) {
            // Switch to executing phase
            taskState.phase = "executing";
            context.log(
              `Task ${taskContext.data.id} transitioned to executing phase`,
              "info",
            );

            // Create SPEC.md symlink → PLAN.md in the task directory. Executor
            // extensions (like Conductor) look up the spec via SPEC.md — the symlink
            // bridges planning and execution without duplicating the plan contents.
            try {
              const specPath = join(dirname(planPath), "SPEC.md");
              if (!existsSync(specPath)) {
                symlinkSync(basename(planPath), specPath);
                context.log(
                  `Created SPEC.md symlink → ${basename(planPath)} at ${specPath}`,
                  "info",
                );
              }
            } catch (symlinkError) {
              // EEXIST and similar are non-fatal; execution can proceed without the link
              context.log(
                `Failed to create SPEC.md symlink: ${symlinkError instanceof Error ? symlinkError.message : symlinkError}`,
                "warn",
              );
            }

            const doneMsg =
              taskState.checklistItems.length > 0
                ? "After completing each step, include [DONE:n] in your response where n is the step number."
                : "";

            const feedbackMsg = result.feedback
              ? `\n\n## Implementation Notes\n\nThe user approved your plan but added the following notes to consider during implementation:\n\n${result.feedback}\n\nProceed with implementation, incorporating these notes where applicable.`
              : "";

            return `Plan approved! You now have full tool access (read, bash, edit, write). Execute the plan in ${taskState.planFile}. ${doneMsg}${feedbackMsg}`;
          } else {
            // Plan rejected - agent must revise
            const feedbackText =
              result.feedback || "Plan rejected. Please revise.";
            context.log("Plan rejected by user", "info");

            return `Plan not approved.\n\nUser feedback: ${feedbackText}\n\nRevise the plan:\n1. Read ${taskState.planFile} to see the current plan.\n2. Use the file_edit tool to make targeted changes addressing the feedback above — do not rewrite the entire file.\n3. Call exit_plan_mode again when ready.`;
          }
        },
      },
    ];
  }

  // ── Event Handlers ────────────────────────────────────────────────────

  async onTaskClosed(
    event: TaskClosedEvent,
    context: ExtensionContext,
  ): Promise<void> {
    // Clean up task state. Resolve (not just delete) any pending review so the
    // waiting exit_plan_mode call unwinds instead of hanging forever.
    this.taskStates.delete(event.task.id);
    this.pendingDecisions.get(event.task.id)?.dispose();
    this.pendingDecisions.delete(event.task.id);
    // Shut down any browser code-review server still waiting on this task:
    // its waitForDecision() would otherwise never settle (the user can no
    // longer act on a closed task), leaking a listening socket for the
    // lifetime of the process.
    for (const server of this.activeReviewServers.get(event.task.id) ?? []) {
      server.stop();
    }
    this.activeReviewServers.delete(event.task.id);
    // Browser plan reviews: stop (idempotent) and unwind the waiting tool
    // call as "aborted" so it cannot hang on a never-arriving decision.
    for (const finalize of this.activeBrowserReviewFinalizers.get(event.task.id) ?? []) {
      finalize();
    }
    this.activeBrowserReviewFinalizers.delete(event.task.id);
    // Refresh the panel so the now-stale review UI disappears instead of
    // staying clickable against a pending decision that no longer exists.
    context.triggerUIDataRefresh(PLAN_REVIEW_COMPONENT_ID, event.task.id);
    context.log(`Task closed and state cleaned up: ${event.task.id}`, "debug");
  }

  async onToolCalled(
    event: ToolCalledEvent,
    context: ExtensionContext,
  ): Promise<void | Partial<ToolCalledEvent>> {
    const taskContext = context.getTaskContext();
    if (!taskContext || taskContext.data.currentMode !== "plannotator") {
      return undefined;
    }

    const taskState = this.getTaskState(taskContext.data.id);

    if (taskState.phase !== "planning") {
      return undefined;
    }

    // Special handling for file_write and file_edit
    if (
      event.toolName === "power---file_write" ||
      event.toolName === "power---file_edit"
    ) {
      const projectContext = context.getProjectContext();
      if (!projectContext) {
        return undefined;
      }

      const filePath = (event.input as { filePath?: string })?.filePath;
      if (typeof filePath !== "string") {
        return undefined;
      }

      // Resolve both paths against the project dir — usePlanFile is normally
      // absolute (task dir) but may be relative in legacy/edge cases
      const allowedPath = resolve(projectContext.baseDir, taskState.planFile);
      const targetPath = resolve(projectContext.baseDir, filePath);

      if (targetPath !== allowedPath) {
        context.log(
          `Blocked write to ${filePath} (only ${taskState.planFile} allowed)`,
          "warn",
        );
        return {
          output: `Plannotator: writes are restricted to ${taskState.planFile} during planning. Blocked: ${filePath}`,
        };
      }

      // Append keeps its semantics (it only adds to the allowed plan file);
      // only create_only/undefined coerce to overwrite so plan updates never
      // fail on an existing file — and never silently destroy content that
      // append semantics promised to keep.
      if (
        event.toolName === "power---file_write" &&
        event.input.mode !== "overwrite" &&
        event.input.mode !== "append"
      ) {
        return {
          input: {
            ...event.input,
            mode: "overwrite",
          },
        };
      }
    }

    // Restrict bash commands to read-only
    if (event.toolName === "power---bash") {
      const command = (event.input as { command?: string })?.command;
      if (typeof command !== "string") {
        return undefined;
      }

      const blockReason = getPlanningBashBlockReason(command);
      if (blockReason) {
        context.log(`Blocked non-read-only bash command: ${command}`, "warn");
        return {
          output: blockReason,
        };
      }

      // Harden allowed git diff/show commands against repository-declared
      // textconv helpers (.gitattributes can wire arbitrary commands and
      // porcelain applies them by default — see hardenGitDiffCommand).
      const hardened = hardenGitDiffCommand(command);
      if (hardened !== null) {
        return {
          input: {
            ...(event.input as Record<string, unknown>),
            command: hardened,
          },
        };
      }
    }

    return undefined;
  }

  async onToolApproval(
    event: ToolApprovalEvent,
    context: ExtensionContext,
  ): Promise<void | Partial<ToolApprovalEvent>> {
    const taskContext = context.getTaskContext();
    if (!taskContext || taskContext.data.currentMode !== "plannotator") {
      return undefined;
    }

    const taskState = this.getTaskState(taskContext.data.id);

    if (taskState.phase !== "planning") {
      return undefined;
    }

    if (
      event.toolName !== "power---file_write" &&
      event.toolName !== "power---file_edit"
    ) {
      return undefined;
    }

    const filePath = (event.input as { filePath?: string })?.filePath;
    if (typeof filePath !== "string") {
      return undefined;
    }

    // Resolve both paths against the project dir — planFile is normally
    // absolute (task dir) but may be relative in legacy/edge cases
    const projectContext = context.getProjectContext();
    const targetPath = projectContext
      ? resolve(projectContext.baseDir, filePath)
      : filePath;
    const allowedPath = projectContext
      ? resolve(projectContext.baseDir, taskState.planFile)
      : resolve(taskState.planFile);

    if (targetPath === allowedPath) {
      context.log(`Auto-approving ${event.toolName} for ${filePath}`, "debug");
      return { allowed: true };
    }

    return undefined;
  }

  async onAgentStarted(
    event: AgentStartedEvent,
    context: ExtensionContext,
  ): Promise<void | Partial<AgentStartedEvent>> {
    // Only inject context if in plannotator mode and not a subagent
    if (event.mode !== "plannotator" || event.agentProfile.isSubagent) {
      return undefined;
    }

    const taskContext = context.getTaskContext();
    if (!taskContext) {
      return undefined;
    }

    const taskState = this.getTaskState(taskContext.data.id);

    // If entering plannotator mode for the first time, start in planning phase
    // and resolve the plan path to the AiderDesk task directory
    if (taskState.phase === "idle") {
      taskState.phase = "planning";
      // Mode may be set from the UI without going through /plannotator, so the plan
      // path may still be relative — pin it to the task directory here
      if (!taskState.planFile.includes(".aider-desk")) {
        const taskDir = join(
          context.getProjectDir(),
          ".aider-desk",
          "tasks",
          taskContext.data.id,
        );
        mkdirSync(taskDir, { recursive: true });
        taskState.planFile = join(taskDir, taskState.planFile);
      }
      context.log(
        `Task ${taskContext.data.id} entering plannotator mode - starting planning phase`,
        "info",
      );
    }

    context.log(`Plannotator mode active - phase: ${taskState.phase}`, "info");

    let instructions: string;

    if (taskState.phase === "planning") {
      // replaceAll: the {PLAN_PATH} placeholder appears multiple times in the instructions
      instructions = PLANNING_INSTRUCTIONS.replaceAll(
        "{PLAN_PATH}",
        taskState.planFile,
      );
    } else if (taskState.phase === "executing") {
      // Re-read plan file and parse checklist
      const planPath = resolve(taskState.planFile);
      if (existsSync(planPath)) {
        const planContent = readFileSync(planPath, "utf-8");
        taskState.checklistItems = parseChecklist(planContent);
      }

      const remaining = taskState.checklistItems.filter((t) => !t.completed);
      if (remaining.length > 0) {
        const todoList = remaining.map((t) => `- [ ] ${t.text}`).join("\n");
        instructions = `${EXECUTING_INSTRUCTIONS}\n\nRemaining steps:\n${todoList}`;
      } else {
        instructions = EXECUTING_INSTRUCTIONS;
      }
    } else {
      return undefined;
    }

    const instructionMessage = {
      id: "plannotator-instructions",
      role: "user" as const,
      content: instructions,
    };

    return { contextMessages: [instructionMessage, ...event.contextMessages] };
  }

  async onAgentFinished(
    event: AgentFinishedEvent,
    context: ExtensionContext,
  ): Promise<void | Partial<AgentFinishedEvent>> {
    const taskContext = context.getTaskContext();
    if (!taskContext || taskContext.data.currentMode !== "plannotator") {
      return undefined;
    }

    const taskState = this.getTaskState(taskContext.data.id);

    if (
      taskState.phase !== "executing" ||
      taskState.checklistItems.length === 0
    ) {
      return undefined;
    }

    // Track [DONE:n] markers in result messages
    let hasChanges = false;
    for (const message of event.resultMessages) {
      if (message.role === "assistant" && typeof message.content === "string") {
        const completedCount = markCompletedSteps(
          message.content,
          taskState.checklistItems,
        );
        if (completedCount > 0) {
          hasChanges = true;
        }
      }
    }

    if (hasChanges) {
      // Check if all items are completed
      if (taskState.checklistItems.every((t) => t.completed)) {
        taskContext.addLogMessage("info", "Plan execution completed!");
      }
    }

    return undefined;
  }

  async onImportantReminders(
    event: ImportantRemindersEvent,
    context: ExtensionContext,
  ): Promise<void | Partial<ImportantRemindersEvent>> {
    const taskContext = context.getTaskContext();
    if (!taskContext || taskContext.data.currentMode !== "plannotator") {
      return undefined;
    }

    const taskState = this.getTaskState(taskContext.data.id);

    if (taskState.phase !== "planning") {
      return undefined;
    }

    // Add reminder about exit_plan_mode
    const planFileRelative = taskState.planFile.replace(
      context.getProjectDir() + "/",
      "",
    );
    const reminder = `\n## Plannotator Mode Active

You are in planning phase. Your available tools are restricted to read-only operations and writing to ${planFileRelative}.

**When your plan is ready**: Call the \`exit_plan_mode\` tool to exit planning phase and begin implementation. Your plan should be complete with all sections filled out (Context, Approach, Files to modify, Steps, Verification).`;

    return {
      remindersContent: event.remindersContent + reminder,
    };
  }

  // ── Plan Review Helpers ──────────────────────────────────────────────

  /**
   * Present the plan via the inline task-message review component and wait for
   * the user's approve/deny decision. No browser/XDG required — works in
   * headless and remote-server deployments.
   */
  private async runInlinePlanReview(
    context: ExtensionContext,
    taskId: string,
    plan: string,
    signal?: AbortSignal,
  ): Promise<{ approved: boolean; feedback?: string } | "aborted"> {
    // A concurrent exit_plan_mode for the same task supersedes this decision:
    // detach its abort handler and resolve it as 'aborted' so the earlier tool
    // call never hangs on a permanently orphaned pending decision.
    this.pendingDecisions.get(taskId)?.dispose();

    return new Promise((resolve) => {
      const abortHandler = () => {
        this.pendingDecisions.delete(taskId);
        // Refresh the panel so it picks up the removed pending data and hides.
        context.triggerUIDataRefresh(PLAN_REVIEW_COMPONENT_ID, taskId);
        resolve("aborted");
      };

      const decision = new Promise<{ approved: boolean; feedback?: string }>(
        (decisionResolve) => {
          this.pendingDecisions.set(taskId, {
            kind: "plan",
            reviewId: randomUUID(),
            content: plan,
            resolve: decisionResolve,
            dispose: () => {
              // Superseded by a newer review or the task closed: detach the abort
              // handler and resolve as 'aborted' so the waiting call unwinds.
              signal?.removeEventListener("abort", abortHandler);
              resolve("aborted");
            },
          });
        },
      );

      // Refresh the inline component so it picks up the new plan
      context.triggerUIDataRefresh(PLAN_REVIEW_COMPONENT_ID, taskId);

      // Abort events do not replay for listeners added afterwards: an
      // already-aborted signal must be handled before registering, otherwise
      // the pending decision would remain registered forever.
      if (signal?.aborted) {
        abortHandler();
        return;
      }
      signal?.addEventListener("abort", abortHandler);
      decision.then((result) => {
        signal?.removeEventListener("abort", abortHandler);
        resolve(result);
      });
    });
  }

  /**
   * Present the plan via the local HTTP server opened in a browser/overlay.
   * Used when browser-based review is enabled in settings.
   */
  private async runBrowserPlanReview(
    context: ExtensionContext,
    plan: string,
    signal?: AbortSignal,
  ): Promise<
    { approved: boolean; feedback?: string } | "aborted" | "unavailable"
  > {
    if (!planHtmlContent) {
      context.log(
        "Error: Review UI not available. plannotator.html file is missing.",
        "error",
      );
      // Not a user interruption — report it as an environment problem so the
      // caller does not surface "Interrupted by user".
      return "unavailable";
    }

    context.log("Starting plan review server...", "info");
    const server = startPlanReviewServer({
      plan,
      htmlContent: planHtmlContent,
      origin: "aiderdesk",
      host: this.getHost(),
    });

    context.log(
      `Opening modal-overlay with ${redactPageToken(server.url)}`,
      "info",
    );
    // Track the server BEFORE awaiting openUrl: task shutdown can land in
    // that window, and onTaskClosed/onUnload must be able to stop the server
    // and unwind the review even if the tool's abort signal is never
    // replayed (audit: tracking gap while openUrl is pending).
    const taskId = context.getTaskContext()?.data.id;
    if (taskId) {
      this.trackReviewServer(taskId, server as unknown as ReviewServerResult);
    }

    return new Promise<
      { approved: boolean; feedback?: string } | "aborted" | "unavailable"
    >(
      (resolve) => {
        let settled = false;
        let abortHandler: (() => void) | null = null;
        let openTimeout: ReturnType<typeof setTimeout> | null = null;
        const finish = (
          result:
            | { approved: boolean; feedback?: string }
            | "aborted"
            | "unavailable",
        ): void => {
          if (settled) {
            return;
          }
          settled = true;
          if (openTimeout) {
            clearTimeout(openTimeout);
            openTimeout = null;
          }
          if (abortHandler) {
            signal?.removeEventListener("abort", abortHandler);
          }
          if (taskId) {
            this.untrackReviewServer(
              taskId,
              server as unknown as ReviewServerResult,
            );
            this.untrackBrowserReviewFinalizer(taskId, finalizer);
          }
          // Grace period so the review page can render its final state before
          // the server (and the page token with it) goes away; abort/task-close
          // cleanup stays immediate (merge-base behavior; audit finding).
          const stopTimer = setTimeout(
            () => {
              server.stop();
            },
            result === "aborted" ? 0 : BROWSER_REVIEW_STOP_GRACE_MS,
          );
          stopTimer.unref?.();
          resolve(result);
        };
        // Task close / unload unwinds the waiting tool call as "aborted"
        // even if the tool's abort signal never fires.
        const finalizer = () => finish("aborted");
        abortHandler = () => finish("aborted");
        if (taskId) {
          this.trackBrowserReviewFinalizer(taskId, finalizer);
        }
        // A dismissed modal can resolve openUrl without ever submitting a
        // decision. Cleanup here is event-driven (task abort / close /
        // unload via the registered finalizer); this timer is only the
        // last-resort bound that stops the server + page token leaking
        // indefinitely. It is deliberately long so it can never abort an
        // active human review (audit: the previous 30s cap did).
        openTimeout = setTimeout(
          () => finish("aborted"),
          BROWSER_REVIEW_MAX_OPEN_TIMEOUT_MS,
        );
        openTimeout.unref?.();
        // Failures must not become floating unhandled rejections: surface
        // them here so a broken/failed open does not leave the review server
        // waiting on a decision that can never arrive.
        void context.openUrl(server.url, "modal-overlay").then(
          () => {
            if (settled) {
              return;
            }
            // Abort events do not replay for listeners added afterwards: an
            // already-aborted signal must be handled before registering.
            if (signal?.aborted) {
              finish("aborted");
              return;
            }
            signal?.addEventListener("abort", abortHandler);
            server.waitForDecision().then((decision) => {
              finish(decision);
            });
          },
          (error: unknown) => {
            context.log(
              `Failed to open plan review UI: ${redactPageToken(
                error instanceof Error ? error.message : String(error),
              )}`,
              "error",
            );
            finish("unavailable");
          },
        );
      },
    );
  }

  /**
   * Present a git diff inline in the chat and collect the user's review
   * decision without opening a browser. Reached when browser review is off.
   */
  private async runInlineCodeReview(
    context: ExtensionContext,
    patch: string,
    label: string,
  ): Promise<void> {
    const taskContext = context.getTaskContext();
    // Fence with the next-longest backtick run so a ``` sequence inside the
    // patch cannot break out of the block; cut on a code-point boundary so
    // truncation never splits a UTF-16 surrogate pair.
    const fence = "`".repeat(
      Math.max(
        3,
        Math.max(0, ...(patch.match(/`+/g)?.map((run) => run.length) ?? [0])) +
          1,
      ),
    );
    let diffSummary = patch;
    if (patch.length > 12000) {
      let cut = 12000;
      while (
        cut > 0 &&
        patch.charCodeAt(cut - 1) >= 0xd800 &&
        patch.charCodeAt(cut - 1) <= 0xdbff
      ) {
        cut--;
      }
      diffSummary = `${patch.slice(0, cut)}\n\n… (truncated, ${patch.split("\n").length} lines total)`;
    }

    context.log(`Code review started (${label})`, "info");
    taskContext?.addLogMessage(
      "info",
      `Code review for: ${label}\n${fence}diff\n${diffSummary}\n${fence}\n\nApprove or request changes below.`,
    );

    const answer = await context
      .getTaskContext()
      ?.askQuestion(
        "Review the changes shown above. Approve them, or request changes?",
        {
          subject: "Code Review",
          answers: [
            { text: "Approve", shortkey: "a" },
            { text: "Request changes", shortkey: "r" },
          ],
        },
      );

    // askQuestion resolves with the matched answer's shortkey (see
    // Task.askQuestion → determinedAnswer), so 'a'/'r' mean Approve /
    // Request changes here. ONLY an explicit "Request changes" answer may
    // trigger the follow-up runPrompt: banners like the auto-answered 'n'
    // (any unrelated user message while the question is pending), free text
    // or undefined are dismissals — treating them as implicit change requests
    // would spawn spurious autonomous runs.
    if (answer === "Request changes" || answer?.toLowerCase() === "r") {
      context.log("Code review: changes requested", "info");
      taskContext?.addLogMessage(
        "info",
        "Code review: changes requested. Describe what to change and the agent will address it.",
      );
      void context
        .getTaskContext()
        ?.runPrompt(
          "The user requested changes to the current code. Ask the user what specifically they want changed, then address their feedback.",
        );
      return;
    }

    if (answer === "Approve" || answer?.toLowerCase() === "a") {
      context.log("Code review approved", "info");
      taskContext?.addLogMessage("info", "Code review approved.");
      return;
    }

    context.log("Code review dismissed (no matching answer)", "info");
    taskContext?.addLogMessage(
      "info",
      "Code review dismissed — no decision recorded.",
    );
  }

  // ── Task State Management ─────────────────────────────────────────────

  private getTaskState(taskId: string): TaskState {
    if (!this.taskStates.has(taskId)) {
      this.taskStates.set(taskId, {
        phase: "idle",
        planFile: "PLAN.md",
        checklistItems: [],
      });
    }
    return this.taskStates.get(taskId)!;
  }
}

# Verifier Extension

Adds a **"Proceed & Verify"** button to task state actions when a task reaches **Ready for Implementation** state. Clicking the button starts the implementation and automatically reviews it against the plan once it completes.

## How It Works

1. **Plan Creation** — The agent creates an implementation plan for a task, which transitions to the `READY_FOR_IMPLEMENTATION` state.
2. **Proceed & Verify** — A "Proceed & Verify" button appears in the task state bar. Clicking it:
   - Captures the original user request and the generated plan
   - Starts watching the task for completion
   - Sends the `"Proceed."` prompt to begin implementation
3. **Automatic Review** — When the task reaches `READY_FOR_REVIEW`:
   - Creates a review subtask with all modified files as read-only context
   - Instructs the reviewer to verify the implementation against the plan
   - Expects a `VERDICT: PASS` or `VERDICT: FAIL` response
4. **Fix Loop** — If the review fails:
   - Extracts failure details and sends them back as a fix prompt
   - Waits for the task to reach `READY_FOR_REVIEW` again
   - Repeats the review up to the configured **Max Retries**
5. **Completion** — If the review passes or max retries are reached, the task is unwatched.

## Screenshots

**Proceed & Verify Button**

![Proceed & Verify Button](https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/verifier/proceed-and-verify.png)

**Verification Task in Action**

![Verification Task Example](https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/verifier/verifier-example.png)

## When to Use

- You want to ensure implementations match their plans automatically
- You work with structured task workflows where plans are generated before coding
- You want a manual trigger for verification rather than automatic watching of all tasks

## Configuration

The extension has a configurable **Max Retries** setting (default: `3`):

- Open **Settings → Extensions → Verifier**
- Set the maximum number of review-and-fix cycles (1–20)
- The value is stored in the extension's `config.json`

## Requirements

- Tasks must use the standard state machine (`READY_FOR_IMPLEMENTATION` → `IN_PROGRESS` → `READY_FOR_REVIEW`)
- The agent must produce a plan in the conversation before the task reaches `READY_FOR_IMPLEMENTATION`

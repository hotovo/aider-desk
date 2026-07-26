# Task Scheduler

Schedule tasks to run automatically on a cron or periodic basis.

![Task Scheduler screenshot](https://raw.githubusercontent.com/hotovo/aider-desk/main/packages/extensions/extensions/task-scheduler/screenshot.png)

## Features

- **Cron schedules**: Use standard 5-field cron expressions (e.g., `*/5 * * * *` for every 5 minutes)
- **Periodic schedules**: Run tasks at fixed intervals (e.g., every 30 minutes)
- **One-time schedules**: Parse natural language times (e.g., "in 2 hours", "tomorrow at 9am")
- **Max runs**: Limit the number of automatic executions
- **Pause/Resume**: Temporarily pause a schedule without losing it
- **Run Now**: Trigger an immediate scheduled execution
- **Subtask chaining**: Periodic schedules wait for the previous subtask to complete before starting the next run

## Usage

1. **Write your prompt**: Create a new task and write the prompt you want to run on a schedule. Save the task without running it yet.
2. **Set up the schedule**: With the task saved, configure when it should run using either:
   - The **Set Schedule** button in the task state actions area, which opens an edit form where you can choose between cron or periodic scheduling.
   - The **`/schedule`** slash command (see below).
3. **Manage**: Once scheduled, the task runs automatically. You can pause/resume, edit, run now, or cancel the schedule at any time from the task state actions.

### Slash Command

```
/schedule                      # Set default hourly schedule
/schedule */5 * * * *          # Every 5 minutes (cron)
/schedule 0 9 * * 1            # Every Monday at 9am (cron)
/schedule in 30 minutes        # One-time in 30 minutes
/schedule tomorrow at 9am      # One-time tomorrow at 9am
```

### UI

- **Task State Actions**: A **Set Schedule** button appears in the task state actions area for unscheduled tasks. Click it to configure a schedule with the edit form.
- **Task Sidebar**: A schedule icon appears next to scheduled tasks in the sidebar, with a tooltip showing the next run time.

## How It Works

1. Schedule data is stored per-project in `.aider-desk/schedules.json`
2. When a project starts, the extension loads all schedules and starts cron timers
3. When a schedule fires, the task is duplicated and the duplicate is run automatically
4. The original task's schedule state is updated (runs completed, next run time)
5. For periodic schedules, the next run waits for the subtask to complete (detected via `onTaskClosed`)

## Use Cases

The task scheduler is versatile — any task that benefits from running on a recurring basis is a good candidate. Below are some practical examples.

### Nightly Cleanup

Remove temporary files, stale branches, unused imports, and build artifacts to keep the project lean.

**Prompt:** "Clean up the project: remove any temporary or generated files, delete stale local branches that have been merged, and identify any unused dependencies or imports."

**Schedule:** Cron — `0 2 * * *` (Every day at 2 AM)

---

### Automated Daily Code Review

Review all the changes made during the day and flag potential issues, bugs, or improvements.

**Prompt:** "Review all the commits from today. Summarize the changes, flag any potential bugs, code smells, or security concerns, and suggest improvements."

**Schedule:** Cron — `0 18 * * *` (Every day at 6 PM)

---

### Periodic Test Runner

Run the full test suite on a schedule to catch regressions early, especially in long-running development branches.

**Prompt:** "Run the full test suite (`npm run test`) and report the results. If any tests fail, investigate and suggest fixes."

**Schedule:** Cron — `0 */4 * * *` (Every 4 hours)

---

### Dependency Update Check

Check for outdated or vulnerable dependencies and propose updates.

**Prompt:** "Check for outdated npm dependencies and known security vulnerabilities (`npm audit`). List any packages that need updating and suggest the appropriate version bumps."

**Schedule:** Cron — `0 9 * * 1` (Every Monday at 9 AM)

---

### Nightly Code Formatting & Linting

Keep the codebase consistently formatted and lint-clean by running formatting and lint fixes overnight.

**Prompt:** "Run the linter and formatter across the entire codebase (`eslint --fix .` and `prettier --write .`). Summarize any files that were changed and any lint errors that couldn't be auto-fixed."

**Schedule:** Cron — `0 1 * * *` (Every day at 1 AM)

---

### Daily Project Summary

Generate a summary of what was accomplished each day — useful for standups, changelogs, or keeping stakeholders informed.

**Prompt:** "Generate a summary of today's activity in this project. Include commits made, files changed, features added, bugs fixed, and any outstanding issues. Format it as a daily changelog."

**Schedule:** Cron — `0 19 * * *` (Every day at 7 PM)

---

### GitHub Trends Research

Discover trending repositories that could offer ideas, tools, or integrations relevant to your project.

**Prompt:** "Search GitHub for trending repositories in topics relevant to this project. Identify any tools, libraries, or techniques that could be integrated or adopted. Summarize your findings with links."

**Schedule:** Cron — `0 10 * * 1` (Every Monday at 10 AM)

---

### Fork Analysis

Check the forks of your project to find interesting features or improvements contributed by the community that could be merged upstream.

**Prompt:** "Look at the forks of this repository. Find any that have added noteworthy features, bug fixes, or improvements that aren't in the main repo yet. Summarize each interesting fork and what it adds, with links."

**Schedule:** Cron — `0 10 * * 5` (Every Friday at 10 AM)

---

### Security Vulnerability Scan

Run recurring security audits to catch newly disclosed vulnerabilities in dependencies or identify insecure code patterns.

**Prompt:** "Perform a security review of the codebase: run `npm audit`, check for any known CVEs in dependencies, and scan for common security anti-patterns (hardcoded secrets, insecure API usage, etc.). Provide a report with severity levels and remediation suggestions."

**Schedule:** Cron — `0 8 * * *` (Every day at 8 AM)

---

## Dependencies

- `node-cron` — cron job scheduling
- `cron-parser` — next run calculation
- `cronstrue` — human-readable cron descriptions
- `chrono-node` — natural language date parsing

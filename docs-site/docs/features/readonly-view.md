---
title: "Readonly View Mode"
sidebar_label: "Readonly View Mode"
---

# Readonly View Mode

Readonly View Mode turns AiderDesk into a server-enforced, browser-accessible dashboard where visitors can browse projects and inspect complete task traces — messages, tool results, command output, and code — without being able to modify anything through the normal API surface.

When enabled, every browser route is automatically redirected to `/#/readonly`, which serves a dedicated read-only UI shell. The standard REST API and direct Socket.IO mutations are blocked at the server level.

## Enabling Readonly Mode

There are two ways to enable Readonly View Mode depending on your deployment.

### Option 1: Electron App (Runtime Toggle)

In the desktop application, Readonly Mode can be toggled at runtime via the Network Settings:

1. Open **Settings** (gear icon, top-right).
2. Navigate to the **Network** tab.
3. Under the **Server** section, enable **Readonly**.
4. A nested checkbox — **Extension UI in Readonly View** — appears (defaults to enabled). Uncheck it to suppress all extension UI components in the readonly browser view.
5. Start (or restart) the server for the change to take effect.

The setting is stored in `settings.server.readonly` and evaluated dynamically per-request. Toggling it requires a server stop/start cycle — the checkbox is disabled while the server is running.

### Option 2: Docker / Headless (Immutable)

For server or container deployments, set the `AIDER_DESK_READONLY` environment variable to `true`. You must also specify at least one project via `AIDER_DESK_PROJECTS`:

```bash
docker run -d \
  -p 24337:24337 \
  -v ~/projects:/projects \
  -e AIDER_DESK_READONLY=true \
  -e AIDER_DESK_PROJECTS="/projects/public-app,/projects/public-api" \
  ghcr.io/hotovo/aider-desk:latest
```

This mode is **immutable** for the process lifetime — it cannot be toggled at runtime. All configured projects are started automatically before the readonly UI becomes available. See [Docker](../advanced/docker.md#readonly-browser-deployments) for the full environment variable reference.

Optional Basic Auth (`AIDER_DESK_USERNAME` / `AIDER_DESK_PASSWORD`) or the in-app Basic Auth settings continue to protect the deployment.

## What's Available vs. What's Blocked

| Capability | Readonly Mode | Normal Mode |
|---|---|---|
| Browse projects & tasks | ✅ | ✅ |
| View full task traces (messages, tool results, output) | ✅ | ✅ |
| Real-time updates (Socket.IO allowlisted events) | ✅ | ✅ |
| Display settings (theme, font, language) | ✅ | ✅ |
| Extension UI components (if enabled) | ✅ | ✅ |
| Extension UI actions (trusted) | ✅ | ✅ |
| Run prompts | ❌ | ✅ |
| Add/remove context files | ❌ | ✅ |
| Project management (start/stop/restart) | ❌ | ✅ |
| Settings management | ❌ | ✅ |
| File diff viewing | ❌ | ✅ |
| Terminal operations | ❌ | ✅ |
| All other REST API endpoints | ❌ (403 `READ_ONLY_MODE`) | ✅ |

### Readonly API Endpoints

The readonly UI communicates through a dedicated set of endpoints under `/api/readonly/`:

| Endpoint | Method | Description |
|---|---|---|
| `/api/readonly/bootstrap` | GET | Returns bootstrap data (mode, projects, display settings, extension UI flag) |
| `/api/readonly/tasks` | GET | Lists all tasks for a project |
| `/api/readonly/tasks/:taskId` | GET | Loads full task state (messages, context files, etc.) |
| `/api/readonly/extensions/ui-components` | GET | Lists extension UI components for a placement |
| `/api/readonly/extensions/ui-data` | GET | Fetches data for a specific extension component |
| `/api/readonly/extensions/library` | GET | Loads a shared extension library bundle |
| `/api/readonly/extensions/ui-action` | POST | Executes an extension UI action (trusted) |

All other `/api/` routes return `403` with `{ "error": "...", "code": "READ_ONLY_MODE" }`.

### Real-Time Events

The readonly UI subscribes to a curated set of Socket.IO events for live updates:

- `task-created`, `task-updated`, `task-started`, `task-completed`, `task-cancelled`, `task-deleted`
- `user-message`, `response-chunk`, `response-completed`
- `tool`, `tool-input-chunk`
- `log`, `command-output`
- `clear-task`, `message-removed`
- `extension-ui-refresh`

Direct Socket.IO mutations (e.g., running prompts, sending messages) are blocked — only these read-only event types are forwarded to browser clients.

## Extensions in Readonly Mode

Extensions are the key differentiator that makes Readonly View Mode more than a static dashboard.

### How Extensions Work in Readonly Mode

1. **UI Components**: Extension UI components render at all standard placements — header bars, task status bars, message areas, and floating overlays — exactly as in the full application.
2. **UI Actions**: Extension actions (button clicks, form submissions, etc.) are sent to the server via `POST /api/readonly/extensions/ui-action`. These actions are **fully trusted** and have access to the complete `ExtensionContext`, including `TaskContext` and `ProjectContext`. This means extensions can read and write task/project state, add messages, trigger data refreshes, and more.
3. **Disabling Extension UI**: If you want a pure read-only dashboard without any extension interactivity, uncheck **Extension UI in Readonly View** in Network Settings (or set `settings.server.readonlyExtensionUi` to `false`). This suppresses all extension UI components from rendering in the readonly browser view. The API endpoints remain available server-side, but the UI won't render any extension components.

:::caution Extension Actions Are Trusted
Extension UI actions bypass the readonly restriction by design — they are operator-installed, trusted code. Only install extensions you trust in readonly deployments. If extension UI is enabled, any visitor with access to the readonly view can trigger extension actions.
:::

### Extension Placements Available in Readonly View

All extension UI placements are available in the readonly shell, including:

- `header-left`, `header-right`
- `task-status-bar-left`, `task-status-bar-right`
- `task-top-bar-left`, `task-top-bar-right`
- `task-messages-top`, `task-messages-bottom`
- `task-message-above`, `task-message-below`, `task-message-bar`
- `app-floating`, `project-floating`, `task-floating`

See [Creating Extensions](../extensions/creating-extensions.md#available-placements) for the complete list.

## Use Cases

### Public Task Dashboard

Share your AI-assisted development work with stakeholders, clients, or team members in real-time. They can watch tasks progress, see what the agent did, and review the full conversation — all without risk of accidentally modifying anything.

**Setup**: Run AiderDesk in a Docker container with `AIDER_DESK_READONLY=true`, expose the port or use a [Cloudflare Tunnel](../configuration/settings.md), and share the URL.

### Code Review & Audit Trail

Use Readonly View Mode as an immutable record of what the AI did during a session. Reviewers can inspect tool calls, command output, and the reasoning behind each step. Since no modifications are possible, the view serves as a reliable audit trail.

### Client Demonstrations

Show live progress on a project to clients without giving them access to modify anything. Combine with [Basic Auth](#option-2-docker--headless-immutable) to control who can view the dashboard.

### Educational Sharing

Instructors can share AiderDesk sessions with students, who can study the AI's approach, tool usage patterns, and code generation steps. Extension-powered interactivity (see below) can add Q&A or discussion capabilities.

## Extensions-Powered Public Interactions

Because extension UI actions remain fully functional in Readonly View Mode, you can build extensions that turn a public readonly instance into an interactive platform. Here are some practical examples.

### Commenting System

Allow visitors to leave comments on tasks or individual messages.

```typescript
export default class CommentingExtension implements Extension {
  getUIComponents(): UIComponentDefinition[] {
    return [
      {
        id: 'comment-box',
        placement: 'task-messages-bottom',
        loadData: true,
        jsx: `
(props) => {
  const { data, ui, executeExtensionAction } = props;
  const { Button, Input } = ui;
  const [text, setText] = React.useState('');

  return (
    <div className="p-4 border-t border-border">
      {data?.comments?.map((c) => (
        <div key={c.id} className="text-xs mb-2">
          <strong>{c.author}</strong>: {c.text}
        </div>
      ))}
      <div className="flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment..." />
        <Button size="xs" onClick={() => executeExtensionAction('add-comment', [text])}>
          Post
        </Button>
      </div>
    </div>
  );
}
        `,
      },
    ];
  }

  async getUIExtensionData(componentId: string, context: ExtensionContext): Promise<unknown> {
    if (componentId === 'comment-box') {
      const taskContext = context.getTaskContext();
      const taskDir = taskContext?.getTaskDir();
      // Load comments from task directory or external storage
      return { comments: await loadComments(taskDir) };
    }
    return undefined;
  }

  async executeUIExtensionAction(
    componentId: string,
    action: string,
    args: unknown[],
    context: ExtensionContext,
  ): Promise<unknown> {
    if (action === 'add-comment') {
      const taskContext = context.getTaskContext();
      const taskDir = taskContext?.getTaskDir();
      await saveComment(taskDir, args[0] as string);
      context.triggerUIDataRefresh('comment-box');
      return { success: true };
    }
    return undefined;
  }
}
```

### Approval / Voting

Let stakeholders approve or vote on proposed changes directly from the readonly view. Place an approval button in the task status bar:

```typescript
{
  id: 'approval-button',
  placement: 'task-status-bar-right',
  loadData: true,
  jsx: `
(props) => {
  const { data, ui, executeExtensionAction } = props;
  const { Button } = ui;
  const approved = data?.approved ?? false;

  return (
    <Button
      variant={approved ? 'solid' : 'outline'}
      color={approved ? 'primary' : 'tertiary'}
      size="xs"
      onClick={() => executeExtensionAction('toggle-approval')}
    >
      {approved ? '✓ Approved' : 'Approve'}
    </Button>
  );
}
  `,
}
```

### Feedback Collection

Add a structured feedback form as a floating component that visitors can fill out without leaving the page:

```typescript
{
  id: 'feedback-widget',
  placement: 'app-floating',
  loadData: true,
  jsx: `
(props) => {
  const { data, ui, executeExtensionAction } = props;
  const { Button, Input } = ui;
  const [open, setOpen] = React.useState(false);
  const [feedback, setFeedback] = React.useState('');

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>💬 Feedback</Button>
    );
  }

  return (
    <div className="bg-bg-secondary rounded-lg p-4 shadow-lg w-80 space-y-2">
      <h3 className="text-sm font-medium">Share your feedback</h3>
      <textarea
        className="w-full text-xs p-2 rounded bg-bg-primary"
        rows={4}
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="What do you think?"
      />
      <div className="flex justify-end gap-2">
        <Button size="xs" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="xs" onClick={() => { executeExtensionAction('submit-feedback', [feedback]); setOpen(false); }}>
          Submit
        </Button>
      </div>
    </div>
  );
}
  `,
}
```

### Task Status Dashboard

Render a high-level overview of all tasks across projects using the `header-right` or `project-floating` placement, showing counts, progress indicators, or status badges pulled from extension data.

### Q&A / Discussion Thread

Embed a discussion thread within each task using `task-message-below` placement. Visitors can ask questions about specific AI actions, and the responses are stored alongside the task for future reference.

## Security Considerations

- **Full Trace Exposure**: Readonly View Mode exposes complete task traces, including tool results, command output, file paths, and embedded code snippets. Do not enable it for projects containing sensitive or private information.
- **Extension Actions Are Trusted**: If extension UI is enabled, visitors can trigger extension actions that may modify state. Only install extensions you fully trust. Disable extension UI (`settings.server.readonlyExtensionUi = false`) if you want a guaranteed zero-interaction dashboard.
- **Use Authentication**: Always protect public-facing readonly deployments with Basic Auth (`AIDER_DESK_USERNAME` / `AIDER_DESK_PASSWORD` or in-app credentials).
- **Network Exposure**: Use Cloudflare Tunnel or a reverse proxy with TLS for public deployments. Avoid exposing the server directly without authentication.

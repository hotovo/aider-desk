# DBX

Embeds the [DBX](https://github.com/t8y2/dbx) database client into AiderDesk as a full-featured modal. DBX is a lightweight open-source database manager supporting 100+ databases (MySQL, PostgreSQL, SQLite, Redis, MongoDB, ClickHouse, and more), message queues (Kafka, RabbitMQ, MQTT), and more — all without leaving AiderDesk.

## Features

- **Header button** — a database icon in the header (`header-right` placement, pulsing while the container is starting) opens the DBX modal.
- **Embedded DBX web UI** — the full DBX interface rendered in an Electron `<webview>` inside a `ModalOverlayLayout` modal (iframe fallback for browser mode).
- **Stateful modal** — the webview stays mounted after the first open: DBX session, open tabs, and settings survive close/reopen. UI preferences (theme, layout) persist across AiderDesk restarts.
- **Docker or external instance** — either start a managed DBX container via testcontainers, or connect to an already running DBX Web/Docker deployment.
- **Local disk access** — optional mounted drives make host folders available inside the container for file-based databases like SQLite (`/dbx-mounts/<folder-name>/...`).
- **Persistent data** — connections and settings are stored outside the extension folder, surviving reinstalls.

## Requirements

- Docker (for `docker` mode). No Docker needed for `url` mode (or when pointing the modal at a `url`-mode instance).

## Configuration (extension settings)

| Setting | Description |
| --- | --- |
| `Mode` | `docker` — automatically start a DBX container; `url` — connect to an external DBX Web instance |
| `DBX URL` | URL of the existing DBX instance (only in `url` mode) |
| `Mounted drives` | One host folder per line (docker mode), each bind-mounted at `/dbx-mounts/<folder-name>` inside the container. Used to access file-based databases such as SQLite and for the file browser. Changing drives restarts the container. |

## Notes

- In docker mode the container binds a **fixed host port** so the UI origin stays stable — theme/layout settings persist across AiderDesk restarts.
- Some DBX features (e.g. "Open folder" with server-side directory browsing) are gated by DBX itself in the web client and only work in the desktop app.
- Drag & drop file preview (Parquet, CSV, JSON) works in the web UI for quick inspection of files.
- No commands or agent tools are registered — see the DBX `@dbx-app/mcp-server` npm package if you want DBX-connected agent tools.

# Sound Notification

Plays a notification sound when an agent finishes a task or needs your input, using packs from [og-packs](https://github.com/PeonPing/og-packs).

## Features

- **Sound on task finished / input needed** — configurable sound pack and sound per event
- **Multiple delivery modes** — play on the AiderDesk host (OS player), in remote browser tabs (synthesized Web Audio chimes), or both
- **Per-kind browser sound mapping** — choose a chime preset (bell, ding, chime, soft, or silent) and enable/disable each notification kind
- **Configurable browser chime volume**
- **Normally only the primary tab plays** — among all open browser tabs, normally only the primary visible tab plays; rare duplicate chimes are possible after the primary lease expires before acknowledgement
- **Test sounds** — preview each event sound from the settings panel, and test browser chimes from the Remote Sounds panel

## Delivery Modes

Configured via **Settings → Extensions → Sound Notification → Delivery Mode**:

| Mode | Behavior |
| --------------- | --------------------------------------------------------------------------------------------- |
| `local` (default) | Plays pack sounds with an OS player on the AiderDesk host (desktop app users) |
| `browser` | Synthesized Web Audio chimes in open remote browser tabs only |
| `both` | Local playback plus browser-tab playback |

Local playback requires an audio player to be available on the machine running AiderDesk. It is unaffected by browsers and works even when no tabs are open.

## Remote Browser Sounds

Browser delivery works in any non-Electron AiderDesk tab (e.g., AiderDesk accessed from another device or browser window):

1. Set the delivery mode to `browser` or `both`.
2. Open an AiderDesk tab in the browser. The **Remote Sounds** panel appears.
3. Click **Enable sounds in this browser**. Browsers only allow audio after a user gesture, so this step is required — without it, notifications are counted as missed and replayed once sounds are enabled.
4. Optionally click **Test sound** to verify playback.

Browser chimes are synthesized with Web Audio (no downloads). Each notification kind (`task-finished`, `input-needed`, `generic`) can be enabled individually and mapped to a preset: **Bell**, **Ding**, **Chime**, **Soft**, or **Silent**. The master **Browser sound volume** slider applies to all remote chimes.

Sounds play from the tab only while it stays open and visible. Multiple open tabs elect a single primary tab, so each notification normally chimes in one tab only (rare duplicate chimes are still possible, e.g. when the primary lock expires or a tab disappears) — if no tab claims the notification, it is missed and shown in the panel.

## Deployment Notes

Remote browser delivery doesn't require a special tunneling setup: the extension is served by the AiderDesk server itself, so it just needs the remote browser to be able to **reach the AiderDesk server (e.g., a public URL, tunnel, or VPN)**. For example:

- **Remote browser on LAN / VPN** — access AiderDesk via its local or VPN address directly.
- **Remote browser on the public internet** — expose AiderDesk over HTTPS through a reverse proxy or tunnel (e.g., Cloudflare Tunnel/ngrok).

No SSH tunnel is needed if the browser can reach the AiderDesk server by any of these means. Note that the audio is synthesized in your browser; the sound pack files are only used for local (host) playback.

## Configuration

Settings are in **Settings → Extensions → Sound Notification → Configure**:

- **Delivery Mode** — `local` (default), `browser`, or `both`
- **Browser sound volume** — 0–100%
- **Per-kind browser sounds** — enable checkbox + chime preset for task finished / input needed / other
- **Task Finished / Question Asked** — sound pack and sound selection, with play-preview buttons and a **Refresh Packs** action that re-fetches the pack catalog from GitHub

Config values are deep-merged over defaults on load, so older installs pick up the new delivery settings automatically.

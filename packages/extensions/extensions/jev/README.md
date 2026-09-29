# Jev Extension for AiderDesk

Brings [Jev](https://typesafe.ai) — a fast, typed decision model (~300 ms, a fraction of a cent per call) — to AiderDesk agents as two tools. Jev answers **noul** (yes/no probability), **choice** (pick one declared option with probabilities), and **score** (position on an ordered scale) questions about a *state*: your own text, project files, or a command's output — and the agent only ever receives the typed answers, never the content.

Ported from [disler/ten-levels-of-jev](https://github.com/disler/ten-levels-of-jev) (MIT).

## Tools

### `ask-jev`
Ask typed questions about one situation (files, a command's output, your own state, or any mix).

- `questions_json` — raw Jev question block keyed by question id
- `state` — plain text or a JSON object as a string (≤ 8k chars; pass files/commands instead of pasting)
- `paths` — files or globs read into `files["path"]` (≤ 20 files, ~60k token total budget; over the budget the call is refused with a split suggestion)
- `command` — runs in the project context; result goes to `output {command, exit_code, stdout, stderr}`; gated through Jev's bash gate (irreversible/destructive commands are blocked)

### `ask-jev-files`
Scout many files at once: paths, globs, or directories are expanded and pruned (`node_modules`, `dist`, binaries, oversized files drop out with a reason, 255-file cap), then judged one call per file — all in parallel — never entering the model's context. Optional `pick_first` second pass selects the file worth opening first (always one of the listed paths, or null).

## Providers

| Provider | Endpoint | Notes |
| --- | --- | --- |
| TypeSafe | `https://api.typesafe.ai/v1/systemone` | native contract, model `jev-latest` |
| OpenRouter | `https://openrouter.ai/api/alpha/decisions` | native contract, model `~typesafe/jev-latest` |
| Requesty | Chat Completions + `response_format` questions | native contract responses mapped back |
| Mock | offline, deterministic | no network, for testing |

API key resolution order: extension config override → AiderDesk provider settings key (`llmProviders.openrouter.apiKey` / `llmProviders.requesty.apiKey`) → environment variable (`TYPESAFE_API_KEY` / `OPENROUTER_API_KEY` / `REQUESTY_API_KEY`).

## Commands

- `/jev-test` — verify the configuration with a live request; logs the resolved provider, model, latency, and answer.

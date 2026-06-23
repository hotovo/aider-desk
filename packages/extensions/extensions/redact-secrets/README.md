# Redact Secrets Extension

An AiderDesk extension that automatically redacts secrets from file read results using two complementary layers.

## What it does

### Layer 1: Regex-based pattern matching

Scans all file read output for known secret formats and replaces them with `<redacted-secret>`:

- **OpenAI keys**: `sk-...`, `sk-proj-...`
- **Anthropic keys**: `sk-ant-...`
- **AWS access keys**: `AKIA...`, `ASIA...`
- **GitHub tokens**: `gh[opsur]_...`, `github_pat_...`
- **Google API keys**: `AIza...`
- **Slack tokens**: `xox[bpsare]-...`
- **Stripe keys**: `sk_live_...`, `pk_test_...`, `rk_live_...`, etc.
- **JWTs**: `eyJ...`
- **Bearer tokens**: `Bearer ...`
- **Inline env assignments**: `API_KEY=value`, `SECRET=value`, `PASSWORD=value`, etc. (quote-aware — preserves key name, redacts only the value)

### Layer 2: .env* file value redaction

Loads all `.env*` files from the project directory and identifies secrets by matching key patterns:

- `API_KEY`, `TOKEN`, `SECRET`, `PASSWORD`, `PRIVATE_KEY`, `ACCESS_KEY`, `AUTH_TOKEN`, `BEARER`, `CREDENTIAL`

Values from matching keys are replaced with `<redacted-secret>` wherever they appear in file read output.

## Installation

1. Copy the extension directory to your AiderDesk extensions folder:

```bash
# Global (available to all projects)
cp -r redact-secrets ~/.aider-desk/extensions/

# Or project-specific
cp -r redact-secrets .aider-desk/extensions/
```

2. Install dependencies:

```bash
cd ~/.aider-desk/extensions/redact-secrets
npm install
```

3. Restart AiderDesk

## Example

Given a `.env` file:

```
DATABASE_URL=postgres://localhost:5432/mydb
OPENAI_API_KEY=sk-1234567890abcdef
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
```

When the agent reads a file containing `sk-1234567890abcdef` or `ghp_xxxxxxxxxxxx`, the output will show `<redacted-secret>` instead.

Additionally, any file containing secret-like patterns (e.g., a stray `sk-proj-abc123...` in a source file, or `Bearer eyJhbG...` in a log) will also be redacted via regex matching, even if no `.env` file references them.

Note: `DATABASE_URL` is not redacted via env-value matching because it doesn't match the secret key patterns (though its value would still be redacted if it matched a regex pattern).

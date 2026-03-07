# Redact Secrets Extension

An AiderDesk extension that automatically redacts secret values from `.env*` files when reading files.

## What it does

- Loads all `.env*` files from your project directory
- Identifies secrets by matching key patterns: `API_KEY`, `TOKEN`, `SECRET`, `PASSWORD`, `PRIVATE_KEY`, `ACCESS_KEY`, `AUTH_TOKEN`, `BEARER`, `CREDENTIAL`
- Intercepts `power---file_read` tool results and replaces secret values with `<redacted-secret>`

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

Note: `DATABASE_URL` is not redacted because it doesn't match the secret key patterns.

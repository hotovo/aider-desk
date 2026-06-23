# Protected Paths Extension

An AiderDesk extension that blocks read, write, and edit operations on sensitive files and protected system directories.

## What it does

Intercepts `power---file_read`, `power---file_write`, and `power---file_edit` tool calls and blocks access to:

### Secret basename patterns

Files whose basename matches known sensitive file patterns are blocked on both read and write:

- `.env*` — environment files (including `.env.local`, `.env.production`, etc.)
- `*.pem`, `*.key`, `*.p12`, `*.pfx` — private keys and certificates
- `*.asc`, `*.gpg` — PGP/GPG armored keys
- `*.keystore`, `*.jks` — Java keystores
- `id_rsa`, `id_ed25519`, `id_ecdsa`, `id_dsa` (and variants like `.pub`, `.bak`, `_old`)
- `known_hosts`, `authorized_keys` — SSH files
- `htpasswd` — Apache password files
- `.netrc`, `_netrc` — netrc credential files
- `credentials` — AWS/GCP credential files
- `.pgpass`, `.npmrc`, `.pypirc` — tool credentials
- `secrets.{json,yaml,yml,toml,env}` — explicit secrets files
- `service-account*.json` — GCP service account keys

### Protected directories

Directories that commonly contain secrets or system-critical files are blocked on read and write:

- `/.ssh`, `/.gnupg` — SSH and GPG directories
- `/.aws`, `/.azure`, `/.kube`, `/.docker` — cloud/container config
- `/.config/gh`, `/.config/git`, `/.config/gcloud`, `/.config/op` — CLI credentials
- `/.git` — git internals
- `/.terraform.d` — Terraform state
- `/etc`, `/private/etc` — system configuration
- `/proc`, `/sys` — kernel/process state (leaks env vars, PII)
- `/var/db`, `/var/root` — system databases and root home
- `/library/keychains`, `/library/cookies` — macOS keychain and cookies
- `node_modules/` — dependency directories
- Windows credential stores (`AppData/.../Credentials`, `AppData/.../gcloud`)

### Write-deny prefixes

System locations blocked on write only (reading `/etc/hosts` is fine; writing to it isn't):

- `/etc/`, `/var/db/`, `/var/root/`, `/private/etc/`, `/private/var/db/`, `/private/var/root/`
- `/usr/bin/`, `/usr/sbin/`, `/usr/local/bin/`, `/bin/`, `/sbin/`, `/boot/`
- `/system/`, `/library/keychains/`, `/library/launchagents/`, `/library/launchdaemons/`
- `/windows/`, `/program files/`, `/program files (x86)/`, `/programdata/`

### Path normalization

All paths are normalized before matching to handle cross-platform edge cases:

- Backslashes converted to forward slashes
- Windows drive prefixes (`C:`) stripped
- UNC/extended-length prefixes (`//?/`) stripped
- NTFS alternate data streams (`name:stream`, `name::$DATA`) stripped
- Trailing dots/spaces stripped per segment (Windows behavior)
- Duplicate slashes collapsed
- Case-insensitive matching
- Control bytes in paths rejected

## Installation

1. Copy the extension directory to your AiderDesk extensions folder:

```bash
# Global (available to all projects)
cp -r protected-paths ~/.aider-desk/extensions/

# Or project-specific
cp -r protected-paths .aider-desk/extensions/
```

2. Restart AiderDesk

## Patterns credit

Security patterns adapted from [Terax-AI](https://github.com/terax-ai/terax) (Apache-2.0).

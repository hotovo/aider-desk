---
sidebar_position: 1
title: "Custom Aider Version" 
sidebar_label: "Custom Aider Version"
---

# Using a Custom Aider Version

AiderDesk allows you to specify a custom version of the `aider-chat` Python package to be used. This is particularly useful if you need to test a specific Aider release, a development branch, or even a local clone of the Aider repository.

## How it Works

You can control the Aider version by setting the `AIDER_DESK_AIDER_VERSION` environment variable before launching AiderDesk. AiderDesk will use the value of this variable when installing `aider-chat` via `pip`.

If this variable is not set, AiderDesk will default to installing the latest stable version of `aider-chat` from PyPI.

## Setting the Environment Variable

The method for setting an environment variable depends on your operating system and shell.

**macOS/Linux (bash/zsh):**
```bash
export AIDER_DESK_AIDER_VERSION="your_version_specifier"
# Then launch AiderDesk from the same terminal session
```

**Windows (PowerShell):**
```powershell
$env:AIDER_DESK_AIDER_VERSION = "your_version_specifier"
# Then launch AiderDesk from the same PowerShell session
```

**Windows (Command Prompt):**
```cmd
set AIDER_DESK_AIDER_VERSION="your_version_specifier"
# Then launch AiderDesk from the same Command Prompt session
```

## Version Specifier Examples

The `AIDER_DESK_AIDER_VERSION` variable accepts version specifiers compatible with `pip install`. Here are some common examples:

### 1. Specific Version Number
To use a specific released version of Aider (e.g., 0.36.1):
```
AIDER_DESK_AIDER_VERSION=0.36.1
```

### 2. Git Repository URL (Branch)
To install Aider from a specific branch of a Git repository (e.g., `my-feature-branch` from `user/aider`):
```
AIDER_DESK_AIDER_VERSION=git+https://github.com/user/aider.git@my-feature-branch
```
(Replace `user/aider.git` with the actual repository URL and `my-feature-branch` with your branch name.)

### 3. Git Repository URL (Commit Hash)
To install Aider from a specific commit hash of a Git repository:
```
AIDER_DESK_AIDER_VERSION=git+https://github.com/user/aider.git@abcdef1234567890
```
(Replace `abcdef1234567890` with the desired commit hash.)

### 4. Local Path
To install Aider from a local clone of the Aider repository:
```
AIDER_DESK_AIDER_VERSION=/path/to/your/local/aider/clone
```
Or on Windows:
```
AIDER_DESK_AIDER_VERSION=C:\path\to\your\local\aider\clone
```
Ensure the specified path points to a directory containing a valid `setup.py` or `pyproject.toml` for Aider.

## ⚠️ Important Warning: Compatibility Issues

Using a custom version of `aider-chat`, especially unreleased development branches or local modifications, can lead to compatibility issues with AiderDesk. AiderDesk is designed and tested against stable releases of Aider.

**Custom versions might:**
- Break the communication protocol between AiderDesk and the Aider backend.
- Cause unexpected behavior or errors in AiderDesk's functionality.
- Lead to features not working as intended or failing silently.

Proceed with caution and primarily use this feature for testing or development purposes. If you encounter issues, try reverting to the latest stable Aider version (by unsetting the environment variable) to see if the problem persists.

## Installation Failure

If AiderDesk fails to install the `aider-chat` package using the version specified in `AIDER_DESK_AIDER_VERSION` (e.g., due to an invalid specifier, network issues, or problems with the custom Aider source code), AiderDesk will:
1. Display an error message indicating the installation failure.
2. Log the detailed error from `pip`.
3. Exit, and will not complete the startup process.

You will need to correct the `AIDER_DESK_AIDER_VERSION` variable or resolve the underlying installation issue before AiderDesk can start successfully with the custom Aider version.

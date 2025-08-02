# Installation

AiderDesk is available for macOS, Windows, and Linux.

## Quick Start

1.  **Download the latest release:** Go to the [Releases page](https://github.com/hotovo/aider-desk/releases) and download the appropriate installer for your operating system.
2.  **Run the installer:**
    *   **Windows:** Run the `.exe` installer and follow the on-screen instructions.
    *   **macOS:** Open the `.dmg` file and drag the AiderDesk application to your Applications folder.
    *   **Linux:** Use the `.AppImage` or `.deb` package to install the application.

## Disabling Auto-Updates

AiderDesk automatically checks for updates on startup. If you need to disable this feature, you can set the `AIDER_DESK_NO_AUTO_UPDATE` environment variable to `true`.

### macOS/Linux

```bash
export AIDER_DESK_NO_AUTO_UPDATE=true
```

### Windows (PowerShell)

```powershell
$env:AIDER_DESK_NO_AUTO_UPDATE = "true"
```

## Custom Aider Version

By default, AiderDesk installs the latest version of the `aider-chat` Python package. If you need to use a specific version of Aider, you can set the `AIDER_DESK_AIDER_VERSION` environment variable.

For example, to use Aider version `0.83.1`:

### macOS/Linux

```bash
export AIDER_DESK_AIDER_VERSION=0.83.1
```

### Windows (PowerShell)

```powershell
$env:AIDER_DESK_AIDER_VERSION = "0.83.1"
```

You can also specify a git URL for installing a development version of Aider:

```bash
# macOS/Linux
export AIDER_DESK_AIDER_VERSION=git+https://github.com/user/aider.git@branch-name
```

For more details, see the [Custom Aider Version](./../advanced-topics/custom-aider-version.md) page.

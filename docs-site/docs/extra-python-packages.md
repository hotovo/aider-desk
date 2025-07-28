---
sidebar_position: 25
title: "Extra Python Packages"
sidebar_label: "Extra Python Packages"
---

# AIDER_DESK_EXTRA_PYTHON_PACKAGES

The `AIDER_DESK_EXTRA_PYTHON_PACKAGES` environment variable allows you to install additional Python packages into AiderDesk's virtual environment. This can be useful for a few reasons:

-   Installing new libraries that you want to be available to `aider`.
-   Overriding specific versions of `aider`'s dependencies.

## How to Use

You can set this environment variable before launching AiderDesk. The value should be a comma-separated list of Python packages as you would specify them for `pip install`.

**macOS/Linux:**

```sh
export AIDER_DESK_EXTRA_PYTHON_PACKAGES="package1,package2==1.2.3"
./AiderDesk-*.AppImage
```

**Windows (Command Prompt):**

```cmd
set AIDER_DESK_EXTRA_PYTHON_PACKAGES="package1,package2==1.2.3"
AiderDesk.exe
```

**Windows (PowerShell):**

```powershell
$env:AIDER_DESK_EXTRA_PYTHON_PACKAGES="package1,package2==1.2.3"
.\AiderDesk.exe
```

## Examples

### Overriding a Dependency

Aider uses the `Pygments` library for code analysis and token counting. If you want to use the very latest, unreleased version of `Pygments` directly from their git repository, you can do so like this:

```sh
export AIDER_DESK_EXTRA_PYTHON_PACKAGES="git+https://github.com/pygments/pygments.git@master"
```

When you start AiderDesk, it will install the specified version of Pygments.

### Installing a New Package

If you need to install a package like `scikit-learn`, you can specify it:

```sh
export AIDER_DESK_EXTRA_PYTHON_PACKAGES="scikit-learn"
```

### Combining Multiple Packages

You can provide a comma-separated list to install or override multiple packages at once:

```sh
export AIDER_DESK_EXTRA_PYTHON_PACKAGES="scikit-learn==1.0.2,pandas,git+https://github.com/pygments/pygments.git@master"
```

## Important Notes

-   Packages are installed using `uv pip install`. Any format that `uv` and `pip` accept should work.
-   The packages are installed into a dedicated virtual environment managed by AiderDesk, so they will not affect your system's global Python installation.
-   If you make a mistake, you can simply unset the environment variable and restart AiderDesk. On the next start, it may try to re-install the default dependencies if needed.
-   For a clean installation, you can remove the virtual environment directory (`.aider-desk/python_venvs/aider-desk-env` inside your home directory) and let AiderDesk recreate it on the next start.

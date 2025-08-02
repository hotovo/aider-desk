# Custom Aider Version

AiderDesk is built on top of the powerful `aider-chat` Python package. By default, AiderDesk automatically installs and uses the latest version of `aider-chat` to ensure you always have access to the newest features and improvements.

However, there may be situations where you need to use a specific version of `aider-chat`. For example:

-   You need to use a feature that is only available in a particular version.
-   You want to avoid a regression that was introduced in a newer version.
-   You are developing a feature for `aider-chat` and need to test a development version from a Git repository.

AiderDesk provides an environment variable that allows you to override the default version of `aider-chat` and specify the exact version you want to use.

## Using the `AIDER_DESK_AIDER_VERSION` Environment Variable

To use a custom version of `aider-chat`, you need to set the `AIDER_DESK_AIDER_VERSION` environment variable before launching AiderDesk. The value of this variable will be passed directly to `pip install`.

### Installing a Specific Version

You can set the variable to a specific version number, like `0.83.1`.

**macOS/Linux:**
```bash
export AIDER_DESK_AIDER_VERSION=0.83.1
AiderDesk
```

**Windows (PowerShell):**
```powershell
$env:AIDER_DESK_AIDER_VERSION = "0.83.1"
AiderDesk
```

### Installing from a Git Repository

You can also install a version directly from a Git repository. This is useful for testing development branches or specific commits. The format for this is `git+<repository_url>@<branch_or_commit>`.

**macOS/Linux:**
```bash
export AIDER_DESK_AIDER_VERSION=git+https://github.com/paul-gauthier/aider.git@dev
AiderDesk
```

**Windows (PowerShell):**
```powershell
$env:AIDER_DESK_AIDER_VERSION = "git+https://github.com/paul-gauthier/aider.git@dev"
AiderDesk
```

When you launch AiderDesk with this environment variable set, it will attempt to install the specified version of `aider-chat` into its virtual environment. This gives you full control over the underlying `aider` engine, allowing you to customize your setup for your specific needs.

# Automatic Updates in AiderDesk

AiderDesk is designed to keep itself up-to-date with the latest features, bug fixes, and performance improvements through an automatic update mechanism. This ensures that you are always running the most current and stable version of the application.

## How Automatic Updates Work

1.  **Check for Updates:**
    *   When AiderDesk starts, and periodically while it's running, it checks a designated update server for new versions.
    *   This check is typically done in the background without interrupting your workflow.

2.  **Download Update:**
    *   If a new version is found, AiderDesk will download the update package in the background.
    *   You may see a notification or a subtle indicator that an update is being downloaded.

3.  **Notification and Installation:**
    *   Once the download is complete, AiderDesk will notify you that an update is ready to be installed.
    *   The notification might offer options like "Install and Relaunch," "Install on Quit," or "Remind Me Later."
    *   Choosing to install will typically quit the current instance of AiderDesk, apply the update, and then relaunch the application with the new version.

4.  **Seamless Updates (for `aider` and dependencies):**
    *   AiderDesk also manages the version of the underlying `aider-chat` Python package and its dependencies.
    *   Updates to AiderDesk may include updates to `aider-chat` or other components in its Python environment. This process is generally handled automatically during the application update.

## Managing Update Settings

AiderDesk usually provides settings to manage how updates are handled. These can typically be found in the **Settings** or **Preferences** menu, often under an "About" or "Updates" section.

Common settings include:

-   **Enable/Disable Automatic Updates:**
    *   You might have an option to turn off automatic update checks if you prefer to update manually. However, staying on the latest version is generally recommended.
-   **Check for Updates Frequency:**
    *   Some applications allow you to configure how often they check for new versions (e.g., daily, weekly).
-   **Prerelease/Beta Channels (Optional):**
    *   Advanced users might have the option to subscribe to prerelease or beta channels to get early access to new features (and potentially less stable builds).
-   **Manual Check for Updates:**
    *   There's almost always a button or menu item like "Check for Updates..." that allows you to trigger an update check manually at any time.

![Settings Update Check](images/settings.png)
*(Image showing a settings panel which might include an update check button or version information)*

## Benefits of Keeping AiderDesk Up-to-Date

-   **Access to New Features:** Receive the latest tools, functionalities, and improvements as they are released.
-   **Bug Fixes:** Updates include fixes for known issues, leading to a more stable and reliable experience.
-   **Performance Enhancements:** Developers continuously work on optimizing performance, and updates often bring these improvements.
-   **Security Patches:** Important security vulnerabilities, if any, are addressed in updates, keeping your application and data secure.
-   **Improved AI Model Compatibility:** Updates ensure compatibility with the latest AI models and API changes from providers like OpenAI or Anthropic.
-   **Better `aider` Integration:** As the `aider` tool itself evolves, AiderDesk updates ensure seamless integration with its newest capabilities.

## Manual Updates (If Automatic Updates are Disabled or Fail)

If automatic updates are disabled, or if an automatic update fails for some reason, you can typically update AiderDesk manually:

1.  **Visit the Official Website:** Go to the official AiderDesk website or GitHub repository.
2.  **Download the Latest Version:** Look for the "Downloads" section and get the latest installer or application bundle for your operating system.
3.  **Install:** Run the installer or replace your existing AiderDesk application file with the new one, following the standard installation procedure for your OS.

## Troubleshooting Update Issues

-   **Firewall/Network Issues:** Ensure that AiderDesk is not blocked by your firewall or network configuration from accessing the update server.
-   **Disk Space:** Make sure you have enough free disk space for the update to download and install.
-   **Permissions:** On some systems, AiderDesk might require administrative privileges to install updates.
-   **Check Logs:** AiderDesk may have logs that provide more details if an update fails. These can often be found via a "Help" or "Developer" menu.
-   **Contact Support:** If you consistently have trouble with updates, reach out to AiderDesk support or check their community forums/issue trackers.

By default, AiderDesk's automatic update system is designed to be convenient and ensure you benefit from the latest advancements with minimal effort. It's generally recommended to keep automatic updates enabled.

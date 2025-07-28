---
sidebar_position: 3
title: "Automatic Updates"
sidebar_label: "Automatic Updates"
---

# Automatic Updates

AiderDesk is designed to keep itself and the integrated Aider library up-to-date with minimal effort.

## AiderDesk Application Updates

The application uses `electron-updater` to manage updates.

- **Update Checks**: AiderDesk periodically checks for new versions in the background. You can also trigger a manual check in **Settings > About**.
- **Notifications**:
    - When an update is available, an **Upload** icon (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/></svg>) will appear in the top-right corner. Hovering over it will show the update status.
    - Once an update is downloaded and ready to install, you will be notified. The update will be applied the next time you restart the application.
- **Automatic Downloads**: You can control this behavior in **Settings > About** with the "Download update automatically" checkbox.
    - **Checked (Default)**: AiderDesk will automatically download available updates in the background.
    - **Unchecked**: You will be notified of available updates, and you can start the download manually from the **About** settings page.

## Aider Library Updates

The `aider-chat` Python library is managed within a dedicated virtual environment. AiderDesk checks for new versions of the library on startup and will automatically install the latest version to ensure you always have access to the newest features and bug fixes. You will be notified in the **About** settings page if a new version is available, and it will be installed the next time you restart AiderDesk.

For information on using a specific version of Aider, see the [Configuration](./configuration.md) documentation.

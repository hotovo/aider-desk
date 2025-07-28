---
sidebar_position: 18
title: "Prompt Behavior"
sidebar_label: "Prompt Behavior"
---

# Prompt Behavior Settings

Customize the behavior of the prompt input field to match your workflow. These settings can be found in **Settings > General > Prompt Behavior**.

## Suggestions

Control when and how autocompletion suggestions appear as you type.

- **Show Suggestions**:
    - **Automatically while typing**: Suggestions will appear automatically after a short delay as you type. You can configure the delay with the **Suggestions delay** slider.
    - **Only when TAB key is pressed**: Suggestions will only appear when you explicitly press the `Tab` key.
    - **@ mention mode**: Suggestions for files will only appear when you type `@`. Command suggestions will still appear when you type `/`.

## Command Confirmation

To prevent accidental execution of commands, you can require a confirmation step before a command is run. When enabled, you will need to press `Enter` a second time to confirm the command.

You can configure this for the following commands:
- `/add`
- `/read-only`
- `/model`
- Mode switching commands (`/code`, `/agent`, etc.)

## Key Bindings

- **Use Vim bindings**: Enable this option to use Vim key bindings for navigating and editing text within the prompt field. This provides a familiar editing experience for Vim users.

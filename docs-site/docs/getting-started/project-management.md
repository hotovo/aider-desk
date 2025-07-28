---
sidebar_position: 2
title: "Project Management"
sidebar_label: "Projects"
slug: "/getting-started/projects"
---

# Project Management

AiderDesk is designed to handle multiple projects simultaneously, allowing you to seamlessly switch between different codebases without losing context.

## Opening a Project

To start working, you first need to open a project directory.
1.  If no projects are open, click the **Open Project** button in the center of the screen.
2.  If you already have projects open, click the **`+`** button in the tab bar at the top.
3.  An "Open Project" dialog will appear. You can either:
    - Type or paste the absolute path to your project's root directory.
    - Click the folder icon to open your system's file browser and select a directory.
    - Select a project from the "Recent projects" list.

## Project Isolation

Each project you open in AiderDesk runs in its own isolated `aider-chat` instance. This means:
- **Separate Contexts**: The chat history and context files for one project are completely separate from others.
- **Independent Processes**: Each project has its own dedicated Python process, preventing interference between projects.
- **Concurrent Work**: You can have an AI task running in one project while you work on another.

## Switching Between Projects

All open projects are displayed as tabs at the top of the window.
- **Click a tab** to switch to that project.
- Use the keyboard shortcut **`Ctrl + Tab`** to cycle through your open projects.

## Closing a Project

To close a project, simply click the **`x`** icon on its tab. The project will be removed from the tab bar, and its associated Aider process will be terminated. The project will also be added to your "Recent projects" list for quick access later.

## Reordering Tabs

You can reorder the project tabs by clicking and dragging them into your desired position. This allows you to organize your workspace to your liking.

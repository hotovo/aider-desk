---
description: Update CHANGELOG.md with new entry based on git diff
includeContext: false
---
Update the CHANGELOG.md file by adding a new entry under the [UNRELEASED] section based on the current git diff.

This is the current CHANGELOG.md (first 20 lines):

!head -n 20 CHANGELOG.md

This is `git diff HEAD` to see what changes were made:

!git diff HEAD

Based on the git diff, generate a concise changelog entry following this format:
- description of the change in past tense (starting with lowercase)

Guidelines for generating the changelog entry:
- Use past tense (e.g., "added feature" not "add feature")
- Start with lowercase letter
- Be concise but descriptive
- Focus on user-visible changes
- Use appropriate verbs: added, fixed, improved, updated, removed, etc.
- If multiple related changes, combine them or create the most significant one

Examples of good entries:
- added support for custom commands in subfolders
- fixed issue with model selection not persisting
- improved performance of message rendering
- updated dependencies to latest versions

Now update the CHANGELOG.md file by inserting the generated entry as the last item under the [UNRELEASED] section. The changelog entry should be added to the end of the [UNRELEASED] section, after any existing entries in that section.

Do not read any files, just update based on given info.

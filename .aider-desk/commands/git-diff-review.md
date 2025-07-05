---
description: Review and summarize the output of a git diff for code quality, bugs, and improvements.
arguments:
  - description: The git diff arguments (e.g., HEAD~1, a file path, or a commit range)
    required: false
---
Please review the following git diff and provide a summary of the changes, potential bugs, code quality issues, and suggestions for improvement. Focus on correctness, maintainability, and best practices.

!git diff {{1}}

After reviewing, list any:
- Potential bugs or risky changes
- Code style or quality issues
- Suggestions for improvement
- Notable refactorings or design changes

If the diff is large, summarize the most important changes and issues.

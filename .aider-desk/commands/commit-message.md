---
description: Generate a conventional commit message based on the provided git diff.
---
Please generate a conventional commit message based on result of git diff. The commit message should adhere to the Conventional Commits specification.

The message should be a single line, starting with a type (e.g., `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`), followed by an optional scope, a colon and a space, and then a short, imperative description of the change.

!git diff

Provide the commit message in the following format:

```
<type>[optional scope]: <description>
```

Only answer with the commit message, nothing else.

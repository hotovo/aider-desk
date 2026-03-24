---
name: skill-creator
# prettier-ignore
description: Create AiderDesk Agent Skills by writing SKILL.md files, defining frontmatter metadata, structuring references, and organizing skill directories. Use when building a new skill, creating a SKILL.md, planning skill architecture, or writing skill content.
---

# Skill Creator

Create effective Agent Skills using progressive disclosure.

## When to Create a Skill

Create a skill when you notice:

- **Repeating context** across conversations
- **Domain expertise** needed repeatedly
- **Project-specific knowledge** the agent should know automatically

## Progressive Disclosure

Skills load in 3 levels:

1. **Metadata** (~27 tokens) - YAML frontmatter for triggering
2. **Instructions** (<680 tokens) - SKILL.md body with core patterns
3. **Resources** (unlimited) - references/ scripts/ assets/ loaded on
   demand

**Key**: Keep Levels 1 & 2 lean. Move details to Level 3.

## Quick Workflow

1. Create skill directory: `.aider-desk/skills/my-skill/`
2. Write `SKILL.md` with YAML frontmatter (`name`, `description`) and body instructions
3. Add detailed docs to `references/` as needed
4. Verify: mention a trigger keyword — skill should appear in active skills sidebar

**If skill doesn't load**: check YAML syntax is valid, `name` is lowercase-hyphenated, and `description` contains the trigger terms users would say

### SKILL.md Example

```yaml
---
name: deploy-helper
description: Deploy AiderDesk builds to staging and production environments. Use when deploying, releasing, or publishing builds.
---
```

```markdown
# Deploy Helper

Build and deploy AiderDesk to target environments.

## Steps

1. Run `npm run build` to generate production artifacts
2. Verify build output exists in `dist/`
3. Deploy to staging: `./scripts/deploy.sh staging`
4. Verify deployment: check health endpoint returns 200

## Troubleshooting

- Build fails: check `tsconfig.json` paths and run `npm run typecheck`

## References

- [environments.md](references/environments.md) - Environment configs
```

## Structure

```
my-skill/
├── SKILL.md       # Core instructions + metadata
├── references/    # Detailed docs (loaded as needed)
├── scripts/       # Executable operations
└── assets/        # Templates, images, files
```

## References

- [quick-start.md](references/quick-start.md) - Creating your first
  skill
- [writing-guide.md](references/writing-guide.md) - Writing effective
  skills
- [development-process.md](references/development-process.md) -
  Step-by-step workflow
- [skill-examples.md](references/skill-examples.md) - Patterns and
  examples
- [cli-reference.md](references/cli-reference.md) - CLI tool usage
- [agent-skills-resources.md](references/agent-skills-resources.md) -
  Architecture and best practices

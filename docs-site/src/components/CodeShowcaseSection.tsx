import { useState } from 'react';
import { clsx } from 'clsx';
import Link from '@docusaurus/Link';
import { TerminalIcon, PuzzleIcon, SparklesIcon, ArrowRightIcon } from './Icons';
import styles from './CodeShowcaseSection.module.css';

export enum CodeSnippetType {
  Extension = 'extension',
  Skill = 'skill',
  Api = 'api',
}

const SNIPPETS: Record<
  CodeSnippetType,
  {
    fileName: string;
    language: string;
    title: string;
    description: string;
    code: string;
    docLink: string;
  }
> = {
  [CodeSnippetType.Extension]: {
    fileName: 'src/extensions/quality-gate.ts',
    language: 'typescript',
    title: 'TypeScript Extension API',
    description:
      'Write custom extensions with direct access to lifecycle hooks, tools, slash commands, and OS execution.',
    code: `import { Extension, ExtensionContext } from '@aiderdesk/extensions';

export default class QualityGateExtension implements Extension {
  async onTaskComplete(ctx: ExtensionContext) {
    const { exitCode, stdout } = await ctx.exec('npm run test:node -- --no-color');

    if (exitCode !== 0) {
      await ctx.notify('Tests failed in worktree. Refusal gate active.', 'error');
      // Instruct agent to automatically resolve the failing tests
      await ctx.runPrompt('The test suite failed. Inspect stderr and fix the regression.');
    }
  }
}`,
    docLink: '/docs/extensions/creating-extensions',
  },
  [CodeSnippetType.Skill]: {
    fileName: '.aider-desk/skills/writing-tests/SKILL.md',
    language: 'markdown',
    title: 'Procedural Agent Skills',
    description:
      'Bundle reusable patterns, test guides, and operational checklists into skills loaded on demand without prompt cache churn.',
    code: `---
name: writing-tests
description: Write unit and integration tests using Vitest and React Testing Library
location: project
---

# Test Writing Directives
1. When writing component tests, always mock ApplicationAPI via test/helpers/mockApi.
2. Run tests in node mode: \`npm run test:node -- --no-color\`.
3. Never import concrete database instances in unit test files.
4. Verify edge cases: network timeout, malformed payload, empty state.`,
    docLink: '/docs/agent-mode/skills',
  },
  [CodeSnippetType.Api]: {
    fileName: 'scripts/run-autonomous-task.sh',
    language: 'bash',
    title: 'Headless CLI & REST API',
    description:
      'Trigger autonomous agent tasks from CI/CD pipelines, git webhooks, or local automation scripts via HTTP and WebSocket.',
    code: `# Create an isolated task in autonomous mode via REST API
curl -X POST http://localhost:24337/api/tasks \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Security Audit: Scan Dependencies",
    "prompt": "Audit package.json for known CVEs and bump vulnerable transitive dependencies in a worktree",
    "autonomyMode": "autonomous",
    "executionMode": "run_in_background",
    "worktree": true
  }'`,
    docLink: '/docs/integrations/rest-api',
  },
};

type Props = {
  className?: string;
};

export const CodeShowcaseSection = ({ className }: Props) => {
  const [activeSnippet, setActiveSnippet] = useState<CodeSnippetType>(CodeSnippetType.Extension);

  const current = SNIPPETS[activeSnippet];

  return (
    <section className={clsx(styles.section, className)}>
      <div className={styles.container}>
        <div className={styles.textColumn}>
          <div className={styles.sectionBadge}>Developer Extensibility</div>
          <h2 className={styles.heading}>Scriptable. Extensible. Hackable.</h2>
          <p className={styles.subheading}>
            Zero setup required to get started — but when your team needs a custom quality gate, CI/CD integration, or procedural testing skill, build it with standard TypeScript, Markdown, or Bash.
          </p>

          <div className={styles.tabButtons}>
            <button
              type="button"
              className={clsx(
                styles.tabBtn,
                activeSnippet === CodeSnippetType.Extension && styles.tabBtnActive
              )}
              onClick={() => setActiveSnippet(CodeSnippetType.Extension)}
            >
              <PuzzleIcon size={16} />
              <span>TypeScript Extensions</span>
            </button>

            <button
              type="button"
              className={clsx(
                styles.tabBtn,
                activeSnippet === CodeSnippetType.Skill && styles.tabBtnActive
              )}
              onClick={() => setActiveSnippet(CodeSnippetType.Skill)}
            >
              <SparklesIcon size={16} />
              <span>Procedural Skills</span>
            </button>

            <button
              type="button"
              className={clsx(
                styles.tabBtn,
                activeSnippet === CodeSnippetType.Api && styles.tabBtnActive
              )}
              onClick={() => setActiveSnippet(CodeSnippetType.Api)}
            >
              <TerminalIcon size={16} />
              <span>REST & CLI Automation</span>
            </button>
          </div>

          <div className={styles.activeInfo}>
            <h3 className={styles.infoTitle}>{current.title}</h3>
            <p className={styles.infoText}>{current.description}</p>
            <Link to={current.docLink} className={styles.docLink}>
              <span>Read API Documentation</span>
              <ArrowRightIcon size={14} />
            </Link>
          </div>
        </div>

        <div className={styles.codeColumn}>
          <div className={styles.editorBox}>
            <div className={styles.editorHeader}>
              <div className={styles.trafficLights}>
                <span className={styles.lightRed} />
                <span className={styles.lightYellow} />
                <span className={styles.lightGreen} />
              </div>
              <span className={styles.editorFile}>{current.fileName}</span>
              <span className={styles.langPill}>{current.language}</span>
            </div>
            <pre className={styles.editorPre}>
              <code>{current.code}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
};

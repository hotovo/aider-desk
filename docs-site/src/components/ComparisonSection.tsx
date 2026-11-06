import { clsx } from 'clsx';
import { CheckIcon } from './Icons';
import styles from './ComparisonSection.module.css';

type ComparisonRow = {
  feature: string;
  aiderDesk: string;
  ideAssistants: string;
  terminalAgents: string;
};

const ROWS: ComparisonRow[] = [
  {
    feature: 'User Interface & Workspace',
    aiderDesk: 'Native desktop GUI with multi-project tabs, visual subtask board, and dedicated diff workspace',
    ideAssistants: 'Editor-embedded side panels (VS Code fork or plugin); shares your active editor space',
    terminalAgents: 'Terminal text UI (TUI) only; multi-tasking requires manual tmux or terminal tabs',
  },
  {
    feature: 'Visual Diff Review',
    aiderDesk: 'Side-by-side graphical diffs with syntax highlighting, inline comments, and 1-click line acceptance',
    ideAssistants: 'In-editor inline decorations or diff gutters inside the code editor',
    terminalAgents: 'Raw terminal unified diff text or pager dumps; no side-by-side graphical inspection',
  },
  {
    feature: 'Git Worktree Isolation',
    aiderDesk: '1-click automated Git worktrees. Agent works in an isolated branch/directory without touching active editor files',
    ideAssistants: 'Modifies files directly in your active editor checkout; risk of dirtying unstaged or uncommitted work',
    terminalAgents: 'Edits working directory in-place; relies on git commits or shell commands to revert',
  },
  {
    feature: 'Background Multitasking',
    aiderDesk: 'Autonomous subtasks run in background worktrees while you continue coding in your favorite IDE',
    ideAssistants: 'Single-threaded composer/chat turn that ties up editor focus and active file state',
    terminalAgents: 'Blocks the shell terminal process until the tool run or agent loop completes',
  },
  {
    feature: 'Editing Engine Flexibility',
    aiderDesk: 'Dual engines: Surgical diffs (/code, /architect) for quick fixes + Autonomous Agent for multi-file features',
    ideAssistants: 'Single conversational loop or inline autocomplete; often rewrites large blocks unnecessarily',
    terminalAgents: 'Single agent loop (Claude Code) or chat-only command line (CLI Aider)',
  },
  {
    feature: 'Model Freedom & Offline Local LLMs',
    aiderDesk: 'Universal: 15+ hosted providers (Claude, OpenAI, Gemini, DeepSeek) + 100% offline local models (Ollama, LM Studio)',
    ideAssistants: 'Curated hosted models (Cursor, Copilot) or extension-based (Cline); limited air-gapped local workflows',
    terminalAgents: 'Vendor locked (Claude Code is Claude-only) or requires manual CLI setup (Aider + LiteLLM)',
  },
  {
    feature: 'Pricing & Token Markup',
    aiderDesk: '100% Free & Open Source with 0% token markup. Direct provider billing or free local models',
    ideAssistants: '$10 to $40+/month seat subscriptions (Cursor, Copilot) with proprietary usage quotas and markups',
    terminalAgents: 'Free/open-source CLI tools, but require API usage (Claude Code requires Anthropic API billing)',
  },
  {
    feature: 'Extensibility & MCP',
    aiderDesk: 'TypeScript extension SDK, in-app gallery, procedural skills (SKILL.md), and bidirectional MCP client/server',
    ideAssistants: 'VS Code extension ecosystem or proprietary rules (.cursorrules); varying MCP client support',
    terminalAgents: 'MCP client support and CLI hooks, but lacks a graphical extension manager or UI plugins',
  },
];

type Props = {
  className?: string;
};

export const ComparisonSection = ({ className }: Props) => {
  return (
    <section className={clsx(styles.section, className)}>
      <div className={styles.header}>
        <div className={styles.sectionBadge}>Architectural Comparison</div>
        <h2 className={styles.heading}>Why engineers choose AiderDesk</h2>
        <p className={styles.subheading}>
          How AiderDesk&apos;s desktop GUI studio compares to in-editor AI assistants and terminal CLI agents.
        </p>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.featureCol}>Capability</th>
              <th className={styles.adCol}>
                <div className={styles.adHeaderBadge}>
                  <CheckIcon size={14} />
                  <span>AiderDesk (Desktop GUI)</span>
                </div>
              </th>
              <th className={styles.otherCol}>AI IDEs &amp; Extensions (Cursor, Copilot, Cline)</th>
              <th className={styles.otherCol}>Terminal AI Agents (Claude Code, CLI Aider)</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.feature}>
                <td className={styles.featureCell}>
                  <strong>{row.feature}</strong>
                </td>
                <td className={styles.adCell}>
                  <div className={styles.cellContent}>
                    <span className={styles.adHighlight} />
                    <span>{row.aiderDesk}</span>
                  </div>
                </td>
                <td className={styles.otherCell}>{row.ideAssistants}</td>
                <td className={styles.otherCell}>{row.terminalAgents}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

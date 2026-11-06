import { clsx } from 'clsx';
import Link from '@docusaurus/Link';
import {
  GitBranchIcon,
  TerminalIcon,
  EyeIcon,
  LayersIcon,
  ShieldIcon,
  PuzzleIcon,
  ArrowRightIcon,
} from './Icons';
import styles from './PrimitivesSection.module.css';

type PrimitiveItem = {
  title: string;
  description: string;
  icon: typeof GitBranchIcon;
  badge: string;
  link: string;
};

const PRIMITIVES: PrimitiveItem[] = [
  {
    title: 'Parallel Git Worktree Sandboxes',
    description:
      'Every task runs on a dedicated Git branch in an isolated worktree. Experiment boldly, run tests in parallel, and never worry about dirtying your primary working directory or active editor checkout.',
    icon: GitBranchIcon,
    badge: 'Safe Sandboxing',
    link: '/docs/features/git-worktrees',
  },
  {
    title: 'Dual Engines: Surgical vs. Autonomous',
    description:
      'Toggle between surgical diff-based editing (/code) for quick bugfixes without prompt bloat, and autonomous Agent Mode for open-ended multi-file architectures.',
    icon: TerminalIcon,
    badge: 'Right Tool for the Job',
    link: '/docs/core/chat-modes',
  },
  {
    title: 'Visual Side-by-Side Diff Review',
    description:
      'Inspect every modified line side-by-side with full syntax highlighting. Comment inline to give the agent targeted feedback, accept or reject changes with one click, or rollback any checkpoint.',
    icon: EyeIcon,
    badge: 'Total Observability',
    link: '/docs/core/reviewing-changes',
  },
  {
    title: 'Autonomous Subtasks in the Background',
    description:
      'Let agents break complex projects into hierarchical subtasks. Agents run autonomously in the background while you keep working in your editor, then notify you when changes are ready.',
    icon: LayersIcon,
    badge: 'Uninterrupted Flow',
    link: '/docs/agent-mode/task-management',
  },
  {
    title: 'Local-First & Direct API Access',
    description:
      'Your code never routes through third-party proxy servers. Connect directly to 15+ LLM providers with your own API keys, or run 100% offline with local Ollama weights for complete privacy.',
    icon: ShieldIcon,
    badge: 'Zero Markup & Privacy',
    link: '/docs/configuration/providers',
  },
  {
    title: 'TypeScript Extensions & Skills SDK',
    description:
      'Write custom TypeScript plugins to hook into task events, register custom slash commands, or load team-wide procedural skills from markdown files without prompt cache churn.',
    icon: PuzzleIcon,
    badge: 'Developer Extensible',
    link: '/docs/extensions',
  },
];

type Props = {
  className?: string;
};

export const PrimitivesSection = ({ className }: Props) => {
  return (
    <section className={clsx(styles.section, className)}>
      <div className={styles.header}>
        <div className={styles.sectionBadge}>Core Guarantees</div>
        <h2 className={styles.heading}>Engineered for developer control & safety</h2>
        <p className={styles.subheading}>
          No black-box magic, no surprise file overwrites, and no dirty git trees. AiderDesk is built around foundational guarantees that give you total safety and transparent control.
        </p>
      </div>

      <div className={styles.grid}>
        {PRIMITIVES.map((item) => {
          const IconComponent = item.icon;
          return (
            <div key={item.title} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.iconBox}>
                  <IconComponent size={20} />
                </div>
                <span className={styles.badge}>{item.badge}</span>
              </div>
              <h3 className={styles.cardTitle}>{item.title}</h3>
              <p className={styles.cardText}>{item.description}</p>
              <Link to={item.link} className={styles.cardLink}>
                <span>Learn more</span>
                <ArrowRightIcon size={14} />
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
};

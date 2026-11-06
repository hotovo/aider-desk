import { clsx } from 'clsx';
import Link from '@docusaurus/Link';
import { DownloadIcon, ArrowRightIcon, DiscordIcon, GithubIcon } from './Icons';
import styles from './CtaSection.module.css';

type Props = {
  className?: string;
};

export const CtaSection = ({ className }: Props) => {
  return (
    <section className={clsx(styles.section, className)}>
      <div className={styles.container}>
        <div className={styles.ctaBox}>
          <div className={styles.content}>
            <div className={styles.badge}>Get Started In Under 60 Seconds</div>
            <h2 className={styles.heading}>
              Ready for an AI coding agent that stays in its lane?
            </h2>
            <p className={styles.subheading}>
              Zero markup, parallel Git worktrees, 15+ model providers, and 100% open source.
            </p>
            <div className={styles.actionsRow}>
              <a href="#download" className={styles.primaryBtn}>
                <DownloadIcon size={18} />
                <span>Download Desktop App</span>
              </a>
              <Link to="/docs/getting-started/quick-start" className={styles.secondaryBtn}>
                <span>Quick Start Guide</span>
                <ArrowRightIcon size={16} />
              </Link>
            </div>
            <div className={styles.linksRow}>
              <a
                href="https://github.com/magiksoft/aider-desk"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.communityLink}
              >
                <GithubIcon size={18} />
                <span>Star on GitHub</span>
              </a>
              <a
                href="https://discord.com/invite/dyM3G9nTe4"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.communityLink}
              >
                <DiscordIcon size={18} />
                <span>Join Discord Community</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

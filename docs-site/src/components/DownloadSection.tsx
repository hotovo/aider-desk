import { clsx } from 'clsx';
import Link from '@docusaurus/Link';
import {
  AppleIcon,
  WindowsIcon,
  LinuxIcon,
  TerminalIcon,
  DockerIcon,
  ExternalLinkIcon,
  DownloadIcon,
  ArrowRightIcon,
} from './Icons';
import styles from './DownloadSection.module.css';

type Props = {
  className?: string;
};

export const DownloadSection = ({ className }: Props) => {
  return (
    <section id="download" className={clsx(styles.section, className)}>
      <div className={styles.header}>
        <div className={styles.sectionBadge}>Get Started</div>
        <h2 className={styles.heading}>Download AiderDesk for your platform</h2>
        <p className={styles.subheading}>
          Free and open source. Works natively on macOS, Windows, and Linux — or run headless via the CLI and Docker.
        </p>
      </div>

      <div className={styles.grid}>
        <div className={styles.downloadCard}>
          <div className={styles.cardHeader}>
            <div className={styles.osIcon}>
              <AppleIcon size={24} />
            </div>
            <div className={styles.osInfo}>
              <h3 className={styles.osName}>macOS</h3>
              <span className={styles.osVersion}>macOS 12+ (Monterey or later)</span>
            </div>
          </div>
          <div className={styles.downloadButtons}>
            <a
              href="https://github.com/magiksoft/aider-desk/releases/latest"
              className={styles.downloadBtnPrimary}
            >
              <DownloadIcon size={16} />
              <span>Apple Silicon (.dmg)</span>
            </a>
            <a
              href="https://github.com/magiksoft/aider-desk/releases/latest"
              className={styles.downloadBtnSecondary}
            >
              <DownloadIcon size={16} />
              <span>Intel Mac (.dmg)</span>
            </a>
          </div>
          <div className={styles.brewHint}>
            <code>brew install --cask aider-desk</code>
          </div>
        </div>

        <div className={styles.downloadCard}>
          <div className={styles.cardHeader}>
            <div className={styles.osIcon}>
              <WindowsIcon size={24} />
            </div>
            <div className={styles.osInfo}>
              <h3 className={styles.osName}>Windows</h3>
              <span className={styles.osVersion}>Windows 10 / 11 (64-bit)</span>
            </div>
          </div>
          <div className={styles.downloadButtons}>
            <a
              href="https://github.com/magiksoft/aider-desk/releases/latest"
              className={styles.downloadBtnPrimary}
            >
              <DownloadIcon size={16} />
              <span>Installer (.exe)</span>
            </a>
            <a
              href="https://github.com/magiksoft/aider-desk/releases/latest"
              className={styles.downloadBtnSecondary}
            >
              <DownloadIcon size={16} />
              <span>Portable (.zip)</span>
            </a>
          </div>
          <div className={styles.brewHint}>
            <code>winget install Magiksoft.AiderDesk</code>
          </div>
        </div>

        <div className={styles.downloadCard}>
          <div className={styles.cardHeader}>
            <div className={styles.osIcon}>
              <LinuxIcon size={24} />
            </div>
            <div className={styles.osInfo}>
              <h3 className={styles.osName}>Linux</h3>
              <span className={styles.osVersion}>Ubuntu, Fedora, Arch, Debian</span>
            </div>
          </div>
          <div className={styles.downloadButtons}>
            <a
              href="https://github.com/magiksoft/aider-desk/releases/latest"
              className={styles.downloadBtnPrimary}
            >
              <DownloadIcon size={16} />
              <span>AppImage (x86_64)</span>
            </a>
            <a
              href="https://github.com/magiksoft/aider-desk/releases/latest"
              className={styles.downloadBtnSecondary}
            >
              <DownloadIcon size={16} />
              <span>Debian / Ubuntu (.deb)</span>
            </a>
          </div>
          <div className={styles.brewHint}>
            <code>tar.gz &amp; rpm also available</code>
          </div>
        </div>

        <div className={clsx(styles.downloadCard, styles.downloadCardHeadlessFirst)}>
          <div className={styles.cardHeader}>
            <div className={styles.osIcon}>
              <TerminalIcon size={24} />
            </div>
            <div className={styles.osInfo}>
              <h3 className={styles.osName}>npm CLI</h3>
              <span className={styles.osVersion}>Lightweight &amp; Headless</span>
            </div>
          </div>
          <div className={styles.cliBox}>
            <div className={styles.cliSnippet}>
              <span className={styles.cliPrompt}>$</span> npm i -g @aiderdesk/aiderdesk
            </div>
            <div className={styles.cliSnippet}>
              <span className={styles.cliPrompt}>$</span> aiderdesk
            </div>
          </div>
          <div className={styles.cardFooterLink}>
            <Link to="/docs/advanced/npm-cli" className={styles.linkText}>
              <span>CLI Documentation</span>
              <ArrowRightIcon size={12} />
            </Link>
          </div>
        </div>

        <div className={styles.downloadCard}>
          <div className={styles.cardHeader}>
            <div className={styles.osIcon}>
              <DockerIcon size={24} />
            </div>
            <div className={styles.osInfo}>
              <h3 className={styles.osName}>Docker</h3>
              <span className={styles.osVersion}>Containers &amp; Cloud</span>
            </div>
          </div>
          <div className={styles.cliBox}>
            <div className={styles.cliSnippet}>
              <span className={styles.cliPrompt}>$</span> docker pull ghcr.io/magiksoft/aider-desk
            </div>
            <div className={styles.cliSnippet}>
              <span className={styles.cliPrompt}>$</span> docker run -d -p 24337:24337 ...
            </div>
          </div>
          <div className={styles.cardFooterLink}>
            <Link to="/docs/advanced/docker" className={styles.linkText}>
              <span>Docker Guide</span>
              <ArrowRightIcon size={12} />
            </Link>
          </div>
        </div>
      </div>

      <div className={styles.footerRow}>
        <a
          href="https://github.com/magiksoft/aider-desk/releases"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.releaseLink}
        >
          <span>View all release artifacts &amp; checksums on GitHub</span>
          <ExternalLinkIcon size={14} />
        </a>
      </div>
    </section>
  );
};

import { useState } from 'react';
import { clsx } from 'clsx';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import { DownloadIcon, ArrowRightIcon, CopyIcon, CheckIcon, GithubIcon } from './Icons';
import styles from './HeroSection.module.css';

export enum InstallType {
  Npx = 'npx',
  Npm = 'npm',
  Brew = 'brew',
  Docker = 'docker',
}

const INSTALL_COMMANDS: Record<InstallType, string> = {
  [InstallType.Npx]: 'npx @aiderdesk/aiderdesk',
  [InstallType.Npm]: 'npm i -g @aiderdesk/aiderdesk',
  [InstallType.Brew]: 'brew install --cask aider-desk',
  [InstallType.Docker]: 'docker run -d -p 24337:24337 ghcr.io/magiksoft/aider-desk',
};

type Props = {
  className?: string;
};

export const HeroSection = ({ className }: Props) => {
  const [installType, setInstallType] = useState<InstallType>(InstallType.Npx);
  const [copied, setCopied] = useState(false);

  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMANDS[installType]);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // fallback if clipboard API is unavailable
    }
  };

  const handleSelectInstallType = (type: InstallType) => {
    setInstallType(type);
    setCopied(false);
  };

  return (
    <section className={clsx(styles.heroContainer, className)}>
      <div className={styles.titleWrapper}>
        <div className={styles.brandRow}>
          <img src={useBaseUrl('/img/icon.png')} alt="AiderDesk Logo" className={styles.heroLogo} />
          <span className={styles.brandName}>AiderDesk</span>
          <span className={styles.openSourceBadge}>Open Source</span>
        </div>
        <h1 className={styles.heroHeading}>
          The desktop workspace for <br className={styles.breakDesktop} />
          <span className={styles.gradientHeading}>AI coding without the chaos</span>.
        </h1>
        <p className={styles.heroSubheading}>
          A native desktop studio for Aider and autonomous agents. Run tasks safely in isolated Git worktrees, review visual diffs with 1-click merge, and connect any LLM with your own API keys — zero subscription markup.
        </p>
      </div>

      <div className={styles.actionsRow}>
        <a href="#download" className={styles.primaryBtn}>
          <DownloadIcon size={18} />
          <span>Download Desktop App</span>
        </a>
        <Link to="/docs" className={styles.secondaryBtn}>
          <span>Read Documentation</span>
          <ArrowRightIcon size={16} />
        </Link>
        <a
          href="https://github.com/magiksoft/aider-desk"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.githubBtn}
          aria-label="GitHub Repository"
        >
          <GithubIcon size={18} />
          <span>Star on GitHub</span>
        </a>
      </div>

      <div className={styles.heroPreview}>
        <div className={styles.windowFrame}>
          <div className={styles.windowHeader}>
            <div className={styles.trafficLights}>
              <span className={styles.lightRed} />
              <span className={styles.lightYellow} />
              <span className={styles.lightGreen} />
            </div>
            <span className={styles.windowTitle}>AiderDesk — Native Desktop Studio</span>
            <span className={styles.windowBadge}>100% Local-First</span>
          </div>
          <img
            src={useBaseUrl('/img/screenshot.png')}
            alt="AiderDesk Native Desktop Workspace"
            className={styles.heroImage}
            loading="eager"
          />
        </div>
      </div>

      <div className={styles.proofGrid}>
        <div className={styles.proofItem}>
          <span className={styles.proofValue}>Isolated</span>
          <span className={styles.proofLabel}>Git Worktrees (Zero branch mess)</span>
        </div>
        <div className={styles.proofItem}>
          <span className={styles.proofValue}>15+</span>
          <span className={styles.proofLabel}>LLM Providers & Local Models</span>
        </div>
        <div className={styles.proofItem}>
          <span className={styles.proofValue}>0%</span>
          <span className={styles.proofLabel}>Token Markup (Bring your own keys)</span>
        </div>
        <div className={styles.proofItem}>
          <span className={styles.proofValue}>100%</span>
          <span className={styles.proofLabel}>Local-First & Open Source</span>
        </div>
      </div>

      <div className={styles.installWrapper}>
        <div className={styles.installHeading}>Prefer the terminal or remote servers? Run via CLI or Docker:</div>
        <div className={styles.installBox}>
          <div className={styles.installTabs} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={installType === InstallType.Npx}
              className={clsx(styles.installTab, installType === InstallType.Npx && styles.installTabActive)}
              onClick={() => handleSelectInstallType(InstallType.Npx)}
            >
              npx
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={installType === InstallType.Npm}
              className={clsx(styles.installTab, installType === InstallType.Npm && styles.installTabActive)}
              onClick={() => handleSelectInstallType(InstallType.Npm)}
            >
              npm
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={installType === InstallType.Brew}
              className={clsx(styles.installTab, installType === InstallType.Brew && styles.installTabActive)}
              onClick={() => handleSelectInstallType(InstallType.Brew)}
            >
              brew
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={installType === InstallType.Docker}
              className={clsx(styles.installTab, installType === InstallType.Docker && styles.installTabActive)}
              onClick={() => handleSelectInstallType(InstallType.Docker)}
            >
              docker
            </button>
          </div>

          <div className={styles.commandRow}>
            <span className={styles.commandPrompt}>$</span>
            <code className={styles.commandText}>{INSTALL_COMMANDS[installType]}</code>
            <button
              type="button"
              onClick={handleCopyCommand}
              className={styles.copyButton}
              aria-label="Copy install command"
            >
              {copied ? (
                <span className={styles.copiedText}>
                  <CheckIcon size={14} /> Copied
                </span>
              ) : (
                <span className={styles.copyText}>
                  <CopyIcon size={14} /> Copy
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

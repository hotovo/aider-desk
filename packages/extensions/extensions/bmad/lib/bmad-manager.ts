import * as path from 'path';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

import { v4 as uuidv4 } from 'uuid';
import { glob } from 'glob';
import * as yaml from 'yaml';
import * as yamlFront from 'yaml-front-matter';

import { StoryStatus } from './types';
import { ContextPreparer } from './context-preparer';
import { listInstalledSkills, resolveSkillsDir } from './skills';
import { clearBmadConfigCache } from './skill-preprocessor';
import { checkForUpdate as checkNpmUpdate } from './update-checker';
import { deriveArtifactTracker, listCatalog, normalizeWord, readInstallation, readModuleConfigs } from './install-registry';
import { injectHelpSkillStateHints } from './help-skill-hints';
import { buildHelpStateMessage } from './help-state';
import { generateSuggestions } from './bmad-suggestions';

import type { CatalogEntry } from './install-registry';
import type { PreparedContext } from './context-preparer';
import type {
  BmadError,
  BmadStatus,
  InstallResult,
  IncompleteWorkflowMetadata,
  SprintStatusData,
  TrackedEntries,
  UntrackedWorkflow,
  UpdateInfo,
  WorkflowArtifacts,
  WorkflowExecutionResult,
} from './types';
import type { ExtensionContext, TaskContext, ContextFile, PromptContext } from '@aiderdesk/extensions';

// yaml-front-matter is CJS without types; depending on the loader the function
// lives on the namespace or under .default — resolve both interop shapes.
type LoadFront = (content: string) => Record<string, unknown> & { __content?: string };
const yamlFrontModule = yamlFront as unknown as { loadFront?: LoadFront; default?: { loadFront: LoadFront } };
const loadFront: LoadFront = yamlFrontModule.loadFront ?? yamlFrontModule.default!.loadFront;

/** npm package spec installed by default; override via AIDERDESK_BMAD_PACKAGE */
const DEFAULT_BMAD_PACKAGE = 'bmad-method@6.12.0';

/** Default TTL for the getBmadStatus cache in ms (collapses UI poll storms into one scan). */
export const DEFAULT_STATUS_CACHE_TTL_MS = 3_000;

/** Environment variable overriding the status-cache TTL (ms); "0" disables caching. */
export const STATUS_CACHE_TTL_ENV = 'AIDERDESK_BMAD_STATUS_CACHE_MS';

/**
 * Effective status-cache TTL. 0 disables caching; invalid or negative env
 * values fall back to the default. Pure and exported for testing.
 */
export const resolveStatusCacheTtlMs = (envValue?: string): number => {
  if (envValue !== undefined) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return DEFAULT_STATUS_CACHE_TTL_MS;
};

export const getBmadPackage = (): string => process.env.AIDERDESK_BMAD_PACKAGE ?? DEFAULT_BMAD_PACKAGE;

/**
 * Derive the concrete npm package spec to install for an update from the
 * update-check result. Returns undefined when there is nothing to apply
 * (no update, unparseable target) so the caller falls back to the pinned
 * spec — a reinstall still runs the installer's `--action update` migration.
 *
 * Pure and exported for testing.
 */
export const resolveUpdatePackage = (updateInfo: UpdateInfo | null | undefined): string | undefined => {
  const target = updateInfo?.latestPatchVersion;
  if (!updateInfo?.updateAvailable || !target || !/^\d+\.\d+\.\d+$/.test(target)) {
    return undefined;
  }
  return `bmad-method@${target}`;
};

/** Frontmatter statuses that mark an artifact as finished. */
const COMPLETING_STATUS = /final|done|complete|approved|ready-for-dev/i;

export class BmadManager {
  private uvAvailable?: boolean;

  /** Short-TTL cache for getBmadStatus; invalidated by install()/resetWorkflow(). */
  private statusCache?: { status: BmadStatus; timestamp: number };

  private invalidateStatusCache(): void {
    this.statusCache = undefined;
  }

  constructor(
    private readonly projectDir: string,
    private readonly context: ExtensionContext,
  ) {}

  /**
   * A standard installation exists when its manifest is present — created by
   * any `npx bmad-method install` run regardless of the module selection.
   */
  checkInstallation(): boolean {
    return readInstallation(this.projectDir) !== null;
  }

  /** Installed version from _bmad/_config/manifest.yaml. */
  getVersion(): string | undefined {
    return readInstallation(this.projectDir)?.version;
  }

  /**
   * Append or refresh the extension's state-detection hints block in the
   * installed bmad-help SKILL.md. Idempotent and best-effort: failures are
   * logged, never propagated - a missing or unreadable skill must not break
   * installation flows.
   */
  ensureHelpSkillStateHints(): void {
    try {
      const result = injectHelpSkillStateHints(this.projectDir);
      if (result === 'updated') {
        this.context.log('bmad-help state-detection hints updated', 'info');
      } else if (result === 'skipped') {
        this.context.log('bmad-help state-detection hints skipped - no installed bmad-help skill found', 'debug');
      }
    } catch (error) {
      this.context.log(`Failed to update bmad-help state hints: ${error}`, 'warn');
    }
  }

  /**
   * Version pinned by the configured package spec (e.g. '6.10.0' from
   * 'bmad-method@6.10.0'). Returns undefined for non-numeric tags like
   * '@latest' or a bare package name — no drift warning in that case.
   */
  getExpectedVersion(): string | undefined {
    const bmadPackage = getBmadPackage();
    const atIndex = bmadPackage.lastIndexOf('@');
    if (atIndex <= 0) {
      return undefined;
    }

    const version = bmadPackage.slice(atIndex + 1);
    return /^\d/.test(version) ? version : undefined;
  }

  /**
   * Whether the `uv` Python runner is on PATH. Several BMAD skills invoke
   * helper scripts via `uv run`; without it they fall back to documented
   * manual steps. Result is cached per manager instance.
   */
  async checkUvAvailable(): Promise<boolean> {
    if (this.uvAvailable === undefined) {
      try {
        const execAsync = promisify(exec);
        await execAsync('uv --version');
        this.uvAvailable = true;
      } catch {
        this.uvAvailable = false;
      }
    }
    return this.uvAvailable;
  }

  /** The method's own menu, joined with installed skills. */
  getCatalog(): CatalogEntry[] {
    return listCatalog(this.projectDir);
  }

  getCatalogEntry(entryId: string): CatalogEntry | undefined {
    return this.getCatalog().find((entry) => entry.id === entryId);
  }

  private VALID_STORY_STATUSES: StoryStatus[] = [StoryStatus.Backlog, StoryStatus.ReadyForDev, StoryStatus.InProgress, StoryStatus.Review, StoryStatus.Done];

  private isValidStoryStatus = (status: string): status is StoryStatus => {
    return this.VALID_STORY_STATUSES.includes(status as StoryStatus);
  };

  private async parseSprintStatus(projectRoot: string): Promise<SprintStatusData | undefined> {
    const sprintStatusPath = path.join(projectRoot, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml');

    try {
      const content = await fsPromises.readFile(sprintStatusPath, 'utf-8');
      const parsed = yaml.parse(content) as { development_status?: Record<string, string> };

      if (!parsed?.development_status) {
        return undefined;
      }

      const storyStatuses: StoryStatus[] = [];

      for (const [key, status] of Object.entries(parsed.development_status)) {
        if (key.startsWith('epic') || key.endsWith('-retrospective')) {
          continue;
        }

        if (this.isValidStoryStatus(status)) {
          storyStatuses.push(status as StoryStatus);
        }
      }

      if (storyStatuses.length > 0) {
        this.context.log('Parsed sprint-status.yaml', 'debug');
      }

      return { storyStatuses };
    } catch {
      return undefined;
    }
  }

  private parseStepNumber = (stepId: string, index: number): number => {
    const pureNumber = parseInt(stepId, 10);
    if (!isNaN(pureNumber)) {
      return pureNumber;
    }

    const stepPattern = /^step-(\d+)/i;
    const match = stepId.match(stepPattern);
    if (match) {
      return parseInt(match[1], 10);
    }

    return index + 1;
  };

  /**
   * Scan project artifacts for completion state. One recursive listing of
   * _bmad-output feeds every tracked entry: a file belongs to an entry when
   * it lives under the entry's resolved baseDir and its path segment words
   * contain one of the entry's normalized output tokens (case-insensitive,
   * plural/gerund tolerant — see install-registry.deriveArtifactTracker).
   * Entries without a tracker are not tracked; computeBmadStatus reports
   * them via untrackedWorkflows instead of failing silently.
   */
  private async scanWorkflows(
    projectRoot: string,
    trackedEntries: TrackedEntries,
  ): Promise<WorkflowArtifacts> {
    const completedWorkflows: string[] = [];
    const inProgressWorkflows: string[] = [];
    const detectedArtifacts: WorkflowArtifacts['detectedArtifacts'] = {};
    const incompleteWorkflows: IncompleteWorkflowMetadata[] = [];

    if (!fs.existsSync(path.join(projectRoot, '_bmad-output'))) {
      return {
        completedWorkflows,
        inProgressWorkflows,
        detectedArtifacts,
        incompleteWorkflows,
        sprintStatus: await this.parseSprintStatus(projectRoot),
      };
    }

    // Words of one path segment, normalized for token comparison.
    const segmentWords = (segment: string): Set<string> => {
      const words = new Set<string>();
      for (const part of segment.split(/[^A-Za-z0-9]+/)) {
        if (part.length > 0) {
          words.add(normalizeWord(part));
        }
      }
      return words;
    };

    // --- Pass 1: list candidate files once and match them to entries ---
    let files: string[];
    try {
      files = await glob(`${projectRoot.replace(/\\/g, '/')}/_bmad-output/**/*.{md,yaml}`, {
        windowsPathsNoEscape: true,
      });
    } catch {
      files = [];
    }

    interface ScannedFile {
      absolutePath: string;
      relativePath: string;
      segments: string[];
      mtimeMs: number;
    }
    interface EntryMatch {
      file: ScannedFile;
      /** Tokens matched in directories between baseDir and the file (specificity). */
      dirScore: number;
    }
    const matchesByEntry = new Map<string, EntryMatch[]>();

    for (const absolutePath of files) {
      const relativePath = path.relative(projectRoot, absolutePath).replace(/\\/g, '/');
      const segments = relativePath.split('/');
      const stats = await fsPromises.stat(absolutePath).catch(() => undefined);
      const file: ScannedFile = {
        absolutePath,
        relativePath,
        segments,
        mtimeMs: stats?.mtimeMs ?? 0,
      };

      for (const [entryId, tracker] of Object.entries(trackedEntries)) {
        const baseSegments = tracker.baseDir.split('/').filter((s) => s.length > 0);
        if (segments.length <= baseSegments.length) {
          continue;
        }
        let underBase = true;
        for (let i = 0; i < baseSegments.length; i++) {
          if (segments[i] !== baseSegments[i]) {
            underBase = false;
            break;
          }
        }
        if (!underBase) {
          continue;
        }

        const tokens = new Set(tracker.tokens);
        const fileNameWords = segmentWords(segments[segments.length - 1]);
        let nameMatched = false;
        for (const word of fileNameWords) {
          if (tokens.has(word)) {
            nameMatched = true;
            break;
          }
        }
        if (!nameMatched) {
          continue;
        }

        // Specificity: how many tokens appear in intermediate directory
        // names (briefs/brief.md outranks research-x/brief.md for the brief).
        let dirScore = 0;
        for (let i = baseSegments.length; i < segments.length - 1; i++) {
          for (const word of segmentWords(segments[i])) {
            if (tokens.has(word)) {
              dirScore++;
              break;
            }
          }
        }

        const list = matchesByEntry.get(entryId) ?? [];
        list.push({ file, dirScore });
        matchesByEntry.set(entryId, list);
      }
    }

    // --- Pass 2: read frontmatter once per unique matched file ---
    interface ParsedFrontmatter {
      status?: string;
      stepsCompleted?: string[];
      parseError?: string;
    }
    const frontmatterCache = new Map<string, ParsedFrontmatter>();
    const loadParsed = async (absolutePath: string): Promise<ParsedFrontmatter> => {
      const cached = frontmatterCache.get(absolutePath);
      if (cached) {
        return cached;
      }
      try {
        const content = await fsPromises.readFile(absolutePath, 'utf-8');
        const { __content, ...properties } = loadFront(content);
        const parsed: ParsedFrontmatter = {};
        if (properties.status !== undefined && properties.status !== null) {
          parsed.status = String(properties.status);
        }
        if (Array.isArray(properties.stepsCompleted)) {
          parsed.stepsCompleted = properties.stepsCompleted as string[];
        }
        frontmatterCache.set(absolutePath, parsed);
        return parsed;
      } catch (parseError) {
        const parsed: ParsedFrontmatter = {
          parseError: parseError instanceof Error ? parseError.message : 'Unknown error parsing frontmatter',
        };
        frontmatterCache.set(absolutePath, parsed);
        return parsed;
      }
    };

    // Chosen artifact mtime per entry, for the stale-active-status rule in
    // Pass 4 ("the newest artifact is what the user is actually working on").
    const chosenMtimes = new Map<string, number>();

    // --- Pass 3: pick each entry's artifact with the established semantics ---
    for (const [entryId, matches] of matchesByEntry) {
      // Highest specificity first, newest first within a score.
      const ordered = [...matches].sort((a, b) =>
        b.dirScore - a.dirScore || b.file.mtimeMs - a.file.mtimeMs,
      );

      interface ArtifactCandidate extends ParsedFrontmatter {
        path: string;
        mtime: number;
      }
      const candidates: ArtifactCandidate[] = [];
      for (const match of ordered) {
        const parsed = await loadParsed(match.file.absolutePath);
        if (parsed.stepsCompleted || parsed.status) {
          candidates.push({ ...parsed, path: match.file.absolutePath, mtime: match.file.mtimeMs });
        }
      }

      // Fallback: artifacts exist but none carries status/stepsCompleted
      // frontmatter ("no status = completed") — the most specific, newest one.
      if (candidates.length === 0) {
        candidates.push({
          path: ordered[0].file.absolutePath,
          mtime: ordered[0].file.mtimeMs,
        });
      }

      // In-progress work wins over completed runs (a finished spec must not
      // mask one still being worked on), newest first within each group.
      const isActive = (candidate: ArtifactCandidate): boolean =>
        typeof candidate.status === 'string' && !COMPLETING_STATUS.test(candidate.status);

      const chosen =
        candidates.filter(isActive).sort((a, b) => b.mtime - a.mtime)[0] ??
        candidates.sort((a, b) => b.mtime - a.mtime)[0];
      if (!chosen) {
        continue;
      }

      const frontmatterError = chosen.parseError;
      chosenMtimes.set(entryId, chosen.mtime);
      detectedArtifacts[entryId] = {
        path: chosen.path,
        ...(chosen.stepsCompleted && { stepsCompleted: chosen.stepsCompleted }),
        ...(chosen.status && { status: chosen.status }),
        ...(frontmatterError && { error: frontmatterError }),
      };

      const completed = !chosen.status || COMPLETING_STATUS.test(chosen.status);

      if (completed) {
        completedWorkflows.push(entryId);
      } else {
        inProgressWorkflows.push(entryId);

        try {
          const stats = await fsPromises.stat(chosen.path);
          const stepsCompletedNumbers = chosen.stepsCompleted?.map((s, i) => this.parseStepNumber(s, i)) || [];
          const maxCompletedStep = stepsCompletedNumbers.length > 0 ? Math.max(...stepsCompletedNumbers) : 0;

          incompleteWorkflows.push({
            workflowId: entryId,
            artifactPath: chosen.path,
            stepsCompleted: stepsCompletedNumbers,
            nextStep: maxCompletedStep + 1,
            lastModified: stats.mtime,
            ...(frontmatterError && {
              corrupted: true,
              corruptionError: frontmatterError,
            }),
          });
        } catch {
          // Failed to get file stats
        }
      }
    }

    // --- Pass 4: stale active-status artifacts count as completed ---
    // BMAD's own status vocabulary uses 'draft' as the resting state of
    // finished planning documents (a product brief is never set to 'final'),
    // so a non-completing status alone does not mean active work. Only the
    // newest artifact in the project is considered genuinely in progress:
    // that is what the user is working on right now. Older active-status
    // leftovers (e.g. a weeks-old draft brief while PRD/architecture/epics
    // are newer and finished) would otherwise stay "in progress" forever,
    // shadow the real next step and keep a stale Continue button alive.
    let newestChosenMtime = 0;
    for (const mtime of chosenMtimes.values()) {
      if (mtime > newestChosenMtime) {
        newestChosenMtime = mtime;
      }
    }
    if (newestChosenMtime > 0) {
      for (let i = inProgressWorkflows.length - 1; i >= 0; i--) {
        const entryId = inProgressWorkflows[i];
        const mtime = chosenMtimes.get(entryId) ?? 0;
        if (mtime < newestChosenMtime) {
          inProgressWorkflows.splice(i, 1);
          completedWorkflows.push(entryId);
          const incompleteIndex = incompleteWorkflows.findIndex((w) => w.workflowId === entryId);
          if (incompleteIndex >= 0) {
            incompleteWorkflows.splice(incompleteIndex, 1);
          }
        }
      }
    }

    const sprintStatus = await this.parseSprintStatus(projectRoot);

    return {
      completedWorkflows,
      inProgressWorkflows,
      detectedArtifacts,
      incompleteWorkflows,
      sprintStatus,
    };
  }

  /**
   * Cached view of computeBmadStatus. Both UI components poll independently
   * (15s live polling, 3s install polling) and every request would otherwise
   * rescan the whole artifact tree; a short TTL collapses near-time polls
   * into one filesystem scan. install()/resetWorkflow() invalidate explicitly.
   */
  async getBmadStatus(): Promise<BmadStatus> {
    const cached = this.statusCache;
    if (cached && Date.now() - cached.timestamp < resolveStatusCacheTtlMs(process.env[STATUS_CACHE_TTL_ENV])) {
      this.context.log('Returning cached BMAD status', 'debug');
      return cached.status;
    }

    const status = await this.computeBmadStatus();
    this.statusCache = { status, timestamp: Date.now() };
    return status;
  }

  /** Drop the cached status so the next getBmadStatus rescans the project. */
  invalidateCache(): void {
    this.invalidateStatusCache();
  }

  private async computeBmadStatus(): Promise<BmadStatus> {
    const installation = readInstallation(this.projectDir);
    const installed = installation !== null;

    if (!installed) {
      return {
        projectDir: this.projectDir,
        installed: false,
        version: undefined,
        modules: [],
        skillsDir: undefined,
        catalog: [],
        trackedEntries: {},
        untrackedWorkflows: [],
        completedWorkflows: [],
        inProgressWorkflows: [],
        incompleteWorkflows: [],
        detectedArtifacts: {},
        sprintStatus: undefined,
      };
    }

    const configs = readModuleConfigs(this.projectDir);
    const catalog = this.getCatalog();

    const trackedEntries: TrackedEntries = {};
    const untrackedWorkflows: UntrackedWorkflow[] = [];
    for (const entry of catalog) {
      const result = deriveArtifactTracker(entry, configs);
      if (result.ok) {
        trackedEntries[entry.id] = { baseDir: result.baseDir, tokens: result.tokens };
      } else if (entry.outputLocation || (entry.outputs && entry.outputs.length > 0)) {
        // Rows with partial or unresolvable artifact metadata would silently
        // never count toward progress — surface them so the UI can explain.
        // Rows with neither column are utility skills and stay unlisted.
        untrackedWorkflows.push({ id: entry.id, name: entry.name, reason: result.reason });
      }
    }

    const workflowArtifacts = await this.scanWorkflows(this.projectDir, trackedEntries);

    return {
      projectDir: this.projectDir,
      installed: true,
      version: installation.version,
      modules: installation.modules,
      skillsDir: resolveSkillsDir(this.projectDir),
      catalog,
      trackedEntries,
      untrackedWorkflows,
      completedWorkflows: workflowArtifacts.completedWorkflows,
      inProgressWorkflows: workflowArtifacts.inProgressWorkflows,
      incompleteWorkflows: workflowArtifacts.incompleteWorkflows,
      detectedArtifacts: workflowArtifacts.detectedArtifacts,
      sprintStatus: workflowArtifacts.sprintStatus,
    };
  }

  async install(packageOverride?: string): Promise<InstallResult> {
    try {
      const legacyV4Path = path.join(this.projectDir, '.bmad-method');
      if (fs.existsSync(legacyV4Path)) {
        const bmadError: BmadError = {
          errorCode: 'BMAD_INSTALL_FAILED',
          message: 'Legacy BMAD v4 installation detected. Please remove the .bmad-method folder and try again.',
          recoveryAction: 'Remove the .bmad-method folder from your project directory, then retry installation.',
        };
        throw bmadError;
      }

      let safeUsername: string;
      try {
        const username = os.userInfo().username;
        safeUsername = username.charAt(0).toUpperCase() + username.slice(1);
      } catch {
        safeUsername = process.env.USER || process.env.USERNAME || 'User';
      }

      const isReinstall = this.checkInstallation();

      // bmad-method 6.10+ requires a tool id for non-interactive installs.
      // 'amp' targets the cross-tool standard directory .agents/skills,
      // keeping the install provider-agnostic. Explicit override wins
      // (performUpdate resolves the concrete target version); otherwise the
      // pinned/env-configured default spec applies.
      const bmadPackage = packageOverride ?? getBmadPackage();
      const bmadModules = process.env.AIDERDESK_BMAD_MODULES ?? 'bmm';
      const bmadTools = process.env.AIDERDESK_BMAD_TOOLS ?? 'amp';

      const commandParts = [
        'npx',
        '-y',
        bmadPackage,
        'install',
        `--directory "${this.projectDir}"`,
        `--modules ${bmadModules}`,
        `--tools ${bmadTools}`,
        `--user-name "${safeUsername}"`,
        '--communication-language English',
        '--document-output-language English',
        '--output-folder _bmad-output',
      ];

      if (isReinstall) {
        commandParts.push('--action update');
      }

      commandParts.push('--yes');

      const command = commandParts.join(' ');

      this.context.log('Installing BMAD using npx', 'info');

      const execAsync = promisify(exec);
      const { stdout: _stdout, stderr } = await execAsync(command, {
        cwd: this.projectDir,
        env: { ...process.env, FORCE_COLOR: '0' },
      });

      if (stderr) {
        this.context.log('BMAD installation stderr output', 'warn');
      }

      this.context.log('BMAD installation stdout', 'debug');

      const installed = this.checkInstallation();
      if (!installed) {
        throw new Error('Installation verification failed - BMAD directory not detected');
      }

      const version = this.getVersion();
      this.context.log('BMAD installation completed', 'info');

      // New/changed manifests and configs must be visible immediately.
      this.invalidateStatusCache();
      clearBmadConfigCache();
      // The freshly (re)installed bmad-help skill learns the deterministic
      // completion rules for this installation.
      this.ensureHelpSkillStateHints();

      return {
        success: true,
        version,
        message: isReinstall ? 'BMAD updated successfully' : 'BMAD installed successfully',
      };
    } catch (error: unknown) {
      this.context.log('BMAD installation failed', 'error');

      const bmadError: BmadError = {
        errorCode: 'BMAD_INSTALL_FAILED',
        message: `Failed to install BMAD: ${error instanceof Error ? error.message : String(error)}`,
        recoveryAction: this.getRecoveryAction(error),
        details: error instanceof Error ? error.stack : String(error),
      };

      throw bmadError;
    }
  }

  private getRecoveryAction(error: unknown): string {
    if (error && typeof error === 'object' && 'code' in error) {
      const code = (error as { code: string }).code;

      switch (code) {
        case 'EACCES':
        case 'EPERM':
          return 'Check write permissions for project directory';
        case 'ENOSPC':
          return 'Free up disk space and retry installation';
        case 'ENOENT':
          return 'Ensure BMAD library is bundled with application';
        default:
          break;
      }
    }

    return 'Try restarting the application and retry installation';
  }

  async resetWorkflow(): Promise<{ success: boolean; message?: string }> {
    try {
      const outputDir = path.join(this.projectDir, '_bmad-output');

      if (!fs.existsSync(outputDir)) {
        this.context.log('BMAD output directory does not exist, nothing to reset', 'info');
        return {
          success: true,
          message: 'No workflow state to reset',
        };
      }

      // Move instead of delete: the user can recover artifacts until they
      // remove the trash folder themselves. Suffix with -N when the same
      // second is already taken (repeated resets within one second).
      const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14); // yyyyMMddHHmmss
      let trashName = `_bmad-output-trash-${stamp}`;
      let suffix = 1;
      while (fs.existsSync(path.join(this.projectDir, trashName))) {
        trashName = `_bmad-output-trash-${stamp}-${suffix}`;
        suffix++;
      }
      const trashDir = path.join(this.projectDir, trashName);
      await fsPromises.rename(outputDir, trashDir);

      this.context.log(`BMAD workflow state moved to ${trashDir}`, 'info');

      this.invalidateStatusCache();

      return {
        success: true,
        message: `Workflow state moved to _bmad-output-trash-${stamp}. Delete the folder manually when done.`,
      };
    } catch (error) {
      this.context.log('Failed to reset BMAD workflow state', 'error');

      return {
        success: false,
        message: `Failed to reset workflow state: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Update check (bmad-method patch updates)
  // ---------------------------------------------------------------------------

  private cachedUpdateInfo: UpdateInfo | undefined;

  /**
   * Check the npm registry for a newer patch version of bmad-method in the
   * same minor version line. Results are cached in the update-checker module
   * for the configured interval (default 24h).
   *
   * Returns the cached result if the interval hasn't elapsed yet.
   */
  async checkForBmadUpdate(): Promise<UpdateInfo | undefined> {
    try {
      const version = this.getVersion();
      if (!version) {
        this.context.log('Cannot check for update: no installed version detected', 'debug');
        this.cachedUpdateInfo = {
          currentVersion: 'unknown',
          latestPatchVersion: '',
          updateAvailable: false,
          lastChecked: Date.now(),
          error: 'No installed version detected',
        };
        return this.cachedUpdateInfo;
      }

      const result = await checkNpmUpdate(version);
      this.cachedUpdateInfo = result ?? undefined;
      return this.cachedUpdateInfo;
    } catch (error) {
      this.context.log(`Update check failed: ${error}`, 'warn');
      this.cachedUpdateInfo = {
        currentVersion: this.getVersion() ?? 'unknown',
        latestPatchVersion: '',
        updateAvailable: false,
        lastChecked: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      };
      return this.cachedUpdateInfo;
    }
  }

  /**
   * Returns the most recently checked update info without triggering a new
   * npm request. Useful for the UI to display cached data.
   */
  getCachedUpdateInfo(): UpdateInfo | undefined {
    return this.cachedUpdateInfo;
  }

  /**
   * Perform a bmad-method update using the existing install/update mechanism.
   *
   * Resolves the concrete target version from the npm registry first: a bare
   * install() would reinstall the pinned default spec (`bmad-method@X.Y.Z`)
   * and never move past it — the UI offered an update that could never be
   * applied. When no target can be resolved (no installed version, network
   * error, already up to date), the pinned spec is reinstalled, which still
   * performs the installer's layout migration via `--action update`.
   */
  async performUpdate(): Promise<InstallResult> {
    let packageOverride: string | undefined;
    try {
      const version = this.getVersion();
      if (version) {
        packageOverride = resolveUpdatePackage(await checkNpmUpdate(version));
      }
    } catch (error) {
      this.context.log(`Could not resolve update target - reinstalling pinned spec: ${error}`, 'warn');
    }
    return await this.install(packageOverride);
  }

  /**
   * Start one of the method's own menu entries: inject the generic start
   * template pointing at the entry's original SKILL.md.
   */
  async executeWorkflow(workflowId: string, taskContext: TaskContext, provider?: string, model?: string, asSubtask = false): Promise<WorkflowExecutionResult> {
    try {
      this.context.log(`Starting workflow execution: ${workflowId}, asSubtask: ${asSubtask}`, 'info');

      // If asSubtask is true, create a new subtask with the provider/model
      if (asSubtask) {
        const parentId = taskContext.data.parentId || taskContext.data.id;
        const projectContext = this.context.getProjectContext();
        if (!projectContext) {
          throw new Error('Project context not available');
        }
        const subtaskData = await projectContext.createTask({
          parentId,
          activate: true,
          provider,
          model,
        });

        this.context.log(`Subtask created: ${subtaskData.id}`, 'info');

        const subtaskContext = projectContext.getTask(subtaskData.id);
        if (!subtaskContext) {
          throw new Error('Failed to get subtask context');
        }

        return await this.executeWorkflow(workflowId, subtaskContext, provider, model, false);
      }

      const entry = this.getCatalogEntry(workflowId);
      if (!entry) {
        throw new Error(`Workflow '${workflowId}' not found in the installed method's catalog`);
      }

      this.context.log(`Workflow found: ${entry.name}`, 'debug');

      const preparer = new ContextPreparer(this.projectDir, this.context);
      const preparedContext = await preparer.prepareEntry(entry);

      this.context.log(`Context prepared: ${preparedContext.contextMessages.length} messages, ${preparedContext.contextFiles.length} files`, 'debug');

      // Clear a stale skill id so onAgentStarted re-injects the workflow context
      return await this.runPreparedContext(preparedContext, entry.name, { bmadWorkflowId: entry.id, bmadSkillId: '' }, taskContext, provider, model);
    } catch (error) {
      return this.toWorkflowError(error);
    }
  }

  /**
   * Execute an arbitrary installed BMAD skill (including internal ones that
   * have no menu row) using the generic skill context template.
   */
  async executeSkill(skillId: string, taskContext: TaskContext, provider?: string, model?: string, asSubtask = false): Promise<WorkflowExecutionResult> {
    try {
      this.context.log(`Starting skill execution: ${skillId}, asSubtask: ${asSubtask}`, 'info');

      if (asSubtask) {
        const parentId = taskContext.data.parentId || taskContext.data.id;
        const projectContext = this.context.getProjectContext();
        if (!projectContext) {
          throw new Error('Project context not available');
        }
        const subtaskData = await projectContext.createTask({
          parentId,
          activate: true,
          provider,
          model,
        });

        const subtaskContext = projectContext.getTask(subtaskData.id);
        if (!subtaskContext) {
          throw new Error('Failed to get subtask context');
        }

        return await this.executeSkill(skillId, subtaskContext, provider, model, false);
      }

      const skill = listInstalledSkills(this.projectDir).find((s) => s.id === skillId);
      if (!skill) {
        throw new Error(`Skill '${skillId}' is not installed`);
      }

      const preparer = new ContextPreparer(this.projectDir, this.context);
      const preparedContext = await preparer.prepareSkill(skill);

      // bmad-help is the orchestrator: prepend the extension's own artifact
      // scan result so the skill orients from deterministic ground truth
      // (done/in-progress/untracked rows, sprint board, next steps) instead
      // of re-deriving completion from fuzzy filename matching at runtime.
      if (skill.id === 'bmad-help') {
        const status = await this.getBmadStatus();
        const suggestions = generateSuggestions(status, taskContext.data.metadata);
        preparedContext.contextMessages.unshift(buildHelpStateMessage(status, suggestions));
      }

      // Clear a stale workflow id so onAgentStarted re-injects the skill context
      return await this.runPreparedContext(preparedContext, skill.name, { bmadSkillId: skillId, bmadWorkflowId: '' }, taskContext, provider, model);
    } catch (error) {
      return this.toWorkflowError(error);
    }
  }

  private async runPreparedContext(
    preparedContext: PreparedContext,
    displayName: string,
    metadata: Record<string, string>,
    taskContext: TaskContext,
    provider?: string,
    model?: string,
  ): Promise<WorkflowExecutionResult> {
    try {
      // Execute via Agent Mode
      this.context.log('Getting task agent profile...', 'debug');
      let agentProfile = await taskContext.getTaskAgentProfile();
      if (!agentProfile) {
        throw new Error('No agent profile configured for this task');
      }

      // Override provider/model if provided
      if (provider && model) {
        this.context.log(`Using custom provider/model: ${provider}/${model}`, 'debug');
        agentProfile = {
          ...agentProfile,
          provider,
          model,
        };
      }

      this.context.log(`Agent profile retrieved: ${agentProfile.name}`, 'debug');

      const promptContext: PromptContext = { id: uuidv4() };

      this.context.log('Building context files array...', 'debug');
      const contextFiles: ContextFile[] = preparedContext.contextFiles.map((filePath) => ({
        path: filePath,
        readOnly: true,
      }));

      // Store prepared context messages in task context and send to UI
      if (preparedContext.contextMessages.length > 0) {
        this.context.log('Loading context messages...', 'debug');
        await taskContext.loadContextMessages(preparedContext.contextMessages);
        this.context.log('Context messages loaded', 'debug');
      }

      if (!taskContext.data.name) {
        this.context.log('Updating task name...', 'debug');
        await taskContext.updateTask({ name: preparedContext.taskName ?? displayName });
      }

      // Store workflow/skill ID in task metadata
      this.context.log('Storing workflow ID in metadata...', 'debug');
      await taskContext.updateTask({
        metadata: {
          ...taskContext.data.metadata,
          ...metadata,
        },
      });

      if (preparedContext.execute) {
        this.context.log('Starting agent execution...', 'info');
        taskContext.addLoadingMessage();
        // AiderDesk 0.77.0 API: runPromptInAgent(profile, mode, userPrompt,
        // promptContext?, contextMessages?, contextFiles?, systemPrompt?,
        // waitForCurrentAgentToFinish?, sendNotification?). Provider/model
        // overrides are already applied to agentProfile above — passing them
        // positionally here would map provider->systemPrompt and
        // model->waitForCurrentAgentToFinish (corrupt system prompt).
        await taskContext.runPromptInAgent(
          agentProfile,
          'bmad',
          null, // No user prompt - workflow is system-driven
          promptContext,
          preparedContext.contextMessages,
          contextFiles,
        );
        this.context.log('Agent execution completed', 'info');
      } else {
        this.context.log('Workflow prepared but not set to execute', 'info');
      }

      this.context.log('Workflow execution completed', 'info');

      // Return success
      return {
        success: true,
      };
    } catch (error) {
      return this.toWorkflowError(error);
    }
  }

  private toWorkflowError(error: unknown): WorkflowExecutionResult {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    this.context.log(`Workflow execution failed: ${errorMessage}`, 'error');
    if (errorStack) {
      this.context.log(`Stack trace: ${errorStack}`, 'error');
    }

    // Determine error code based on error type
    let errorCode = 'WORKFLOW_EXECUTION_FAILED';
    let recoveryAction = 'Check workflow configuration and retry';

    if (error instanceof Error) {
      if (error.message.includes('agent profile')) {
        errorCode = 'AGENT_PROFILE_MISSING';
        recoveryAction = 'Configure an agent profile for this task';
      } else if (
        error.message.includes('not found') ||
        error.message.includes('WORKFLOW_NOT_FOUND') ||
        error.message.includes('not installed')
      ) {
        errorCode = 'WORKFLOW_DEFINITION_MISSING';
        recoveryAction = 'Ensure BMAD library is installed and workflow exists';
      }
    }

    return {
      success: false,
      error: {
        message: errorMessage,
        errorCode,
        recoveryAction,
      },
    };
  }
}


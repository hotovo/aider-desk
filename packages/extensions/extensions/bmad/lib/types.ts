import type { ArtifactTracker, CatalogEntry, InstalledModuleInfo, UntrackReason } from './install-registry';

export type { CatalogEntry, InstalledModuleInfo };

/**
 * A skill installed by the BMAD installer (parsed from _bmad/_config/skill-manifest.csv)
 */
export interface InstalledSkill {
  id: string;
  name: string;
  description: string;
  module: string;
  /** Path to SKILL.md relative to the project root */
  skillPath: string;
}

/**
 * Story status values in sprint-status.yaml (schema defined by the method)
 */
export enum StoryStatus {
  Backlog = 'backlog',
  ReadyForDev = 'ready-for-dev',
  InProgress = 'in-progress',
  Review = 'review',
  Done = 'done',
}

/**
 * Sprint status data parsed from sprint-status.yaml
 */
export interface SprintStatusData {
  storyStatuses: StoryStatus[];
}

export type DetectedArtifact = {
  path: string;
  stepsCompleted?: string[];
  status?: string;
  error?: string;
};

export type DetectedArtifacts = {
  [entryId: string]: DetectedArtifact;
};

/**
 * Artifact scan result. Completion is derived generically from the
 * output-location/outputs columns of module-help.csv (see
 * install-registry.deriveArtifactTracker) plus sprint-status.yaml.
 */
export interface WorkflowArtifacts {
  completedWorkflows: string[];
  inProgressWorkflows: string[];
  incompleteWorkflows?: IncompleteWorkflowMetadata[];
  detectedArtifacts: DetectedArtifacts;
  sprintStatus?: SprintStatusData;
}

/**
 * A catalog entry that produces artifacts but cannot be located generically,
 * surfaced so the UI can explain why it never counts toward progress.
 */
export interface UntrackedWorkflow {
  id: string;
  name: string;
  reason: UntrackReason;
}

/** Catalog entries with a derived artifact tracker (tracked in progress). */
export type TrackedEntries = Record<string, ArtifactTracker>;

/**
 * BMAD status
 */
export interface BmadStatus {
  projectDir: string;
  installed: boolean;
  version?: string;
  /** Installed modules from _bmad/_config/manifest.yaml */
  modules: InstalledModuleInfo[];
  /** Resolved tool skills directory (POSIX, project-relative) */
  skillsDir?: string;
  /** The method's own menu entries whose skill is installed */
  catalog: CatalogEntry[];
  /** Entry ids with a derived completion glob (artifact tracking eligible) */
  trackedEntries: TrackedEntries;
  /** Menu entries that produce artifacts but cannot be located generically */
  untrackedWorkflows?: UntrackedWorkflow[];
  completedWorkflows: string[];
  inProgressWorkflows: string[];
  incompleteWorkflows?: IncompleteWorkflowMetadata[];
  detectedArtifacts: DetectedArtifacts;
  sprintStatus?: SprintStatusData;
}

/**
 * Incomplete workflow metadata
 */
export interface IncompleteWorkflowMetadata {
  workflowId: string;
  artifactPath: string;
  stepsCompleted: number[];
  nextStep: number;
  lastModified: Date;
  corrupted?: boolean;
  corruptionError?: string;
}

/**
 * BMAD installation result
 */
export interface InstallResult {
  success: boolean;
  version?: string;
  message?: string;
}

/**
 * BMAD error with recovery action
 */
export interface BmadError {
  errorCode: string;
  message: string;
  recoveryAction?: string;
  details?: string;
}

/**
 * Workflow execution result
 */
export interface WorkflowExecutionResult {
  success: boolean;
  artifactPath?: string;
  error?: {
    message: string;
    errorCode?: string;
    recoveryAction?: string;
  };
}

/**
 * Progress of a single phase (original phase labels from module-help.csv)
 */
export interface PhaseProgress {
  phase: string;
  phaseName: string;
  completed: number;
  inProgress: number;
  total: number;
  percentage: number;
}

/**
 * Epic/sprint story status distribution
 */
export interface EpicProgress {
  backlog: number;
  readyForDev: number;
  inProgress: number;
  review: number;
  done: number;
  total: number;
  percentage: number;
}

/**
 * Overall project progress summary computed from BmadStatus.
 */
export interface ProgressSummary {
  overall: {
    completed: number;
    inProgress: number;
    total: number;
    percentage: number;
  };
  phases: PhaseProgress[];
  epicProgress?: EpicProgress;
}

/**
 * BMAD action extracted from assistant messages ([Y] Yes menus etc.)
 */
export interface BmadAction {
  actionLetter: string;
  actionName: string;
}

/**
 * Result of a bmad-method version update check against the npm registry.
 */
export interface UpdateInfo {
  currentVersion: string;
  latestPatchVersion: string;
  updateAvailable: boolean;
  lastChecked: number;
  error?: string;
  notes?: string[];
}

/**
 * BMAD configuration settings (merged from the installed modules' config.yaml).
 *
 * Includes an index signature so that future BMAD fields (added by upstream)
 * pass the type-checker without a code change.
 */
export interface BmadConfig {
  project_name?: string;
  user_name?: string;
  communication_language?: string;
  document_output_language?: string;
  user_skill_level?: string;
  implementation_artifacts?: string;
  planning_artifacts?: string;
  output_folder?: string;
  project_context?: string;
  language?: string;
  config_version?: string;
  [key: string]: string | undefined;
}

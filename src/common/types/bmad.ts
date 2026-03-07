/**
 * BMAD workflow execution phases
 */
export enum WorkflowPhase {
  Analysis = 'analysis',
  Planning = 'planning',
  Solutioning = 'solutioning',
  Implementation = 'implementation',
  QuickFlow = 'quick-flow',
}

/**
 * Metadata for a BMAD workflow
 */
export interface WorkflowMetadata {
  id: string;
  name: string;
  phase: WorkflowPhase;
  description: string;
  workflowPath: string;
  outputArtifact: string;
  totalSteps: number;
  requiredArtifacts?: string[];
  followUps?: string[];
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
  corrupted?: boolean; // True if artifact frontmatter is corrupted/unreadable
  corruptionError?: string; // Error message explaining corruption
}

/**
 * Story status values in sprint-status.yaml
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
  completedWorkflows: string[];
}

export type DetectedArtifact = {
  path: string;
  stepsCompleted?: string[];
  status?: string;
  error?: string;
};

export type DetectedArtifacts = {
  [workflowId: string]: DetectedArtifact;
};

/**
 * Workflow artifacts detection result
 */
export interface WorkflowArtifacts {
  completedWorkflows: string[];
  inProgressWorkflows: string[];
  incompleteWorkflows?: IncompleteWorkflowMetadata[];
  detectedArtifacts: DetectedArtifacts;
  sprintStatus?: SprintStatusData;
}

/**
 * BMAD Mode status
 */
export interface BmadStatus {
  projectDir: string;
  installed: boolean;
  version?: string;
  availableWorkflows: WorkflowMetadata[];
  completedWorkflows: string[];
  inProgressWorkflows: string[];
  incompleteWorkflows?: IncompleteWorkflowMetadata[];
  detectedArtifacts: DetectedArtifacts;
  sprintStatus?: SprintStatusData;
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
 * Workflow execution options
 */
export interface WorkflowExecutionOptions {
  asSubtask?: boolean;
  provider?: string;
  model?: string;
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

import { BMAD_WORKFLOWS } from '@common/bmad-workflows';
import { WorkflowArtifacts, SprintStatusData, StoryStatus, WorkflowMetadata, WorkflowPhase } from '@common/bmad-types';

/**
 * Simple glob pattern matching for artifact paths
 */
const matchesPattern = (pathToMatch: string, pattern: string): boolean => {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.') // Escape dots
    .replace(/\*/g, '.*'); // Replace * with .*

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(pathToMatch);
};

/**
 * Calculate prerequisite satisfaction score for a workflow
 * Higher score = more prerequisites satisfied
 */
const getPrerequisiteScore = (workflow: WorkflowMetadata | undefined, detectedArtifacts: WorkflowArtifacts['detectedArtifacts']): number => {
  if (!workflow?.requiredArtifacts || workflow.requiredArtifacts.length === 0) {
    // No prerequisites = high priority
    return 100;
  }

  // Check how many prerequisites are satisfied
  let satisfiedCount = 0;
  const totalRequired = workflow.requiredArtifacts.length;

  workflow.requiredArtifacts.forEach((requiredPattern) => {
    // Check if any detected artifact matches the required pattern
    const hasMatch = Object.values(detectedArtifacts).some((artifact) => matchesPattern(artifact.path, requiredPattern));
    if (hasMatch) {
      satisfiedCount++;
    }
  });

  // Return percentage of satisfied prerequisites
  return (satisfiedCount / totalRequired) * 100;
};

const STORY_STATUS_TO_WORKFLOW: Record<StoryStatus, string | null> = {
  [StoryStatus.Backlog]: 'create-story',
  [StoryStatus.ReadyForDev]: 'dev-story',
  [StoryStatus.InProgress]: null,
  [StoryStatus.Review]: 'code-review',
  [StoryStatus.Done]: null,
};

/**
 * Get workflow suggestions based on story statuses in sprint-status.yaml
 */
const getSprintStatusSuggestions = (sprintStatus: SprintStatusData | undefined): string[] => {
  if (!sprintStatus?.storyStatuses.length) {
    return [];
  }

  const suggestions = new Set<string>();

  for (const status of sprintStatus.storyStatuses) {
    const workflow = STORY_STATUS_TO_WORKFLOW[status];
    if (workflow) {
      suggestions.add(workflow);
    }
  }

  return Array.from(suggestions);
};

/**
 * Determine if the user is on the Quick Flow path based on completed workflows
 */
const isOnQuickPath = (completedWorkflows: string[]): boolean => {
  const quickWorkflowIds = BMAD_WORKFLOWS.filter((w) => w.phase === WorkflowPhase.QuickFlow).map((w) => w.id);
  return completedWorkflows.some((id) => quickWorkflowIds.includes(id));
};

/**
 * Determine if the user is on the Full Workflow path based on completed workflows
 */
const isOnFullPath = (completedWorkflows: string[]): boolean => {
  const fullPathPhases = [WorkflowPhase.Analysis, WorkflowPhase.Planning, WorkflowPhase.Solutioning, WorkflowPhase.Implementation];
  const fullWorkflowIds = BMAD_WORKFLOWS.filter((w) => fullPathPhases.includes(w.phase)).map((w) => w.id);
  return completedWorkflows.some((id) => fullWorkflowIds.includes(id));
};

/**
 * Generate smart workflow suggestions based on completed workflows, detected artifacts, and task metadata
 * Implements greenfield/brownfield detection and prerequisite checking
 * Ensures suggestions include next steps from both Full and Quick paths
 * Prioritizes follow-ups from the currently executing workflow
 */
export const generateSuggestions = (
  completedWorkflows: string[],
  detectedArtifacts: WorkflowArtifacts['detectedArtifacts'],
  sprintStatus?: SprintStatusData,
  taskMetadata?: Record<string, unknown>,
): string[] => {
  // No workflows completed - suggest entry points for both paths
  if (completedWorkflows.length === 0) {
    return ['create-product-brief', 'quick-spec'];
  }

  // Get the currently executing workflow ID from metadata (if available)
  const currentWorkflowId = taskMetadata?.bmadWorkflowId as string | undefined;
  const currentWorkflow = currentWorkflowId ? BMAD_WORKFLOWS.find((w) => w.id === currentWorkflowId) : undefined;

  // If a workflow is currently executing but not completed, don't show any suggestions
  if (currentWorkflow && !completedWorkflows.includes(currentWorkflowId!)) {
    return [];
  }

  // Collect followUps from completed workflows
  const followUpSet = new Set<string>();

  // Collect follow-ups from all completed workflows
  completedWorkflows.forEach((workflowId) => {
    const workflow = BMAD_WORKFLOWS.find((w) => w.id === workflowId);
    if (workflow?.followUps) {
      workflow.followUps.forEach((followUp) => followUpSet.add(followUp));
    }
  });

  // Add suggestions based on story statuses in sprint-status.yaml
  const sprintSuggestions = getSprintStatusSuggestions(sprintStatus);
  sprintSuggestions.forEach((suggestion) => followUpSet.add(suggestion));

  // Ensure both paths are represented in suggestions
  const onQuickPath = isOnQuickPath(completedWorkflows);
  const onFullPath = isOnFullPath(completedWorkflows);

  // If on Quick path, also suggest Full path entry point if not already suggested/completed
  if (onQuickPath && !completedWorkflows.includes('create-product-brief') && !followUpSet.has('create-product-brief')) {
    followUpSet.add('create-product-brief');
  }

  // If on Full path, also suggest Quick path entry point if not already suggested/completed
  if (onFullPath && !completedWorkflows.includes('quick-spec') && !followUpSet.has('quick-spec')) {
    followUpSet.add('quick-spec');
  }

  // If we have a current workflow, filter to only include its follow-ups
  // BUT only if the workflow is completed
  if (currentWorkflow && completedWorkflows.includes(currentWorkflowId!)) {
    if (currentWorkflow.followUps) {
      const currentFollowUps = new Set(currentWorkflow.followUps);
      followUpSet.forEach((item) => {
        if (!currentFollowUps.has(item)) {
          followUpSet.delete(item);
        }
      });
    }
  }

  // Filter out already completed workflows
  const suggestions = Array.from(followUpSet).filter((workflowId) => !completedWorkflows.includes(workflowId));

  // Sort suggestions: prioritize follow-ups from current workflow, then by satisfied prerequisites
  return suggestions.sort((a, b) => {
    const workflowA = BMAD_WORKFLOWS.find((w) => w.id === a);
    const workflowB = BMAD_WORKFLOWS.find((w) => w.id === b);

    // If current workflow has follow-ups, prioritize them
    if (currentWorkflow) {
      const aIsFromCurrent = currentWorkflow.followUps?.includes(a) ?? false;
      const bIsFromCurrent = currentWorkflow.followUps?.includes(b) ?? false;

      if (aIsFromCurrent && !bIsFromCurrent) {
        return -1;
      }
      if (!aIsFromCurrent && bIsFromCurrent) {
        return 1;
      }
    }

    const scoreA = getPrerequisiteScore(workflowA, detectedArtifacts);
    const scoreB = getPrerequisiteScore(workflowB, detectedArtifacts);

    // Higher score first (more prerequisites satisfied)
    return scoreB - scoreA;
  });
};

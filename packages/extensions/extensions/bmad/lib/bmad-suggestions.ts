import { BMAD_WORKFLOWS } from './workflows';
import { WorkflowArtifacts, SprintStatusData, StoryStatus, WorkflowMetadata, WorkflowPhase } from './types';

/**
 * Simple glob pattern matching for artifact paths
 */
const matchesPattern = (pathToMatch: string, pattern: string): boolean => {
  const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(pathToMatch);
};

/**
 * Calculate prerequisite satisfaction score for a workflow
 */
const getPrerequisiteScore = (workflow: WorkflowMetadata | undefined, detectedArtifacts: WorkflowArtifacts['detectedArtifacts']): number => {
  if (!workflow?.requiredArtifacts || workflow.requiredArtifacts.length === 0) {
    return 100;
  }

  let satisfiedCount = 0;
  const totalRequired = workflow.requiredArtifacts.length;

  workflow.requiredArtifacts.forEach((requiredPattern) => {
    const hasMatch = Object.values(detectedArtifacts).some((artifact) => matchesPattern(artifact.path, requiredPattern));
    if (hasMatch) {
      satisfiedCount++;
    }
  });

  return (satisfiedCount / totalRequired) * 100;
};

/**
 * Determine if the user is on the Quick Flow path
 */
const isOnQuickPath = (completedWorkflows: string[]): boolean => {
  const quickWorkflowIds = BMAD_WORKFLOWS.filter((w) => w.phase === WorkflowPhase.QuickFlow).map((w) => w.id);
  return completedWorkflows.some((id) => quickWorkflowIds.includes(id));
};

/**
 * Determine if the user is on the Full Workflow path
 */
const isOnFullPath = (completedWorkflows: string[]): boolean => {
  const fullPathPhases = [WorkflowPhase.Analysis, WorkflowPhase.Planning, WorkflowPhase.Solutioning, WorkflowPhase.Implementation];
  const fullWorkflowIds = BMAD_WORKFLOWS.filter((w) => fullPathPhases.includes(w.phase)).map((w) => w.id);
  return completedWorkflows.some((id) => fullWorkflowIds.includes(id));
};

/**
 * Generate smart workflow suggestions
 */
export const generateSuggestions = (
  completedWorkflows: string[],
  detectedArtifacts: WorkflowArtifacts['detectedArtifacts'],
  sprintStatus?: SprintStatusData,
  taskMetadata?: Record<string, unknown>,
): string[] => {
  if (completedWorkflows.length === 0) {
    return ['create-product-brief', 'quick-spec'];
  }

  const currentWorkflowId = taskMetadata?.bmadWorkflowId as string | undefined;
  const currentWorkflow = currentWorkflowId ? BMAD_WORKFLOWS.find((w) => w.id === currentWorkflowId) : undefined;

  const followUpSet = new Set<string>();

  if (currentWorkflow) {
    if (currentWorkflow.id === 'create-story' && sprintStatus?.storyStatuses.some((status) => status === StoryStatus.ReadyForDev)) {
      return ['dev-story'];
    }

    if (currentWorkflow.id === 'dev-story') {
      if (sprintStatus?.storyStatuses.some((status) => status === StoryStatus.Review)) {
        followUpSet.add('code-review');
      }
      if (sprintStatus?.storyStatuses.some((status) => status === StoryStatus.Backlog)) {
        followUpSet.add('create-story');
      }

      return Array.from(followUpSet);
    }

    if (currentWorkflow.id === 'code-review') {
      if (sprintStatus?.storyStatuses.some((status) => status === StoryStatus.Backlog)) {
        followUpSet.add('create-story');
      }
      if (sprintStatus?.storyStatuses.some((status) => status === StoryStatus.ReadyForDev)) {
        followUpSet.add('dev-story');
      }
      return Array.from(followUpSet);
    }
  } else {
    if (sprintStatus?.storyStatuses.some((status) => status === StoryStatus.Backlog)) {
      followUpSet.add('create-story');
    }
    if (sprintStatus?.storyStatuses.some((status) => status === StoryStatus.ReadyForDev)) {
      followUpSet.add('dev-story');
    }
    if (sprintStatus?.storyStatuses.some((status) => status === StoryStatus.Review)) {
      followUpSet.add('code-review');
    }
  }

  if (currentWorkflow && !completedWorkflows.includes(currentWorkflowId!)) {
    return [];
  }

  completedWorkflows.forEach((workflowId) => {
    const workflow = BMAD_WORKFLOWS.find((w) => w.id === workflowId);
    if (workflow?.followUps) {
      workflow.followUps.forEach((followUp) => followUpSet.add(followUp));
    }
  });

  const onQuickPath = isOnQuickPath(completedWorkflows);
  const onFullPath = isOnFullPath(completedWorkflows);

  if (onQuickPath && !completedWorkflows.includes('create-product-brief') && !followUpSet.has('create-product-brief')) {
    followUpSet.add('create-product-brief');
  }

  if (onFullPath && !completedWorkflows.includes('quick-spec') && !followUpSet.has('quick-spec')) {
    followUpSet.add('quick-spec');
  }

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

  const suggestions = Array.from(followUpSet).filter((workflowId) => !completedWorkflows.includes(workflowId));

  return suggestions.sort((a, b) => {
    const workflowA = BMAD_WORKFLOWS.find((w) => w.id === a);
    const workflowB = BMAD_WORKFLOWS.find((w) => w.id === b);

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

    return scoreB - scoreA;
  });
};

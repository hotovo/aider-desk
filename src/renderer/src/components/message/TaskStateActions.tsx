import { ExtensionUIComponent, Mode, TaskData } from '@common/types';
import { UIComponentProps } from '@common/extensions';
import { ExtensionDisplayAPI } from '@common/api';

import { DefaultTaskStateActions } from '@/components/message/DefaultTaskStateActions';
import { ExtensionComponentRenderer } from '@/components/extensions/ExtensionComponentRenderer';
import { useExtensionComponentsWrapper } from '@/components/extensions/useExtensionComponentsWrapper';
import { RebaseConflictsActions } from '@/components/message/RebaseConflictsActions';
import { RebaseResolvedActions } from '@/components/message/RebaseResolvedActions';
import { useTaskGitStatus } from '@/hooks/useTaskGitStatus';

type Props = {
  projectDir: string;
  taskId: string;
  state: string | undefined;
  mode?: Mode;
  isArchived: boolean | undefined;
  task?: TaskData | null;
  onResumeTask?: () => void;
  onMarkAsDone?: () => void;
  onRunPrompt?: (prompt: string) => void;
  onArchiveTask?: () => void;
  onUnarchiveTask?: () => void;
  onDeleteTask?: () => void;
};

type ChainProps = {
  components: ExtensionUIComponent[];
  defaultTaskActionsProps: Props;
  componentProps: UIComponentProps;
  additionalProps: Record<string, unknown>;
  libraries: Record<string, Record<string, unknown>>;
  currentProjectDir?: string;
  currentTaskId?: string;
  currentActionProjectDir?: string;
  currentActionTaskId?: string;
  api: ExtensionDisplayAPI;
};

const TaskActionsChain = ({
  components,
  defaultTaskActionsProps,
  componentProps,
  additionalProps,
  libraries,
  currentProjectDir,
  currentTaskId,
  currentActionProjectDir,
  currentActionTaskId,
  api,
}: ChainProps) => {
  if (components.length === 0) {
    return <DefaultTaskStateActions {...defaultTaskActionsProps} />;
  }

  const component = components[0];
  const remainingComponents = components.slice(1);

  return (
    <ExtensionComponentRenderer
      component={component}
      componentProps={componentProps}
      additionalProps={{
        ...additionalProps,
        renderDefaultTaskActions: () => (
          <TaskActionsChain
            components={remainingComponents}
            defaultTaskActionsProps={defaultTaskActionsProps}
            componentProps={componentProps}
            additionalProps={additionalProps}
            libraries={libraries}
            currentProjectDir={currentProjectDir}
            currentTaskId={currentTaskId}
            currentActionProjectDir={currentActionProjectDir}
            currentActionTaskId={currentActionTaskId}
            api={api}
          />
        ),
      }}
      libraries={libraries}
      currentProjectDir={currentProjectDir}
      currentTaskId={currentTaskId}
      currentActionProjectDir={currentActionProjectDir}
      currentActionTaskId={currentActionTaskId}
      api={api}
    />
  );
};

export const TaskStateActions = ({
  projectDir,
  taskId,
  state,
  isArchived,
  task,
  onResumeTask,
  onMarkAsDone,
  onRunPrompt,
  onArchiveTask,
  onUnarchiveTask,
  onDeleteTask,
}: Props) => {
  const { taskGitStatus } = useTaskGitStatus(projectDir, taskId);

  const defaultTaskActionsProps: Props = {
    projectDir,
    taskId,
    state,
    isArchived,
    task,
    onResumeTask,
    onMarkAsDone,
    onRunPrompt,
    onArchiveTask,
    onUnarchiveTask,
    onDeleteTask,
  };

  const { components, isEmpty, componentProps, componentLibraries, api, currentProjectDir, currentTaskId, currentActionProjectDir, currentActionTaskId } =
    useExtensionComponentsWrapper({
      placement: 'task-state-actions-all',
      additionalProps: { task, taskId, onRunPrompt, onResumeTask },
      projectDir,
      taskId,
    });

  if (taskGitStatus?.rebaseState.hasUnmergedPaths === true && (taskGitStatus.rebaseState.unmergedFiles?.length ?? 0) > 0) {
    return <RebaseConflictsActions projectDir={projectDir} taskId={taskId} status={taskGitStatus} />;
  }

  if (taskGitStatus?.rebaseState.inProgress === true && taskGitStatus.rebaseState.hasUnmergedPaths === false) {
    return <RebaseResolvedActions projectDir={projectDir} taskId={taskId} />;
  }

  if (isEmpty || !components) {
    return <DefaultTaskStateActions {...defaultTaskActionsProps} />;
  }

  return (
    <TaskActionsChain
      components={components}
      defaultTaskActionsProps={defaultTaskActionsProps}
      componentProps={componentProps}
      additionalProps={{ task, taskId, onRunPrompt, onResumeTask }}
      libraries={componentLibraries}
      currentProjectDir={currentProjectDir}
      currentTaskId={currentTaskId}
      currentActionProjectDir={currentActionProjectDir}
      currentActionTaskId={currentActionTaskId}
      api={api}
    />
  );
};

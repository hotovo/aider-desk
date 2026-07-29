import { TaskData, TaskStateData } from '@common/types';
import { useTranslation } from 'react-i18next';
import { MdMenu } from 'react-icons/md';

import { Messages } from '@/components/message/Messages';
import { ExtensionComponentWrapper } from '@/components/extensions/ExtensionComponentWrapper';
import { convertTaskStateMessages } from '@/utils/task-messages';

type Props = {
  projectDir: string;
  task: TaskData;
  state: TaskStateData;
  onToggleTaskSidebar?: () => void;
};

export const ReadonlyTaskView = ({ projectDir, task, state, onToggleTaskSidebar }: Props) => {
  const { t } = useTranslation();
  const allFiles = state.files.map((file) => file.path);
  const messages = convertTaskStateMessages(state.messages);

  return (
    <main className="min-w-0 flex-1 flex flex-col bg-gradient-to-b from-bg-primary to-bg-primary-light">
      <header className="border-b border-border-dark-light px-4 flex items-center justify-between gap-4 bg-bg-primary-light">
        {onToggleTaskSidebar && (
          <button type="button" className="p-1 text-text-muted hover:text-text-primary" onClick={onToggleTaskSidebar} aria-label={t('readonly.openTasks')}>
            <MdMenu className="h-5 w-5" />
          </button>
        )}
        <ExtensionComponentWrapper placement="task-top-bar-left" projectDir={projectDir} taskId={task.id} className="py-2" />
        <ExtensionComponentWrapper placement="task-top-bar-right" projectDir={projectDir} taskId={task.id} className="py-2" />
      </header>
      <ExtensionsTaskContent projectDir={projectDir} task={task} state={state} messages={messages} allFiles={allFiles} />
      <footer className="flex items-center justify-between border-t border-border-dark-light">
        <ExtensionComponentWrapper placement="task-status-bar-left" projectDir={projectDir} taskId={task.id} className="py-2" />
        <ExtensionComponentWrapper placement="task-status-bar-right" projectDir={projectDir} taskId={task.id} className="py-2" />
      </footer>
    </main>
  );
};

type ContentProps = Props & {
  allFiles: string[];
  messages: import('@common/types').Message[];
};

const ExtensionsTaskContent = ({ projectDir, task, messages, allFiles }: ContentProps) => (
  <div className="flex-1 min-h-0 overflow-y-auto">
    <ExtensionComponentWrapper placement="task-messages-top" projectDir={projectDir} taskId={task.id} className="px-4 pt-4" />
    <Messages baseDir={projectDir} taskId={task.id} messages={messages} allFiles={allFiles} renderMarkdown={true} inProgress={false} />
    <ExtensionComponentWrapper placement="task-messages-bottom" projectDir={projectDir} taskId={task.id} className="px-4 pb-4" />
  </div>
);

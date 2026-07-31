import { ReadonlyBootstrap, SettingsData, THEMES } from '@common/types';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import { IconContext } from 'react-icons';

import { ReadonlyProjectView } from '@/components/readonly/ReadonlyProjectView';
import { ReadonlyHeader } from '@/components/readonly/ReadonlyHeader';
import { ExtensionComponentWrapper } from '@/components/extensions/ExtensionComponentWrapper';
import { ReadonlyApiProvider } from '@/contexts/ReadonlyApiContext';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { ReadonlyModelProvider } from '@/contexts/ModelProviderContext';
import { ExtensionsProvider } from '@/contexts/ExtensionsContext';
import { useSettingsStore } from '@/stores/settingsStore';
import { decodeBaseDir, encodeBaseDir, ROUTES, URL_PARAMS } from '@/utils/routes';
import i18n from '@/i18n';

const ICON_CONTEXT_DEFAULT_VALUE: IconContext = {};

type Props = {
  bootstrap: ReadonlyBootstrap;
};

const ReadonlyRoute = ({ bootstrap }: Props) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const projectParam = searchParams.get(URL_PARAMS.PROJECT);
  const requestedProject = projectParam ? decodeBaseDir(projectParam) : undefined;
  const projectDir = bootstrap.projects.some((project) => project.baseDir === requestedProject) ? requestedProject! : bootstrap.projects[0]?.baseDir;
  const taskId = searchParams.get(URL_PARAMS.TASK) ?? undefined;

  useEffect(() => {
    if (projectDir && projectDir !== requestedProject) {
      setSearchParams({ [URL_PARAMS.PROJECT]: encodeBaseDir(projectDir) }, { replace: true });
    }
  }, [projectDir, requestedProject, setSearchParams]);

  const handleSelectProject = useCallback(
    (selectedProjectDir: string) => {
      setSearchParams({ [URL_PARAMS.PROJECT]: encodeBaseDir(selectedProjectDir) });
    },
    [setSearchParams],
  );

  const handleSelectTask = useCallback(
    (selectedTaskId: string) => {
      if (!projectDir) {
        return;
      }
      setSearchParams({ [URL_PARAMS.PROJECT]: encodeBaseDir(projectDir), [URL_PARAMS.TASK]: selectedTaskId }, { replace: true });
    },
    [projectDir, setSearchParams],
  );

  if (!projectDir) {
    return <div className="absolute inset-0 flex items-center justify-center text-text-muted">{t('readonly.noProjects')}</div>;
  }

  return (
    <ReadonlyApiProvider projectDir={projectDir}>
      <ReadonlyModelProvider>
        <ExtensionsProvider projectDir={projectDir}>
          <div className="absolute inset-0 flex flex-col overflow-hidden">
            <ReadonlyHeader projects={bootstrap.projects} projectDir={projectDir} onSelectProject={handleSelectProject} />
            <div className="relative flex-1 min-h-0">
              <ReadonlyProjectView key={projectDir} projectDir={projectDir} selectedTaskId={taskId} onSelectTask={handleSelectTask} />
            </div>
            <ExtensionComponentWrapper placement="app-floating" projectDir={projectDir} className="fixed bottom-4 right-4 z-40" />
            <ExtensionComponentWrapper placement="project-floating" projectDir={projectDir} className="fixed bottom-4 left-4 z-40" />
            {taskId && (
              <ExtensionComponentWrapper placement="task-floating" projectDir={projectDir} taskId={taskId} className="fixed bottom-4 right-1/3 z-40" />
            )}
          </div>
        </ExtensionsProvider>
      </ReadonlyModelProvider>
    </ReadonlyApiProvider>
  );
};

export const ReadonlyApp = ({ bootstrap }: Props) => {
  useEffect(() => {
    const themeClasses = THEMES.map((theme) => `theme-${theme}`);
    document.body.classList.remove(...themeClasses);
    document.body.classList.add(`theme-${bootstrap.display.theme}`);
    document.documentElement.style.setProperty('--font-family', `"${bootstrap.display.font}", monospace`);
    document.documentElement.style.setProperty('font-size', `${bootstrap.display.fontSize}px`);
    void i18n.changeLanguage(bootstrap.display.language);
  }, [bootstrap]);

  useEffect(() => {
    const { display } = bootstrap;
    const settings: Partial<SettingsData> = {
      language: display.language,
      theme: display.theme,
      font: display.font,
      fontSize: display.fontSize,
      renderMarkdown: display.renderMarkdown,
      fullMessageRendering: display.fullMessageRendering,
      messageViewMode: display.messageViewMode,
    };
    useSettingsStore.getState().setSettingsState(settings as SettingsData);
    useSettingsStore.setState({ readonlyExtensionUi: display.enableExtensionUi });
  }, [bootstrap]);

  const readonlyRoute = useMemo(() => <ReadonlyRoute bootstrap={bootstrap} />, [bootstrap]);

  return (
    <IconContext.Provider value={ICON_CONTEXT_DEFAULT_VALUE}>
      <TooltipProvider>
        <Routes>
          <Route path={ROUTES.Readonly} element={readonlyRoute} />
          <Route path="*" element={<Navigate to={ROUTES.Readonly} replace />} />
        </Routes>
      </TooltipProvider>
    </IconContext.Provider>
  );
};

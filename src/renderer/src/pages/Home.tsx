import { ProjectData } from '@common/types';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, Suspense, lazy, startTransition, useCallback, useEffect, useOptimistic, useRef, useState, useTransition } from 'react';
import { MdBarChart, MdSettings, MdUpload } from 'react-icons/md';
import { PiNotebookFill } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import { useHotkeys } from 'react-hotkeys-hook';
import { useSearchParams } from 'react-router-dom';
import { compareBaseDirs } from '@common/utils';

import { useConfiguredHotkeys } from '@/hooks/useConfiguredHotkeys';
import { useOS } from '@/hooks/useOS';
import { LogsPage } from '@/components/logs/LogsPage';
import { IconButton } from '@/components/common/IconButton';
import { LoadingOverlay } from '@/components/common/LoadingOverlay';
import { NoProjectsOpen } from '@/components/project/NoProjectsOpen';
import { OpenProjectDialog } from '@/components/project/OpenProjectDialog';
import { ProjectTabs } from '@/components/project/ProjectTabs';
import { ProjectView } from '@/components/project/ProjectView';
import { useVersions } from '@/hooks/useVersions';
import { ExtensionComponentWrapper } from '@/components/extensions/ExtensionComponentWrapper';
import { FloatingExtensionPanels } from '@/components/extensions/FloatingExtensionPanels';
import { HtmlInfoDialog } from '@/components/common/HtmlInfoDialog';
import { ProjectSettingsProvider } from '@/contexts/ProjectSettingsContext';
import { TelemetryInfoDialog } from '@/components/TelemetryInfoDialog';
import { showInfoNotification } from '@/utils/notifications';
import { useApi } from '@/contexts/ApiContext';
import { URL_PARAMS, encodeBaseDir, decodeBaseDir, ROUTES } from '@/utils/routes';
import { useBooleanState } from '@/hooks/useBooleanState';
import { PaletteItemType, useCommandPaletteStore } from '@/stores/commandPaletteStore';
import { closeSettings, openSettingsPage, useSettingsNavigationStore } from '@/stores/settingsNavigationStore';
import { registerAction, unregisterAction } from '@/stores/actionsStore';

const UsageDashboard = lazy(() => import('@/components/usage/UsageDashboard').then((module) => ({ default: module.UsageDashboard })));
const SettingsPage = lazy(() => import('@/components/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const ModelLibrary = lazy(() => import('@/components/ModelLibrary').then((module) => ({ default: module.ModelLibrary })));

let hasShownUpdateNotification = false;

export const Home = () => {
  const { t } = useTranslation();
  const { versions } = useVersions();
  const api = useApi();
  const os = useOS();
  const { PROJECT_HOTKEYS } = useConfiguredHotkeys();
  const replaceItems = useCommandPaletteStore((state) => state.replaceItems);
  const clearItems = useCommandPaletteStore((state) => state.clearItems);
  const [searchParams, setSearchParams] = useSearchParams();
  const [openProjects, setOpenProjects] = useState<ProjectData[]>([]);
  const [optimisticOpenProjects, setOptimisticOpenProjects] = useOptimistic(openProjects);
  const [previousProjectBaseDir, setPreviousProjectBaseDir] = useState<string | null>(null);
  const [isOpenProjectDialogVisible, setIsOpenProjectDialogVisible] = useState(false);
  const settingsPage = useSettingsNavigationStore((state) => state.settingsPage);
  const [releaseNotesContent, setReleaseNotesContent] = useState<string | null>(null);
  const [isUsageDashboardVisible, showUsageDashboard, hideUsageDashboard] = useBooleanState(false);
  const [isModelLibraryVisible, showModelLibrary, hideModelLibrary] = useBooleanState(false);
  const [isLogsVisible, showLogs, hideLogs] = useBooleanState(false);
  const [isCtrlTabbing, setIsCtrlTabbing] = useState(false);
  const [isProjectSwitching, startProjectTransition] = useTransition();
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [initialTaskId, setInitialTaskId] = useState<string | undefined>();

  // The URL parameter is the source of truth for the active project, falling back to the
  // backend-tracked selection until the first navigation writes the parameter
  const projectParam = searchParams.get(URL_PARAMS.PROJECT);
  const urlProjectBaseDir = projectParam ? decodeBaseDir(projectParam) : null;
  const storeActiveProject = (optimisticOpenProjects.find((project) => project.active) || optimisticOpenProjects[0])?.baseDir;
  const activeProject = urlProjectBaseDir || storeActiveProject;
  const closingProjectRef = useRef<string | null>(null);

  const handleReorderProjects = useCallback(
    (reorderedProjects: ProjectData[]) => {
      startTransition(async () => {
        setOptimisticOpenProjects(reorderedProjects);
        try {
          setOpenProjects(await api.updateOpenProjectsOrder(reorderedProjects.map((project) => project.baseDir)));
        } catch {
          const currentProjects = await api.getOpenProjects();
          setOpenProjects(currentProjects);
        }
      });
    },
    [api, setOptimisticOpenProjects],
  );

  const isAiderDeskUpdateAvailable = versions?.aiderDeskAvailableVersion && versions.aiderDeskAvailableVersion !== versions.aiderDeskCurrentVersion;
  const isAiderUpdateAvailable = versions?.aiderAvailableVersion && versions.aiderAvailableVersion !== versions.aiderCurrentVersion;
  const isUpdateAvailable = isAiderDeskUpdateAvailable || isAiderUpdateAvailable;
  const isDownloading = typeof versions?.aiderDeskDownloadProgress === 'number';
  const showUpdateIcon = isDownloading || isUpdateAvailable || versions?.aiderDeskNewVersionReady;

  useEffect(() => {
    if (versions?.aiderDeskNewVersionReady && !hasShownUpdateNotification) {
      showInfoNotification(t('settings.about.newAiderDeskVersionReady'));
      hasShownUpdateNotification = true;
    }
  }, [versions, t]);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const openProjects = await api.getOpenProjects();
        setOpenProjects(openProjects);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error loading projects:', error);
      } finally {
        setProjectsLoaded(true);
      }
    };

    void loadProjects();
  }, [api]);

  useEffect(() => {
    const handleShowView = (viewId: string) => {
      if (viewId.startsWith('settings/')) {
        const pageName = viewId.split('/')[1];
        openSettingsPage(pageName);
        hideLogs();
      } else if (viewId === 'logs') {
        closeSettings();
        showLogs();
      }
    };

    const removeListener = api.addShowViewListener(handleShowView);
    return () => {
      removeListener();
    };
  }, [api, hideLogs, showLogs]);

  useEffect(() => {
    const checkReleaseNotes = async () => {
      const notes = await api.getReleaseNotes();
      if (notes) {
        const cleanedNotes = notes.replace(/<img[^>]*>/g, '');
        setReleaseNotesContent(cleanedNotes);
      }
    };

    void checkReleaseNotes();
  }, [api]);

  const setActiveProject = useCallback(
    (baseDir: string) => {
      // The URL parameter allows each window to have its own active project;
      // the backend call is a write-behind mirror
      setSearchParams({ [URL_PARAMS.PROJECT]: encodeBaseDir(baseDir) });
      void api.setActiveProject(baseDir).then(setOpenProjects);
    },
    [api, setSearchParams],
  );

  const handleCloseProject = useCallback(
    (projectBaseDir: string) => {
      closingProjectRef.current = projectBaseDir;
      startTransition(async () => {
        try {
          const removedIndex = optimisticOpenProjects.findIndex((project) => project.baseDir === projectBaseDir);
          const remaining = optimisticOpenProjects.filter((project) => project.baseDir !== projectBaseDir);

          // Only change selection if we're closing the currently active project
          if (projectBaseDir === activeProject && remaining.length > 0) {
            // Pick adjacent from remaining array (not original!) to avoid re-selecting the closed project
            const nextIndex = removedIndex >= remaining.length ? removedIndex - 1 : removedIndex;
            const nextProject = remaining[nextIndex];
            setSearchParams({ [URL_PARAMS.PROJECT]: encodeBaseDir(nextProject.baseDir) }, { replace: true });
          } else if (remaining.length === 0) {
            setSearchParams({}, { replace: true });
          }
          // If closing non-active project: don't touch searchParams at all

          setOptimisticOpenProjects(remaining);
          const updatedProjects = await api.removeOpenProject(projectBaseDir);
          setOpenProjects(updatedProjects);
        } finally {
          closingProjectRef.current = null;
        }
      });
    },
    [api, optimisticOpenProjects, activeProject, setOptimisticOpenProjects, setSearchParams],
  );

  // Close current project tab
  useHotkeys(
    PROJECT_HOTKEYS.CLOSE_PROJECT,
    (e) => {
      e.preventDefault();
      if (activeProject) {
        void handleCloseProject(activeProject);
      }
    },
    { scopes: 'home', enableOnFormTags: true, enableOnContentEditable: true },
    [activeProject, handleCloseProject, PROJECT_HOTKEYS.CLOSE_PROJECT],
  );

  // Handle URL parameters for direct project/task navigation
  useEffect(() => {
    if (!projectsLoaded) {
      return;
    }

    const projectParam = searchParams.get(URL_PARAMS.PROJECT);
    const taskId = searchParams.get(URL_PARAMS.TASK);
    const projectBaseDir = projectParam ? decodeBaseDir(projectParam) : null;

    // Propagate task deep links to the active project view
    if (taskId && taskId !== initialTaskId) {
      setInitialTaskId(taskId);
    }

    if (!projectBaseDir || closingProjectRef.current === projectBaseDir) {
      return;
    }

    const existingProject = optimisticOpenProjects.find((p) => compareBaseDirs(p.baseDir, projectBaseDir, os ?? undefined));
    if (existingProject) {
      // Project is already open and activeProject is derived from the URL, nothing to do
      return;
    }

    // Project is not open yet (deep link): add it
    startProjectTransition(async () => {
      try {
        await api.addOpenProject(projectBaseDir);
        const updatedProjects = await api.getOpenProjects();
        setOpenProjects(updatedProjects);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to open project from URL:', error);
      }
    });
  }, [searchParams, projectsLoaded, api, initialTaskId, optimisticOpenProjects, os]);

  // Open new project dialog
  useHotkeys(
    PROJECT_HOTKEYS.NEW_PROJECT,
    (e) => {
      e.preventDefault();
      setIsOpenProjectDialogVisible(true);
    },
    { scopes: 'home', enableOnFormTags: true, enableOnContentEditable: true },
    [PROJECT_HOTKEYS.NEW_PROJECT, setIsOpenProjectDialogVisible],
  );

  // Open usage dashboard
  useHotkeys(
    PROJECT_HOTKEYS.USAGE_DASHBOARD,
    (e) => {
      e.preventDefault();
      showUsageDashboard();
    },
    { scopes: 'home', enableOnFormTags: true, enableOnContentEditable: true },
    [PROJECT_HOTKEYS.USAGE_DASHBOARD, showUsageDashboard],
  );

  // Open model library
  useHotkeys(
    PROJECT_HOTKEYS.MODEL_LIBRARY,
    (e) => {
      e.preventDefault();
      showModelLibrary();
    },
    { scopes: 'home', enableOnFormTags: true, enableOnContentEditable: true },
    [PROJECT_HOTKEYS.MODEL_LIBRARY, showModelLibrary],
  );

  // Open settings
  useHotkeys(
    PROJECT_HOTKEYS.SETTINGS,
    (e) => {
      e.preventDefault();
      openSettingsPage('general');
    },
    { scopes: 'home', enableOnFormTags: true, enableOnContentEditable: true },
    [PROJECT_HOTKEYS.SETTINGS],
  );

  // Close overlays on Escape
  useHotkeys(
    'esc',
    (e) => {
      e.preventDefault();
      if (isUsageDashboardVisible) {
        hideUsageDashboard();
      } else if (isOpenProjectDialogVisible) {
        setIsOpenProjectDialogVisible(false);
      } else if (releaseNotesContent) {
        void api.clearReleaseNotes();
        setReleaseNotesContent(null);
      }
    },
    {
      enabled: !!(isUsageDashboardVisible || isOpenProjectDialogVisible || releaseNotesContent),
      scopes: 'home',
      enableOnFormTags: true,
      enableOnContentEditable: true,
    },
    [isUsageDashboardVisible, isOpenProjectDialogVisible, releaseNotesContent, api, hideUsageDashboard],
  );

  const switchToProjectByIndex = useCallback(
    (index: number) => {
      if (index < optimisticOpenProjects.length) {
        const targetProject = optimisticOpenProjects[index];
        if (targetProject && targetProject.baseDir !== activeProject) {
          void setActiveProject(targetProject.baseDir);
        }
      }
    },
    [optimisticOpenProjects, activeProject, setActiveProject],
  );

  // Switch to specific project tabs (Alt/Cmd + 1-9)
  useHotkeys(
    [
      PROJECT_HOTKEYS.SWITCH_PROJECT_1,
      PROJECT_HOTKEYS.SWITCH_PROJECT_2,
      PROJECT_HOTKEYS.SWITCH_PROJECT_3,
      PROJECT_HOTKEYS.SWITCH_PROJECT_4,
      PROJECT_HOTKEYS.SWITCH_PROJECT_5,
      PROJECT_HOTKEYS.SWITCH_PROJECT_6,
      PROJECT_HOTKEYS.SWITCH_PROJECT_7,
      PROJECT_HOTKEYS.SWITCH_PROJECT_8,
      PROJECT_HOTKEYS.SWITCH_PROJECT_9,
    ].join(','),
    (e) => {
      e.preventDefault();
      const key = e.key;
      const index = parseInt(key) - 1;
      switchToProjectByIndex(index);
    },
    { scopes: 'home', enableOnFormTags: true, enableOnContentEditable: true },
    [
      optimisticOpenProjects,
      activeProject,
      setActiveProject,
      switchToProjectByIndex,
      PROJECT_HOTKEYS.SWITCH_PROJECT_1,
      PROJECT_HOTKEYS.SWITCH_PROJECT_2,
      PROJECT_HOTKEYS.SWITCH_PROJECT_3,
      PROJECT_HOTKEYS.SWITCH_PROJECT_4,
      PROJECT_HOTKEYS.SWITCH_PROJECT_5,
      PROJECT_HOTKEYS.SWITCH_PROJECT_6,
      PROJECT_HOTKEYS.SWITCH_PROJECT_7,
      PROJECT_HOTKEYS.SWITCH_PROJECT_8,
      PROJECT_HOTKEYS.SWITCH_PROJECT_9,
    ],
  );

  // Ctrl+Tab cycling (forward)
  useHotkeys(
    PROJECT_HOTKEYS.CYCLE_NEXT_PROJECT,
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (optimisticOpenProjects.length <= 1) {
        return;
      }

      setIsCtrlTabbing(true);
      if (!isCtrlTabbing && previousProjectBaseDir && optimisticOpenProjects.some((project) => project.baseDir === previousProjectBaseDir)) {
        setPreviousProjectBaseDir(activeProject || null);
        void setActiveProject(previousProjectBaseDir);
      } else {
        const currentIndex = optimisticOpenProjects.findIndex((project) => project.baseDir === activeProject);
        const nextIndex = (currentIndex + 1) % optimisticOpenProjects.length;
        void setActiveProject(optimisticOpenProjects[nextIndex].baseDir);
        setPreviousProjectBaseDir(activeProject || null);
      }
    },
    { scopes: 'home', keydown: true, keyup: false, enableOnFormTags: true, enableOnContentEditable: true },
    [optimisticOpenProjects, activeProject, previousProjectBaseDir, isCtrlTabbing, setActiveProject, PROJECT_HOTKEYS.CYCLE_NEXT_PROJECT],
  );

  // Ctrl+Shift+Tab cycling (backward)
  useHotkeys(
    PROJECT_HOTKEYS.CYCLE_PREV_PROJECT,
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (optimisticOpenProjects.length <= 1) {
        return;
      }

      setIsCtrlTabbing(true);
      if (!isCtrlTabbing && previousProjectBaseDir && optimisticOpenProjects.some((project) => project.baseDir === previousProjectBaseDir)) {
        setPreviousProjectBaseDir(activeProject || null);
        void setActiveProject(previousProjectBaseDir);
      } else {
        const currentIndex = optimisticOpenProjects.findIndex((project) => project.baseDir === activeProject);
        const prevIndex = (currentIndex - 1 + optimisticOpenProjects.length) % optimisticOpenProjects.length;
        void setActiveProject(optimisticOpenProjects[prevIndex].baseDir);
        setPreviousProjectBaseDir(activeProject || null);
      }
    },
    { scopes: 'home', keydown: true, keyup: false, enableOnFormTags: true, enableOnContentEditable: true },
    [optimisticOpenProjects, activeProject, previousProjectBaseDir, isCtrlTabbing, setActiveProject, PROJECT_HOTKEYS.CYCLE_PREV_PROJECT],
  );

  // Reset Ctrl+Tab state on Control key up
  useEffect(() => {
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        setIsCtrlTabbing(false);
      }
    };

    window.addEventListener('keyup', handleKeyUp);
    return () => window.removeEventListener('keyup', handleKeyUp);
  }, []);

  const handleAddProject = async (baseDir: string) => {
    const projects = await api.addOpenProject(baseDir);
    setOpenProjects(projects);
    void setActiveProject(baseDir);
  };

  const handleCloseOtherProjects = useCallback(
    (baseDir: string) => {
      const projectsToClose = optimisticOpenProjects.filter((p) => p.baseDir !== baseDir);
      for (const project of projectsToClose) {
        handleCloseProject(project.baseDir);
      }
    },
    [handleCloseProject, optimisticOpenProjects],
  );

  const handleCloseAllProjects = useCallback(() => {
    for (const project of optimisticOpenProjects) {
      handleCloseProject(project.baseDir);
    }
  }, [handleCloseProject, optimisticOpenProjects]);

  const cycleProject = useCallback(
    (offset: number) => {
      if (optimisticOpenProjects.length <= 1) {
        return;
      }
      const currentIndex = optimisticOpenProjects.findIndex((p) => p.baseDir === activeProject);
      const nextIndex = (currentIndex + offset + optimisticOpenProjects.length) % optimisticOpenProjects.length;
      void setActiveProject(optimisticOpenProjects[nextIndex].baseDir);
    },
    [optimisticOpenProjects, activeProject, setActiveProject],
  );

  useEffect(() => {
    const actions: Record<string, () => void> = {
      'project.close': () => {
        if (activeProject) {
          void handleCloseProject(activeProject);
        }
      },
      'project.new': () => setIsOpenProjectDialogVisible(true),
      'project.cycleNext': () => cycleProject(1),
      'project.cyclePrev': () => cycleProject(-1),
      'view.usageDashboard': () => showUsageDashboard(),
      'view.modelLibrary': () => showModelLibrary(),
      'view.showLogs': () => {
        closeSettings();
        showLogs();
      },
    };
    for (const [id, handler] of Object.entries(actions)) {
      registerAction(id, handler);
    }
    return () => {
      for (const id of Object.keys(actions)) {
        unregisterAction(id);
      }
    };
  }, [activeProject, handleCloseProject, cycleProject, showUsageDashboard, showModelLibrary, showLogs]);

  useEffect(() => {
    const projects = optimisticOpenProjects.map((project) => ({
      id: `project.switch.${project.baseDir}`,
      label: project.baseDir.split(/[\\/]/).pop() || project.baseDir,
      description: project.baseDir,
      type: PaletteItemType.Project,
      action: () => setActiveProject(project.baseDir),
    }));

    replaceItems('home', projects);
    return () => {
      clearItems('home');
    };
  }, [replaceItems, clearItems, optimisticOpenProjects, setActiveProject]);

  const renderProjectPanels = () =>
    optimisticOpenProjects.map((project) => (
      <ProjectSettingsProvider key={project.baseDir} baseDir={project.baseDir}>
        <div
          className="absolute top-0 left-0 w-full h-full"
          style={{
            zIndex: activeProject === project.baseDir ? 1 : 0,
          }}
        >
          <ProjectView
            projectDir={project.baseDir}
            isProjectActive={activeProject === project.baseDir}
            initialTaskId={activeProject === project.baseDir ? initialTaskId : undefined}
          />
        </div>
      </ProjectSettingsProvider>
    ));

  const getUpdateTooltip = () => {
    if (versions?.aiderDeskNewVersionReady) {
      return t('settings.about.newAiderDeskVersionReady');
    }
    if (isDownloading && versions?.aiderDeskDownloadProgress) {
      return `${t('settings.about.downloadingUpdate')}: ${Math.round(versions.aiderDeskDownloadProgress)}%`;
    }
    if (isAiderDeskUpdateAvailable) {
      return t('settings.about.updateAvailable');
    }
    if (isAiderUpdateAvailable && versions?.aiderAvailableVersion) {
      return t('settings.about.newAiderVersionAvailable', { version: versions.aiderAvailableVersion });
    }
    return ''; // Should not happen if showUpdateIcon is true
  };

  const handleCloseReleaseNotes = async () => {
    await api.clearReleaseNotes();
    setReleaseNotesContent(null);
  };

  const handleOpenAddProjectDialog = useCallback(() => {
    setIsOpenProjectDialogVisible(true);
  }, []);

  const handleOpenUsageDashboard = useCallback(() => {
    showUsageDashboard();
  }, [showUsageDashboard]);

  const handleOpenAboutSettings = useCallback(() => {
    openSettingsPage('about');
  }, []);

  const handleOpenGeneralSettings = useCallback(() => {
    openSettingsPage('general');
  }, []);

  const handleShowLogs = useCallback(() => {
    closeSettings();
    showLogs();
  }, [showLogs]);

  return (
    <div className="flex flex-col h-full p-[4px] bg-gradient-to-b from-bg-primary to-bg-primary-light">
      <div className="flex flex-col h-full border-2 border-border-default relative">
        <div className="flex border-b-2 border-border-default justify-between bg-gradient-to-b from-bg-primary to-bg-primary-light">
          <ProjectTabs
            openProjects={optimisticOpenProjects}
            activeProject={activeProject}
            onAddProject={handleOpenAddProjectDialog}
            onSetActiveProject={setActiveProject}
            onCloseProject={handleCloseProject}
            onCloseAllProjects={handleCloseAllProjects}
            onCloseOtherProjects={handleCloseOtherProjects}
            onReorderProjects={handleReorderProjects}
          />
          <div className="flex items-center flex-shrink-0">
            <ExtensionComponentWrapper placement="header-right" />
            {showUpdateIcon && (
              <IconButton
                icon={<MdUpload className="h-5 w-5 text-text-primary animate-pulse animate-slow" />}
                tooltip={getUpdateTooltip()}
                onClick={handleOpenAboutSettings}
                className="px-4 py-2 hover:bg-bg-tertiary-emphasis transition-colors duration-200"
              />
            )}
            <IconButton
              icon={<PiNotebookFill className="h-5 w-5 text-text-secondary" />}
              tooltip={t('projectBar.modelLibrary')}
              onClick={showModelLibrary}
              className="px-4 py-2 hover:bg-bg-tertiary-emphasis transition-colors duration-200"
            />
            <IconButton
              icon={<MdBarChart className="h-5 w-5 text-text-secondary" />}
              tooltip={t('usageDashboard.title')}
              onClick={handleOpenUsageDashboard}
              className="px-4 py-2 hover:bg-bg-tertiary-emphasis transition-colors duration-200"
            />
            <IconButton
              icon={<MdSettings className="h-5 w-5 text-text-secondary" />}
              tooltip={t('settings.title')}
              onClick={handleOpenGeneralSettings}
              className="px-4 py-2 hover:bg-bg-tertiary-emphasis transition-colors duration-200"
            />
          </div>
        </div>
        {isOpenProjectDialogVisible && (
          <OpenProjectDialog onClose={() => setIsOpenProjectDialogVisible(false)} onAddProject={handleAddProject} openProjects={optimisticOpenProjects} />
        )}
        <Activity mode={settingsPage !== null ? 'visible' : 'hidden'} key={settingsPage?.pageId || 'general'}>
          <Suspense fallback={null}>
            <SettingsPage
              onClose={closeSettings}
              initialPageId={settingsPage?.pageId || 'general'}
              initialOptions={settingsPage?.options}
              openProjects={optimisticOpenProjects}
              onShowLogs={handleShowLogs}
            />
          </Suspense>
        </Activity>
        <Activity mode={isUsageDashboardVisible ? 'visible' : 'hidden'}>
          <Suspense fallback={null}>
            <UsageDashboard onClose={hideUsageDashboard} />
          </Suspense>
        </Activity>
        <Activity mode={isModelLibraryVisible ? 'visible' : 'hidden'}>
          <Suspense fallback={null}>
            <ModelLibrary onClose={hideModelLibrary} />
          </Suspense>
        </Activity>
        <Activity mode={isLogsVisible ? 'visible' : 'hidden'}>
          <LogsPage onClose={hideLogs} openInWindowUrl={`#${ROUTES.Logs}`} />
        </Activity>
        {releaseNotesContent && versions && (
          <HtmlInfoDialog
            title={`${t('settings.about.releaseNotes')} - ${versions.aiderDeskCurrentVersion}`}
            text={releaseNotesContent}
            onClose={handleCloseReleaseNotes}
          />
        )}
        {!releaseNotesContent && <TelemetryInfoDialog />}
        <div className="flex-1 overflow-hidden relative z-10">
          {!projectsLoaded ? (
            <LoadingOverlay message={t('home.loadingProjects')} />
          ) : optimisticOpenProjects.length > 0 ? (
            <div className="relative w-full h-full">
              <AnimatePresence>
                {isProjectSwitching && activeProject && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0 z-50"
                  >
                    <LoadingOverlay message={t('common.loadingProject')} animateOpacity />
                  </motion.div>
                )}
              </AnimatePresence>
              {renderProjectPanels()}
              <div id="floating-panels-root" className="absolute inset-0 pointer-events-none z-40 overflow-visible" />
            </div>
          ) : (
            <NoProjectsOpen onOpenProject={handleOpenAddProjectDialog} />
          )}
        </div>
        <div id="app-floating-panels-root" className="absolute inset-0 pointer-events-none z-50 overflow-visible" />
        <FloatingExtensionPanels placement="app-floating" portalRootId="app-floating-panels-root" />
      </div>
    </div>
  );
};

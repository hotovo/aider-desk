import { ProjectData } from '@common/types';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, startTransition, useCallback, useEffect, useOptimistic, useRef, useState, useTransition } from 'react';
import { MdBarChart, MdSettings, MdUpload } from 'react-icons/md';
import { PiNotebookFill } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import { useHotkeys } from 'react-hotkeys-hook';
import { useSearchParams } from 'react-router-dom';

import { useConfiguredHotkeys } from '@/hooks/useConfiguredHotkeys';
import { UsageDashboard } from '@/components/usage/UsageDashboard';
import { LogsPage } from '@/components/logs/LogsPage';
import { IconButton } from '@/components/common/IconButton';
import { LoadingOverlay } from '@/components/common/LoadingOverlay';
import { NoProjectsOpen } from '@/components/project/NoProjectsOpen';
import { OpenProjectDialog } from '@/components/project/OpenProjectDialog';
import { ProjectTabs } from '@/components/project/ProjectTabs';
import { ProjectView } from '@/components/project/ProjectView';
import { SettingsPage } from '@/components/settings/SettingsPage';
import { useVersions } from '@/hooks/useVersions';
import { ExtensionComponentWrapper } from '@/components/extensions/ExtensionComponentWrapper';
import { HtmlInfoDialog } from '@/components/common/HtmlInfoDialog';
import { ProjectSettingsProvider } from '@/contexts/ProjectSettingsContext';
import { TelemetryInfoDialog } from '@/components/TelemetryInfoDialog';
import { showInfoNotification } from '@/utils/notifications';
import { useApi } from '@/contexts/ApiContext';
import { ModelLibrary } from '@/components/ModelLibrary';
import { URL_PARAMS, encodeBaseDir, decodeBaseDir } from '@/utils/routes';
import { useBooleanState } from '@/hooks/useBooleanState';

let hasShownUpdateNotification = false;

type ShowSettingsInfo = {
  pageId: string;
  options?: Record<string, unknown>;
};

export const Home = () => {
  const { t } = useTranslation();
  const { versions } = useVersions();
  const api = useApi();
  const { PROJECT_HOTKEYS } = useConfiguredHotkeys();
  const [searchParams, setSearchParams] = useSearchParams();
  const [openProjects, setOpenProjects] = useState<ProjectData[]>([]);
  const [optimisticOpenProjects, setOptimisticOpenProjects] = useOptimistic(openProjects);
  const [previousProjectBaseDir, setPreviousProjectBaseDir] = useState<string | null>(null);
  const [isOpenProjectDialogVisible, setIsOpenProjectDialogVisible] = useState(false);
  const [showSettingsInfo, setShowSettingsInfo] = useState<ShowSettingsInfo | null>(null);
  const [releaseNotesContent, setReleaseNotesContent] = useState<string | null>(null);
  const [isUsageDashboardVisible, showUsageDashboard, hideUsageDashboard] = useBooleanState(false);
  const [isModelLibraryVisible, showModelLibrary, hideModelLibrary] = useBooleanState(false);
  const [isLogsVisible, showLogs, hideLogs] = useBooleanState(false);
  const [isCtrlTabbing, setIsCtrlTabbing] = useState(false);
  const [isProjectSwitching, startProjectTransition] = useTransition();
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [initialUrlNavigationDone, setInitialUrlNavigationDone] = useState(false);
  const [initialTaskId, setInitialTaskId] = useState<string | undefined>();

  // Derive active project from URL parameter first, then fall back to store
  const projectParam = searchParams.get(URL_PARAMS.PROJECT);
  const urlProjectBaseDir = projectParam ? decodeBaseDir(projectParam) : null;
  const storeActiveProject = (optimisticOpenProjects.find((project) => project.active) || optimisticOpenProjects[0])?.baseDir;
  const activeProject = urlProjectBaseDir || storeActiveProject;
  const [optimisticActiveProject, setOptimisticActiveProject] = useOptimistic(activeProject);
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
        setProjectsLoaded(true);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error loading projects:', error);
      }
    };

    void loadProjects();
  }, [api]);

  useEffect(() => {
    const handleShowView = (viewId: string) => {
      if (viewId.startsWith('settings/')) {
        const pageName = viewId.split('/')[1];
        setShowSettingsInfo({
          pageId: pageName,
        });
        hideLogs();
      } else if (viewId === 'logs') {
        setShowSettingsInfo(null);
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
      startProjectTransition(async () => {
        setOptimisticActiveProject(baseDir);
        // Update URL parameter instead of global store
        // This allows each window to have its own active project
        setSearchParams({ [URL_PARAMS.PROJECT]: encodeBaseDir(baseDir) });
        const projects = await api.setActiveProject(baseDir);
        setOpenProjects(projects);
      });
    },
    [api, setOptimisticActiveProject, setSearchParams],
  );

  const handleCloseProject = useCallback(
    (projectBaseDir: string) => {
      closingProjectRef.current = projectBaseDir;
      startTransition(async () => {
        try {
          const removedIndex = optimisticOpenProjects.findIndex((project) => project.baseDir === projectBaseDir);
          const remaining = optimisticOpenProjects.filter((project) => project.baseDir !== projectBaseDir);
          if (remaining.length > 0) {
            const nextProject = optimisticOpenProjects[removedIndex === optimisticOpenProjects.length - 1 ? removedIndex - 1 : removedIndex];
            setSearchParams({ [URL_PARAMS.PROJECT]: encodeBaseDir(nextProject.baseDir) }, { replace: true });
          } else {
            setSearchParams({}, { replace: true });
          }

          setOptimisticOpenProjects(remaining);
          const updatedProjects = await api.removeOpenProject(projectBaseDir);
          setOpenProjects(updatedProjects);
        } finally {
          closingProjectRef.current = null;
        }
      });
    },
    [api, optimisticOpenProjects, setOptimisticOpenProjects, setSearchParams],
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

    if (!projectBaseDir) {
      return;
    }

    const handleUrlNavigation = async () => {
      if (!initialUrlNavigationDone) {
        setInitialUrlNavigationDone(true);
      }

      if (closingProjectRef.current === projectBaseDir) {
        return;
      }

      const existingProject = optimisticOpenProjects.find((p) => p.baseDir === projectBaseDir);

      // Only update initial task ID on first navigation or when task changes
      if (taskId && (!initialUrlNavigationDone || taskId !== initialTaskId)) {
        setInitialTaskId(taskId);
      }

      if (existingProject) {
        // Project exists, just update optimistic state (URL is already set)
        if (activeProject !== projectBaseDir) {
          setOptimisticActiveProject(projectBaseDir);
        }
      } else {
        // Project doesn't exist, add it and update optimistic state
        try {
          await api.addOpenProject(projectBaseDir);
          const updatedProjects = await api.getOpenProjects();
          setOpenProjects(updatedProjects);
          setOptimisticActiveProject(projectBaseDir);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to open project from URL:', error);
        }
      }
    };

    void handleUrlNavigation();
  }, [
    searchParams,
    projectsLoaded,
    setActiveProject,
    initialUrlNavigationDone,
    api,
    activeProject,
    initialTaskId,
    setOptimisticActiveProject,
    optimisticOpenProjects,
  ]);

  // Note: We no longer sync activeProject to URL here because setActiveProject now updates the URL directly

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
      setShowSettingsInfo({
        pageId: 'general',
      });
    },
    { scopes: 'home', enableOnFormTags: true, enableOnContentEditable: true },
    [PROJECT_HOTKEYS.SETTINGS, setShowSettingsInfo],
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

  const handleShowSettingsPage = useCallback((pageId?: string, options?: Record<string, unknown>) => {
    if (pageId) {
      setShowSettingsInfo({
        pageId,
        options,
      });
    } else {
      setShowSettingsInfo(null);
    }
  }, []);

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
            showSettingsPage={handleShowSettingsPage}
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
    setShowSettingsInfo({
      pageId: 'about',
    });
  }, []);

  const handleOpenGeneralSettings = useCallback(() => {
    setShowSettingsInfo({
      pageId: 'general',
    });
  }, []);

  const handleShowLogs = useCallback(() => {
    setShowSettingsInfo(null);
    showLogs();
  }, [showLogs]);

  return (
    <div className="flex flex-col h-full p-[4px] bg-gradient-to-b from-bg-primary to-bg-primary-light">
      <div className="flex flex-col h-full border-2 border-border-default relative">
        <div className="flex border-b-2 border-border-default justify-between bg-gradient-to-b from-bg-primary to-bg-primary-light">
          <ProjectTabs
            openProjects={optimisticOpenProjects}
            activeProject={optimisticActiveProject}
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
        <Activity mode={showSettingsInfo !== null ? 'visible' : 'hidden'} key={showSettingsInfo?.pageId || 'general'}>
          <SettingsPage
            onClose={() => setShowSettingsInfo(null)}
            initialPageId={showSettingsInfo?.pageId || 'general'}
            initialOptions={showSettingsInfo?.options}
            openProjects={optimisticOpenProjects}
            onShowLogs={handleShowLogs}
          />
        </Activity>
        <Activity mode={isUsageDashboardVisible ? 'visible' : 'hidden'}>
          <UsageDashboard onClose={hideUsageDashboard} />
        </Activity>
        <Activity mode={isModelLibraryVisible ? 'visible' : 'hidden'}>
          <ModelLibrary onClose={hideModelLibrary} />
        </Activity>
        <Activity mode={isLogsVisible ? 'visible' : 'hidden'}>
          <LogsPage onClose={hideLogs} openInWindowUrl="#/logs" />
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
          {optimisticOpenProjects.length > 0 ? (
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
            </div>
          ) : (
            <NoProjectsOpen onOpenProject={handleOpenAddProjectDialog} />
          )}
        </div>
      </div>
    </div>
  );
};

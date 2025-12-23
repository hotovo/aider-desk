import { ProjectData } from '@common/types';
import { useCallback, useEffect, useState } from 'react';
import { MdBarChart, MdSettings, MdUpload } from 'react-icons/md';
import { PiNotebookFill } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import { useHotkeys } from 'react-hotkeys-hook';

import { useConfiguredHotkeys } from '@/hooks/useConfiguredHotkeys';
import { UsageDashboard } from '@/components/usage/UsageDashboard';
import { IconButton } from '@/components/common/IconButton';
import { NoProjectsOpen } from '@/components/project/NoProjectsOpen';
import { OpenProjectDialog } from '@/components/project/OpenProjectDialog';
import { ProjectTabs } from '@/components/project/ProjectTabs';
import { ProjectView } from '@/components/project/ProjectView';
import { SettingsPage } from '@/components/settings/SettingsPage';
import { useVersions } from '@/hooks/useVersions';
import { HtmlInfoDialog } from '@/components/common/HtmlInfoDialog';
import { ProjectSettingsProvider } from '@/contexts/ProjectSettingsContext';
import { TelemetryInfoDialog } from '@/components/TelemetryInfoDialog';
import { showInfoNotification } from '@/utils/notifications';
import { useApi } from '@/contexts/ApiContext';
import { ModelLibrary } from '@/components/ModelLibrary';
import { StyledTooltip } from '@/components/common/StyledTooltip';

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
  const [openProjects, setOpenProjects] = useState<ProjectData[]>([]);
  const [previousProjectBaseDir, setPreviousProjectBaseDir] = useState<string | null>(null);
  const [isOpenProjectDialogVisible, setIsOpenProjectDialogVisible] = useState(false);
  const [showSettingsInfo, setShowSettingsInfo] = useState<ShowSettingsInfo | null>(null);
  const [releaseNotesContent, setReleaseNotesContent] = useState<string | null>(null);
  const [isUsageDashboardVisible, setIsUsageDashboardVisible] = useState(false);
  const [isModelLibraryVisible, setIsModelLibraryVisible] = useState(false);
  const [isCtrlTabbing, setIsCtrlTabbing] = useState(false);

  const activeProject = openProjects.find((project) => project.active) || openProjects[0];

  const handleReorderProjects = async (reorderedProjects: ProjectData[]) => {
    setOpenProjects(reorderedProjects);
    try {
      setOpenProjects(await api.updateOpenProjectsOrder(reorderedProjects.map((project) => project.baseDir)));
    } catch {
      const currentProjects = await api.getOpenProjects();
      setOpenProjects(currentProjects);
    }
  };

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
      }
    };

    void loadProjects();
  }, [api]);

  useEffect(() => {
    const handleOpenSettings = (pageId: string) => {
      setShowSettingsInfo({
        pageId,
      });
    };

    const removeListener = api.addOpenSettingsListener(handleOpenSettings);
    return () => {
      removeListener();
    };
  }, [api]);

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
    async (baseDir: string) => {
      const projects = await api.setActiveProject(baseDir);
      setOpenProjects(projects);
    },
    [api],
  );

  const handleCloseProject = useCallback(
    async (projectBaseDir: string) => {
      const updatedProjects = await api.removeOpenProject(projectBaseDir);
      setOpenProjects(updatedProjects);
    },
    [api],
  );

  // Close current project tab
  useHotkeys(
    PROJECT_HOTKEYS.CLOSE_PROJECT,
    (e) => {
      e.preventDefault();
      if (activeProject) {
        void handleCloseProject(activeProject.baseDir);
      }
    },
    { scopes: 'home', enableOnFormTags: true, enableOnContentEditable: true },
    [activeProject, handleCloseProject, PROJECT_HOTKEYS.CLOSE_PROJECT],
  );

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
      setIsUsageDashboardVisible(true);
    },
    { scopes: 'home', enableOnFormTags: true, enableOnContentEditable: true },
    [PROJECT_HOTKEYS.USAGE_DASHBOARD, setIsUsageDashboardVisible],
  );

  // Open model library
  useHotkeys(
    PROJECT_HOTKEYS.MODEL_LIBRARY,
    (e) => {
      e.preventDefault();
      setIsModelLibraryVisible(true);
    },
    { scopes: 'home', enableOnFormTags: true, enableOnContentEditable: true },
    [PROJECT_HOTKEYS.MODEL_LIBRARY, setIsModelLibraryVisible],
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
        setIsUsageDashboardVisible(false);
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
    [isUsageDashboardVisible, isOpenProjectDialogVisible, releaseNotesContent, api],
  );

  const switchToProjectByIndex = useCallback(
    (index: number) => {
      if (index < openProjects.length) {
        const targetProject = openProjects[index];
        if (targetProject && targetProject.baseDir !== activeProject?.baseDir) {
          void setActiveProject(targetProject.baseDir);
        }
      }
    },
    [openProjects, activeProject, setActiveProject],
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
      openProjects,
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
      if (openProjects.length <= 1) {
        return;
      }

      setIsCtrlTabbing(true);
      if (!isCtrlTabbing && previousProjectBaseDir && openProjects.some((project) => project.baseDir === previousProjectBaseDir)) {
        setPreviousProjectBaseDir(activeProject?.baseDir || null);
        void setActiveProject(previousProjectBaseDir);
      } else {
        const currentIndex = openProjects.findIndex((project) => project.baseDir === activeProject?.baseDir);
        const nextIndex = (currentIndex + 1) % openProjects.length;
        void setActiveProject(openProjects[nextIndex].baseDir);
        setPreviousProjectBaseDir(activeProject?.baseDir || null);
      }
    },
    { scopes: 'home', keydown: true, keyup: false, enableOnFormTags: true, enableOnContentEditable: true },
    [openProjects, activeProject, previousProjectBaseDir, isCtrlTabbing, setActiveProject, PROJECT_HOTKEYS.CYCLE_NEXT_PROJECT],
  );

  // Ctrl+Shift+Tab cycling (backward)
  useHotkeys(
    PROJECT_HOTKEYS.CYCLE_PREV_PROJECT,
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (openProjects.length <= 1) {
        return;
      }

      setIsCtrlTabbing(true);
      if (!isCtrlTabbing && previousProjectBaseDir && openProjects.some((project) => project.baseDir === previousProjectBaseDir)) {
        setPreviousProjectBaseDir(activeProject?.baseDir || null);
        void setActiveProject(previousProjectBaseDir);
      } else {
        const currentIndex = openProjects.findIndex((project) => project.baseDir === activeProject?.baseDir);
        const prevIndex = (currentIndex - 1 + openProjects.length) % openProjects.length;
        void setActiveProject(openProjects[prevIndex].baseDir);
        setPreviousProjectBaseDir(activeProject?.baseDir || null);
      }
    },
    { scopes: 'home', keydown: true, keyup: false, enableOnFormTags: true, enableOnContentEditable: true },
    [openProjects, activeProject, previousProjectBaseDir, isCtrlTabbing, setActiveProject, PROJECT_HOTKEYS.CYCLE_PREV_PROJECT],
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

  const handleCloseOtherProjects = async (baseDir: string) => {
    const projectsToClose = openProjects.filter((p) => p.baseDir !== baseDir);
    for (const project of projectsToClose) {
      await handleCloseProject(project.baseDir);
    }
  };

  const handleCloseAllProjects = async () => {
    for (const project of openProjects) {
      await handleCloseProject(project.baseDir);
    }
  };

  const projectOperations = {
    onCloseProject: handleCloseProject,
    onCloseOtherProjects: handleCloseOtherProjects,
    onCloseAllProjects: handleCloseAllProjects,
  };

  const renderProjectPanels = () =>
    openProjects.map((project) => (
      <ProjectSettingsProvider key={project.baseDir} baseDir={project.baseDir}>
        <div
          className="absolute top-0 left-0 w-full h-full"
          style={{
            display: activeProject?.baseDir === project.baseDir ? 'block' : 'none',
          }}
        >
          <ProjectView project={project} isActive={activeProject?.baseDir === project.baseDir} />
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

  return (
    <div className="flex flex-col h-full p-[4px] bg-gradient-to-b from-bg-primary to-bg-primary-light">
      <StyledTooltip id="top-bar-tooltip" />
      <div className="flex flex-col h-full border-2 border-border-default relative">
        <div className="flex border-b-2 border-border-default justify-between bg-gradient-to-b from-bg-primary to-bg-primary-light">
          <ProjectTabs
            openProjects={openProjects}
            activeProject={activeProject}
            onAddProject={() => setIsOpenProjectDialogVisible(true)}
            onSetActiveProject={setActiveProject}
            projectOperations={projectOperations}
            onReorderProjects={handleReorderProjects}
          />
          <div className="flex items-center">
            {showUpdateIcon && (
              <IconButton
                icon={<MdUpload className="h-5 w-5 text-text-primary animate-pulse animate-slow" />}
                tooltip={getUpdateTooltip()}
                tooltipId="top-bar-tooltip"
                onClick={() => {
                  setShowSettingsInfo({
                    pageId: 'about',
                  });
                }}
                className="px-4 py-2 hover:bg-bg-tertiary-emphasis transition-colors duration-200"
              />
            )}
            <IconButton
              icon={<PiNotebookFill className="h-5 w-5 text-text-secondary" />}
              tooltip={t('projectBar.modelLibrary')}
              tooltipId="top-bar-tooltip"
              onClick={() => setIsModelLibraryVisible(true)}
              className="px-4 py-2 hover:bg-bg-tertiary-emphasis transition-colors duration-200"
            />
            <IconButton
              icon={<MdBarChart className="h-5 w-5 text-text-secondary" />}
              tooltip={t('usageDashboard.title')}
              tooltipId="top-bar-tooltip"
              onClick={() => setIsUsageDashboardVisible(true)}
              className="px-4 py-2 hover:bg-bg-tertiary-emphasis transition-colors duration-200"
            />
            <IconButton
              icon={<MdSettings className="h-5 w-5 text-text-secondary" />}
              tooltip={t('settings.title')}
              tooltipId="top-bar-tooltip"
              onClick={() => {
                setShowSettingsInfo({
                  pageId: 'general',
                });
              }}
              className="px-4 py-2 hover:bg-bg-tertiary-emphasis transition-colors duration-200"
            />
          </div>
        </div>
        {isOpenProjectDialogVisible && (
          <OpenProjectDialog onClose={() => setIsOpenProjectDialogVisible(false)} onAddProject={handleAddProject} openProjects={openProjects} />
        )}
        {showSettingsInfo !== null && (
          <SettingsPage
            onClose={() => setShowSettingsInfo(null)}
            initialPageId={showSettingsInfo.pageId}
            initialOptions={showSettingsInfo.options}
            openProjects={openProjects}
          />
        )}
        {isUsageDashboardVisible && <UsageDashboard onClose={() => setIsUsageDashboardVisible(false)} />}
        {isModelLibraryVisible && <ModelLibrary isVisible={isModelLibraryVisible} onClose={() => setIsModelLibraryVisible(false)} />}
        {releaseNotesContent && versions && (
          <HtmlInfoDialog
            title={`${t('settings.about.releaseNotes')} - ${versions.aiderDeskCurrentVersion}`}
            text={releaseNotesContent}
            onClose={handleCloseReleaseNotes}
          />
        )}
        {!releaseNotesContent && <TelemetryInfoDialog />}
        <div className="flex-1 overflow-hidden relative">
          {openProjects.length > 0 ? renderProjectPanels() : <NoProjectsOpen onOpenProject={() => setIsOpenProjectDialogVisible(true)} />}
        </div>
      </div>
    </div>
  );
};

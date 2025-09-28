import { ProjectData } from '@common/types';
import { useCallback, useEffect, useState } from 'react';
import { MdBarChart, MdSettings, MdUpload } from 'react-icons/md';
import { PiNotebookFill } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';

import { UsageDashboard } from '@/components/usage/UsageDashboard';
import { IconButton } from '@/components/common/IconButton';
import { NoProjectsOpen } from '@/components/project/NoProjectsOpen';
import { OpenProjectDialog } from '@/components/project/OpenProjectDialog';
import { ProjectTabs } from '@/components/project/ProjectTabs';
import { ProjectView } from '@/components/project/ProjectView';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { useVersions } from '@/hooks/useVersions';
import { HtmlInfoDialog } from '@/components/common/HtmlInfoDialog';
import { ProjectSettingsProvider } from '@/context/ProjectSettingsContext';
import { TelemetryInfoDialog } from '@/components/TelemetryInfoDialog';
import { showInfoNotification } from '@/utils/notifications';
import { useApi } from '@/context/ApiContext';
import { ModelLibrary } from '@/components/ModelLibrary';

export const Home = () => {
  const { t } = useTranslation();
  const { versions } = useVersions();
  const api = useApi();
  const [openProjects, setOpenProjects] = useState<ProjectData[]>([]);
  const [previousProjectBaseDir, setPreviousProjectBaseDir] = useState<string | null>(null);
  const [isOpenProjectDialogVisible, setIsOpenProjectDialogVisible] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [isTabbing, setIsTabbing] = useState(false);
  const [showSettingsTab, setShowSettingsTab] = useState<number | null>(null);
  const [releaseNotesContent, setReleaseNotesContent] = useState<string | null>(null);
  const [isUsageDashboardVisible, setIsUsageDashboardVisible] = useState(false);
  const [isModelLibraryVisible, setIsModelLibraryVisible] = useState(false);
  const [hasShownUpdateNotification, setHasShownUpdateNotification] = useState(false);

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
      setHasShownUpdateNotification(true);
    }
  }, [versions, t, hasShownUpdateNotification, api]);

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
    const handleOpenSettings = (tabIndex: number) => {
      setShowSettingsTab(tabIndex);
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

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        setIsCtrlPressed(true);
      }

      if (e.key === 'Tab' && isCtrlPressed && openProjects.length > 1) {
        e.preventDefault();
        setIsTabbing(true);
        if (!isTabbing && previousProjectBaseDir && openProjects.some((project) => project.baseDir === previousProjectBaseDir)) {
          // First TAB press - switch to previous tab
          setPreviousProjectBaseDir(activeProject?.baseDir);
          void setActiveProject(previousProjectBaseDir);
        } else {
          // Subsequent TAB presses - cycle through tabs
          const currentIndex = openProjects.findIndex((project) => project.baseDir === activeProject?.baseDir);
          const nextIndex = (currentIndex + 1) % openProjects.length;
          void setActiveProject(openProjects[nextIndex].baseDir);
          setPreviousProjectBaseDir(activeProject?.baseDir);
        }
      }
    },
    [isCtrlPressed, activeProject?.baseDir, openProjects, previousProjectBaseDir, isTabbing, setActiveProject],
  );

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Control') {
      setIsCtrlPressed(false);
      setIsTabbing(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  const handleAddProject = async (baseDir: string) => {
    const projects = await api.addOpenProject(baseDir);
    setOpenProjects(projects);
  };

  const handleCloseProject = async (projectBaseDir: string) => {
    const updatedProjects = await api.removeOpenProject(projectBaseDir);
    setOpenProjects(updatedProjects);
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
                onClick={() => {
                  setShowSettingsTab(3);
                }}
                className="px-4 py-2 hover:bg-bg-tertiary-emphasis transition-colors duration-200"
              />
            )}
            <IconButton
              icon={<PiNotebookFill className="h-5 w-5 text-text-secondary" />}
              tooltip={t('projectBar.modelLibrary')}
              onClick={() => setIsModelLibraryVisible(true)}
              className="px-4 py-2 hover:bg-bg-tertiary-emphasis transition-colors duration-200"
            />
            <IconButton
              icon={<MdBarChart className="h-5 w-5 text-text-secondary" />}
              tooltip={t('usageDashboard.title')}
              onClick={() => setIsUsageDashboardVisible(true)}
              className="px-4 py-2 hover:bg-bg-tertiary-emphasis transition-colors duration-200"
            />
            <IconButton
              icon={<MdSettings className="h-5 w-5 text-text-secondary" />}
              tooltip={t('settings.title')}
              onClick={() => {
                setShowSettingsTab(0);
              }}
              className="px-4 py-2 hover:bg-bg-tertiary-emphasis transition-colors duration-200"
            />
          </div>
        </div>
        {isOpenProjectDialogVisible && (
          <OpenProjectDialog onClose={() => setIsOpenProjectDialogVisible(false)} onAddProject={handleAddProject} openProjects={openProjects} />
        )}
        {showSettingsTab !== null && <SettingsDialog onClose={() => setShowSettingsTab(null)} initialTab={showSettingsTab} />}
        {isUsageDashboardVisible && <UsageDashboard onClose={() => setIsUsageDashboardVisible(false)} />}
        {isModelLibraryVisible && <ModelLibrary onClose={() => setIsModelLibraryVisible(false)} />}
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

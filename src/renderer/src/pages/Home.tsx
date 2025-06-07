import { ModelInfo, ProjectData, OS } from '@common/types';
import { useCallback, useEffect, useState } from 'react';
import { MdSettings, MdUpload, MdMinimize, MdCropSquare, MdClose } from 'react-icons/md';
import { useTranslation } from 'react-i18next';

import { IconButton } from '@/components/common/IconButton';
import { NoProjectsOpen } from '@/components/project/NoProjectsOpen';
import { OpenProjectDialog } from '@/components/project/OpenProjectDialog';
import { ProjectTabs } from '@/components/project/ProjectTabs';
import { ProjectView } from '@/components/project/ProjectView';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { useVersions } from '@/hooks/useVersions';
import { HtmlInfoDialog } from '@/components/common/HtmlInfoDialog';
import { ProjectSettingsProvider } from '@/context/ProjectSettingsContext';
import { TelemetryInfoDialog } from '@/components/Dialogs/TelemetryInfoDialog';

export const Home = () => {
  const { t } = useTranslation();
  const { versions } = useVersions();
  const [openProjects, setOpenProjects] = useState<ProjectData[]>([]);
  const [previousProjectBaseDir, setPreviousProjectBaseDir] = useState<string | null>(null);
  const [isOpenProjectDialogVisible, setIsOpenProjectDialogVisible] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [isTabbing, setIsTabbing] = useState(false);
  const [showSettingsTab, setShowSettingsTab] = useState<number | null>(null);
  const [releaseNotesContent, setReleaseNotesContent] = useState<string | null>(null);
  const [modelsInfo, setModelsInfo] = useState<Record<string, ModelInfo>>({});
  const [currentOS, setCurrentOS] = useState<OS | null>(null);

  const activeProject = openProjects.find((project) => project.active) || openProjects[0];

  const handleReorderProjects = async (reorderedProjects: ProjectData[]) => {
    setOpenProjects(reorderedProjects);
    try {
      setOpenProjects(await window.api.updateOpenProjectsOrder(reorderedProjects.map((project) => project.baseDir)));
    } catch {
      const currentProjects = await window.api.getOpenProjects();
      setOpenProjects(currentProjects);
    }
  };

  const handleMinimize = () => {
    window.electronAPI?.minimizeWindow();
  };

  const handleMaximize = () => {
    window.electronAPI?.maximizeWindow();
  };

  const handleClose = () => {
    window.electronAPI?.closeWindow();
  };

  const isAiderDeskUpdateAvailable = versions?.aiderDeskAvailableVersion && versions.aiderDeskAvailableVersion !== versions.aiderDeskCurrentVersion;
  const isAiderUpdateAvailable = versions?.aiderAvailableVersion && versions.aiderAvailableVersion !== versions.aiderCurrentVersion;
  const isUpdateAvailable = isAiderDeskUpdateAvailable || isAiderUpdateAvailable;
  const isDownloading = typeof versions?.aiderDeskDownloadProgress === 'number';
  const showUpdateIcon = isDownloading || isUpdateAvailable || versions?.aiderDeskNewVersionReady;

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const openProjects = await window.api.getOpenProjects();
        setOpenProjects(openProjects);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error loading projects:', error);
      }
    };

    void loadProjects();
  }, []);

  useEffect(() => {
    const checkReleaseNotes = async () => {
      const notes = await window.api.getReleaseNotes();
      if (notes) {
        const cleanedNotes = notes.replace(/<img[^>]*>/g, '');
        setReleaseNotesContent(cleanedNotes);
      }
    };

    void checkReleaseNotes();
  }, []);

  useEffect(() => {
    const loadModels = async () => {
      try {
        const info = await window.api.loadModelsInfo();
        setModelsInfo(info);
      } catch (error) {
        console.error('Failed to load models info:', error);
      }
    };

    void loadModels();
  }, []);

  useEffect(() => {
    const loadOS = async () => {
      try {
        const os = await window.api.getOS();
        setCurrentOS(os);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error loading OS:', error);
      }
    };

    void loadOS();
  }, []);

  const setActiveProject = async (baseDir: string) => {
    const projects = await window.api.setActiveProject(baseDir);
    setOpenProjects(projects);
  };

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
          setActiveProject(previousProjectBaseDir);
        } else {
          // Subsequent TAB presses - cycle through tabs
          const currentIndex = openProjects.findIndex((project) => project.baseDir === activeProject?.baseDir);
          const nextIndex = (currentIndex + 1) % openProjects.length;
          setActiveProject(openProjects[nextIndex].baseDir);
          setPreviousProjectBaseDir(activeProject?.baseDir);
        }
      }
    },
    [isCtrlPressed, activeProject?.baseDir, openProjects, previousProjectBaseDir, isTabbing],
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
    const projects = await window.api.addOpenProject(baseDir);
    setOpenProjects(projects);
  };

  const handleCloseProject = async (projectBaseDir: string) => {
    const updatedProjects = await window.api.removeOpenProject(projectBaseDir);
    setOpenProjects(updatedProjects);
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
          <ProjectView project={project} isActive={activeProject?.baseDir === project.baseDir} modelsInfo={modelsInfo} />
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
    await window.api.clearReleaseNotes();
    setReleaseNotesContent(null);
  };

  const isMacOS = currentOS === OS.MacOS;
  const shouldShowWindowControls = currentOS && currentOS !== OS.MacOS;

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: 'var(--theme-background-primary)' }}>
      {/* Custom title bar with window controls */}
      <div className="window-drag custom-title-bar flex justify-between items-center h-8 border-b" style={{ backgroundColor: 'var(--theme-background-secondary)', borderColor: 'var(--theme-border-primary)' }}>
        {/* Left side - draggable area with macOS padding */}
        <div className={`flex-1 h-full ${isMacOS ? 'pl-20' : ''}`} />
        
        {/* Right side - window controls (only on Windows/Linux) */}
        {shouldShowWindowControls && (
          <div className="window-no-drag window-controls">
            <button className="window-control-button" onClick={handleMinimize} title="Minimize">
              <MdMinimize />
            </button>
            <button className="window-control-button" onClick={handleMaximize} title="Maximize">
              <MdCropSquare />
            </button>
            <button className="window-control-button close" onClick={handleClose} title="Close">
              <MdClose />
            </button>
          </div>
        )}
      </div>

      {/* Main content area */}
      <div className="flex flex-col flex-1 p-[4px]">
        <div className="flex flex-col h-full border-2" style={{ borderColor: 'var(--theme-border-primary)' }}>
          {/* Project tabs and settings bar */}
          <div className="flex border-b-2 justify-between" style={{ borderColor: 'var(--theme-border-primary)', backgroundColor: 'var(--theme-background-secondary)' }}>
            <div className="window-no-drag flex-1">
              <ProjectTabs
                openProjects={openProjects}
                activeProject={activeProject}
                onAddProject={() => setIsOpenProjectDialogVisible(true)}
                onSetActiveProject={setActiveProject}
                onCloseProject={handleCloseProject}
                onReorderProjects={handleReorderProjects}
              />
            </div>
            <div className="window-no-drag flex items-center">
              {showUpdateIcon && (
                <IconButton
                  icon={<MdUpload className="h-5 w-5 animate-pulse animate-slow" />}
                  tooltip={getUpdateTooltip()}
                  onClick={() => {
                    setShowSettingsTab(3);
                  }}
                  className="px-4 py-2 hover:bg-[var(--theme-background-tertiary)]"
                />
              )}
              <IconButton
                icon={<MdSettings className="h-5 w-5" />}
                tooltip={t('settings.title')}
                onClick={() => {
                  setShowSettingsTab(0);
                }}
                className="px-4 py-2 hover:bg-[var(--theme-background-tertiary)]"
              />
            </div>
          </div>

          {/* Dialogs */}
          {isOpenProjectDialogVisible && (
            <OpenProjectDialog onClose={() => setIsOpenProjectDialogVisible(false)} onAddProject={handleAddProject} openProjects={openProjects} />
          )}
          {showSettingsTab !== null && <SettingsDialog onClose={() => setShowSettingsTab(null)} initialTab={showSettingsTab} />}
          {releaseNotesContent && versions && (
            <HtmlInfoDialog
              title={`${t('settings.about.releaseNotes')} - ${versions.aiderDeskCurrentVersion}`}
              text={releaseNotesContent}
              onClose={handleCloseReleaseNotes}
            />
          )}
          {!releaseNotesContent && <TelemetryInfoDialog />}

          {/* Project content area */}
          <div className="flex-grow overflow-hidden relative">
            {openProjects.length > 0 ? renderProjectPanels() : <NoProjectsOpen onOpenProject={() => setIsOpenProjectDialogVisible(true)} />}
          </div>
        </div>
      </div>
    </div>
  );
};

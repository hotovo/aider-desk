import { AgentProfile, Font, McpServersData, ProjectData, ProviderProfile, SettingsData, Theme } from '@common/types';
import { Dispatch, ReactNode, SetStateAction, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FaBrain,
  FaChevronDown,
  FaChevronRight,
  FaCog,
  FaInfoCircle,
  FaKeyboard,
  FaMicrophone,
  FaPlug,
  FaPuzzlePiece,
  FaRobot,
  FaServer,
} from 'react-icons/fa';
import { MdTerminal } from 'react-icons/md';
import { LuClipboardList } from 'react-icons/lu';
import { RiMenuUnfold4Line } from 'react-icons/ri';
import { HiXMark } from 'react-icons/hi2';

import { useResponsive } from '@/hooks/useResponsive';
import { useBooleanState } from '@/hooks/useBooleanState';
import { getPathBasename } from '@/utils/path-utils';
import { useApi } from '@/contexts/ApiContext';
import { AiderSettings } from '@/components/settings/AiderSettings';
import { GeneralSettings } from '@/components/settings/GeneralSettings';
import { AgentSettings } from '@/components/settings/agent/AgentSettings';
import { McpSettings } from '@/components/settings/mcp/McpSettings';
import { AboutSettings } from '@/components/settings/AboutSettings';
import { NetworkSettings } from '@/components/settings/NetworkSettings';
import { MemorySettings } from '@/components/settings/MemorySettings';
import { VoiceSettings } from '@/components/settings/VoiceSettings';
import { HotkeysSettings } from '@/components/settings/HotkeysSettings';
import { TaskSettings } from '@/components/settings/TaskSettings';
import { ExtensionsSettings } from '@/components/settings/ExtensionsSettings';

type PageId = 'general' | 'aider' | 'agents' | 'mcpServers' | 'tasks' | 'memory' | 'voice' | 'hotkeys' | 'network' | 'extensions' | 'about';

interface SidebarItem {
  id: string;
  label: string;
  icon?: ReactNode;
  children?: { id: string; label: string }[];
  pageId: PageId;
}

type Props = {
  settings: SettingsData;
  updateSettings: (settings: SettingsData) => void;
  onLanguageChange: (language: string) => void;
  onZoomChange: (zoomLevel: number) => void;
  onThemeChange: (theme: Theme) => void;
  onFontChange: (fontName: Font) => void;
  onFontSizeChange: (fontSize: number) => void;
  initialPageId?: string;
  initialOptions?: Record<string, unknown>;
  agentProfiles?: AgentProfile[];
  setAgentProfiles?: (profiles: AgentProfile[]) => void;
  mcpServers: McpServersData;
  setMcpServers: Dispatch<SetStateAction<McpServersData>>;
  openProjects?: ProjectData[];
  providers?: ProviderProfile[];
  setProviders?: (providers: ProviderProfile[]) => void;
  onShowLogs?: () => void;
};

export const Settings = ({
  settings,
  updateSettings,
  onLanguageChange,
  onZoomChange,
  onThemeChange,
  onFontChange,
  onFontSizeChange,
  initialPageId,
  initialOptions,
  agentProfiles,
  setAgentProfiles,
  mcpServers,
  setMcpServers,
  openProjects,
  providers,
  setProviders,
  onShowLogs,
}: Props) => {
  const { t } = useTranslation();
  const api = useApi();
  const { isMobile } = useResponsive();
  const [isNavSidebarOpen, , hideNavSidebar, toggleNavSidebar] = useBooleanState();

  const [activePage, setActivePage] = useState<PageId>((initialPageId as PageId) || 'general');
  const [selectedProfileContext, setSelectedProfileContext] = useState<string>('global');
  const contentRef = useRef<HTMLDivElement>(null);

  const sidebarItems: SidebarItem[] = [
    {
      id: 'general',
      pageId: 'general',
      label: t('settings.tabs.general'),
      icon: <FaCog className="w-4 h-4" />,
      children: [
        { id: 'general-gui', label: t('settings.gui') },
        { id: 'general-startup', label: t('settings.startup.title') },
        { id: 'general-messages', label: t('settings.messages.title') },
        { id: 'general-prompt', label: t('settings.promptBehavior.title') },
        {
          id: 'general-notifications',
          label: t('settings.notificationsAndFiles.title'),
        },
      ],
    },
    {
      id: 'aider',
      pageId: 'aider',
      label: t('settings.tabs.aider'),
      icon: <MdTerminal className="w-4 h-4" />,
      children: [
        { id: 'aider-options', label: t('settings.aider.options') },
        {
          id: 'aider-env-vars',
          label: t('settings.aider.environmentVariables'),
        },
        { id: 'aider-context', label: t('settings.aider.context') },
      ],
    },
    {
      id: 'agents',
      pageId: 'agents',
      label: t('settings.tabs.agents'),
      icon: <FaRobot className="w-4 h-4" />,
      children: [
        ...(openProjects || []).map((project) => ({
          id: `agent-${project.baseDir}`,
          label: getPathBasename(project.baseDir),
        })),
      ],
    },
    {
      id: 'mcpServers',
      pageId: 'mcpServers',
      label: t('settings.tabs.mcpServers'),
      icon: <FaPlug className="w-4 h-4" />,
      children: [
        ...(openProjects || []).map((project) => ({
          id: `mcpServers-${project.baseDir}`,
          label: getPathBasename(project.baseDir),
        })),
      ],
    },
    {
      id: 'tasks',
      pageId: 'tasks',
      label: t('settings.tabs.tasks'),
      icon: <LuClipboardList className="w-4 h-4" />,
    },
    {
      id: 'memory',
      pageId: 'memory',
      label: t('settings.tabs.memory'),
      icon: <FaBrain className="w-4 h-4" />,
    },
    {
      id: 'voice',
      pageId: 'voice',
      label: t('settings.tabs.voice'),
      icon: <FaMicrophone className="w-4 h-4" />,
    },
    {
      id: 'hotkeys',
      pageId: 'hotkeys',
      label: t('settings.tabs.hotkeys'),
      icon: <FaKeyboard className="w-4 h-4" />,
    },
    {
      id: 'extensions',
      pageId: 'extensions',
      label: t('settings.tabs.extensions'),
      icon: <FaPuzzlePiece className="w-4 h-4" />,
      children: [
        ...(openProjects || []).map((project) => ({
          id: `extension-${project.baseDir}`,
          label: getPathBasename(project.baseDir),
        })),
      ],
    },
    api.isManageServerSupported()
      ? {
          id: 'network',
          pageId: 'network' as PageId,
          label: t('settings.tabs.network'),
          icon: <FaServer className="w-4 h-4" />,
          children: [
            { id: 'network-proxy', label: t('settings.network.proxy') },
            { id: 'network-server', label: t('settings.tabs.server') },
          ],
        }
      : {
          id: 'network',
          pageId: 'network' as PageId,
          label: t('settings.tabs.network'),
          icon: <FaServer className="w-4 h-4" />,
        },
    {
      id: 'about',
      pageId: 'about',
      label: t('settings.tabs.about'),
      icon: <FaInfoCircle className="w-4 h-4" />,
    },
  ];

  const scrollToSection = (sectionId: string) => {
    setTimeout(() => {
      const element = document.getElementById(sectionId);
      if (element && contentRef.current) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleItemClick = (item: SidebarItem) => {
    setSelectedProfileContext('global');
    setActivePage(item.pageId);
    if (isMobile) {
      hideNavSidebar();
    }
  };

  const handleOpenMcpServers = (context?: string) => {
    setSelectedProfileContext(context || 'global');
    setActivePage('mcpServers');
  };

  const handleChildClick = (pageId: PageId, sectionId: string) => {
    setActivePage(pageId);
    if (isMobile) {
      hideNavSidebar();
    }

    // Handle agent context selection
    if (pageId === 'agents' && sectionId.startsWith('agent-')) {
      // Extract project baseDir from sectionId (format: agent-{baseDir})
      const projectBaseDir = sectionId.replace('agent-', '');
      setSelectedProfileContext(projectBaseDir);
    } else if (pageId === 'mcpServers' && sectionId.startsWith('mcpServers-')) {
      // Extract project baseDir from sectionId (format: mcpServers-{baseDir})
      const projectBaseDir = sectionId.replace('mcpServers-', '');
      setSelectedProfileContext(projectBaseDir);
    } else if (pageId === 'extensions' && sectionId.startsWith('extension-')) {
      // Extract project baseDir from sectionId (format: extension-{baseDir})
      const projectBaseDir = sectionId.replace('extension-', '');
      setSelectedProfileContext(projectBaseDir);
    } else {
      scrollToSection(sectionId);
    }
  };

  const renderContent = () => {
    switch (activePage) {
      case 'general':
        return (
          <GeneralSettings
            settings={settings}
            setSettings={updateSettings}
            onLanguageChange={onLanguageChange}
            onZoomChange={onZoomChange}
            onThemeChange={onThemeChange}
            onFontChange={onFontChange}
            onFontSizeChange={onFontSizeChange}
          />
        );
      case 'aider':
        return <AiderSettings settings={settings} setSettings={updateSettings} />;
      case 'agents':
        return (
          <AgentSettings
            settings={settings}
            setSettings={updateSettings}
            agentProfiles={agentProfiles || []}
            setAgentProfiles={setAgentProfiles || (() => {})}
            mcpServersData={mcpServers}
            initialProfileId={initialOptions?.agentProfileId as string | undefined}
            openProjects={openProjects}
            selectedProfileContext={selectedProfileContext}
            onOpenMcpServers={handleOpenMcpServers}
          />
        );
      case 'mcpServers':
        return <McpSettings mcpServers={mcpServers} setMcpServers={setMcpServers} openProjects={openProjects} selectedMcpContext={selectedProfileContext} />;
      case 'memory':
        return <MemorySettings settings={settings} setSettings={updateSettings} />;
      case 'tasks':
        return <TaskSettings settings={settings} setSettings={updateSettings} />;
      case 'voice':
        return <VoiceSettings providers={providers} setProviders={setProviders} initialProviderId={initialOptions?.providerId as string | undefined} />;
      case 'hotkeys':
        return <HotkeysSettings settings={settings} setSettings={updateSettings} />;
      case 'extensions':
        return (
          <ExtensionsSettings settings={settings} setSettings={updateSettings} openProjects={openProjects} selectedProjectContext={selectedProfileContext} />
        );
      case 'network':
        return <NetworkSettings settings={settings} setSettings={updateSettings} />;
      case 'about':
        return <AboutSettings settings={settings} setSettings={updateSettings} onShowLogs={onShowLogs} />;
      default:
        return null;
    }
  };

  const activeItemLabel = sidebarItems.find((item) => item.pageId === activePage)?.label || '';

  const settingsNav = (
    <div className="p-2 space-y-0.5">
      {sidebarItems.map((item) => (
        <div key={item.id}>
          <div
            className={clsx(
              'flex items-center px-3 py-1.5 text-sm font-medium rounded-md cursor-pointer transition-colors duration-150 select-none',
              activePage === item.pageId
                ? 'bg-bg-active text-text-primary bg-bg-secondary'
                : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary',
            )}
            onClick={() => handleItemClick(item)}
          >
            {!!item.children?.length && (
              <div
                className="mr-2 p-0.5 rounded hover:bg-bg-tertiary-strong transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                {activePage === item.id ? <FaChevronDown className="w-3 h-3" /> : <FaChevronRight className="w-3 h-3" />}
              </div>
            )}
            {!item.children?.length && <span className="w-6" />} {/* Spacer for items without children */}
            <span className="mr-3">{item.icon}</span>
            <span className="flex-1 truncate uppercase">{item.label}</span>
          </div>

          {/* Children */}
          {item.children && activePage === item.id && (
            <div className="ml-9 space-y-0.5 mt-0.5 border-l border-border-default pl-2">
              {item.children.map((child) => (
                <div
                  key={child.id}
                  className={clsx(
                    'px-3 py-1.5 text-xs rounded-md cursor-pointer transition-colors duration-150 select-none truncate',
                    'text-text-muted hover:text-text-primary hover:bg-bg-tertiary',
                  )}
                  onClick={() => handleChildClick(item.pageId, child.id)}
                >
                  {child.label}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-1 h-full min-h-0 overflow-hidden">
      {/* Sidebar */}
      {!isMobile && (
        <div className="w-64 flex-shrink-0 overflow-y-auto pt-0 bg-bg-primary border-r border-border-default-dark scrollbar-thin scrollbar-track-transparent scrollbar-thumb-bg-tertiary">
          {settingsNav}
        </div>
      )}

      {/* Mobile navigation drawer */}
      {isMobile && (
        <AnimatePresence>
          {isNavSidebarOpen && (
            <motion.div
              initial={{ x: '-100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-100%', opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="fixed inset-y-0 left-0 w-full h-full bg-bg-primary z-[1000] shadow-xl flex flex-col"
            >
              <div className="flex items-center justify-between p-2 h-10 bg-bg-primary-light border-b border-border-dark-light flex-shrink-0">
                <h3 className="text-sm font-semibold uppercase">{t('settings.navigation')}</h3>
                <button className="p-1 rounded-md hover:bg-bg-tertiary transition-colors" onClick={hideNavSidebar}>
                  <HiXMark className="w-5 h-5 text-text-primary" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-bg-tertiary">{settingsNav}</div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {isMobile && (
          <div className="flex items-center px-2 py-1.5 border-b border-border-default-dark bg-bg-primary-light flex-shrink-0">
            <button className="p-1 rounded-md hover:bg-bg-tertiary transition-colors mr-3" onClick={toggleNavSidebar}>
              <RiMenuUnfold4Line className="w-5 h-5 text-text-primary" />
            </button>
            <span className="text-sm font-medium uppercase truncate">{activeItemLabel}</span>
          </div>
        )}
        <div
          ref={contentRef}
          className={clsx(
            'flex-1 w-full mx-auto',
            activePage === 'agents' || activePage === 'mcpServers'
              ? 'overflow-hidden p-0 h-full'
              : clsx(
                  'overflow-y-auto max-w-[1024px] scrollbar-thin scrollbar-track-transparent scrollbar-thumb-bg-tertiary hover:scrollbar-thumb-bg-tertiary-strong',
                  isMobile ? 'p-4' : 'p-8',
                ),
          )}
        >
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default Settings;

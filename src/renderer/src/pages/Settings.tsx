import { Font, ProjectData, SettingsData, Theme, AgentProfile, ProviderProfile } from '@common/types';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { FaChevronDown, FaChevronRight, FaCog, FaInfoCircle, FaRobot, FaServer, FaBrain, FaMicrophone, FaKeyboard } from 'react-icons/fa';
import { MdTerminal } from 'react-icons/md';

import { getPathBasename } from '@/utils/path-utils';
import { useApi } from '@/contexts/ApiContext';
import { AiderSettings } from '@/components/settings/AiderSettings';
import { GeneralSettings } from '@/components/settings/GeneralSettings';
import { AgentSettings } from '@/components/settings/agent/AgentSettings';
import { AboutSettings } from '@/components/settings/AboutSettings';
import { ServerSettings } from '@/components/settings/ServerSettings';
import { MemorySettings } from '@/components/settings/MemorySettings';
import { VoiceSettings } from '@/components/settings/VoiceSettings';
import { HotkeysSettings } from '@/components/settings/HotkeysSettings';
import { DEFAULT_HOTKEY_CONFIG } from '@/utils/hotkeys';

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
  openProjects?: ProjectData[];
  providers?: ProviderProfile[];
  setProviders?: (providers: ProviderProfile[]) => void;
};

type PageId = 'general' | 'aider' | 'agents' | 'memory' | 'voice' | 'hotkeys' | 'server' | 'about';

interface SidebarItem {
  id: string;
  label: string;
  icon?: ReactNode;
  children?: { id: string; label: string }[];
  pageId: PageId;
}

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
  openProjects,
  providers,
  setProviders,
}: Props) => {
  const { t } = useTranslation();
  const api = useApi();
  const [isServerManagementSupported, setIsServerManagementSupported] = useState(false);

  const [activePage, setActivePage] = useState<PageId>((initialPageId as PageId) || 'general');
  const [selectedProfileContext, setSelectedProfileContext] = useState<string>('global');
  const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>({
    general: true,
    aider: true,
    agents: true,
    memory: true,
    server: true,
  });
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsServerManagementSupported(api.isManageServerSupported());
  }, [api]);

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
          label: t('settings.notifications.title'),
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
    ...(isServerManagementSupported
      ? [
          {
            id: 'server',
            pageId: 'server' as PageId,
            label: t('settings.tabs.server'),
            icon: <FaServer className="w-4 h-4" />,
            children: [
              { id: 'server-auth', label: t('settings.server.authentication') },
              {
                id: 'server-control',
                label: t('settings.server.serverControl'),
              },
              {
                id: 'server-tunnel',
                label: t('settings.server.tunnelManagement'),
              },
            ],
          },
        ]
      : []),
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

  const toggleExpand = (id: string) => {
    setExpandedPages((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleItemClick = (item: SidebarItem) => {
    setSelectedProfileContext('global');
    setActivePage(item.pageId);
    if (item.children) {
      setExpandedPages((prev) => ({
        ...prev,
        [item.id]: true,
      }));
    }
  };

  const handleChildClick = (pageId: PageId, sectionId: string) => {
    setActivePage(pageId);

    // Handle agent context selection
    if (pageId === 'agents' && sectionId.startsWith('agent-')) {
      // Extract project baseDir from sectionId (format: agent-{baseDir})
      const projectBaseDir = sectionId.replace('agent-', '');
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
            initialProfileId={initialOptions?.agentProfileId as string | undefined}
            openProjects={openProjects}
            selectedProfileContext={selectedProfileContext}
          />
        );
      case 'memory':
        return <MemorySettings settings={settings} setSettings={updateSettings} />;
      case 'voice':
        return <VoiceSettings providers={providers} setProviders={setProviders} initialProviderId={initialOptions?.providerId as string | undefined} />;
      case 'hotkeys':
        return (
          <HotkeysSettings
            hotkeyConfig={settings.hotkeyConfig || DEFAULT_HOTKEY_CONFIG}
            onSave={(config) => updateSettings({ ...settings, hotkeyConfig: config })}
          />
        );
      case 'server':
        return <ServerSettings settings={settings} setSettings={updateSettings} />;
      case 'about':
        return <AboutSettings settings={settings} setSettings={updateSettings} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-1 h-full min-h-0 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 overflow-y-auto pt-0 bg-bg-primary border-r border-border-default-dark scrollbar-thin scrollbar-track-transparent scrollbar-thumb-bg-tertiary">
        <div className="p-2 space-y-1">
          {sidebarItems.map((item) => (
            <div key={item.id}>
              <div
                className={clsx(
                  'flex items-center px-3 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors duration-150 select-none',
                  activePage === item.pageId
                    ? 'bg-bg-active text-text-primary bg-bg-secondary'
                    : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary',
                )}
                onClick={() => handleItemClick(item)}
              >
                {item.children && item.children.length > 0 && (
                  <div
                    className="mr-2 p-0.5 rounded hover:bg-bg-tertiary-strong transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand(item.id);
                    }}
                  >
                    {expandedPages[item.id] ? <FaChevronDown className="w-3 h-3" /> : <FaChevronRight className="w-3 h-3" />}
                  </div>
                )}
                {!item.children && <span className="w-6" />} {/* Spacer for items without children */}
                <span className="mr-3">{item.icon}</span>
                <span className="flex-1 truncate uppercase">{item.label}</span>
              </div>

              {/* Children */}
              {item.children && expandedPages[item.id] && (
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
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div
          ref={contentRef}
          className={clsx(
            'flex-1 w-full mx-auto',
            activePage === 'agents'
              ? 'overflow-hidden p-0 h-full'
              : 'overflow-y-auto p-8 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-bg-tertiary hover:scrollbar-thumb-bg-tertiary-strong max-w-[1024px]',
          )}
        >
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default Settings;

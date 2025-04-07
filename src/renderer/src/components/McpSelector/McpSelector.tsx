import { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MdOutlineHdrAuto, MdOutlineFileCopy, MdSettings } from 'react-icons/md';
import { RiToolsFill } from 'react-icons/ri';
import { SettingsData } from '@common/types';

import { McpServerSelectorItem } from './McpServerSelectorItem';

import { Checkbox } from '@/components/common/Checkbox';
import { TriStateCheckbox } from '@/components/common/TriStateCheckbox';
import { InfoIcon } from '@/components/common/InfoIcon';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { useSettings } from '@/context/SettingsContext';
import { useClickOutside } from '@/hooks/useClickOutside';

export const McpSelector = () => {
  const { t } = useTranslation();
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [enabledToolsCount, setEnabledToolsCount] = useState<number | null>(null);
  const selectorRef = useRef<HTMLDivElement>(null);
  const { settings, saveSettings } = useSettings();

  useClickOutside(selectorRef, () => setSelectorVisible(false));

  useEffect(() => {
    const calculateEnabledTools = async () => {
      if (!settings) {
        return;
      }

      const { mcpServers, disabledServers, disabledTools } = settings.agentConfig;
      const serverNames = Object.keys(mcpServers);
      const enabledServerNames = serverNames.filter((name) => !disabledServers.includes(name));

      if (enabledServerNames.length === 0) {
        setEnabledToolsCount(0);
        return;
      }

      // set to loading state after 1 second
      const timeoutId = setTimeout(() => setEnabledToolsCount(null), 1000);

      try {
        const toolCounts = await Promise.all(
          enabledServerNames.map(async (serverName) => {
            try {
              const tools = await window.api.loadMcpServerTools(serverName);
              const serverTotalTools = tools?.length ?? 0;
              const serverDisabledTools = disabledTools.filter((toolId) => toolId.startsWith(`${serverName}-`)).length;
              return Math.max(0, serverTotalTools - serverDisabledTools);
            } catch (error) {
              console.error(`Failed to load tools for server ${serverName}:`, error);
              return 0; // Count 0 tools if loading fails for a server
            }
          }),
        );

        const totalEnabledTools = toolCounts.reduce((sum, count) => sum + count, 0);
        setEnabledToolsCount(totalEnabledTools);
      } catch (error) {
        console.error('Failed to calculate total enabled tools:', error);
        setEnabledToolsCount(0); // Set to 0 on overall failure
      }

      clearTimeout(timeoutId);
    };

    void calculateEnabledTools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.agentConfig.mcpServers, settings?.agentConfig.disabledServers, settings?.agentConfig.disabledTools]);

  if (!settings) {
    return <div className="text-xs text-neutral-400">{t('common.loading')}</div>;
  }

  const getTriState = (): 'checked' | 'unchecked' | 'indeterminate' => {
    const { disabledServers } = settings.agentConfig;
    const serverCount = Object.keys(settings.agentConfig.mcpServers).length;

    if (disabledServers.length === 0) {
      return 'checked';
    }
    if (disabledServers.length === serverCount) {
      return 'unchecked';
    }
    return 'indeterminate';
  };

  const handleToggleAllServers = () => {
    const { agentConfig } = settings;
    const { disabledServers } = agentConfig;
    const serverNames = Object.keys(agentConfig.mcpServers);

    let updatedDisabledServers: string[];
    if (disabledServers.length === 0) {
      // If none are disabled, disable all
      updatedDisabledServers = serverNames;
    } else {
      // If some or all are disabled, enable all
      updatedDisabledServers = [];
    }

    const updatedSettings: SettingsData = {
      ...settings,
      agentConfig: {
        ...agentConfig,
        disabledServers: updatedDisabledServers,
      },
    };

    void saveSettings(updatedSettings);
  };

  const toggleSelectorVisible = () => {
    setSelectorVisible((prev) => !prev);
  };

  const toggleServer = (serverName: string) => {
    const { agentConfig } = settings;
    const { disabledServers } = agentConfig;

    let updatedDisabledServers: string[];

    if (disabledServers.includes(serverName)) {
      updatedDisabledServers = disabledServers.filter((name) => name !== serverName);
    } else {
      updatedDisabledServers = [...disabledServers, serverName];
    }

    const updatedSettings: SettingsData = {
      ...settings,
      agentConfig: {
        ...agentConfig,
        disabledServers: updatedDisabledServers,
      },
    };

    void saveSettings(updatedSettings);
  };

  const handleOpenSettings = () => {
    setSelectorVisible(false);
    setShowSettings(true);
  };

  const serverNames = Object.keys(settings.agentConfig.mcpServers);

  const handleToggleIncludeContextFiles = () => {
    const updatedSettings: SettingsData = {
      ...settings,
      agentConfig: {
        ...settings.agentConfig,
        includeContextFiles: !settings.agentConfig.includeContextFiles,
      },
    };
    void saveSettings(updatedSettings);
  };

  const handleToggleUseAiderTools = () => {
    const updatedSettings: SettingsData = {
      ...settings,
      agentConfig: {
        ...settings.agentConfig,
        useAiderTools: !settings.agentConfig.useAiderTools,
      },
    };
    void saveSettings(updatedSettings);
  };

  const renderConfigureServersButton = (t: (key: string) => string) => (
    <>
      <div className="py-1 border-b border-neutral-700 ">
        <div className="px-3 py-1 text-xs text-neutral-300 hover:text-neutral-100 flex items-center gap-2">
          <Checkbox checked={settings.agentConfig.useAiderTools} onChange={handleToggleUseAiderTools} label={t('mcp.useAiderTools')} className="flex-1 mr-1" />
          <InfoIcon tooltip={t('mcp.aiderToolsTooltip')} />
        </div>
        <div className="px-3 py-1 text-xs text-neutral-300 hover:text-neutral-100 flex items-center gap-2">
          <Checkbox
            checked={settings.agentConfig.includeContextFiles}
            onChange={handleToggleIncludeContextFiles}
            label={t('mcp.includeContextFiles')}
            className="flex-1 mr-1"
          />
          <InfoIcon tooltip={t('mcp.includeFilesTooltip')} />
        </div>
      </div>
      <button onClick={handleOpenSettings} className="w-full flex items-center px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-700 transition-colors">
        <MdSettings className="w-3 h-3 mr-2" />
        {t('mcp.configureServers')}
      </button>
    </>
  );

  return (
    <div className="relative" ref={selectorRef}>
      <button
        onClick={toggleSelectorVisible}
        className="flex items-center gap-1.5 px-2 py-1 bg-neutral-850 text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100 focus:outline-none transition-colors duration-200 text-xs border-neutral-600 border rounded-md"
      >
        <RiToolsFill className="w-4 h-4" />
        <span className="text-xxs font-mono">{enabledToolsCount ?? '...'}</span>
        {settings.agentConfig.useAiderTools && <MdOutlineHdrAuto className="w-4 h-4 text-green-400 opacity-50" title={t('mcp.useAiderTools')} />}
        {settings.agentConfig.includeContextFiles && <MdOutlineFileCopy className="w-3 h-3 text-yellow-400 opacity-50" title={t('mcp.includeContextFiles')} />}
      </button>

      {selectorVisible && (
        <div className="absolute bottom-full left-0 mb-1 bg-neutral-900 border border-neutral-700 rounded-md shadow-lg z-10 min-w-[250px]">
          {serverNames.length > 0 ? (
            <>
              <div
                className="px-3 py-2 text-xs font-medium text-neutral-300 border-b border-neutral-700 mb-1 flex items-center select-none cursor-pointer"
                onClick={handleToggleAllServers}
              >
                <TriStateCheckbox state={getTriState()} onChange={handleToggleAllServers} className="mr-2" label={t('mcp.servers')} />
              </div>
              {serverNames.map((serverName) => (
                <McpServerSelectorItem
                  key={serverName}
                  serverName={serverName}
                  disabled={settings.agentConfig.disabledServers.includes(serverName)}
                  disabledTools={settings.agentConfig.disabledTools}
                  onToggle={toggleServer}
                />
              ))}
              <div className="border-t border-neutral-700 mt-1">{renderConfigureServersButton(t)}</div>
            </>
          ) : (
            renderConfigureServersButton(t)
          )}
        </div>
      )}

      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} initialTab={2} />}
    </div>
  );
};

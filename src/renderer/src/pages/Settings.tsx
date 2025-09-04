import { Font, SettingsData, Theme } from '@common/types';
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LlmProviderName } from '@common/agent';

import { AiderSettings } from '@/components/settings/AiderSettings';
import { GeneralSettings } from '@/components/settings/GeneralSettings';
import { ModelProvidersSettings } from '@/components/settings/ModelProvidersSettings';
import { AgentSettings } from '@/components/settings/agent/AgentSettings';
import { AboutSettings } from '@/components/settings/AboutSettings';

type Props = {
  settings: SettingsData;
  updateSettings: (settings: SettingsData) => void;
  onLanguageChange: (language: string) => void;
  onZoomChange: (zoomLevel: number) => void;
  onThemeChange: (theme: Theme) => void;
  onFontChange: (fontName: Font) => void;
  onFontSizeChange: (fontSize: number) => void;
  initialTab?: number;
  initialAgentProfileId?: string;
  initialAgentProvider?: LlmProviderName;
};

export const Settings = ({
  settings,
  updateSettings,
  onLanguageChange,
  onZoomChange,
  onThemeChange,
  onFontChange,
  onFontSizeChange,
  initialTab = 0,
  initialAgentProfileId,
}: Props) => {
  const { t } = useTranslation();
  const [selectedTabIndex, setSelectedTabIndex] = useState(initialTab);

  const handleSwitchToAiderTab = () => {
    setSelectedTabIndex(2); // Aider tab is at index 2
  };

  const renderTab = (label: string) => (
    <Tab
      className={({ selected }) =>
        `relative px-6 py-3 text-sm font-medium transition-all duration-200 uppercase tracking-wide ${
          selected ? 'text-text-primary' : 'text-text-muted  hover:text-text-secondary hover:bg-bg-secondary-light'
        } first:rounded-tl-lg border-r border-border-default-dark last:border-r-0`
      }
    >
      {label}
    </Tab>
  );

  const renderTabPanel = (content: ReactNode) => (
    <TabPanel className="flex flex-col flex-1 min-h-0 bg-bg-secondary backdrop-blur-sm border border-border-default-dark rounded-b-lg shadow-xl">
      <div className="p-8 flex flex-col flex-1 max-h-[100%] overflow-y-auto scrollbar-thin scrollbar-track-bg-secondary-light-strongest scrollbar-thumb-bg-fourth hover:scrollbar-thumb-bg-fifth">
        {content}
      </div>
    </TabPanel>
  );

  return (
    <TabGroup className="flex flex-col flex-1 min-h-0" selectedIndex={selectedTabIndex} onChange={setSelectedTabIndex}>
      <TabList className="flex bg-bg-secondary backdrop-blur-sm border border-border-default-dark rounded-t-lg shadow-lg">
        {renderTab(t('settings.tabs.general'))}
        {renderTab(t('settings.tabs.providers'))}
        {renderTab(t('settings.tabs.aider'))}
        {renderTab(t('settings.tabs.agent'))}
        {renderTab(t('settings.tabs.about'))}
      </TabList>
      <TabPanels className="flex flex-col flex-1 overflow-hidden">
        {renderTabPanel(
          <GeneralSettings
            settings={settings}
            setSettings={updateSettings}
            onLanguageChange={onLanguageChange}
            onZoomChange={onZoomChange}
            onThemeChange={onThemeChange}
            onFontChange={onFontChange}
            onFontSizeChange={onFontSizeChange}
          />,
        )}
        {renderTabPanel(<ModelProvidersSettings settings={settings} setSettings={updateSettings} onSwitchToAiderTab={handleSwitchToAiderTab} />)}
        {renderTabPanel(<AiderSettings settings={settings} setSettings={updateSettings} />)}
        {renderTabPanel(<AgentSettings settings={settings} setSettings={updateSettings} initialProfileId={initialAgentProfileId} />)}
        {renderTabPanel(<AboutSettings settings={settings} setSettings={updateSettings} />)}
      </TabPanels>
    </TabGroup>
  );
};

export default Settings;

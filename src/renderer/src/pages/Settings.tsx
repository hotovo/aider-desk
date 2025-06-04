import { SettingsData } from '@common/types';
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LlmProviderName } from '@common/agent';

import { AiderSettings } from '@/components/settings/AiderSettings';
import { GeneralSettings } from '@/components/settings/GeneralSettings';
import { AgentSettings } from '@/components/settings/agent/AgentSettings';
import { AboutSettings } from '@/components/settings/AboutSettings';

type Props = {
  settings: SettingsData;
  updateSettings: (settings: SettingsData) => void;
  onLanguageChange: (language: string) => void;
  onZoomChange: (zoomLevel: number) => void;
  onFontChange?: (fontFamily: string, monospaceFontFamily: string) => void;
  initialTab?: number;
  initialAgentProfileId?: string;
  initialAgentProvider?: LlmProviderName;
};

export const Settings = ({ settings, updateSettings, onLanguageChange, onZoomChange, onFontChange, initialTab = 0, initialAgentProfileId, initialAgentProvider }: Props) => {
  const { t } = useTranslation();

  const renderTab = (label: string) => (
    <Tab
      className={({ selected }) =>
        `relative px-6 py-3 text-sm font-medium transition-all duration-200 uppercase tracking-wide ${
          selected ? 'text-neutral-100' : 'text-neutral-500  hover:text-neutral-200 hover:bg-neutral-800'
        } first:rounded-tl-lg border-r border-neutral-700 last:border-r-0`
      }
    >
      {label}
    </Tab>
  );

  const renderTabPanel = (content: ReactNode) => (
    <TabPanel className="flex flex-col flex-1 min-h-0 bg-neutral-850 backdrop-blur-sm border border-neutral-700 rounded-b-lg shadow-xl">
      <div className="p-8 flex flex-col flex-1 max-h-[100%] overflow-y-auto scrollbar-thin scrollbar-track-neutral-800/50 scrollbar-thumb-neutral-600 hover:scrollbar-thumb-neutral-500">
        {content}
      </div>
    </TabPanel>
  );

  return (
    <TabGroup className="flex flex-col flex-1 min-h-0" defaultIndex={initialTab}>
      <TabList className="flex bg-neutral-850 backdrop-blur-sm border border-neutral-700 rounded-t-lg shadow-lg">
        {renderTab(t('settings.tabs.general'))}
        {renderTab(t('settings.tabs.aider'))}
        {renderTab(t('settings.tabs.agent'))}
        {renderTab(t('settings.tabs.about'))}
      </TabList>
      <TabPanels className="flex flex-col flex-1 overflow-hidden">
        {renderTabPanel(<GeneralSettings settings={settings} setSettings={updateSettings} onLanguageChange={onLanguageChange} onZoomChange={onZoomChange} onFontChange={onFontChange} />)}
        {renderTabPanel(<AiderSettings settings={settings} setSettings={updateSettings} />)}
        {renderTabPanel(
          <AgentSettings settings={settings} setSettings={updateSettings} initialProfileId={initialAgentProfileId} initialProvider={initialAgentProvider} />,
        )}
        {renderTabPanel(<AboutSettings settings={settings} setSettings={updateSettings} />)}
      </TabPanels>
    </TabGroup>
  );
};

export default Settings;

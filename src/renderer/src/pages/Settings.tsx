import { SettingsData } from '@common/types';
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LlmProviderName } from '@common/agent';

import { AiderSettings } from '@/components/settings/AiderSettings';
import { GeneralSettings } from '@/components/settings/GeneralSettings';
import { ThemeSettings } from '@/components/settings/ThemeSettings';
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
    <Tab className={({ selected }) =>
      `relative px-6 py-3 text-sm font-medium transition-all duration-200 uppercase tracking-wide border-r last:border-r-0 ${
        selected ? 'text-[var(--theme-foreground-primary,#000)]' : 'text-[var(--theme-foreground-secondary,#666)] hover:bg-[var(--theme-background-tertiary,#f0f0f0)]'
      }`
    }>
      {label}
    </Tab>
  );

  const renderTabPanel = (content: ReactNode) => (
    <TabPanel 
      className="flex flex-col flex-1 min-h-0 backdrop-blur-sm border rounded-b-lg shadow-xl"
      style={{
        backgroundColor: 'var(--theme-background-secondary, #f8f9fa)',
        borderColor: 'var(--theme-border-primary, #cccccc)',
        color: 'var(--theme-foreground-primary, #000000)'
      }}
    >
      <div className="p-8 flex flex-col flex-1 max-h-[100%] overflow-y-auto scrollbar-thin scrollbar-track-[var(--theme-background-tertiary)]/50 scrollbar-thumb-[var(--theme-border-secondary)] hover:scrollbar-thumb-[var(--theme-border-primary)]">
        {content}
      </div>
    </TabPanel>
  );

  return (
    <TabGroup className="flex flex-col flex-1 min-h-0" defaultIndex={initialTab}>
      <TabList 
        className="flex backdrop-blur-sm border rounded-t-lg shadow-lg"
        style={{
          backgroundColor: 'var(--theme-background-secondary, #f8f9fa)',
          borderColor: 'var(--theme-border-primary, #cccccc)'
        }}
      >
        {renderTab(t('settings.tabs.general'))}
        {renderTab(t('settings.tabs.appearance'))}
        {renderTab(t('settings.tabs.aider'))}
        {renderTab(t('settings.tabs.agent'))}
        {renderTab(t('settings.tabs.about'))}
      </TabList>
      <TabPanels className="flex flex-col flex-1 overflow-hidden">
        {renderTabPanel(<GeneralSettings settings={settings} setSettings={updateSettings} onLanguageChange={onLanguageChange} onZoomChange={onZoomChange} onFontChange={onFontChange} />)}
        {renderTabPanel(<ThemeSettings settings={settings} setSettings={updateSettings} />)}
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

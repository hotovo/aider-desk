import { SettingsData } from '@common/types';
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import { ReactNode } from 'react';

import { AiderSettings } from '@/components/settings/AiderSettings';
import { McpSettings } from '@/components/settings/McpSettings';
import { GeneralSettings } from '@/components/settings/GeneralSettings';

type Props = {
  settings: SettingsData;
  updateSettings: (settings: SettingsData) => void;
  initialTab?: number;
};

export const Settings = ({ settings, updateSettings, initialTab = 0 }: Props) => {
  const renderTab = (label: string) => (
    <Tab
      className={({ selected }) =>
        `px-4 py-2 text-sm font-medium border-b-2 rounded-t-md transition-colors duration-200 bg-neutral-850 uppercase ${
          selected ? 'border-neutral-600 text-neutral-100' : 'border-transparent text-neutral-400 hover:border-neutral-400/50 hover:text-neutral-200'
        }`
      }
    >
      {label}
    </Tab>
  );

  const renderTabPanel = (content: ReactNode) => (
    <TabPanel className="flex flex-col flex-1 min-h-0 bg-neutral-900/50 backdrop-blur-sm border border-neutral-800 rounded-tr-lg rounded-b-lg mt-[-1px]">
      <div className="p-6 overflow-y-auto scrollbar-thin scrollbar-track-neutral-850 scrollbar-thumb-neutral-700 hover:scrollbar-thumb-neutral-600">
        {content}
      </div>
    </TabPanel>
  );

  return (
    <TabGroup className="flex flex-col flex-1 min-h-0" defaultIndex={initialTab}>
      <TabList className="flex space-x-2 backdrop-blur-sm border border-neutral-800 rounded-t-lg">
        {renderTab('General')}
        {renderTab('Aider')}
        {renderTab('MCP Config')}
      </TabList>
      <TabPanels className="flex flex-col flex-1 overflow-hidden">
        {renderTabPanel(<GeneralSettings settings={settings} setSettings={updateSettings} />)}
        {renderTabPanel(<AiderSettings settings={settings} setSettings={updateSettings} />)}
        {renderTabPanel(<McpSettings settings={settings} setSettings={updateSettings} />)}
      </TabPanels>
    </TabGroup>
  );
};

export default Settings;

import { McpServerConfig } from '@common/types';
import { useState, useMemo } from 'react';
import { FaArrowLeft } from 'react-icons/fa';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';

import { TextArea } from '@/components/common/TextArea';
import { Button } from '@/components/common/Button';

export const McpServerConfigSchema = z.object({
  mcpServers: z.record(
    z.object({
      command: z.string(),
      args: z.array(z.string()).readonly(),
      env: z.record(z.string()).readonly().optional(),
      enabled: z.boolean().optional(),
    }),
  ),
});



type Props = {
  onSave: (name: string, config: McpServerConfig) => void;
  onCancel: () => void;
  initialName?: string;
  initialConfig?: McpServerConfig;
};

export const McpServerForm = ({ onSave, onCancel, initialName, initialConfig }: Props) => {
  const { t } = useTranslation();
  
  const PLACEHOLDER = `${t('mcpServer.pasteServerAs')}

{
  "mcpServers": {
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"]
    }
  }
}`;
  const [configJSON, setConfigJSON] = useState(() => {
    if (initialName && initialConfig) {
      return JSON.stringify(
        {
          mcpServers: {
            [initialName]: initialConfig,
          },
        },
        null,
        2,
      );
    }
    return '';
  });

  const isValidJson = useMemo(() => {
    try {
      const parsed = JSON.parse(configJSON);
      const result = McpServerConfigSchema.safeParse(parsed);
      return result.success;
    } catch {
      return false;
    }
  }, [configJSON]);

  const handleAddServer = () => {
    if (isValidJson) {
      const parsed = JSON.parse(configJSON);
      const serverName = Object.keys(parsed.mcpServers)[0];
      const serverConfig = parsed.mcpServers[serverName];
      onSave(serverName, serverConfig);
    }
  };

  return (
    <div>
      <div className="flex items-center mb-2 text-neutral-200">
        <button onClick={onCancel} className="mr-2 hover:bg-neutral-700 rounded-md p-2 text-md">
          <FaArrowLeft />
        </button>
        <h3 className="text-md font-medium uppercase">{initialName ? `${t('common.edit')} MCP Server: ${initialName}` : t('mcpServer.addServer')}</h3>
      </div>
      <div className="mb-2">
        <TextArea
          label={t('mcpServer.serverConfigJson')}
          placeholder={PLACEHOLDER}
          value={configJSON}
          onChange={(e) => setConfigJSON(e.target.value)}
          className={`w-full h-60 p-2 resize-none ${configJSON && !isValidJson ? 'border-red-800/50 focus:border-red-800/50' : ''}`}
        />
      </div>
      <div className="flex justify-end">
        <Button onClick={handleAddServer} variant="contained" disabled={!isValidJson || !configJSON}>
          {t('common.save')}
        </Button>
      </div>
    </div>
  );
};

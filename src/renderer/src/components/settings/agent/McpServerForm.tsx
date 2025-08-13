import { McpServerConfig } from '@common/types';
import { useState, useMemo, ChangeEvent } from 'react';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { MdInfoOutline } from 'react-icons/md';

import { StyledTooltip } from '@/components/common/StyledTooltip';
import { TextArea } from '@/components/common/TextArea';
import { Button } from '@/components/common/Button';

const MCP_SERVER_EXAMPLE_JSON = `{
  "mcpServers": {
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"]
    },
    "remote": {
      "url": "http://localhost:8080"
    }
  }
}`;

const MCP_SERVER_EXAMPLE_NO_PARENT = `{
  "puppeteer": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-puppeteer"]
  },
  "remote": {
    "url": "http://localhost:8080"
  }
}`;

const MCP_SERVER_EXAMPLE_BARE = `"puppeteer": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-puppeteer"]
},
"remote": {
  "url": "http://localhost:8080"
}`;

const McpServersRecordSchema = z.record(
  z.union([
    z.object({
      command: z.string(),
      args: z.array(z.string()).readonly().optional(),
      env: z.record(z.string()).readonly().optional(),
      url: z.undefined().optional(),
    }),
    z.object({
      url: z.string().url(),
      headers: z.record(z.string()).readonly().optional(),
    }),
  ]),
);

export const McpServerConfigSchema = z.union([
  z.object({
    mcpServers: McpServersRecordSchema,
  }),
  McpServersRecordSchema,
]);

export type McpServer = {
  name: string;
  config: McpServerConfig;
};

type Props = {
  onSave: (servers: Record<string, McpServerConfig>) => void;
  onCancel: () => void;
  servers?: McpServer[];
};

export const McpServerForm = ({ onSave, onCancel, servers }: Props) => {
  const { t } = useTranslation();
  const tooltipId = useMemo(() => `mcp-config-hint-${Math.random().toString(36).substring(7)}`, []);
  const [configJSON, setConfigJSON] = useState(() => {
    if (servers && servers.length > 0) {
      // If multiple servers, merge them into a single object
      const serversObj: Record<string, McpServerConfig> = {};
      servers.forEach(({ name, config }) => {
        serversObj[name] = config;
      });
      return JSON.stringify(
        {
          mcpServers: serversObj,
        },
        null,
        2,
      );
    }
    return '';
  });

  // Try to parse as JSON, or as a "bare" object (without enclosing {})
  const parseConfig = (text: string) => {
    try {
      // Try as full JSON first
      return JSON.parse(text);
    } catch {
      // Try as "bare" object: wrap in braces and parse
      try {
        return JSON.parse(`{${text}}`);
      } catch {
        return null;
      }
    }
  };

  const isValidJson = useMemo(() => {
    const parsed = parseConfig(configJSON);
    if (!parsed) {
      return false;
    }
    const result = McpServerConfigSchema.safeParse(parsed);
    return result.success;
  }, [configJSON]);

  const handleAddServer = () => {
    if (isValidJson) {
      const parsed = parseConfig(configJSON);
      if (!parsed) {
        return;
      }
      // Accept both { mcpServers: {...} } and just { ... }
      if ('mcpServers' in parsed && typeof parsed.mcpServers === 'object') {
        onSave(parsed.mcpServers);
      } else {
        onSave(parsed);
      }
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setConfigJSON(e.target.value);
  };

  return (
    <div>
      <div className="flex items-center space-between mb-3 text-text-primary w-full">
        <div className="text-md font-medium uppercase flex-1">
          {servers && servers.length === 1
            ? t('mcpServer.editServer', { name: servers[0].name })
            : servers && servers.length > 1
              ? t('settings.agent.editMcpServersConfig')
              : t('mcpServer.addServer')}
        </div>
        {!servers && (
          <div className="mr-1">
            <MdInfoOutline className="h-5 w-5 text-text-secondary hover:text-text-primary cursor-pointer" data-tooltip-id={tooltipId} />
            <StyledTooltip id={tooltipId} content={t('mcpServer.configHint')} />
          </div>
        )}
      </div>
      <div className="mb-2">
        <TextArea
          placeholder={t('mcpServer.pasteServerAs', {
            example: MCP_SERVER_EXAMPLE_JSON,
            exampleNoParent: MCP_SERVER_EXAMPLE_NO_PARENT,
            exampleBare: MCP_SERVER_EXAMPLE_BARE,
          })}
          value={configJSON}
          onChange={handleChange}
          className={`w-full h-96 p-2 resize-none ${configJSON && !isValidJson ? 'border-error-emphasis focus:border-error-emphasis' : ''}`}
        />
      </div>
      <div className="flex justify-between items-center gap-2">
        <a href="https://modelcontextprotocol.io/examples" target="_blank" rel="noopener noreferrer" className="text-xs text-info-light hover:underline">
          {t('mcpServer.viewExamples')}
        </a>
        <div className="flex gap-2">
          <Button onClick={onCancel} variant="text" size="sm">
            {t('common.cancel')}
          </Button>
          <Button onClick={handleAddServer} variant="contained" disabled={!isValidJson || !configJSON} size="sm">
            {t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  );
};

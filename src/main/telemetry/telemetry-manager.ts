import { PostHog } from 'posthog-node';
import { AgentProfile, Mode, SettingsData } from '@common/types';
import { app } from 'electron';

import { Store } from '@/store';
import logger from '@/logger';
import { POSTHOG_PUBLIC_API_KEY, POSTHOG_HOST } from '@/constants';

export class TelemetryManager {
  private readonly store: Store;
  private readonly distinctId: string;
  private client?: PostHog;

  constructor(store: Store) {
    this.store = store;
    this.distinctId = store.getUserId();
  }

  settingsChanged(oldSettings: SettingsData, newSettings: SettingsData) {
    if (oldSettings.telemetryEnabled !== newSettings.telemetryEnabled) {
      if (newSettings.telemetryEnabled && this.client) {
        this.client.capture({
          distinctId: this.distinctId,
          event: 'telemetry-enabled',
        });
      } else if (!newSettings.telemetryEnabled && this.client) {
        this.client.capture({
          distinctId: this.distinctId,
          event: 'telemetry-disabled',
        });
      }
    }
  }

  async init(): Promise<void> {
    try {
      await import('./open-telemetry');

      this.client = new PostHog(POSTHOG_PUBLIC_API_KEY, {
        host: POSTHOG_HOST,
      });
      logger.info('TelemetryManager initialized for PostHog.');
      this.client.identify({
        distinctId: this.distinctId,
        properties: {
          os: process.platform,
          version: app.getVersion(),
        },
      });
    } catch (error) {
      logger.error('Failed to initialize TelemetryManager:', error);
      if (this.client) {
        await this.client.shutdown().catch((shutdownError) => {
          logger.error('Error shutting down PostHog client during failed initialization:', shutdownError);
        });
        this.client = undefined;
      }
    }
  }

  async destroy(): Promise<void> {
    if (this.client) {
      await this.client.shutdown();
      logger.info('TelemetryManager destroyed.');
    }
  }

  captureProjectOpened(openedProjectsCount: number) {
    if (!this.store.getSettings().telemetryEnabled) {
      return;
    }
    this.client?.capture({
      distinctId: this.distinctId,
      event: 'project-opened',
      properties: {
        count: openedProjectsCount,
      },
    });
  }

  captureProjectClosed(closedProjectsCount: number) {
    if (!this.store.getSettings().telemetryEnabled) {
      return;
    }
    this.client?.capture({
      distinctId: this.distinctId,
      event: 'project-closed',
      properties: {
        count: closedProjectsCount,
      },
    });
  }

  captureRunPrompt(mode?: Mode) {
    if (!this.store.getSettings().telemetryEnabled) {
      return;
    }
    this.client?.capture({
      distinctId: this.distinctId,
      event: 'run-prompt',
      properties: {
        mode,
      },
    });
  }

  captureAgentRun(profile: AgentProfile) {
    if (!this.store.getSettings().telemetryEnabled) {
      return;
    }
    this.client?.capture({
      distinctId: this.distinctId,
      event: 'agent-run',
      properties: {
        maxIterations: profile.maxIterations,
        maxTokens: profile.maxTokens,
        customInstructionsDefined: profile.customInstructions.trim().length > 0,
        useAiderTools: profile.useAiderTools,
        usePowerTools: profile.usePowerTools,
        useTodoTools: profile.useTodoTools,
        includeContextFiles: profile.includeContextFiles,
        includeRepoMap: profile.includeRepoMap,
        autoApprove: profile.autoApprove,
        enabledMcpServersCount: profile.enabledServers.length,
        totalMcpServersCount: Object.keys(this.store.getSettings().mcpServers).length,
      },
    });
  }

  captureCustomCommand(commandName: string, argsCount: number, mode: Mode) {
    if (!this.store.getSettings().telemetryEnabled) {
      return;
    }
    this.client?.capture({
      distinctId: this.distinctId,
      event: 'custom-command-run',
      properties: {
        commandName,
        argsCount,
        mode,
      },
    });
  }
}

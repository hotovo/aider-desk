import { PostHog } from 'posthog-node';
import { AgentProfile, AIDER_MODES, Mode, SettingsData, TaskData } from '@common/types';
import { extractProviderModel } from '@common/utils';

import type { Task } from '@/task/task';
import type { ModelManager } from '@/models/model-manager';

import { Store } from '@/store';
import logger from '@/logger';
import { POSTHOG_PUBLIC_API_KEY, POSTHOG_HOST, APP_TYPE, PRODUCT_TELEMETRY_DISTINCT_ID } from '@/constants';
import { getElectronApp } from '@/app';

export class TelemetryManager {
  private readonly store: Store;
  private readonly distinctId: string;
  private client?: PostHog;

  constructor(
    store: Store,
    private readonly modelManager: ModelManager,
  ) {
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

      if (!POSTHOG_PUBLIC_API_KEY) {
        logger.info('TelemetryManager skipped: POSTHOG_PUBLIC_API_KEY not configured.');
        return;
      }

      const app = getElectronApp();
      this.client = new PostHog(POSTHOG_PUBLIC_API_KEY, {
        host: POSTHOG_HOST,
      });
      logger.info('TelemetryManager initialized for PostHog.');
      this.client.identify({
        distinctId: this.distinctId,
        properties: {
          os: process.platform,
          version: app?.getVersion(),
          appType: APP_TYPE,
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

  async captureRunPrompt(task: Task, mode: Mode) {
    if (!this.store.getSettings().telemetryEnabled || !this.client) {
      return;
    }

    const profile = AIDER_MODES.includes(mode) ? null : await task.getTaskAgentProfile();
    const aiderModels = task.getAiderModelsData();

    this.client.capture({
      distinctId: this.distinctId,
      event: 'run-prompt',
      properties: {
        mode,
        ...this.getAgentModelProperties(profile),
        mainModel: this.getTelemetryModelName(aiderModels?.mainModel),
        weakModel: this.getTelemetryModelName(aiderModels?.weakModel),
        architectModel: this.getTelemetryModelName(task.getArchitectModel()),
      },
    });
  }

  captureAgentRun(profile: AgentProfile, task?: TaskData, totalMcpServersCount = 0) {
    if (!this.store.getSettings().telemetryEnabled) {
      return;
    }
    this.client?.capture({
      distinctId: this.distinctId,
      event: 'agent-run',
      properties: {
        ...this.getAgentModelProperties(profile),
        maxIterations: profile.maxIterations,
        customInstructionsDefined: profile.customInstructions.trim().length > 0,
        useAiderTools: profile.useAiderTools,
        usePowerTools: profile.usePowerTools,
        useTodoTools: profile.useTodoTools,
        includeContextFiles: profile.includeContextFiles,
        includeRepoMap: profile.includeRepoMap,
        autonomyMode: task?.autonomyMode ?? 'guided',
        enabledMcpServersCount: profile.enabledServers.length,
        totalMcpServersCount,
      },
    });
  }

  private getTelemetryProviderName(providerId: string): string | undefined {
    return this.modelManager.getProviders().find((provider) => provider.id === providerId)?.provider.name;
  }

  private getAgentModelProperties(profile: AgentProfile | null) {
    return {
      provider: profile ? this.getTelemetryProviderName(profile.provider) : undefined,
      model: profile?.model,
    };
  }

  private getTelemetryModelName(model?: string | null): string | null | undefined {
    if (!model) {
      return model;
    }
    const [providerId, modelId] = extractProviderModel(model);
    const providerName = this.getTelemetryProviderName(providerId);
    return providerName ? `${providerName}/${modelId}` : model;
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

  captureTerminalCreated() {
    if (!this.store.getSettings().telemetryEnabled) {
      return;
    }
    this.client?.capture({
      distinctId: this.distinctId,
      event: 'terminal-created',
    });
  }

  captureExtensionsLoaded(totalExtensions: number, globalExtensions: number, projectExtensions: number, enabledExtensions: number, disabledExtensions: number) {
    if (!this.store.getSettings().telemetryEnabled) {
      return;
    }
    this.client?.capture({
      distinctId: this.distinctId,
      event: 'extensions-loaded',
      properties: {
        totalExtensions,
        globalExtensions,
        projectExtensions,
        enabledExtensions,
        disabledExtensions,
      },
    });
  }

  captureExtensionInstalled(extensionName: string, location: 'global' | 'project') {
    if (this.store.getSettings().telemetryEnabled) {
      this.client?.capture({
        distinctId: this.distinctId,
        event: 'extension-installed',
        properties: {
          extensionName,
          location,
        },
      });
    }

    this.client?.capture({
      distinctId: PRODUCT_TELEMETRY_DISTINCT_ID,
      event: 'extension-installed',
      properties: {
        extensionName,
        os: process.platform,
        appVersion: getElectronApp()?.getVersion(),
        appType: APP_TYPE,
      },
    });
  }

  captureExtensionUninstalled(extensionName: string, location: 'global' | 'project') {
    if (this.store.getSettings().telemetryEnabled) {
      this.client?.capture({
        distinctId: this.distinctId,
        event: 'extension-uninstalled',
        properties: {
          extensionName,
          location,
        },
      });
    }

    this.client?.capture({
      distinctId: PRODUCT_TELEMETRY_DISTINCT_ID,
      event: 'extension-uninstalled',
      properties: {
        extensionName,
        os: process.platform,
        appVersion: getElectronApp()?.getVersion(),
        appType: APP_TYPE,
      },
    });
  }
}

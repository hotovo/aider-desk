/**
 * WakaTime Extension
 *
 * Tracks coding activity by sending heartbeats to WakaTime via wakatime-cli.
 * Relies on a global wakatime-cli installation and configuration (~/.wakatime.cfg).
 */

import { spawn } from 'child_process';
import { basename, isAbsolute, join } from 'path';

import type {
  Extension,
  ExtensionContext,
  FilesAddedEvent,
  PromptFinishedEvent,
  PromptStartedEvent,
  ToolFinishedEvent,
} from '@aiderdesk/extensions';

const WAKATIME_CLI = process.platform === 'win32' ? 'wakatime-cli.exe' : 'wakatime-cli';
const HEARTBEAT_THROTTLE_MS = 60000; // 1 minute

export default class WakaTimeExtension implements Extension {
  static metadata = {
    name: 'WakaTime',
    version: '1.0.0',
    description: 'Tracks coding activity by sending heartbeats to WakaTime',
    author: 'wladimiiir',
    capabilities: ['tracking'],
  };

  private lastHeartbeats = new Map<string, number>();

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('WakaTime extension loaded', 'info');
  }

  async onPromptStarted(event: PromptStartedEvent, context: ExtensionContext): Promise<void> {
    const entity = this.getPrimaryFile(context);
    if (entity) {
      this.sendHeartbeat(context, entity, this.getProjectName(context), false);
    }
  }

  async onPromptFinished(event: PromptFinishedEvent, context: ExtensionContext): Promise<void> {
    const project = this.getProjectName(context);
    const editedFiles = event.responses.flatMap((r) => r.editedFiles || []);

    if (editedFiles.length > 0) {
      const fullPaths = editedFiles.map((f) => (isAbsolute(f) ? f : join(context.getProjectDir(), f)));
      fullPaths.forEach((file) => this.sendHeartbeat(context, file, project, true));
    } else {
      const entity = this.getPrimaryFile(context);
      if (entity) {
        this.sendHeartbeat(context, entity, project, false);
      }
    }
  }

  async onToolFinished(event: ToolFinishedEvent, context: ExtensionContext): Promise<void> {
    const { toolName, input } = event;
    const project = this.getProjectName(context);

    // Track file writes in Agent mode
    if ((toolName === 'write_file' || toolName === 'edit_file') && input?.path) {
      const fullPath = isAbsolute(input.path as string) ? (input.path as string) : join(context.getProjectDir(), input.path as string);
      this.sendHeartbeat(context, fullPath, project, true);
    } else {
      const entity = this.getPrimaryFile(context);
      if (entity) {
        this.sendHeartbeat(context, entity, project, false);
      }
    }
  }

  async onFilesAdded(event: FilesAddedEvent, context: ExtensionContext): Promise<void> {
    const project = this.getProjectName(context);

    for (const file of event.files) {
      const fullPath = isAbsolute(file.path) ? file.path : join(context.getProjectDir(), file.path);
      this.sendHeartbeat(context, fullPath, project, false);
    }
  }

  private sendHeartbeat(context: ExtensionContext, entity: string, project: string, isWrite: boolean): void {
    const now = Date.now();
    const lastTime = this.lastHeartbeats.get(entity) || 0;

    // Throttle heartbeats for the same entity unless it's a write
    if (!isWrite && now - lastTime < HEARTBEAT_THROTTLE_MS) {
      return;
    }

    const args = ['--entity', entity, '--project', project, '--plugin', 'aider-desk-extension/1.0.0'];

    if (isWrite) {
      args.push('--write');
    }

    setImmediate(() => {
      try {
        const proc = spawn(WAKATIME_CLI, args, {
          detached: true,
          stdio: 'ignore',
          timeout: 5000,
        });

        proc.on('error', (error) => {
          context.log(`WakaTime spawn error: ${error.message}`, 'error');
        });

        proc.on('close', (code) => {
          if (code !== 0 && code !== null) {
            context.log(`WakaTime process exited with code ${code}`, 'debug');
          }
        });

        proc.unref();
      } catch (e) {
        context.log(`WakaTime heartbeat error: ${e instanceof Error ? e.message : String(e)}`, 'error');
      }
    });

    this.lastHeartbeats.set(entity, now);
  }

  private getPrimaryFile(context: ExtensionContext): string | null {
    const taskContext = context.getTaskContext();
    if (!taskContext) {
      return context.getProjectDir();
    }

    // Get context files synchronously - we need to handle this differently
    // since getContextFiles is async but we're in a sync context
    // For now, return project dir as fallback
    return context.getProjectDir();
  }

  private getProjectName(context: ExtensionContext): string {
    return basename(context.getProjectDir());
  }
}

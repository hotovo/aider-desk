import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { getClientErrorStatus, isClientError } from 'ai-sdk-provider-opencode-sdk';

import type { ContextMessage } from '@aiderdesk/extensions';

type SessionRecord = {
  version: 1;
  sessionId: string;
  workspace: string;
  model: string;
  historyHash: string | null;
};

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
};

export const fingerprint = (value: unknown): string =>
  createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');

export const historyFingerprint = (messages: ContextMessage[]): string =>
  fingerprint(
    messages.flatMap(({ role, content }) => {
      if ((role === 'assistant' || role === 'tool') && Array.isArray(content)) {
        const filtered = content.filter((part) => !('toolName' in part && typeof part.toolName === 'string' && part.toolName.startsWith('helpers---')));
        return filtered.length ? [{ role, content: filtered }] : [];
      }
      return [{ role, content }];
    }),
  );

export class SessionState {
  readonly directory: string;
  readonly storageDirectory: string;
  sessionId?: string;
  private file: string;

  constructor(
    root: string,
    project: string,
    taskId: string,
    profileId: string,
    scope: string,
    private workspace: string,
    private model: string,
  ) {
    this.directory = join(root, fingerprint([resolve(project), taskId, profileId, scope]));
    this.storageDirectory = join(this.directory, 'runtime');
    this.file = join(this.directory, 'session.json');
  }

  async restore(historyHash: string, getSession: (id: string) => Promise<unknown>): Promise<string | undefined> {
    let record: unknown;
    try {
      record = JSON.parse(await readFile(this.file, 'utf8'));
    } catch (error) {
      if (error instanceof SyntaxError || (error as NodeJS.ErrnoException).code === 'ENOENT') {
        return undefined;
      }
      throw error;
    }
    if (!record || typeof record !== 'object') {
      return undefined;
    }
    const saved = record as Partial<SessionRecord>;
    if (
      saved.version !== 1 ||
      saved.workspace !== resolve(this.workspace) ||
      saved.model !== this.model ||
      saved.historyHash !== historyHash ||
      typeof saved.sessionId !== 'string'
    ) {
      return undefined;
    }
    try {
      await getSession(saved.sessionId);
    } catch (error) {
      if ((isClientError(error) && getClientErrorStatus(error) === 404) || (error && typeof error === 'object' && 'status' in error && error.status === 404)) {
        return undefined;
      }
      throw error;
    }
    this.sessionId = saved.sessionId;
    return this.sessionId;
  }

  async invalidate(): Promise<void> {
    await this.save(null);
  }

  async observe(metadata: Record<string, unknown> | undefined): Promise<void> {
    const native = metadata?.opencode;
    if (native && typeof native === 'object' && 'sessionId' in native && typeof native.sessionId === 'string') {
      this.sessionId = native.sessionId;
      await this.save(null);
    }
  }

  async checkpoint(messages: ContextMessage[]): Promise<SessionRecord | undefined> {
    if (!this.sessionId) {
      return undefined;
    }
    return this.save(historyFingerprint(messages));
  }

  private async save(historyHash: string | null): Promise<SessionRecord> {
    const record: SessionRecord = { version: 1, sessionId: this.sessionId ?? '', workspace: resolve(this.workspace), model: this.model, historyHash };
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const temporary = join(this.directory, `${randomUUID()}.json`);
    await writeFile(temporary, JSON.stringify(record), { mode: 0o600 });
    await rename(temporary, this.file);
    return record;
  }
}

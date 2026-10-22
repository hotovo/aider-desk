import { describe, expect, it } from 'vitest';
import { createToolRecoveryNotice, ToolRecoveryCode } from '@common/tool-recovery';
import en from '@common/locales/en.json';
import zh from '@common/locales/zh.json';
import ru from '@common/locales/ru.json';
import ko from '@common/locales/ko.json';

import { localizeToolRecoveryContent } from '../localize-tool-recovery';

describe('localized recovery presentation', () => {
  it.each([en, zh, ru, ko])('localizes nested recovery notices without changing stored/model-facing data', (locale) => {
    const notice = createToolRecoveryNotice(ToolRecoveryCode.Interrupted);
    const raw = JSON.stringify({ ...notice, nested: [createToolRecoveryNotice(ToolRecoveryCode.FinalizationInterrupted)], originalToolData: notice.message });
    const translated = localizeToolRecoveryContent(raw, (key) => locale.durability.notices[key.split('.').at(-1)! as ToolRecoveryCode]);
    const result = JSON.parse(translated);
    expect(result.message).toBe(locale.durability.notices.interrupted);
    expect(result.nested[0].message).toBe(locale.durability.notices.finalizationInterrupted);
    expect(result.originalToolData).toBe(notice.message);
    expect(JSON.parse(raw).message).toBe(notice.message);
  });

  it('does not rewrite arbitrary tool text or malformed JSON', () => {
    expect(localizeToolRecoveryContent('not JSON', () => 'translated')).toBe('not JSON');
    const content = JSON.stringify({ message: 'Tool execution was interrupted.', text: 'User text' });
    expect(localizeToolRecoveryContent(content, () => 'translated')).toBe(content);
  });
});

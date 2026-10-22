import { expect, it } from 'vitest';
import { ToolRecoveryMode } from '@common/types';

import { ToolRecoveryMode as ExtensionToolRecoveryMode } from '../../../../../packages/extensions/src';

it('exports the recovery enum as a runtime value from the public extension entrypoint', () => {
  expect(ExtensionToolRecoveryMode).toEqual(ToolRecoveryMode);
});

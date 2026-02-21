import { describe, expect, it } from 'vitest';

import { AIDER_DESK_DIR, AIDER_DESK_HOOKS_DIR, AIDER_DESK_GLOBAL_HOOKS_DIR, AIDER_DESK_EXTENSIONS_DIR, AIDER_DESK_GLOBAL_EXTENSIONS_DIR } from '../constants';

describe('Extension Directory Constants', () => {
  it('should define AIDER_DESK_EXTENSIONS_DIR as project-specific extension directory', () => {
    expect(AIDER_DESK_EXTENSIONS_DIR).toBeDefined();
    expect(AIDER_DESK_EXTENSIONS_DIR).toBe('.aider-desk/extensions');
  });

  it('should define AIDER_DESK_GLOBAL_EXTENSIONS_DIR using user home directory', () => {
    expect(AIDER_DESK_GLOBAL_EXTENSIONS_DIR).toBeDefined();
    expect(AIDER_DESK_GLOBAL_EXTENSIONS_DIR).toContain('.aider-desk/extensions');
    expect(AIDER_DESK_GLOBAL_EXTENSIONS_DIR).not.toBe('.aider-desk/extensions');
  });

  it('should maintain consistent naming pattern with hook constants', () => {
    const hookDirPattern = AIDER_DESK_HOOKS_DIR.replace('hooks', '');
    const extensionDirPattern = AIDER_DESK_EXTENSIONS_DIR.replace('extensions', '');

    expect(hookDirPattern).toBe(extensionDirPattern);
  });

  it('should maintain consistent naming pattern with global hook constant', () => {
    const globalHookDirPattern = AIDER_DESK_GLOBAL_HOOKS_DIR.replace('hooks', '');
    const globalExtensionDirPattern = AIDER_DESK_GLOBAL_EXTENSIONS_DIR.replace('extensions', '');

    expect(globalHookDirPattern).toBe(globalExtensionDirPattern);
  });

  it('should base project extensions on AIDER_DESK_DIR', () => {
    expect(AIDER_DESK_EXTENSIONS_DIR).toContain(AIDER_DESK_DIR);
  });
});

/**
 * Local type declarations for yaml-front-matter (CJS package without types).
 * Note: depending on the module loader the functions may live on the namespace
 * or under `.default` — the runtime interop resolution in lib/bmad-manager.ts
 * handles both shapes; these declarations only cover the documented API.
 */
declare module 'yaml-front-matter' {
  export interface FrontMatterResult extends Record<string, unknown> {
    __content: string;
  }

  export function loadFront(content: string | Buffer): FrontMatterResult;
  export function safeLoadFront(content: string | Buffer): FrontMatterResult;
}

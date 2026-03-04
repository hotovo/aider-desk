import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import logger from './logger';

const LANGUAGE_WASM_MAP: Record<string, { url: string; file: string }> = {
  python: {
    url: 'https://unpkg.com/tree-sitter-python/tree-sitter-python.wasm',
    file: 'tree-sitter-python.wasm',
  },
  javascript: {
    url: 'https://unpkg.com/tree-sitter-javascript/tree-sitter-javascript.wasm',
    file: 'tree-sitter-javascript.wasm',
  },
  typescript: {
    url: 'https://unpkg.com/tree-sitter-typescript/tree-sitter-typescript.wasm',
    file: 'tree-sitter-typescript.wasm',
  },
  tsx: {
    url: 'https://unpkg.com/tree-sitter-typescript/tree-sitter-tsx.wasm',
    file: 'tree-sitter-tsx.wasm',
  },
  java: {
    url: 'https://unpkg.com/tree-sitter-java/tree-sitter-java.wasm',
    file: 'tree-sitter-java.wasm',
  },
  go: {
    url: 'https://unpkg.com/tree-sitter-go/tree-sitter-go.wasm',
    file: 'tree-sitter-go.wasm',
  },
  rust: {
    url: 'https://unpkg.com/tree-sitter-rust/tree-sitter-rust.wasm',
    file: 'tree-sitter-rust.wasm',
  },
  c: {
    url: 'https://unpkg.com/tree-sitter-c/tree-sitter-c.wasm',
    file: 'tree-sitter-c.wasm',
  },
  cpp: {
    url: 'https://unpkg.com/tree-sitter-cpp/tree-sitter-cpp.wasm',
    file: 'tree-sitter-cpp.wasm',
  },
  ruby: {
    url: 'https://unpkg.com/tree-sitter-ruby/tree-sitter-ruby.wasm',
    file: 'tree-sitter-ruby.wasm',
  },
  php: {
    url: 'https://unpkg.com/tree-sitter-php/tree-sitter-php.wasm',
    file: 'tree-sitter-php.wasm',
  },
  scala: {
    url: 'https://unpkg.com/tree-sitter-scala/tree-sitter-scala.wasm',
    file: 'tree-sitter-scala.wasm',
  },
  dart: {
    url: 'https://unpkg.com/tree-sitter-dart/tree-sitter-dart.wasm',
    file: 'tree-sitter-dart.wasm',
  },
  ocaml: {
    url: 'https://unpkg.com/tree-sitter-ocaml/tree-sitter-ocaml.wasm',
    file: 'tree-sitter-ocaml.wasm',
  },
  ocaml_interface: {
    url: 'https://unpkg.com/tree-sitter-ocaml/tree-sitter-ocaml_interface.wasm',
    file: 'tree-sitter-ocaml_interface.wasm',
  },
  c_sharp: {
    url: 'https://unpkg.com/tree-sitter-c-sharp/tree-sitter-c_sharp.wasm',
    file: 'tree-sitter-c_sharp.wasm',
  },
  haskell: {
    url: 'https://unpkg.com/tree-sitter-haskell/tree-sitter-haskell.wasm',
    file: 'tree-sitter-haskell.wasm',
  },
  julia: {
    url: 'https://unpkg.com/tree-sitter-julia/tree-sitter-julia.wasm',
    file: 'tree-sitter-julia.wasm',
  },
};

function getCacheDir(): string {
  const platform = os.platform();
  const homeDir = os.homedir();

  if (platform === 'darwin') {
    return path.join(homeDir, 'Library', 'Caches', 'aiderdesk', 'tree-sitter');
  } else if (platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'aiderdesk', 'tree-sitter');
  } else {
    return path.join(homeDir, '.cache', 'aiderdesk', 'tree-sitter');
  }
}

export async function downloadWasmForLanguage(language: string): Promise<Buffer | null> {
  const config = LANGUAGE_WASM_MAP[language];
  if (!config) {
    logger.warn(`No WASM configuration for language: ${language}`);
    return null;
  }

  const cacheDir = getCacheDir();
  const wasmPath = path.join(cacheDir, 'wasm', config.file);

  try {
    // Try to load from cache first
    try {
      const buffer = await fs.readFile(wasmPath);
      logger.debug(`Loaded WASM for ${language} from cache: ${wasmPath}`);
      return buffer;
    } catch {
      // Not in cache, download it
    }

    // Download WASM file
    logger.info(`Downloading WASM for ${language} from ${config.url}`);

    const response = await fetch(config.url, { redirect: 'follow' });

    if (!response.ok) {
      throw new Error(`Failed to download ${language} WASM: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Save to cache
    await fs.mkdir(path.dirname(wasmPath), { recursive: true });
    await fs.writeFile(wasmPath, buffer);

    logger.info(`Downloaded and cached WASM for ${language} (${Math.round(buffer.byteLength / 1024)} KB)`);

    return buffer;
  } catch (error) {
    logger.error(`Failed to download WASM for ${language}:`, error);
    return null;
  }
}

export function getLanguageWasmConfig(language: string): { url: string; file: string } | null {
  return LANGUAGE_WASM_MAP[language] || null;
}

export function getSupportedLanguagesForWasm(): string[] {
  return Object.keys(LANGUAGE_WASM_MAP);
}

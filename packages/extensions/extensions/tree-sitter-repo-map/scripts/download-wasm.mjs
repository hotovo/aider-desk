import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LANGUAGES = [
  { name: 'python', url: 'https://unpkg.com/tree-sitter-python/tree-sitter-python.wasm' },
  { name: 'javascript', url: 'https://unpkg.com/tree-sitter-javascript/tree-sitter-javascript.wasm' },
  { name: 'typescript', url: 'https://unpkg.com/tree-sitter-typescript/tree-sitter-typescript.wasm' },
  { name: 'tsx', url: 'https://unpkg.com/tree-sitter-typescript/tree-sitter-tsx.wasm' },
  { name: 'java', url: 'https://unpkg.com/tree-sitter-java/tree-sitter-java.wasm' },
  { name: 'go', url: 'https://unpkg.com/tree-sitter-go/tree-sitter-go.wasm' },
  { name: 'rust', url: 'https://unpkg.com/tree-sitter-rust/tree-sitter-rust.wasm' },
  { name: 'c', url: 'https://unpkg.com/tree-sitter-c/tree-sitter-c.wasm' },
  { name: 'cpp', url: 'https://unpkg.com/tree-sitter-cpp/tree-sitter-cpp.wasm' },
  { name: 'ruby', url: 'https://unpkg.com/tree-sitter-ruby/tree-sitter-ruby.wasm' },
  { name: 'php', url: 'https://unpkg.com/tree-sitter-php/tree-sitter-php.wasm' },
  { name: 'scala', url: 'https://unpkg.com/tree-sitter-scala/tree-sitter-scala.wasm' },
  { name: 'dart', url: 'https://unpkg.com/tree-sitter-dart/tree-sitter-dart.wasm' },
  { name: 'ocaml', url: 'https://unpkg.com/tree-sitter-ocaml/tree-sitter-ocaml.wasm' },
  { name: 'ocaml_interface', url: 'https://unpkg.com/tree-sitter-ocaml/tree-sitter-ocaml_interface.wasm' },
  { name: 'c_sharp', url: 'https://unpkg.com/tree-sitter-c-sharp/tree-sitter-c_sharp.wasm' },
  { name: 'haskell', url: 'https://unpkg.com/tree-sitter-haskell/tree-sitter-haskell.wasm' },
  { name: 'julia', url: 'https://unpkg.com/tree-sitter-julia/tree-sitter-julia.wasm' },
];

async function downloadWasmFiles() {
  const outputDir = path.join(__dirname, '..', 'wasm');

  await fs.mkdir(outputDir, { recursive: true });

  console.log('Downloading tree-sitter language WASM files...\n');

  let successCount = 0;
  let failCount = 0;

  for (const lang of LANGUAGES) {
    try {
      process.stdout.write(`Downloading ${lang.name}... `);
      
      const response = await fetch(lang.url, { redirect: 'follow' });

      if (!response.ok) {
        console.log(`✗ Failed (${response.status} ${response.statusText})`);
        failCount++;
        continue;
      }

      const buffer = await response.arrayBuffer();
      const outputPath = path.join(outputDir, `tree-sitter-${lang.name}.wasm`);

      await fs.writeFile(outputPath, Buffer.from(buffer));
      
      const sizeKB = Math.round(buffer.byteLength / 1024);
      console.log(`✓ (${sizeKB} KB)`);
      successCount++;
    } catch (error) {
      console.log(`✗ Error: ${error.message}`);
      failCount++;
    }
  }

  console.log(`\n✓ Downloaded ${successCount} WASM files`);
  
  if (failCount > 0) {
    console.log(`✗ Failed to download ${failCount} files`);
    process.exit(1);
  }
}

downloadWasmFiles().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

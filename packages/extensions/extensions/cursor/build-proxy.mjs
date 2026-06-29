import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import esbuild from 'esbuild'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const distDir = join(__dirname, 'dist')

if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true })
}

console.log('Building Cursor proxy with esbuild...')

await esbuild.build({
  entryPoints: [join(__dirname, 'src', 'proxy', 'main.ts')],
  bundle: true,
  platform: 'node',
  outfile: join(distDir, 'proxy.js'),
  format: 'esm',
})

console.log('✓ Proxy built successfully')

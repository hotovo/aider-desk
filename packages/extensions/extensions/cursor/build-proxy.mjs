import { execSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const distDir = join(__dirname, 'dist')

if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true })
}

console.log('Building Cursor proxy with esbuild...')

execSync(
  'esbuild src/proxy/main.ts --bundle --platform=node --outfile=dist/proxy.js --format=esm',
  {
    cwd: __dirname,
    stdio: 'inherit',
  },
)

console.log('✓ Proxy built successfully')

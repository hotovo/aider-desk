#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== AiderDesk Package Build ==="
echo "Root: $ROOT_DIR"
echo ""

# Step 1: Build runner.js and cli.js via vite
echo "--- Building runner.js & cli.js ---"
cd "$SCRIPT_DIR"
NODE_ENV=npx vite build
echo "runner.js & cli.js built successfully."
echo ""

# Step 2: Build and copy renderer
echo "--- Building renderer ---"
cd "$ROOT_DIR"
npx electron-vite build
mkdir -p "$SCRIPT_DIR/out/renderer"
cp -r "$ROOT_DIR/out/renderer/." "$SCRIPT_DIR/out/renderer/"
echo "Renderer copied successfully."
echo ""

# Step 3: Copy resources (connector, prompts)
echo "--- Copying resources ---"
mkdir -p "$SCRIPT_DIR/out/resources"
cp -r "$ROOT_DIR/resources/connector" "$SCRIPT_DIR/out/resources/connector"
cp -r "$ROOT_DIR/resources/prompts" "$SCRIPT_DIR/out/resources/prompts"
cp -r "$ROOT_DIR/resources/skills" "$SCRIPT_DIR/out/resources/skills"
echo "Resources copied successfully."
echo ""

# Step 4: Build and copy MCP server
echo "--- Building MCP server ---"
cd "$ROOT_DIR"
npx esbuild src/mcp-server/aider-desk-mcp-server.ts --bundle --platform=node --outdir=out/mcp-server
mkdir -p "$SCRIPT_DIR/out/resources/mcp-server"
cp -r "$ROOT_DIR/out/mcp-server/." "$SCRIPT_DIR/out/resources/mcp-server/"
echo "MCP server built and copied successfully."
echo ""

# Step 5: Copy download scripts into package
echo "--- Copying download scripts ---"
cp "$ROOT_DIR/scripts/download-probe.mjs" "$SCRIPT_DIR/scripts/download-probe.mjs"
echo "Download scripts copied."
echo ""

# Step 6: Generate package.json
echo "--- Generating package.json ---"
node "$SCRIPT_DIR/scripts/generate-package.mjs"
echo ""

# Step 7: Install dependencies (rebuilds native deps)
echo "--- Installing dependencies ---"
cd "$SCRIPT_DIR"
npm install --ignore-scripts --legacy-peer-deps
echo ""

echo "=== Build complete! ==="
echo ""
echo "Next step:"
echo "  npm publish"

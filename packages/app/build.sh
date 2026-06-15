#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load .env file if it exists
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/.env"
  set +a
  echo "Loaded environment variables from $SCRIPT_DIR/.env"
fi

echo "=== AiderDesk Package Build ==="
echo "Root: $ROOT_DIR"
echo ""

# Step 1: Build runner.js and cli.js via vite
echo "--- Building runner.js & cli.js ---"
cd "$SCRIPT_DIR"
POSTHOG_PUBLIC_API_KEY="${POSTHOG_PUBLIC_API_KEY:-}" NODE_ENV=npx vite build
echo "runner.js & cli.js built successfully."
echo ""

# Step 2: Build and copy renderer
echo "--- Building renderer ---"
cd "$ROOT_DIR"
POSTHOG_PUBLIC_API_KEY="${POSTHOG_PUBLIC_API_KEY:-}" npx electron-vite build
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

# Step 4: Copy download scripts into package
echo "--- Copying download scripts ---"
cp "$ROOT_DIR/scripts/download-probe.mjs" "$SCRIPT_DIR/scripts/download-probe.mjs"
echo "Download scripts copied."
echo ""

# Step 5: Generate package.json
echo "--- Generating package.json ---"
node "$SCRIPT_DIR/scripts/generate-package.mjs"
echo ""

# Step 6: Install dependencies (rebuilds native deps)
echo "--- Installing dependencies ---"
cd "$SCRIPT_DIR"
npm install --ignore-scripts --legacy-peer-deps
npm audit fix
echo ""

echo "=== Build complete! ==="
echo ""
echo "Next step:"
echo "  npm publish"

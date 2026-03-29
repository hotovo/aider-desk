#!/usr/bin/env node

const path = require('path');

const pkgRoot = path.resolve(__dirname, '..');
const resourcesDir = path.join(pkgRoot, 'out', 'resources');

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
} else {
  console.warn('NODE_ENV is already set to', process.env.NODE_ENV);
}
process.env.AIDER_DESK_RESOURCES_DIR = resourcesDir;
if (!process.env.AIDER_DESK_HEADLESS) {
  process.env.AIDER_DESK_HEADLESS = 'true';
}

require(path.join(pkgRoot, 'out', 'server', 'runner.js'));

#!/usr/bin/env node

const path = require('path');

const pkgRoot = path.resolve(__dirname, '..');

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

require(path.join(pkgRoot, 'out', 'cli.js'));

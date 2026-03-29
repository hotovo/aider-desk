import { readFileSync } from 'fs';
import { resolve, join } from 'path';

import { Command } from 'commander';

import { pkgRoot, DEFAULT_PORT } from './constants';
import { registerStartCommand } from './commands/start';
import { registerTuiCommand } from './commands/tui';

function getVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const program = new Command();

program
  .name('aiderdesk')
  .description('AiderDesk - AI-Powered Development Platform')
  .version(getVersion(), '-v, --version', 'show version number')
  .helpOption('-h, --help', 'show help');

registerStartCommand(program);
registerTuiCommand(program);

program.parse();

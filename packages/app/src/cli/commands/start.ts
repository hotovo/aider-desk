import { Command } from 'commander';

import { DEFAULT_PORT, resolvePort } from '../constants';
import { spawnRunner } from '../runner';

export function registerStartCommand(program: Command): void {
  program
    .command('start')
    .description('Start the runner in foreground (headless mode)')
    .option('-p, --port <port>', `port to listen on (default: ${DEFAULT_PORT}, env: AIDER_DESK_PORT)`, parseInt)
    .action((opts) => {
      const port = resolvePort(opts.port);
      spawnRunner(port, 'inherit');
    });
}

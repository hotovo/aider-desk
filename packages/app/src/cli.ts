import { spawn, ChildProcess } from 'child_process';
import { resolve, dirname, join } from 'path';
import { readFileSync } from 'fs';

import {
  TUI,
  ProcessTerminal,
  matchesKey,
  Key,
  truncateToWidth,
  visibleWidth,
  type Component,
} from '@mariozechner/pi-tui';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  blink: '\x1b[5m',
  black: (s: string) => `\x1b[30m${s}\x1b[39m`,
  red: (s: string) => `\x1b[31m${s}\x1b[39m`,
  green: (s: string) => `\x1b[32m${s}\x1b[39m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[39m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[39m`,
  gray: (s: string) => `\x1b[90m${s}\x1b[39m`,
  white: (s: string) => `\x1b[37m${s}\x1b[49m`,
  bgCyan: (s: string) => `\x1b[46m${s}\x1b[49m`,
  boldCyan: (s: string) => `\x1b[1m\x1b[36m${s}\x1b[0m`,
  boldWhite: (s: string) => `\x1b[1m\x1b[37m${s}\x1b[0m`,
  bgCyanBlack: (s: string) => `\x1b[30m\x1b[46m${s}\x1b[0m`,
};

const READY_PATTERN = /AiderDesk Runner is ready and running on port (\d+)/;
const DEFAULT_PORT = 24337;
const MAX_LOG_LINES = 500;

const pkgRoot = resolve(dirname(__filename), '..');
const resourcesDir = resolve(pkgRoot, 'out', 'resources');
const runnerPath = resolve(pkgRoot, 'out', 'runner.js');

function getInitialPort(): number {
  const envPort = process.env.AIDER_DESK_PORT;
  if (envPort) {
    const port = parseInt(envPort, 10);
    if (port >= 1 && port <= 65535) return port;
  }
  return DEFAULT_PORT;
}

function parseArgs(argv: string[]): { command: string; port: number; showHelp: boolean; showVersion: boolean } {
  const args = argv.slice(2);
  let command = '';
  let port = getInitialPort();
  let showHelp = false;
  let showVersion = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      showHelp = true;
    } else if (arg === '--version' || arg === '-v') {
      showVersion = true;
    } else if (arg === '--port' || arg === '-p') {
      const next = args[++i];
      if (next) {
        const parsed = parseInt(next, 10);
        if (parsed >= 1 && parsed <= 65535) {
          port = parsed;
        } else {
          console.error(`Invalid port: ${next}. Must be between 1 and 65535.`);
          process.exit(1);
        }
      } else {
        console.error('Missing value for --port');
        process.exit(1);
      }
    } else if (!arg.startsWith('-')) {
      command = arg;
    } else {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    }
  }

  return { command, port, showHelp, showVersion };
}

function printVersion(): void {
  try {
    const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'));
    console.log(`AiderDesk v${pkg.version}`);
  } catch {
    console.log('AiderDesk (unknown version)');
  }
}

function printHelp(): void {
  const version = (() => {
    try {
      return `v${JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')).version}`;
    } catch {
      return '(unknown version)';
    }
  })();

  console.log(`AiderDesk ${version}
Usage: aiderdesk [command] [options]

Commands:
  start       Start the runner in foreground (headless mode)
  tui         Start the interactive TUI (default when no command given)

Options:
  -p, --port <port>   Set the port to listen on (default: ${DEFAULT_PORT}, env: AIDER_DESK_PORT)
  -h, --help          Show this help message
  -v, --version       Show version number
`);
}

function startForeground(port: number): void {
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    NODE_ENV: process.env.NODE_ENV || 'production',
    AIDER_DESK_HEADLESS: 'true',
    AIDER_DESK_RESOURCES_DIR: resourcesDir,
  };

  if (port !== DEFAULT_PORT || process.env.AIDER_DESK_PORT) {
    env.AIDER_DESK_PORT = String(port);
  }

  const child = spawn(process.execPath, [runnerPath], {
    env,
    stdio: 'inherit',
  });

  const forwardSignal = (signal: NodeJS.Signals) => {
    child.kill(signal);
  };

  process.on('SIGINT', () => forwardSignal('SIGINT'));
  process.on('SIGTERM', () => forwardSignal('SIGTERM'));

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });

  child.on('error', (err) => {
    console.error(`Failed to start: ${err.message}`);
    process.exit(1);
  });
}

type AppState = 'idle' | 'starting' | 'running' | 'stopping';

class ScrollableLog {
  private lines: string[] = [];
  private scrollOffset = 0;

  push(line: string): void {
    this.lines.push(line);
    if (this.lines.length > MAX_LOG_LINES) {
      this.lines.shift();
    }
    this.scrollOffset = 0;
  }

  getVisibleLines(height: number): string[] {
    const total = this.lines.length;
    const maxOffset = Math.max(0, total - height);
    this.scrollOffset = Math.min(this.scrollOffset, maxOffset);
    const start = Math.max(0, total - height - this.scrollOffset);
    return this.lines.slice(start, start + height);
  }

  scrollUp(count: number): void {
    this.scrollOffset = Math.min(this.scrollOffset + count, this.lines.length);
  }

  scrollDown(count: number): void {
    this.scrollOffset = Math.max(0, this.scrollOffset - count);
  }

  clear(): void {
    this.lines = [];
    this.scrollOffset = 0;
  }

  get totalLines(): number {
    return this.lines.length;
  }

  get currentOffset(): number {
    return this.scrollOffset;
  }
}

class AiderDeskCli implements Component {
  private tui: TUI;
  private state: AppState = 'idle';
  private childProcess: ChildProcess | null = null;
  private detectedPort: number | null = null;
  private configuredPort = getInitialPort();
  private logBuffer = new ScrollableLog();
  private selectedMenuIndex = 0;
  private portInputActive = false;
  private portInputValue = '';
  private cachedWidth?: number;
  private cachedLines?: string[];

  constructor(tui: TUI) {
    this.tui = tui;
  }

  private getMenuItems(): { label: string; key: string; available: boolean }[] {
    const items: { label: string; key: string; available: boolean }[] = [];

    if (this.state === 'idle') {
      items.push({ label: '▶ Start', key: 's', available: true });
    } else if (this.state === 'starting') {
      items.push({ label: '⏳ Starting...', key: '', available: false });
    } else if (this.state === 'running') {
      items.push({ label: '■ Stop', key: 's', available: true });
    } else {
      items.push({ label: '⏳ Stopping...', key: '', available: false });
    }

    items.push({ label: '⚙ Set Port', key: 'p', available: this.state === 'idle' && !this.portInputActive });

    items.push({ label: '✕ Exit', key: 'q', available: this.state === 'idle' });

    return items;
  }

  private startRunner(): void {
    if (this.state !== 'idle') return;
    this.state = 'starting';
    this.detectedPort = null;
    this.logBuffer.clear();
    this.invalidate();

    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      NODE_ENV: process.env.NODE_ENV || 'production',
      AIDER_DESK_HEADLESS: 'true',
      AIDER_DESK_RESOURCES_DIR: resourcesDir,
    };

    if (this.configuredPort !== DEFAULT_PORT) {
      env.AIDER_DESK_PORT = String(this.configuredPort);
    }

    this.childProcess = spawn(process.execPath, [runnerPath], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const handleOutput = (data: Buffer) => {
      const text = data.toString();
      const lines = text.split('\n').filter((l) => l.trim());
      for (const line of lines) {
        this.logBuffer.push(c.gray(line));
      }

      const match = text.match(READY_PATTERN);
      if (match) {
        this.detectedPort = parseInt(match[1], 10);
        this.state = 'running';
      }

      this.invalidate();
      this.tui.requestRender();
    };

    this.childProcess.stdout?.on('data', handleOutput);
    this.childProcess.stderr?.on('data', handleOutput);

    this.childProcess.on('exit', (code) => {
      this.logBuffer.push(
        code === 0 ? c.gray('Process exited.') : c.red(`Process exited with code ${code}.`)
      );
      this.childProcess = null;
      this.state = 'idle';
      this.detectedPort = null;
      this.invalidate();
      this.tui.requestRender();
    });

    this.childProcess.on('error', (err) => {
      this.logBuffer.push(c.red(`Failed to start: ${err.message}`));
      this.state = 'idle';
      this.childProcess = null;
      this.invalidate();
      this.tui.requestRender();
    });
  }

  private stopRunner(): void {
    if (!this.childProcess || (this.state !== 'running' && this.state !== 'starting')) return;
    this.state = 'stopping';
    this.invalidate();
    this.tui.requestRender();
    this.childProcess.kill('SIGTERM');
    setTimeout(() => {
      if (this.childProcess) {
        this.childProcess.kill('SIGKILL');
      }
    }, 5000);
  }

  private doExit(): void {
    this.stopRunner();
    setTimeout(() => {
      this.tui.stop();
      process.exit(0);
    }, 500);
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }

  handleInput(data: string): void {
    if (this.portInputActive) {
      this.handlePortInput(data);
      return;
    }

    if (matchesKey(data, Key.ctrl('c'))) {
      this.doExit();
      return;
    }

    if (matchesKey(data, 's')) {
      if (this.state === 'idle') this.startRunner();
      else if (this.state === 'running') this.stopRunner();
      return;
    }

    if (matchesKey(data, 'q') && this.state === 'idle') {
      this.doExit();
      return;
    }

    if (matchesKey(data, 'p') && this.state === 'idle' && !this.portInputActive) {
      this.portInputActive = true;
      this.portInputValue = String(this.configuredPort);
      this.invalidate();
      this.tui.requestRender();
      return;
    }

    if (matchesKey(data, Key.left)) {
      const items = this.getMenuItems().filter((i) => i.available);
      if (items.length > 0) {
        this.selectedMenuIndex = (this.selectedMenuIndex - 1 + items.length) % items.length;
      }
      this.invalidate();
      this.tui.requestRender();
      return;
    }

    if (matchesKey(data, Key.right)) {
      const items = this.getMenuItems().filter((i) => i.available);
      if (items.length > 0) {
        this.selectedMenuIndex = (this.selectedMenuIndex + 1) % items.length;
      }
      this.invalidate();
      this.tui.requestRender();
      return;
    }

    if (matchesKey(data, Key.up)) {
      this.logBuffer.scrollUp(1);
      this.invalidate();
      this.tui.requestRender();
      return;
    }

    if (matchesKey(data, Key.down)) {
      this.logBuffer.scrollDown(1);
      this.invalidate();
      this.tui.requestRender();
      return;
    }

    if (matchesKey(data, Key.pageUp)) {
      this.logBuffer.scrollUp(Math.max(3, Math.floor((process.stdout.rows || 24) / 2)));
      this.invalidate();
      this.tui.requestRender();
      return;
    }

    if (matchesKey(data, Key.pageDown)) {
      this.logBuffer.scrollDown(Math.max(3, Math.floor((process.stdout.rows || 24) / 2)));
      this.invalidate();
      this.tui.requestRender();
      return;
    }

    if (matchesKey(data, Key.enter)) {
      const items = this.getMenuItems().filter((i) => i.available);
      const item = items[this.selectedMenuIndex];
      if (item) {
        if (item.key === 's') {
          if (this.state === 'idle') this.startRunner();
          else if (this.state === 'running') this.stopRunner();
        } else if (item.key === 'p') {
          this.portInputActive = true;
          this.portInputValue = String(this.configuredPort);
          this.invalidate();
          this.tui.requestRender();
        } else if (item.key === 'q') {
          this.doExit();
        }
      }
      return;
    }
  }

  private handlePortInput(data: string): void {
    if (matchesKey(data, Key.escape)) {
      this.portInputActive = false;
      this.invalidate();
      this.tui.requestRender();
      return;
    }

    if (matchesKey(data, Key.enter)) {
      const port = parseInt(this.portInputValue, 10);
      if (port >= 1 && port <= 65535) {
        this.configuredPort = port;
      }
      this.portInputActive = false;
      this.invalidate();
      this.tui.requestRender();
      return;
    }

    if (matchesKey(data, Key.backspace)) {
      this.portInputValue = this.portInputValue.slice(0, -1);
      this.invalidate();
      this.tui.requestRender();
      return;
    }

    if (data.length === 1 && data >= '0' && data <= '9' && this.portInputValue.length < 5) {
      this.portInputValue += data;
      this.invalidate();
      this.tui.requestRender();
    }
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    const lines: string[] = [];

    lines.push(c.boldCyan('  ╔═══════════════════════════════╗'));
    lines.push(c.boldCyan('  ║') + c.boldWhite('      A i d e r D e s k        ') + c.boldCyan('║'));
    lines.push(c.boldCyan('  ╚═══════════════════════════════╝'));
    lines.push('');

    lines.push(this.renderMenuBar(width));
    lines.push('');

    if (this.portInputActive) {
      lines.push(c.gray('  Port: ') + this.portInputValue + c.blink + '▎' + c.reset);
      lines.push('');
    }

    lines.push(this.renderStatus(width));
    lines.push('');

    lines.push(c.gray('─'.repeat(width)));

    const headerHeight = lines.length + 1;
    const logHeight = Math.max(3, process.stdout.rows - headerHeight);
    const logLines = this.logBuffer.getVisibleLines(logHeight);
    for (const line of logLines) {
      lines.push(truncateToWidth(line, width));
    }

    const footer = this.logBuffer.currentOffset > 0
      ? c.gray(` ↑${this.logBuffer.currentOffset} `)
      : '';
    const rightFooter = c.gray(`${this.logBuffer.totalLines} lines`);
    const padding = Math.max(0, width - visibleWidth(footer) - visibleWidth(rightFooter));
    lines.push(truncateToWidth(footer + ' '.repeat(padding) + rightFooter, width));

    this.cachedWidth = width;
    this.cachedLines = lines;
    return lines;
  }

  private renderMenuBar(width: number): string {
    const items = this.getMenuItems();
    const availableItems = items.filter((i) => i.available);
    const parts = items.map((item) => {
      const availIdx = availableItems.indexOf(item);
      const isSelected = availIdx === this.selectedMenuIndex;
      const text = ` ${item.label} `;
      return isSelected ? c.bgCyanBlack(text) : c.cyan(text);
    });

    const separator = c.gray(' │ ');
    return truncateToWidth(parts.join(separator), width);
  }

  private renderStatus(width: number): string {
    let status: string;
    if (this.state === 'idle') {
      status = c.gray(`  Status: Stopped (port ${this.configuredPort})`);
    } else if (this.state === 'starting') {
      status = c.yellow('  Status: Starting...');
    } else if (this.state === 'running' && this.detectedPort !== null) {
      status = c.green(`  🟢 Running on http://localhost:${this.detectedPort}`);
    } else if (this.state === 'running') {
      status = c.green('  🟢 Running');
    } else {
      status = c.yellow('  Status: Stopping...');
    }
    return truncateToWidth(status, width);
  }
}

const { command, port, showHelp, showVersion } = parseArgs(process.argv);

if (showHelp) {
  printHelp();
  process.exit(0);
}

if (showVersion) {
  printVersion();
  process.exit(0);
}

if (command === 'start') {
  startForeground(port);
} else if (command === '' || command === 'tui') {
  const terminal = new ProcessTerminal();
  const tui = new TUI(terminal);
  const cli = new AiderDeskCli(tui);
  tui.addChild(cli);
  tui.setFocus(cli);
  process.stdout.write('\x1b[2J\x1b[H');
  tui.start();
} else {
  console.error(`Unknown command: ${command}`);
  console.error('Run "aiderdesk --help" for usage information.');
  process.exit(1);
}

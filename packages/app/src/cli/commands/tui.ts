import { type ChildProcess } from 'child_process';

import {
  TUI,
  ProcessTerminal,
  matchesKey,
  Key,
  truncateToWidth,
  visibleWidth,
  wrapTextWithAnsi,
  type Component,
} from '@mariozechner/pi-tui';

import {
  c,
  READY_PATTERN,
  DEFAULT_PORT,
  MAX_LOG_LINES,
  resolvePort,
} from '../constants';
import { spawnRunnerProcess } from '../runner';
import { Command } from 'commander';

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
  private configuredPort: number;
  private logBuffer = new ScrollableLog();
  private selectedMenuIndex = 0;
  private portInputActive = false;
  private portInputValue = '';
  private cachedWidth?: number;
  private cachedLines?: string[];

  constructor(tui: TUI, port: number) {
    this.tui = tui;
    this.configuredPort = port;
  }

  private getMenuItems(): { label: string; key: string; available: boolean }[] {
    const items: { label: string; key: string; available: boolean }[] = [];

    if (this.state === 'idle') {
      items.push({ label: '▶ Start', key: 's', available: true });
      items.push({ label: 'Set Port', key: 'p', available: !this.portInputActive });
      items.push({ label: '✕ Exit', key: 'q', available: true });
    } else if (this.state === 'running') {
      items.push({ label: '■ Stop', key: 's', available: true });
    }

    return items;
  }

  private startRunner(): void {
    if (this.state !== 'idle') return;
    this.state = 'starting';
    this.detectedPort = null;
    this.logBuffer.clear();
    this.selectedMenuIndex = 0;
    this.invalidate();

    this.childProcess = spawnRunnerProcess(this.configuredPort, ['pipe', 'pipe', 'pipe']);

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
      this.selectedMenuIndex = 0;
      this.invalidate();
      this.tui.requestRender();
    });

    this.childProcess.on('error', (err) => {
      this.logBuffer.push(c.red(`Failed to start: ${err.message}`));
      this.state = 'idle';
      this.childProcess = null;
      this.selectedMenuIndex = 0;
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

    for (const line of this.renderBanner(width)) {
      lines.push(line);
    }
    lines.push('');

    if (this.state === 'idle') {
      lines.push(this.renderMenuBar(width));
      lines.push('');

      if (this.portInputActive) {
        lines.push(c.gray('  Port: ') + this.portInputValue + c.blink + '▎' + c.reset);
        lines.push('');
      }

      lines.push(this.renderStatus(width));
      lines.push('');
    } else {
      lines.push(this.renderStatusWithAction(width));
      lines.push('');
    }

    lines.push(c.gray('─'.repeat(width)));

    const headerHeight = lines.length + 1;
    const logHeight = Math.max(3, process.stdout.rows - headerHeight);
    const logLines = this.logBuffer.getVisibleLines(logHeight);
    const wrappedLines = logLines.flatMap((line) => wrapTextWithAnsi(line, width));
    const visibleWrapped = wrappedLines.slice(-logHeight);
    for (const line of visibleWrapped) {
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

  private renderBanner(width: number): string[] {
    const A = [
      '  ██████╗ ',
      '██╔════██╗',
      '█████████║',
      '██╔════██║',
      '██║    ██║',
      '╚═╝    ╚═╝',
    ];
    const I = ['██╗', '██║', '██║', '██║', '██║', '╚═╝'];
    const D = [
      '████████╗ ',
      '██╔════██╗',
      '██║    ██║',
      '██║    ██║',
      '████████╔╝',
      '╚═══════╝ ',
    ];
    const E = ['███████╗', '██╔════╝', '█████╗  ', '██╔══╝  ', '███████╗', '╚══════╝'];
    const R = ['██████╗ ', '██╔══██╗', '██████╔╝', '██╔══██╗', '██║  ██║', '╚═╝  ╚═╝'];
    const S = ['███████╗', '██╔════╝', '███████╗', '╚════██║', '███████║', '╚══════╝'];
    const K = ['██╗  ██╗', '██║ ██╔╝', '█████╔╝ ', '██╔═██╗ ', '██║  ██╗', '╚═╝  ╚═╝'];

    const letters = [
      { rows: A, highlight: true },
      { rows: I, highlight: false },
      { rows: D, highlight: false },
      { rows: E, highlight: false },
      { rows: R, highlight: false },
      { rows: D, highlight: true },
      { rows: E, highlight: false },
      { rows: S, highlight: false },
      { rows: K, highlight: false },
    ];

    const lines: string[] = [];
    for (let row = 0; row < 6; row++) {
      const segments = letters.map(({ rows, highlight }) => {
        const text = rows[row];
        return highlight ? c.boldWhite(text) : c.gray(text);
      });
      const line = segments.join(' ');
      const lineWidth = visibleWidth(line);
      const padding = Math.max(0, Math.floor((width - lineWidth) / 2));
      lines.push(truncateToWidth(' '.repeat(padding) + line, width));
    }
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
    return truncateToWidth(c.gray(`  Status: Stopped (port ${this.configuredPort})`), width);
  }

  private renderStatusWithAction(width: number): string {
    let status: string;
    if (this.state === 'starting') {
      status = c.yellow('  ⏳ Starting...');
    } else if (this.state === 'running' && this.detectedPort !== null) {
      status = c.green(`  🟢 Running on http://localhost:${this.detectedPort}`);
    } else if (this.state === 'running') {
      status = c.green('  🟢 Running');
    } else {
      status = c.yellow('  ⏳ Stopping...');
    }

    if (this.state === 'running') {
      const items = this.getMenuItems().filter((i) => i.available);
      const availIdx = items.findIndex((i) => i.key === 's');
      const isSelected = availIdx === this.selectedMenuIndex;
      const stopLabel = ' ■ Stop [s] ';
      const stopText = isSelected ? c.bgCyanBlack(stopLabel) : c.cyan(stopLabel);
      const statusWidth = visibleWidth(status);
      const stopWidth = visibleWidth(stopText);
      const padding = Math.max(1, width - statusWidth - stopWidth);
      return truncateToWidth(status + ' '.repeat(padding) + stopText, width);
    }

    return truncateToWidth(status, width);
  }
}

function runTui(port: number): void {
  const terminal = new ProcessTerminal();
  const tui = new TUI(terminal);
  const cli = new AiderDeskCli(tui, port);
  tui.addChild(cli);
  tui.setFocus(cli);
  process.stdout.write('\x1b[2J\x1b[H');
  tui.start();
}

export function registerTuiCommand(program: Command): void {
  program
    .command('tui', { isDefault: true })
    .description('Start the interactive TUI (default)')
    .option('-p, --port <port>', `port to listen on (default: ${DEFAULT_PORT}, env: AIDER_DESK_PORT)`, parseInt)
    .action((opts) => {
      const port = resolvePort(opts.port);
      runTui(port);
    });
}

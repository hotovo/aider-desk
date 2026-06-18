import {
  TUI,
  matchesKey,
  Key,
  visibleWidth,
  truncateToWidth,
  wrapTextWithAnsi,
  type Component,
  type OverlayHandle,
} from '@earendil-works/pi-tui';

import { c } from '../constants';

const REASONING_PREVIEW_LINES = 5;
const TOOL_PREVIEW_LINES = 5;
const BLOCK_INDENT = 4;
const HEADER_HINT = c.gray('[Enter]');
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const SPINNER_INTERVAL_MS = 80;

const ICON_REASONING = '💭';
const ICON_TOOL_RUNNING = '⚙';
const ICON_TOOL_OK = '✓';
const ICON_TOOL_ERR = '✗';
const ICON_USER = '🧑';

// === Block types ===

export type ReasoningBlock = {
  type: 'reasoning';
  id: string;
  text: string;
  streaming: boolean;
};

export type ToolBlock = {
  type: 'tool';
  id: string;
  toolName: string;
  argsSummary: string;
  output: string;
  error: boolean;
  finished: boolean;
};

export type AnswerBlock = {
  type: 'answer';
  id: string;
  text: string;
  finished: boolean;
};

export type Block = ReasoningBlock | ToolBlock | AnswerBlock;

// === Tool args formatter ===

export function formatToolArgs(args: unknown): string {
  if (!args || typeof args !== 'object') {
    return '';
  }
  const entries = Object.entries(args as Record<string, unknown>);
  if (entries.length === 0) {
    return '';
  }
  const summary = entries
    .map(([key, value]) => {
      const str = typeof value === 'string' ? value : JSON.stringify(value);
      const truncated = str.length > 60 ? str.substring(0, 57) + '...' : str;
      return `${key}=${truncated}`;
    })
    .join(', ');
  return `(${summary})`;
}

// Returns the current spinner frame based on elapsed time (pure, testable).
export function getSpinnerFrame(elapsedMs: number): string {
  const idx = Math.floor(elapsedMs / SPINNER_INTERVAL_MS) % SPINNER_FRAMES.length;
  return SPINNER_FRAMES[idx] ?? SPINNER_FRAMES[0]!;
}

// Determines whether the cursor should track the newest block after navigation.
// While at the last slot, new blocks keep the cursor pinned (follow). Moving
// off the last slot disables follow until the user navigates back to it.
export function shouldFollowAfterNav(newSlot: number, indicesLen: number): boolean {
  return indicesLen > 0 && newSlot === indicesLen - 1;
}

// === Pure data model (testable without TUI) ===

export class RunStreamModel {
  private blocks: Block[] = [];
  private reasoningByMessageId = new Map<string, ReasoningBlock>();
  private answerByMessageId = new Map<string, AnswerBlock>();
  private toolById = new Map<string, ToolBlock>();

  appendReasoning(messageId: string, text: string): void {
    if (!text) return;
    let block = this.reasoningByMessageId.get(messageId);
    if (!block) {
      block = { type: 'reasoning', id: messageId, text: '', streaming: true };
      this.reasoningByMessageId.set(messageId, block);
      this.blocks.push(block);
    }
    block.text += text;
  }

  freezeReasoning(messageId: string): void {
    const block = this.reasoningByMessageId.get(messageId);
    if (block) {
      block.streaming = false;
    }
  }

  appendAnswer(messageId: string, text: string): void {
    if (!text) return;
    let block = this.answerByMessageId.get(messageId);
    if (!block) {
      this.freezeReasoning(messageId);
      block = { type: 'answer', id: messageId, text: '', finished: false };
      this.answerByMessageId.set(messageId, block);
      this.blocks.push(block);
    }
    block.text += text;
  }

  startTool(id: string, toolName: string, args?: unknown): void {
    if (this.toolById.has(id)) return;
    const block: ToolBlock = {
      type: 'tool',
      id,
      toolName,
      argsSummary: formatToolArgs(args),
      output: '',
      error: false,
      finished: false,
    };
    this.toolById.set(id, block);
    this.blocks.push(block);
  }

  endTool(id: string, output?: string, error = false): void {
    const block = this.toolById.get(id);
    if (!block) return;
    block.output = output ?? '';
    block.error = error;
    block.finished = true;
  }

  completeResponse(messageId: string, fullContent?: string): void {
    let block = this.answerByMessageId.get(messageId);
    if (!block) {
      if (fullContent) {
        this.appendAnswer(messageId, fullContent);
      }
      block = this.answerByMessageId.get(messageId);
    } else if (fullContent && fullContent.startsWith(block.text)) {
      block.text = fullContent;
    } else if (fullContent && !block.text) {
      block.text = fullContent;
    }
    if (block) {
      block.finished = true;
    }
    this.freezeReasoning(messageId);
  }

  getBlocks(): readonly Block[] {
    return this.blocks;
  }

  getSelectableIndices(): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.blocks.length; i++) {
      const b = this.blocks[i];
      if (b && (b.type === 'reasoning' || b.type === 'tool')) {
        out.push(i);
      }
    }
    return out;
  }
}

// === Pure rendering helpers (testable) ===

export function renderReasoningPreview(
  block: ReasoningBlock,
  width: number,
  maxLines = REASONING_PREVIEW_LINES,
): string[] {
  if (!block.text) return [];
  const wrapWidth = Math.max(1, width - BLOCK_INDENT);
  const wrapped = wrapTextWithAnsi(block.text, wrapWidth);
  const lines = wrapped.length > maxLines ? wrapped.slice(-maxLines) : wrapped;
  return lines.map((line) => c.gray(' '.repeat(BLOCK_INDENT) + truncateToWidth(line, wrapWidth)));
}

export function renderToolPreview(
  block: ToolBlock,
  width: number,
  maxLines = TOOL_PREVIEW_LINES,
): string[] {
  if (!block.output) return [];
  const wrapWidth = Math.max(1, width - BLOCK_INDENT);
  const wrapped = wrapTextWithAnsi(block.output, wrapWidth);
  const lines = wrapped.length > maxLines ? wrapped.slice(0, maxLines) : wrapped;
  const colorFn = block.error ? c.red : c.gray;
  const out = lines.map((line) => colorFn(' '.repeat(BLOCK_INDENT) + truncateToWidth(line, wrapWidth)));
  if (wrapped.length > maxLines) {
    const moreCount = wrapped.length - maxLines;
    out.push(c.gray(' '.repeat(BLOCK_INDENT) + `… +${moreCount} more [Enter]`));
  }
  return out;
}

export function renderReasoningFull(block: ReasoningBlock, width: number): string[] {
  if (!block.text) return [c.gray('(empty)')];
  const wrapWidth = Math.max(1, width);
  const wrapped = wrapTextWithAnsi(block.text, wrapWidth);
  if (wrapped.length === 0) {
    return [c.gray('(empty)')];
  }
  const numWidth = String(wrapped.length).length + 2;
  return wrapped.map((line, i) => {
    const num = String(i + 1).padStart(numWidth, ' ');
    return c.gray(num + ' ' + truncateToWidth(line, wrapWidth - numWidth - 1));
  });
}

export function renderToolFull(block: ToolBlock, width: number): string[] {
  const wrapWidth = Math.max(1, width);
  const wrapped = block.output ? wrapTextWithAnsi(block.output, wrapWidth) : [];
  const colorFn = block.error ? c.red : c.gray;
  if (wrapped.length === 0) {
    return [colorFn('(no output)')];
  }
  const numWidth = String(wrapped.length).length + 2;
  return wrapped.map((line, i) => {
    const num = String(i + 1).padStart(numWidth, ' ');
    return colorFn(num + ' ' + truncateToWidth(line, wrapWidth - numWidth - 1));
  });
}

export function renderAnswerLines(block: AnswerBlock, width: number): string[] {
  if (!block.text) return [];
  const wrapWidth = Math.max(1, width - 2);
  const wrapped = wrapTextWithAnsi(block.text, wrapWidth);
  return wrapped.map((line) => truncateToWidth(line, wrapWidth));
}

// === Header builder ===

function buildBlockHeader(block: Block, width: number, selected: boolean): string | null {
  if (block.type === 'answer') {
    return null;
  }
  const marker = selected ? c.cyan('▶') : ' ';
  let icon: string;
  let body: string;
  let iconColor: (s: string) => string;
  let showHint = false;

  if (block.type === 'reasoning') {
    icon = ICON_REASONING;
    body = block.streaming ? 'Thinking…' : 'Thinking';
    iconColor = c.gray;
    showHint = !!block.text;
  } else {
    if (block.finished) {
      icon = block.error ? ICON_TOOL_ERR : ICON_TOOL_OK;
      iconColor = block.error ? c.red : c.green;
      showHint = !!block.output;
    } else {
      icon = ICON_TOOL_RUNNING;
      iconColor = c.yellow;
      showHint = false;
    }
    body = block.toolName + (block.argsSummary || '');
  }

  const left = ` ${marker} ${iconColor(icon)}  ${c.bold}${body}${c.reset}`;
  const leftW = visibleWidth(left);
  const hintStr = showHint ? HEADER_HINT : '';
  const hintW = visibleWidth(hintStr);
  const pad = Math.max(1, width - leftW - hintW);
  return truncateToWidth(left + ' '.repeat(pad) + hintStr, width);
}

// === Overlay component (shows expanded block content) ===

class ContentOverlay implements Component {
  private lines: string[] = [];
  private scrollOffset = 0;
  title: string;
  onClose?: () => void;

  constructor(title: string) {
    this.title = title;
  }

  setContent(lines: string[]): void {
    this.lines = lines;
    this.scrollOffset = 0;
  }

  invalidate(): void {}

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape) || matchesKey(data, 'q') || matchesKey(data, Key.enter)) {
      this.onClose?.();
      return;
    }
    const total = this.lines.length;
    const viewport = this.viewportHeight();
    const maxOffset = Math.max(0, total - viewport);
    if (matchesKey(data, Key.up)) {
      this.scrollOffset = Math.min(this.scrollOffset + 1, maxOffset);
    } else if (matchesKey(data, Key.down)) {
      this.scrollOffset = Math.max(0, this.scrollOffset - 1);
    } else if (matchesKey(data, Key.pageUp)) {
      this.scrollOffset = Math.min(this.scrollOffset + viewport, maxOffset);
    } else if (matchesKey(data, Key.pageDown)) {
      this.scrollOffset = Math.max(0, this.scrollOffset - viewport);
    } else if (matchesKey(data, Key.home)) {
      this.scrollOffset = maxOffset;
    } else if (matchesKey(data, Key.end)) {
      this.scrollOffset = 0;
    }
  }

  private viewportHeight(): number {
    const termRows = process.stdout.rows || 24;
    return Math.max(3, termRows - 5);
  }

  render(width: number): string[] {
    const viewport = this.viewportHeight();
    const result: string[] = [
      c.bgCyanBlack(` ${this.title} `),
      c.gray('─'.repeat(width)),
    ];
    const start = this.scrollOffset;
    const visible = this.lines.slice(start, start + viewport);
    for (const line of visible) {
      result.push(truncateToWidth(line, width));
    }
    while (result.length < viewport + 2) {
      result.push('');
    }
    result.push(c.gray('─'.repeat(width)));
    const total = this.lines.length;
    const label = total === 0 ? ' empty ' : ` ${start + 1}-${Math.min(start + viewport, total)} of ${total} `;
    const scrollHint = c.gray(' ↑↓ scroll • Esc/Enter close ');
    const hintW = visibleWidth(scrollHint);
    const labelStr = c.gray(label);
    const labelW = visibleWidth(labelStr);
    const pad = Math.max(1, width - hintW - labelW);
    result.push(truncateToWidth(scrollHint + ' '.repeat(pad) + labelStr, width));
    return result;
  }
}

// === Main view component ===

export type InteractiveRunOptions = {
  projectDir: string;
  taskId: string;
  host: string;
  port: number;
  prompt?: string;
  onInterrupt: () => void;
};

export class RunStreamView implements Component {
  private tui: TUI;
  private model: RunStreamModel;
  private opts: InteractiveRunOptions;
  private selectedSlot = 0;
  private followSelection = true;
  private scrollOffset = 0;
  private autoFollow = true;
  private finished = false;
  private status: 'streaming' | 'done' | 'interrupted' = 'streaming';
  private overlay: { handle: OverlayHandle; component: ContentOverlay } | null = null;
  private headerText: string;
  private loadingMessage: string | null = null;
  private spinnerStartTime = 0;
  private spinnerIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(tui: TUI, model: RunStreamModel, opts: InteractiveRunOptions) {
    this.tui = tui;
    this.model = model;
    this.opts = opts;
    this.headerText = `AiderDesk Run${opts.taskId ? ` — task:${opts.taskId}` : ''}`;
  }

  notifyChanged(): void {
    // When following, keep the cursor pinned to the newest selectable block
    // so users can watch reasoning/tool blocks stream in. Once the user moves
    // the cursor off the last block we stop auto-following until they manually
    // navigate back to the last block.
    if (this.followSelection) {
      const indices = this.model.getSelectableIndices();
      this.selectedSlot = Math.max(0, indices.length - 1);
    }
    this.tui.requestRender();
  }

  setInterrupted(): void {
    this.status = 'interrupted';
    this.finished = true;
    this.tui.requestRender();
  }

  setFinished(): void {
    this.finished = true;
    if (this.status === 'streaming') {
      this.status = 'done';
    }
    this.stopSpinner();
    this.loadingMessage = null;
    this.tui.requestRender();
  }

  setLoadingMessage(message: string | null): void {
    this.loadingMessage = message;
    if (message) {
      this.startSpinner();
    } else {
      this.stopSpinner();
    }
    this.tui.requestRender();
  }

  private startSpinner(): void {
    if (this.spinnerIntervalId) return;
    this.spinnerStartTime = Date.now();
    this.spinnerIntervalId = setInterval(() => {
      this.tui.requestRender();
    }, SPINNER_INTERVAL_MS);
  }

  private stopSpinner(): void {
    if (this.spinnerIntervalId) {
      clearInterval(this.spinnerIntervalId);
      this.spinnerIntervalId = null;
    }
  }

  invalidate(): void {
    this.tui.requestRender();
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.ctrl('c'))) {
      return; // handled by global input listener
    }
    if (this.overlay) {
      return; // overlay handles its own input
    }
    if (matchesKey(data, Key.escape)) {
      return;
    }
    if (matchesKey(data, Key.enter) || matchesKey(data, 'e')) {
      this.toggleOverlay();
      return;
    }
    if (matchesKey(data, Key.up)) {
      const indices = this.model.getSelectableIndices();
      if (indices.length === 0) return;
      this.selectedSlot = (this.selectedSlot - 1 + indices.length) % indices.length;
      // Stop auto-following until the cursor lands back on the last block.
      this.followSelection = this.selectedSlot === indices.length - 1;
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, Key.down)) {
      const indices = this.model.getSelectableIndices();
      if (indices.length === 0) return;
      this.selectedSlot = (this.selectedSlot + 1) % indices.length;
      // Pressing ↓ onto the last item re-enables follow.
      this.followSelection = this.selectedSlot === indices.length - 1;
      this.tui.requestRender();
      return;
    }
    const viewportHeight = Math.max(3, (process.stdout.rows || 24) / 2);
    if (matchesKey(data, Key.pageUp)) {
      this.scrollOffset += Math.max(3, Math.floor(viewportHeight));
      this.autoFollow = false;
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, Key.pageDown)) {
      this.scrollOffset = Math.max(0, this.scrollOffset - Math.max(3, Math.floor(viewportHeight)));
      if (this.scrollOffset === 0) this.autoFollow = true;
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, Key.end)) {
      this.scrollOffset = 0;
      this.autoFollow = true;
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, Key.home)) {
      this.scrollOffset = Number.MAX_SAFE_INTEGER;
      this.autoFollow = false;
      this.tui.requestRender();
      return;
    }
  }

  private toggleOverlay(): void {
    if (this.overlay) {
      this.overlay.handle.hide();
      this.overlay = null;
      return;
    }
    const indices = this.model.getSelectableIndices();
    if (this.selectedSlot < 0 || this.selectedSlot >= indices.length) return;
    const blockIndex = indices[this.selectedSlot];
    const blocks = this.model.getBlocks();
    const block = blocks[blockIndex];
    if (!block || block.type === 'answer') return;

    const overlayWidth = Math.min(160, Math.max(60, (process.stdout.columns || 80) - 4));
    const lines: string[] =
      block.type === 'reasoning'
        ? renderReasoningFull(block, overlayWidth - 6)
        : renderToolFull(block, overlayWidth - 6);

    const title =
      block.type === 'reasoning'
        ? `${ICON_REASONING} Thinking`
        : `${block.error ? ICON_TOOL_ERR : ICON_TOOL_OK} ${block.toolName}${block.argsSummary || ''}`;

    const overlay = new ContentOverlay(title);
    overlay.setContent(lines);
    overlay.onClose = () => {
      if (this.overlay) {
        this.overlay.handle.hide();
        this.overlay = null;
      }
    };
    const handle = this.tui.showOverlay(overlay, {
      width: overlayWidth,
      maxHeight: Math.floor((process.stdout.rows || 24) * 0.8),
      anchor: 'center',
    });
    this.overlay = { handle, component: overlay };
  }

  private computeSelectedIndex(): number {
    const indices = this.model.getSelectableIndices();
    if (indices.length === 0) return -1;
    const slot = Math.min(this.selectedSlot, indices.length - 1);
    return indices[slot];
  }

  private renderHeader(width: number): string {
    const left = c.gray(` ${this.headerText}`);
    const statusText =
      this.status === 'streaming'
        ? c.yellow('● streaming')
        : this.status === 'interrupted'
          ? c.red('● interrupted')
          : c.green('● done');
    const leftW = visibleWidth(left);
    const rightW = visibleWidth(statusText);
    const pad = Math.max(1, width - leftW - rightW);
    return truncateToWidth(left + ' '.repeat(pad) + statusText, width);
  }

  private renderUserPrompt(prompt: string, width: number): string[] {
    const wrapWidth = Math.max(1, width - BLOCK_INDENT - 3);
    const wrapped = wrapTextWithAnsi(prompt, wrapWidth);
    const out = wrapped.map((line) => `${c.cyan(ICON_USER)} ${c.bold}${truncateToWidth(line, wrapWidth)}${c.reset}`);
    return out.length > 0 ? out : [c.cyan(ICON_USER)];
  }

  private renderFooter(width: number): string {
    const hint = c.gray(' ↑↓ select • Enter expand • Ctrl+C interrupt ');
    let right = '';
    if (!this.autoFollow) {
      right = c.gray(this.scrollOffset === Number.MAX_SAFE_INTEGER ? ' top ' : ` ↑${this.scrollOffset} `);
    }
    const hintW = visibleWidth(hint);
    const rightW = visibleWidth(right);
    const pad = Math.max(1, width - hintW - rightW);
    return truncateToWidth(hint + ' '.repeat(pad) + right, width);
  }

  render(width: number): string[] {
    const lines: string[] = [];
    lines.push(this.renderHeader(width));
    lines.push(c.gray('─'.repeat(width)));

    if (this.opts.prompt) {
      lines.push(...this.renderUserPrompt(this.opts.prompt, width));
      lines.push('');
    }

    const selectedIndex = this.computeSelectedIndex();
    const blocks = this.model.getBlocks();
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (!block) continue;
      const selected = i === selectedIndex;
      const header = buildBlockHeader(block, width, selected);
      if (header !== null) {
        lines.push(header);
      }
      if (block.type === 'reasoning') {
        lines.push(...renderReasoningPreview(block, width));
      } else if (block.type === 'tool') {
        lines.push(...renderToolPreview(block, width));
      } else {
        lines.push(...renderAnswerLines(block, width));
      }
      lines.push('');
    }

    if (this.loadingMessage) {
      const elapsed = Date.now() - this.spinnerStartTime;
      const frame = getSpinnerFrame(elapsed);
      const msg = this.loadingMessage || '';
      lines.push(c.yellow(`${frame} ${msg}`));
      lines.push('');
    }

    lines.push(c.gray('─'.repeat(width)));
    lines.push(this.renderFooter(width));

    // Apply viewport scrolling: render a window of `termHeight` lines
    const termHeight = process.stdout.rows || 24;
    const viewport = termHeight;
    const total = lines.length;

    let start: number;
    if (this.autoFollow) {
      // Stick to bottom (latest content)
      start = Math.max(0, total - viewport);
    } else if (this.scrollOffset === Number.MAX_SAFE_INTEGER) {
      // Home: stick to top
      start = 0;
    } else {
      // Scroll up by `scrollOffset` lines from the bottom
      start = Math.max(0, Math.min(total - viewport, total - viewport - this.scrollOffset));
    }

    const visible = lines.slice(start, start + viewport);
    while (visible.length < viewport) {
      visible.push('');
    }
    return visible;
  }
}

import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

import { transpileJsxString } from '../../../../common/src/jsx-transpiler';
import { describe, expect, it } from 'vitest';

import PlannotatorExtension from '../index';

// ── Helpers ──────────────────────────────────────────────────────────────

interface FakeElement {
  type: unknown;
  props: Record<string, unknown> | null;
  children: unknown[];
}

const walk = (node: unknown, visit: (el: FakeElement) => void): void => {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((child) => walk(child, visit));
    return;
  }
  const el = node as FakeElement;
  if (!('type' in el) || !el.children) return;
  visit(el);
  walk(el.children, visit);
};

const findButton = (element: unknown, label: string): Record<string, unknown> | undefined => {
  let found: Record<string, unknown> | undefined;
  walk(element, (el) => {
    if ((el.children as unknown[]).includes(label)) {
      found = el.props ?? undefined;
    }
  });
  return found;
};

const collectText = (element: unknown): string => {
  const texts: string[] = [];
  walk(element, (el) => {
    (el.children as unknown[]).forEach((child) => {
      if (typeof child === 'string') texts.push(child);
    });
  });
  return texts.join('\n');
};

/**
 * Minimal React shim: the component under test destructures `useState` /
 * `useCallback` from React and the transpiled JSX calls `React.createElement`
 * (classic runtime). There is no real renderer, so hook state lives in slots
 * and re-renders are simulated by calling the component again via
 * `harness.render` (hook index resets each render, like React's dispatcher).
 */
const createHarness = async () => {
  const slots: unknown[] = [];
  let hookIndex = 0;
  // Production React throws when the same mounted instance renders with a
  // different hook count (conditional hooks); the harness reproduces that rule.
  let stableHookCount: number | undefined;
  const React = {
    createElement: (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]): FakeElement => ({
      type,
      props,
      children,
    }),
    useState: (initial: unknown) => {
      const slot = hookIndex++;
      if (slot >= slots.length) {
        slots.push(initial);
      }
      return [
        slots[slot],
        (next: unknown) => {
          slots[slot] = next;
        },
      ];
    },
    useCallback: (fn: unknown) => {
      hookIndex++;
      return fn;
    },
  };
  // Evaluate the component exactly like the production renderer
  // (StringToReactComponent): transpile the UNMODIFIED file contents to an ESM
  // module, import it, then call the default export with the React runtime.
  const jsx = readFileSync(join(__dirname, '../PlanReviewComponent.jsx'), 'utf-8');
  const transpiled = transpileJsxString(jsx);
  const modulePath = resolve(tmpdir(), `plannotator-inline-review-${process.pid}-${Date.now()}.mjs`);
  writeFileSync(modulePath, transpiled, 'utf-8');
  let Component: (props: Record<string, unknown>) => FakeElement | null;
  try {
    const loaded = (await import(pathToFileURL(modulePath).href)) as { default: (react: unknown) => typeof Component };
    Component = loaded.default(React);
  } finally {
    unlinkSync(modulePath);
  }

  return {
    render: (props: Record<string, unknown>) => {
      hookIndex = 0;
      const element = Component(props);
      // Conditional hooks: the same mounted instance must call the same number
      // of hooks on every render, exactly like production React requires.
      if (stableHookCount === undefined) {
        stableHookCount = hookIndex;
      } else if (hookIndex !== stableHookCount) {
        throw new Error(`Hook count changed across renders: ${stableHookCount} -> ${hookIndex}`);
      }
      return element;
    },
  };
};

const makeUi = () => {
  const Button = () => null;
  const TextArea = () => null;
  return { Button, TextArea };
};

// ── Component registration ───────────────────────────────────────────────

describe('PlannotatorExtension inline plan review component', () => {
  it('keeps a stable hook count across null -> plan -> null transitions on one instance', async () => {
    const ui = makeUi();
    const harness = await createHarness();
    const nullProps = { data: null, message: null, executeExtensionAction: () => undefined, ui };
    // The component mounts with data null and later receives plan data —
    // production React would throw on a varying hook count (conditional hooks).
    expect(harness.render(nullProps)).toBeNull();

    const withPlan = { data: { kind: 'plan', plan: 'plan 1' }, message: null, executeExtensionAction: () => undefined, ui };
    expect(harness.render(withPlan)).not.toBeNull();
    expect(harness.render(nullProps)).toBeNull();
    expect(harness.render({ ...withPlan, data: { kind: 'plan', plan: 'plan 2' } })).not.toBeNull();
    expect(harness.render(nullProps)).toBeNull();
  });

  it('registers a single task-level component instead of a per-message one', () => {
    const extension = new PlannotatorExtension();
    const components = extension.getUIComponents();

    expect(components).toHaveLength(1);
    // Per-message placements pass `message` only for finished messages, but the
    // pending plan data only exists while exit_plan_mode is unfinished — so the
    // component must live at a task-level placement and be data-gated instead.
    expect(components[0].placement).toBe('task-messages-top');
    expect(['task-message', 'task-message-above', 'task-message-below']).not.toContain(components[0].placement);
    expect(components[0].loadData).toBe(true);
    expect(components[0].noDataCache).toBe(true);
  });

  // ── Component behavior ────────────────────────────────────────────────

  it('renders the pending plan even though the message prop is absent (null)', async () => {
    const ui = makeUi();
    const element = (await createHarness()).render({
      data: { kind: 'plan', plan: '# My Plan\nstep 1' },
      message: null, // renderer does not pass messages for unfinished tool calls
      executeExtensionAction: () => undefined,
      ui,
    });
    expect(element).not.toBeNull();
    expect(collectText(element)).toContain('# My Plan');
  });

  it('renders only when data.kind === "plan" (scoping/safety)', async () => {
    const ui = makeUi();
    expect(
      (await createHarness()).render({
        data: { kind: 'code', content: 'secret' },
        message: null,
        ui,
      }),
    ).toBeNull();
    expect((await createHarness()).render({ data: undefined, message: null, ui })).toBeNull();
    expect(
      (await createHarness()).render({
        message: { type: 'tool', toolName: 'exit_plan_mode' },
        ui,
      }),
    ).toBeNull();
  });

  it('resolves approve with the entered feedback', async () => {
    const ui = makeUi();
    const calls: Array<[string, unknown]> = [];
    const executeExtensionAction = (action: string, args: unknown) => {
      calls.push([action, args]);
    };

    // Fill the feedback field, re-render (React would then pass the updated
    // state into the component), and click Approve in that render.
    const harness = await createHarness();
    const props = {
      data: { kind: 'plan', plan: '# My Plan', reviewId: 'review-1' },
      message: null,
      executeExtensionAction,
      ui,
    };
    const first = harness.render(props)!;
    const textAreaProps = walkFind(first, ui.TextArea);
    (textAreaProps!.onChange as (e: { target: { value: string } }) => void)({
      target: { value: 'ship it' },
    });
    const second = harness.render(props)!;

    const approveProps = findButton(second, 'Approve');
    expect(approveProps).toBeDefined();
    (approveProps!.onClick as () => void)();

    expect(calls).toEqual([['approve', { feedback: 'ship it', reviewId: 'review-1' }]]);
  });

  it('trims feedback before dispatching a UI action', async () => {
    const ui = makeUi();
    const calls: Array<[string, unknown]> = [];
    const harness = await createHarness();
    const props = {
      data: { kind: 'plan', plan: '# My Plan', reviewId: 'review-trim' },
      message: null,
      executeExtensionAction: (action: string, args: unknown) => calls.push([action, args]),
      ui,
    };
    const first = harness.render(props)!;
    const textAreaProps = walkFind(first, ui.TextArea);
    (textAreaProps!.onChange as (e: { target: { value: string } }) => void)({
      target: { value: '  ship it  ' },
    });
    const second = harness.render(props)!;
    (findButton(second, 'Approve')!.onClick as () => void)();

    expect(calls).toEqual([['approve', { feedback: 'ship it', reviewId: 'review-trim' }]]);
  });

  it('re-arms the action buttons for a new plan-review round after submit', async () => {
    const ui = makeUi();
    const harness = await createHarness();
    const round1 = {
      data: { kind: 'plan', plan: 'plan 1', reviewId: 'review-1' },
      message: null,
      executeExtensionAction: () => undefined,
      ui,
    };

    const shown = harness.render(round1)!;
    (findButton(shown, 'Approve')!.onClick as () => void)();

    // The submitted indicator renders only for the exact data submitted.
    expect(collectText(harness.render(round1)!)).toContain('Review submitted...');

    // The decision consumes the pending data (plan -> null)...
    expect(
      harness.render({
        data: null,
        message: null,
        executeExtensionAction: () => undefined,
        ui,
      }),
    ).toBeNull();

    // ...and the next round arrives as a fresh data object (new reviewId):
    // the buttons must return (a plain boolean submitted state would leak here).
    const round2 = {
      data: { kind: 'plan', plan: 'plan 2', reviewId: 'review-2' },
      message: null,
      executeExtensionAction: () => undefined,
      ui,
    };
    const next = harness.render(round2)!;
    expect(collectText(next)).not.toContain('Review submitted...');
    expect(findButton(next, 'Approve')).toBeDefined();
    expect(findButton(next, 'Request changes')).toBeDefined();
  });

  it('keeps the submitted indicator for the exact pending round it was submitted in', async () => {
    const ui = makeUi();
    const harness = await createHarness();
    const props = {
      data: { kind: 'plan', plan: '# My Plan', reviewId: 'review-1' },
      message: null,
      executeExtensionAction: () => undefined,
      ui,
    };
    const shown = harness.render(props)!;
    (findButton(shown, 'Request changes')!.onClick as () => void)();
    expect(collectText(harness.render(props)!)).toContain('Review submitted...');
  });

  it('fires the deny action from "Request changes" with the current reviewId', async () => {
    const ui = makeUi();
    const calls: Array<[string, unknown]> = [];
    const element = (await createHarness()).render({
      data: { kind: 'plan', plan: '# My Plan', reviewId: 'review-1' },
      message: null,
      executeExtensionAction: (action: string, args: unknown) => {
        calls.push([action, args]);
      },
      ui,
    });
    const denyProps = findButton(element, 'Request changes');
    expect(denyProps).toBeDefined();
    (denyProps!.onClick as () => void)();
    // The action payload ALWAYS echoes the panel's current reviewId — the
    // extension rejects any missing or non-matching ID as a stale payload.
    expect(calls).toEqual([['deny', { feedback: '', reviewId: 'review-1' }]]);
  });

  it('does not fire actions when no reviewId was rendered', async () => {
    const ui = makeUi();
    const calls: Array<[string, unknown]> = [];
    const element = (await createHarness()).render({
      data: { kind: 'plan', plan: '# My Plan' },
      message: null,
      executeExtensionAction: (action: string, args: unknown) => {
        calls.push([action, args]);
      },
      ui,
    });
    (findButton(element, 'Approve')!.onClick as () => void)();
    (findButton(element, 'Request changes')!.onClick as () => void)();
    // Without a rendered reviewId the extension would reject any action as a
    // stale payload (missing-ID bypass is closed), so the panel never sends one.
    expect(calls).toEqual([]);
  });

  it('keeps the buttons re-armed when a stale round is superseded by a new reviewId', async () => {
    const ui = makeUi();
    const harness = await createHarness();
    const stale = {
      data: { kind: 'plan', plan: 'stale plan', reviewId: 'review-stale' },
      message: null,
      executeExtensionAction: () => undefined,
      ui,
    };
    (findButton(harness.render(stale)!, 'Request changes')!.onClick as () => void)();

    // Unrelated round arrives under a different reviewId (the extension data
    // now carries a fresh ID per pending review): the panel must re-arm for
    // the new round instead of staying in "Review submitted...".
    const fresh = { ...stale, data: { ...stale.data, plan: 'fresh plan', reviewId: 'review-fresh' } };
    const next = harness.render(fresh)!;
    expect(collectText(next)).not.toContain('Review submitted...');
    expect(findButton(next, 'Approve')).toBeDefined();
  });

  it('resolves "aborted" immediately when the signal is already aborted', async () => {
    const extension = new PlannotatorExtension();
    const context = {
      getTaskContext: () => ({ data: { id: 'task-1' } }),
      triggerUIDataRefresh: () => undefined,
      log: () => undefined,
    } as never;

    const controller = new AbortController();
    controller.abort();

    const runInlinePlanReview = (
      extension as unknown as {
        runInlinePlanReview: (
          context: never,
          taskId: string,
          plan: string,
          signal?: AbortSignal,
        ) => Promise<{ approved: boolean; feedback?: string } | 'aborted'>;
      }
    ).runInlinePlanReview.bind(extension);

    // Abort events do not replay: without the pre-check the pending decision
    // stays registered forever and this promise never resolves.
    await expect(runInlinePlanReview(context, 'task-1', '# Plan', controller.signal)).resolves.toBe('aborted');

    const pendingDecisions = (extension as unknown as { pendingDecisions: Map<string, unknown> }).pendingDecisions;
    expect(pendingDecisions.get('task-1')).toBeUndefined();
  });

  it('resolves an earlier pending decision as aborted when a new review supersedes it', async () => {
    const extension = new PlannotatorExtension();
    const context = {
      getTaskContext: () => ({ data: { id: 'task-1' } }),
      triggerUIDataRefresh: () => undefined,
      log: () => undefined,
    } as never;
    const runInlinePlanReview = (
      extension as unknown as {
        runInlinePlanReview: (
          context: never,
          taskId: string,
          plan: string,
          signal?: AbortSignal,
        ) => Promise<{ approved: boolean; feedback?: string } | 'aborted'>;
      }
    ).runInlinePlanReview.bind(extension);

    const first = runInlinePlanReview(context, 'task-1', 'plan 1');
    void runInlinePlanReview(context, 'task-1', 'plan 2');

    // The superseded review must unwind instead of hanging forever.
    await expect(first).resolves.toBe('aborted');

    // Abort of the later decision still works after the supersession.
    const controller = new AbortController();
    const withSignal = runInlinePlanReview(context, 'task-1', 'plan 3', controller.signal);
    controller.abort();
    await expect(withSignal).resolves.toBe('aborted');
  });

  it('treats the resolved shortkey "a" as code-review approval, not a change request', async () => {
    const extension = new PlannotatorExtension();
    const runPrompts: string[] = [];
    const taskContext = {
      getProjectDir: () => '/tmp',
      data: { id: 'task-1' },
      addLogMessage: () => undefined,
      // Task.askQuestion resolves the matched answer's shortkey, not its text.
      askQuestion: async () => 'a',
      runPrompt: (prompt: string) => {
        runPrompts.push(prompt);
        return undefined as never;
      },
    };
    const context = {
      getTaskContext: () => taskContext,
      log: () => undefined,
    } as never;

    const runInlineCodeReview = (
      extension as unknown as {
        runInlineCodeReview: (context: never, patch: string, label: string) => Promise<void>;
      }
    ).runInlineCodeReview.bind(extension);

    await runInlineCodeReview(context as never, 'patch', 'diff');

    // Approval must not trigger the changes-request follow-up prompt.
    expect(runPrompts).toEqual([]);
  });

  it('triggers the changes-request follow-up only for the explicit "r" shortkey', async () => {
    const extension = new PlannotatorExtension();
    const runPrompts: string[] = [];
    const taskContext = {
      getProjectDir: () => '/tmp',
      data: { id: 'task-1' },
      addLogMessage: () => undefined,
      askQuestion: async () => 'r',
      runPrompt: (prompt: string) => {
        runPrompts.push(prompt);
        return undefined as never;
      },
    };
    const context = {
      getTaskContext: () => taskContext,
      log: () => undefined,
    } as never;

    const runInlineCodeReview = (
      extension as unknown as {
        runInlineCodeReview: (context: never, patch: string, label: string) => Promise<void>;
      }
    ).runInlineCodeReview.bind(extension);

    await runInlineCodeReview(context as never, 'patch', 'diff');

    // Only the explicit "Request changes" answer may spawn the follow-up prompt.
    expect(runPrompts).toHaveLength(1);
    expect(runPrompts[0]).toContain('requested changes');
  });

  it.each(['n', 'y', 'why did you stop', undefined])('safely dismisses the unrelated answer %j instead of requesting changes', async (answer) => {
    const extension = new PlannotatorExtension();
    const runPrompts: string[] = [];
    const logs: string[] = [];
    const taskContext = {
      getProjectDir: () => '/tmp',
      data: { id: 'task-1' },
      addLogMessage: () => undefined,
      // Task.askQuestion auto-answers 'n' when an unrelated user message
      // arrives while the question is pending; free text and undefined also
      // occur for non-matching responses.
      askQuestion: async () => answer,
      runPrompt: (prompt: string) => {
        runPrompts.push(prompt);
        return undefined as never;
      },
    };
    const context = {
      getTaskContext: () => taskContext,
      log: (_msg: string) => logs.push(_msg),
    } as never;

    const runInlineCodeReview = (
      extension as unknown as {
        runInlineCodeReview: (context: never, patch: string, label: string) => Promise<void>;
      }
    ).runInlineCodeReview.bind(extension);

    // Regression: any answer other than Approve/'a'/'r'/'Request changes' must
    // be ignored (no spurious autonomous runPrompt), never treated as an
    // implicit change request.
    await expect(runInlineCodeReview(context as never, 'patch', 'diff')).resolves.toBeUndefined();

    expect(runPrompts).toEqual([]);
  });

  it('rejects stale inline review actions via the review ID and accepts the current one', async () => {
    const extension = new PlannotatorExtension();
    const logs: string[] = [];
    const refreshes: Array<[string, string]> = [];
    const context = {
      getTaskContext: () => ({ data: { id: 'task-1' } }),
      triggerUIDataRefresh: (componentId: string, taskId: string) => refreshes.push([componentId, taskId]),
      log: (msg: string) => logs.push(msg),
    } as never;

    const runInlinePlanReview = (
      extension as unknown as {
        runInlinePlanReview: (context: never, taskId: string, plan: string) => Promise<unknown>;
      }
    ).runInlinePlanReview.bind(extension);
    const pending = runInlinePlanReview(context, 'task-1', '# Plan');

    const getUIExtensionData = (
      extension as unknown as {
        getUIExtensionData: (componentId: string, context: never) => Promise<{ reviewId: string } | null>;
      }
    ).getUIExtensionData.bind(extension);
    const data = await getUIExtensionData('plannotator-plan-review', context);
    expect(data?.reviewId).toBeTruthy();

    const executeUIExtensionAction = (
      extension as unknown as {
        executeUIExtensionAction: (componentId: string, action: string, args: unknown[], context: never) => Promise<unknown>;
      }
    ).executeUIExtensionAction.bind(extension);

    // A stale panel (superseded/closed review round) presents a reviewId that
    // no longer matches the pending decision: its action must be rejected
    // instead of resolving the (real) pending decision as approved.
    const stale = await executeUIExtensionAction(
      'plannotator-plan-review',
      'approve',
      [{ feedback: 'stale click', reviewId: 'not-the-current-review' }],
      context,
    );
    expect(stale).toEqual({ ok: false, stale: true });

    // Regression (audit): the stale panel already rendered its "Review
    // submitted..." state, so the stale branch must force a UI data refresh —
    // otherwise the component stays stuck on the submitted screen while the
    // current review round remains unresolved.
    const staleRefreshCount = refreshes.length;
    expect(staleRefreshCount).toBeGreaterThanOrEqual(1);
    expect(refreshes).toContainEqual(['plannotator-plan-review', 'task-1']);

    // The matching reviewId still resolves the pending decision normally.
    const accepted = await executeUIExtensionAction(
      'plannotator-plan-review',
      'approve',
      [{ feedback: 'looks good', reviewId: data!.reviewId }],
      context,
    );
    expect(accepted).toEqual({ ok: true });
    await expect(pending).resolves.toEqual({ approved: true, feedback: 'looks good' });
    expect(logs.some((msg) => msg.includes('stale plan review action'))).toBe(true);
    // The successful path also refreshes (the panel hides once data is gone).
    expect(refreshes.length).toBeGreaterThan(staleRefreshCount);
  });

  it('rejects null and undefined reviewId echoes as stale (no missing-ID bypass)', async () => {
    const extension = new PlannotatorExtension();
    const logs: string[] = [];
    let currentTaskId = 'task-1';
    const context = {
      getTaskContext: () => ({ data: { id: currentTaskId } }),
      triggerUIDataRefresh: () => undefined,
      log: (msg: string) => logs.push(msg),
    } as never;

    const runInlinePlanReview = (
      extension as unknown as {
        runInlinePlanReview: (context: never, taskId: string, plan: string) => Promise<unknown>;
      }
    ).runInlinePlanReview.bind(extension);
    const executeUIExtensionAction = (
      extension as unknown as {
        executeUIExtensionAction: (componentId: string, action: string, args: unknown[], context: never) => Promise<unknown>;
      }
    ).executeUIExtensionAction.bind(extension);

    // A payload whose reviewId echo is null (the panel rendered no ID, e.g. a
    // panel from before unique IDs existed) must NOT resolve the pending
    // decision — a missing ID can never prove the payload belongs to the
    // CURRENT round, so it is stale by definition (audit: missing-ID stale
    // bypass).
    const pendingNullEcho = runInlinePlanReview(context, 'task-1', '# Plan');
    const nullEcho = await executeUIExtensionAction(
      'plannotator-plan-review',
      'approve',
      [{ feedback: 'null echo', reviewId: null }],
      context,
    );
    expect(nullEcho).toEqual({ ok: false, stale: true });
    expect(logs.some((msg) => msg.includes('stale plan review action'))).toBe(true);

    // A payload omitting the reviewId key (undefined) is rejected the same way.
    currentTaskId = 'task-2';
    const pendingMissingEcho = runInlinePlanReview(context, 'task-2', '# Plan');
    const missingEcho = await executeUIExtensionAction('plannotator-plan-review', 'approve', [{}], context);
    expect(missingEcho).toEqual({ ok: false, stale: true });
    expect(logs.filter((msg) => msg.includes('stale plan review action')).length).toBe(2);

    // An EMPTY-string echo is stale like any other non-matching ID.
    currentTaskId = 'task-3';
    const pendingEmptyEcho = runInlinePlanReview(context, 'task-3', '# Plan');
    const emptyEcho = await executeUIExtensionAction(
      'plannotator-plan-review',
      'deny',
      [{ feedback: '', reviewId: '' }],
      context,
    );
    expect(emptyEcho).toEqual({ ok: false, stale: true });
    expect(logs.filter((msg) => msg.includes('stale plan review action')).length).toBe(3);

    // None of the rejected payloads resolved their pending decisions.
    expect(logs.some((msg) => msg.includes('Plan approved via inline review'))).toBe(false);
    expect(logs.some((msg) => msg.includes('Plan rejected via inline review'))).toBe(false);

    // The current round still resolves when its exact reviewId is echoed.
    const data = await (
      extension as unknown as {
        getUIExtensionData: (componentId: string, context: never) => Promise<{ reviewId: string } | null>;
      }
    ).getUIExtensionData('plannotator-plan-review', context) as { reviewId: string } | null;
    expect(data?.reviewId).toBeTruthy();
    const accepted = await executeUIExtensionAction(
      'plannotator-plan-review',
      'approve',
      [{ feedback: 'current id works', reviewId: data!.reviewId }],
      context,
    );
    expect(accepted).toEqual({ ok: true });
    // Wait: the LAST runInlinePlanReview was task-3 (empty echo); the current
    // round resolves via its real reviewId.
    await expect(pendingEmptyEcho).resolves.toEqual({ approved: true, feedback: 'current id works' });
    // The earlier stale rounds were superseded (disposed) by the newer ones,
    // so they never resolve a decision via their rejected payloads.
    expect(logs.filter((msg) => msg.includes('Plan approved via inline review')).length).toBe(1);
  });

  it('resolves a pending decision as aborted when the task closes', async () => {
    const extension = new PlannotatorExtension();
    const context = {
      getTaskContext: () => ({ data: { id: 'task-1' } }),
      triggerUIDataRefresh: () => undefined,
      log: () => undefined,
    } as never;
    const runInlinePlanReview = (
      extension as unknown as {
        runInlinePlanReview: (
          context: never,
          taskId: string,
          plan: string,
          signal?: AbortSignal,
        ) => Promise<{ approved: boolean; feedback?: string } | 'aborted'>;
      }
    ).runInlinePlanReview.bind(extension);

    const pending = runInlinePlanReview(context, 'task-1', '# Plan');
    await (extension as never as { onTaskClosed: (event: never, context: never) => Promise<void> }).onTaskClosed({ task: { id: 'task-1' } } as never, context);
    await expect(pending).resolves.toBe('aborted');

    const pendingDecisions = (extension as unknown as { pendingDecisions: Map<string, unknown> }).pendingDecisions;
    expect(pendingDecisions.get('task-1')).toBeUndefined();
  });

  it.each([
    [42, { approved: true, feedback: '' }],
    [null, { approved: false, feedback: 'Plan rejected' }],
    [{ malicious: 'object' }, { approved: true, feedback: '' }],
    [true, { approved: true, feedback: '' }],
  ])('normalizes non-string feedback %j instead of crashing action dispatch', async (badFeedback, expected) => {
    const extension = new PlannotatorExtension();
    const context = {
      getTaskContext: () => ({ data: { id: 'task-1' } }),
      triggerUIDataRefresh: () => undefined,
      log: () => undefined,
    } as never;

    const runInlinePlanReview = (
      extension as unknown as {
        runInlinePlanReview: (context: never, taskId: string, plan: string) => Promise<unknown>;
      }
    ).runInlinePlanReview.bind(extension);
    const pending = runInlinePlanReview(context, 'task-1', '# Plan');

    const executeUIExtensionAction = (
      extension as unknown as {
        executeUIExtensionAction: (componentId: string, action: string, args: unknown[], context: never) => Promise<unknown>;
      }
    ).executeUIExtensionAction.bind(extension);
    const data = await (
      extension as unknown as {
        getUIExtensionData: (componentId: string, context: never) => Promise<{ reviewId: string } | null>;
      }
    ).getUIExtensionData('plannotator-plan-review', context);
    expect(data?.reviewId).toBeTruthy();

    // Audit regression: a malformed payload (valid reviewId, non-string
    // feedback) used to throw TypeError on .trim() and crash the whole
    // action dispatch. It must instead be normalized to empty feedback and
    // resolve the pending decision normally for the CURRENT round.
    const action = badFeedback === null ? 'deny' : 'approve';
    await expect(executeUIExtensionAction('plannotator-plan-review', action, [{ feedback: badFeedback, reviewId: data!.reviewId }], context)).resolves.toEqual({ ok: true });

    await expect(pending).resolves.toEqual(expected);
  });

  it('trims string feedback from UI actions the same as before the hardening', async () => {
    const extension = new PlannotatorExtension();
    const context = {
      getTaskContext: () => ({ data: { id: 'task-1' } }),
      triggerUIDataRefresh: () => undefined,
      log: () => undefined,
    } as never;

    const runInlinePlanReview = (
      extension as unknown as {
        runInlinePlanReview: (context: never, taskId: string, plan: string) => Promise<unknown>;
      }
    ).runInlinePlanReview.bind(extension);
    const pending = runInlinePlanReview(context, 'task-1', '# Plan');

    const executeUIExtensionAction = (
      extension as unknown as {
        executeUIExtensionAction: (componentId: string, action: string, args: unknown[], context: never) => Promise<unknown>;
      }
    ).executeUIExtensionAction.bind(extension);
    const data = await (
      extension as unknown as {
        getUIExtensionData: (componentId: string, context: never) => Promise<{ reviewId: string } | null>;
      }
    ).getUIExtensionData('plannotator-plan-review', context);

    await executeUIExtensionAction('plannotator-plan-review', 'approve', [{ feedback: '  ship it  ', reviewId: data!.reviewId }], context);
    await expect(pending).resolves.toEqual({ approved: true, feedback: 'ship it' });
  });
});

// helper defined after usage for readability (function hoisting)
function walkFind(element: unknown, type: unknown): Record<string, unknown> | undefined {
  let found: Record<string, unknown> | undefined;
  walk(element, (el) => {
    if (el.type === type) {
      found = el.props ?? undefined;
    }
  });
  return found;
}

/**
 * Plannotator Pi extension utilities.
 *
 * Checklist parsing and progress tracking helpers.
 * (No access to pi-mono's plan-mode/utils at runtime.)
 */

import os from 'node:os';

// ── Network Detection ────────────────────────────────────────────────────

let cachedLocalAddress: string | null = null;

/**
 * Auto-detect the best local address for serving the plan review UI.
 *
 * Priority:
 * 1. First non-internal IPv4 address from os.networkInterfaces()
 * 2. Fall back to 'localhost'
 *
 * Result is cached for the process lifetime.
 */
export const getLocalAddress = (): string => {
  if (cachedLocalAddress !== null) {
    return cachedLocalAddress;
  }

  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const entries = interfaces[name];
    if (!entries) continue;

    for (const entry of entries) {
      if (entry.family === 'IPv4' && !entry.internal) {
        cachedLocalAddress = entry.address;
        return cachedLocalAddress;
      }
    }
  }

  cachedLocalAddress = 'localhost';
  return cachedLocalAddress;
};

// ── Checklist Parsing ────────────────────────────────────────────────────

export interface ChecklistItem {
  /** 1-based step number, compatible with markCompletedSteps/extractDoneSteps. */
  step: number;
  text: string;
  completed: boolean;
}

/**
 * Parse standard markdown checkboxes from file content.
 *
 * Matches lines like:
 *   - [ ] Step description
 *   - [x] Completed step
 *   * [ ] Alternative bullet
 */
export const parseChecklist = (content: string): ChecklistItem[] => {
  const items: ChecklistItem[] = [];
  const pattern = /^[-*]\s*\[([ xX])\]\s+(.+)$/gm;

  for (const match of content.matchAll(pattern)) {
    const completed = match[1] !== ' ';
    const text = match[2].trim();
    if (text.length > 0) {
      items.push({ step: items.length + 1, text, completed });
    }
  }
  return items;
};

// ── Progress Tracking ────────────────────────────────────────────────────

export const extractDoneSteps = (message: string): number[] => {
  const steps: number[] = [];
  for (const match of message.matchAll(/\[DONE:(\d+)\]/gi)) {
    const step = Number(match[1]);
    if (Number.isFinite(step)) {
      steps.push(step);
    }
  }
  return steps;
};

export const markCompletedSteps = (text: string, items: ChecklistItem[]): number => {
  const doneSteps = extractDoneSteps(text);
  for (const step of doneSteps) {
    const item = items.find((t) => t.step === step);
    if (item) {
      item.completed = true;
    }
  }
  return doneSteps.length;
};

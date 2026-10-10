import { autocompletion, selectedCompletion, setSelectedCompletion, startCompletion } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { acceptPathSegment } from '../acceptPathSegment';
import { wordCompletions } from '../wordCompletions';

const path = 'packages/extensions/extensions/programmatic-tool-calls/index.ts';
let view: EditorView | undefined;

afterEach(() => {
  view?.destroy();
  view = undefined;
});

const createEditor = async (doc: string, cursor: number, from: number) => {
  const source = vi.fn(async () => wordCompletions(from, [], [path]));
  const editor = new EditorView({
    state: EditorState.create({
      doc,
      selection: { anchor: cursor },
      extensions: [autocompletion({ override: [source], selectOnOpen: false })],
    }),
    parent: document.body,
  });
  view = editor;
  startCompletion(editor);
  await waitFor(() => expect(editor.dom.querySelector('.cm-tooltip-autocomplete')).not.toBeNull());
  editor.dispatch({ effects: setSelectedCompletion(0) });
  return { editor, source, selected: selectedCompletion(editor.state) };
};

describe('acceptPathSegment', () => {
  it('replaces a fuzzy token with the first directory and retains selection across subsequent steps', async () => {
    const { editor, source, selected } = await createEditor('programma', 9, 0);
    for (const expected of ['packages/', 'packages/extensions/', 'packages/extensions/extensions/']) {
      expect(acceptPathSegment(editor, false)).toBe(true);
      expect(editor.state.doc.toString()).toBe(expected);
      expect(selectedCompletion(editor.state)).toBe(selected);
    }
    expect(source).toHaveBeenCalledTimes(1);
  });

  it('preserves surrounding text and the mention marker', async () => {
    const doc = 'look at @programma please';
    const { editor, selected } = await createEditor(doc, 18, 9);
    expect(acceptPathSegment(editor, true)).toBe(true);
    expect(editor.state.doc.toString()).toBe('look at @packages/ please');
    expect(editor.state.selection.main.head).toBe(18);
    expect(selectedCompletion(editor.state)).toBe(selected);
    expect(acceptPathSegment(editor, true)).toBe(true);
    expect(editor.state.doc.toString()).toBe('look at @packages/extensions/ please');
  });

  it('extends a matching prefix rather than replacing it with the first directory', async () => {
    const prefix = 'packages/ext';
    const { editor } = await createEditor(prefix, prefix.length, 0);
    expect(acceptPathSegment(editor, false)).toBe(true);
    expect(editor.state.doc.toString()).toBe('packages/extensions/');
  });

  it('does not change text without a selected completion', async () => {
    const { editor } = await createEditor('programma', 9, 0);
    editor.dispatch({ effects: setSelectedCompletion(-1) });
    expect(acceptPathSegment(editor, false)).toBe(false);
    expect(editor.state.doc.toString()).toBe('programma');
  });
});

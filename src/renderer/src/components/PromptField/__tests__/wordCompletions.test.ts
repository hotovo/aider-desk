import { autocompletion, currentCompletions, selectedCompletion, setSelectedCompletion, startCompletion } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { wordCompletions } from '../wordCompletions';

const files = ['src/main/task.ts', 'src/renderer/components/PromptField.tsx'];
let view: EditorView | undefined;

afterEach(() => {
  view?.destroy();
  view = undefined;
});

const createEditor = async () => {
  const source = vi.fn(async () => wordCompletions(0, [], files));
  const editor = new EditorView({
    state: EditorState.create({
      doc: 's',
      selection: { anchor: 1 },
      extensions: [autocompletion({ override: [source], selectOnOpen: false })],
    }),
    parent: document.body,
  });
  view = editor;
  startCompletion(editor);
  await waitFor(() => expect(currentCompletions(editor.state)).toHaveLength(2));
  const index = currentCompletions(editor.state).findIndex((completion) => completion.label === files[1]);
  editor.dispatch({ effects: setSelectedCompletion(index) });
  return { editor, source, selected: selectedCompletion(editor.state) };
};

const typeText = (editor: EditorView, insert: string) => {
  const cursor = editor.state.selection.main.head;
  editor.dispatch({
    changes: { from: cursor, insert },
    selection: { anchor: cursor + insert.length },
    userEvent: 'input.type',
  });
};

describe('word completions', () => {
  it('preserves the selected completion while typing and filtering', async () => {
    const { editor, source, selected } = await createEditor();
    for (const character of 'rc/renderer') {
      typeText(editor, character);
      expect(selectedCompletion(editor.state)).toBe(selected);
    }
    expect(currentCompletions(editor.state)).toHaveLength(1);
    expect(source).toHaveBeenCalledTimes(1);
  });

  it('preserves selection across repeated path-segment inserts', async () => {
    const { editor, source, selected } = await createEditor();
    for (const segment of ['rc/', 'renderer/', 'components/']) {
      typeText(editor, segment);
      expect(selectedCompletion(editor.state)).toBe(selected);
    }
    expect(editor.state.doc.toString()).toBe('src/renderer/components/');
    expect(source).toHaveBeenCalledTimes(1);
  });

  it('clears selection when the selected completion no longer matches', async () => {
    const { editor } = await createEditor();
    typeText(editor, 'rc/main');
    expect(selectedCompletion(editor.state)).toBeNull();
    expect(currentCompletions(editor.state).map((completion) => completion.label)).toEqual([files[0]]);
  });
});

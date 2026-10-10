import { acceptCompletion, completionStatus, selectedCompletion } from '@codemirror/autocomplete';
import { type EditorView } from '@codemirror/view';

export const acceptPathSegment = (view: EditorView, mentionMode: boolean): boolean => {
  const { state } = view;
  if (completionStatus(state) !== 'active' || !state.selection.main.empty) {
    return false;
  }
  const completion = selectedCompletion(state);
  if (!completion) {
    return false;
  }
  const cursor = state.selection.main.head;
  if (/\S/.test(state.doc.sliceString(cursor, cursor + 1))) {
    return false;
  }
  const word = state.doc.sliceString(0, cursor).match(/\S*$/)?.[0] ?? '';
  const prefix = mentionMode && word.startsWith('@') ? word.slice(1) : word;
  if (!prefix) {
    return false;
  }
  const matchesPrefix = completion.label.startsWith(prefix);
  const offset = matchesPrefix ? prefix.length : 0;
  const slashIndex = completion.label.indexOf('/', offset);
  if (slashIndex === -1) {
    return acceptCompletion(view);
  }
  const from = matchesPrefix ? cursor : cursor - prefix.length;
  const insert = completion.label.slice(offset, slashIndex + 1);
  view.dispatch({
    changes: { from, to: cursor, insert },
    selection: { anchor: from + insert.length },
    userEvent: 'input.type',
  });
  return true;
};

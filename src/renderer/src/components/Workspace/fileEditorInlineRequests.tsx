import { createRoot, type Root } from 'react-dom/client';
import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import { StateField, type Text } from '@codemirror/state';

import { InlineChangeRequest } from './InlineChangeRequest';

import type { Extension } from '@uiw/react-codemirror';

type ChangeRequest = {
  id: string;
  position: number;
  comment: string;
};

type Options = {
  changeRequests: ChangeRequest[];
  editLabel: string;
  deleteLabel: string;
  onEdit: (id: string, rect: DOMRect) => void;
  onRemove: (id: string) => void;
};

const widgetRoots = new WeakMap<HTMLElement, Root>();

class InlineChangeRequestWidget extends WidgetType {
  constructor(
    private readonly changeRequest: ChangeRequest,
    private readonly editLabel: string,
    private readonly deleteLabel: string,
    private readonly onEdit: Options['onEdit'],
    private readonly onRemove: Options['onRemove'],
  ) {
    super();
  }

  eq(other: WidgetType): boolean {
    return (
      other instanceof InlineChangeRequestWidget &&
      other.changeRequest.id === this.changeRequest.id &&
      other.changeRequest.comment === this.changeRequest.comment &&
      other.editLabel === this.editLabel &&
      other.deleteLabel === this.deleteLabel &&
      other.onEdit === this.onEdit &&
      other.onRemove === this.onRemove
    );
  }

  toDOM(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'cm-inline-change-request';

    const root = createRoot(container);
    widgetRoots.set(container, root);
    root.render(
      <InlineChangeRequest
        comment={this.changeRequest.comment}
        editLabel={this.editLabel}
        deleteLabel={this.deleteLabel}
        onEdit={(rect) => this.onEdit(this.changeRequest.id, rect)}
        onRemove={() => this.onRemove(this.changeRequest.id)}
      />,
    );

    return container;
  }

  destroy(dom: HTMLElement): void {
    const root = widgetRoots.get(dom);
    widgetRoots.delete(dom);
    queueMicrotask(() => root?.unmount());
  }

  ignoreEvent(): boolean {
    return true;
  }
}

const createDecorations = (document: Text, options: Options) => {
  const decorations = options.changeRequests.map((changeRequest) => {
    const position = Math.min(changeRequest.position, document.length);
    const line = document.lineAt(position);
    const widget = new InlineChangeRequestWidget(changeRequest, options.editLabel, options.deleteLabel, options.onEdit, options.onRemove);

    return Decoration.widget({ widget, block: true, side: 1 }).range(line.to);
  });

  return Decoration.set(decorations, true);
};

export const createInlineChangeRequestsExtension = (options: Options): Extension => {
  const field = StateField.define({
    create: (state) => createDecorations(state.doc, options),
    update: (decorations, transaction) => decorations.map(transaction.changes),
    provide: (stateField) => EditorView.decorations.from(stateField),
  });

  return field;
};

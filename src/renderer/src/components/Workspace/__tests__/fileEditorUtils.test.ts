import { describe, expect, it } from 'vitest';

import { remapLineAnchors } from '../fileEditorUtils';

const getLineNumber = (content: string, position: number) => content.slice(0, position).split('\n').length;

describe('remapLineAnchors', () => {
  it('moves an anchor when lines are inserted before it', () => {
    const content = 'new\nfirst\nsecond';
    const anchors = [{ id: 'comment-1', position: 6, lineNumber: 2 }];

    const result = remapLineAnchors(
      anchors,
      (position) => position + 4,
      (position) => getLineNumber(content, position),
    );

    expect(result).toEqual([{ id: 'comment-1', position: 10, lineNumber: 3 }]);
  });

  it('keeps additional anchor data while mapping deleted content to a surviving line', () => {
    const content = 'first\nthird';
    const anchors = [{ id: 'comment-1', position: 13, lineNumber: 3, comment: 'Update this' }];

    const result = remapLineAnchors(
      anchors,
      () => 6,
      (position) => getLineNumber(content, position),
    );

    expect(result).toEqual([{ id: 'comment-1', position: 6, lineNumber: 2, comment: 'Update this' }]);
  });
});

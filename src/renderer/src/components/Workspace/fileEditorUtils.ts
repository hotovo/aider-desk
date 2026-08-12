type LineAnchor = {
  position: number;
  lineNumber: number;
};

export const remapLineAnchors = <T extends LineAnchor>(
  anchors: T[],
  mapPosition: (position: number) => number,
  getLineNumber: (position: number) => number,
): T[] =>
  anchors.map((anchor) => {
    const position = mapPosition(anchor.position);
    return {
      ...anchor,
      position,
      lineNumber: getLineNumber(position),
    };
  });

export const getVirtualizedListBottomOffset = (element: HTMLElement) => {
  const content = element.querySelector('.legend-list-content-container') as HTMLElement | null;
  const temporaryPadding = parseFloat(content?.style.paddingBottom ?? '') || 0;
  return Math.max(0, element.scrollHeight - element.clientHeight - temporaryPadding);
};

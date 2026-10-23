export interface MenuAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getAnchoredMenuLayout(
  anchor: MenuAnchor,
  windowWidth: number,
  windowHeight: number,
  insets: { left: number; right: number; top: number; bottom: number },
  alignLeft = false,
) {
  const rightEdge = Math.min(windowWidth - insets.right - 8, anchor.x + anchor.width);
  const availableWidth = alignLeft
    ? windowWidth - insets.right - 8 - anchor.x
    : rightEdge - insets.left - 8;
  const width = Math.min(220, availableWidth);
  return {
    left: alignLeft ? anchor.x : rightEdge - width,
    top: Math.max(
      insets.top + 8,
      Math.min(anchor.y + anchor.height + 8, windowHeight - insets.bottom - 196),
    ),
    width: Math.max(0, width),
  };
}

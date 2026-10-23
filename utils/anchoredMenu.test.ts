import { getAnchoredMenuLayout } from './anchoredMenu';

it.each([
  [390, 844, 220, 36, 110, 32, 0],
  [844, 390, 108, 54, 116, 32, 44],
  [844, 390, 230, 24, 112, 32, 44],
  [1194, 834, 180, 50, 110, 32, 0],
])(
  'aligns the menu with its button in a %i by %i window',
  (width, height, x, y, buttonWidth, buttonHeight, left) => {
    const anchor = { x, y, width: buttonWidth, height: buttonHeight };
    const layout = getAnchoredMenuLayout(anchor, width, height, {
      top: 0,
      bottom: 21,
      left,
      right: 0,
    });
    expect(layout.left + layout.width).toBe(x + buttonWidth);
    expect(layout.left).toBeGreaterThanOrEqual(left + 8);
    expect(layout.top).toBe(y + buttonHeight + 8);
  },
);

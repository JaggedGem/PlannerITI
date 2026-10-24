import {
  candidateColors,
  contrast,
  fromLch,
  hueDistance,
  labDistance,
  subjectPresentation,
  toLab,
  toLch,
  validColor,
} from './colorSpace';
import { semanticPreference, subjectColorId } from './semantics';

it('matches reference OKLab primary coordinates and round trips in-gamut sRGB', () => {
  const red = toLab('#ff0000');
  expect(red.l).toBeCloseTo(0.627955, 5);
  expect(red.a).toBeCloseTo(0.224863, 5);
  expect(red.b).toBeCloseTo(0.125846, 5);
  for (const color of ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000', '#638bdf']) {
    expect(labDistance(toLab(fromLch(toLch(color))), toLab(color))).toBeLessThan(0.004);
  }
  expect(contrast('#ffffff', '#000000')).toBe(21);
  expect(hueDistance(350, 10)).toBe(20);
});

it('gamut maps by reducing chroma while preserving hue', () => {
  const mapped = fromLch({ l: 0.72, c: 0.8, h: 130 });
  expect(validColor(mapped)).toBe(true);
  expect(hueDistance(toLch(mapped).h, 130)).toBeLessThan(1);
});

it('expands deterministically beyond 20 subjects without duplicate colors', () => {
  const colors = candidateColors(80);
  expect(colors.length).toBeGreaterThanOrEqual(88);
  expect(new Set(colors).size).toBe(colors.length);
  expect(colors.every(validColor)).toBe(true);
  expect(candidateColors(80)).toEqual(colors);
});

it.each(['dark', 'light'] as const)(
  'keeps all weekly gradient endpoints readable in %s mode',
  (theme) => {
    for (const color of [...candidateColors(30), '#ffcc00', '#ffffff', '#000000', '#0000ff']) {
      const shown = subjectPresentation(color, theme);
      expect(shown.accent).toBe(color);
      for (const endpoint of shown.gradient) {
        expect(validColor(endpoint)).toBe(true);
        expect(contrast(endpoint, shown.foreground)).toBeGreaterThanOrEqual(4.5);
        if (toLch(color).c > 0.025)
          expect(hueDistance(toLch(color).h, toLch(endpoint).h)).toBeLessThan(2);
      }
      for (const fraction of [0.25, 0.5, 0.75]) {
        const channels = [1, 3, 5].map((offset) =>
          Math.round(
            parseInt(shown.gradient[0].slice(offset, offset + 2), 16) * (1 - fraction) +
              parseInt(shown.gradient[1].slice(offset, offset + 2), 16) * fraction,
          )
            .toString(16)
            .padStart(2, '0'),
        );
        expect(contrast('#' + channels.join(''), shown.foreground)).toBeGreaterThanOrEqual(4.5);
      }
    }
  },
);

it('makes generated accents visible on the existing dark daily cards', () => {
  expect(candidateColors(30).every((color) => contrast(color, '#1a1a1a') >= 3)).toBe(true);
});

it('recognizes explicit Romanian/English aliases without broad substring matches', () => {
  for (const name of ['Matematică', ' Matem. ', 'Math', 'Mathematics'])
    expect(semanticPreference(name)?.hue).toBe(260);
  expect(semanticPreference('L.rom')?.hue).toBe(10);
  expect(semanticPreference('Inform')?.hue).toBe(210);
  for (const name of [
    'Ed.fizica',
    'Pv',
    'Mathematical theatre',
    'Information security',
    'Biographical writing',
  ])
    expect(semanticPreference(name)).toBeUndefined();
  expect(subjectColorId({ name: 'Math', _id: '1' })).not.toBe(
    subjectColorId({ name: 'Math', _id: '2' }),
  );
});

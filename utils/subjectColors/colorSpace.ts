/** OKLab transforms from Björn Ottosson's reference matrices (D65, sRGB). */
export interface Lab {
  l: number;
  a: number;
  b: number;
}

export interface Lch {
  l: number;
  c: number;
  h: number;
}

export const validColor = (value: unknown): value is string =>
  typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);

const linear = (value: number) =>
  value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const encoded = (value: number) =>
  value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;

export function toLab(hex: string): Lab {
  const rgb = [1, 3, 5].map((offset) => linear(parseInt(hex.slice(offset, offset + 2), 16) / 255));
  const [r, g, b] = rgb;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

export function toLch(hex: string): Lch {
  const { l, a, b } = toLab(hex);
  return { l, c: Math.hypot(a, b), h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 };
}

export const labDistance = (a: Lab, b: Lab) => Math.hypot(a.l - b.l, a.a - b.a, a.b - b.b);
export const hueDistance = (a: number, b: number) => {
  const delta = Math.abs(a - b) % 360;
  return Math.min(delta, 360 - delta);
};

function linearRgb({ l, c, h }: Lch): number[] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const ll = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * ll - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * ll + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * ll - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** Reduce chroma at constant hue/lightness; never clip RGB channels to invent a hue. */
export function fromLch(color: Lch): string {
  let low = 0;
  let high = Math.max(0, color.c);
  const l = Math.max(0, Math.min(1, color.l));
  let rgb = linearRgb({ ...color, l });
  const inGamut = (channels: number[]) => channels.every((v) => v >= -1e-7 && v <= 1.0000001);
  if (!inGamut(rgb)) {
    for (let step = 0; step < 20; step++) {
      const c = (low + high) / 2;
      if (inGamut(linearRgb({ ...color, l, c }))) low = c;
      else high = c;
    }
    rgb = linearRgb({ ...color, l, c: low });
  }
  return (
    '#' +
    rgb
      .map((v) =>
        Math.round(Math.max(0, Math.min(1, encoded(v))) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

export function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => linear(parseInt(hex.slice(i, i + 2), 16) / 255));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export interface SubjectPresentation {
  accent: string;
  background: string;
  gradient: readonly [string, string];
  foreground: string;
}

const presentationCache = new Map<string, SubjectPresentation>();

/** Both schedules currently use dark surfaces, irrespective of the OS theme. */
export function subjectPresentation(
  identity: string,
  theme: 'dark' | 'light' = 'dark',
): SubjectPresentation {
  const color = validColor(identity) ? identity.toLowerCase() : '#638bdf';
  const key = `${theme}:${color}`;
  const cached = presentationCache.get(key);
  if (cached) return cached;
  const lch = toLch(color);
  const foreground = theme === 'dark' ? '#ffffff' : '#11181c';
  let l = theme === 'dark' ? 0.52 : 0.86;
  let background = fromLch({ ...lch, l, c: Math.min(lch.c, 0.15) });
  while (contrast(background, foreground) < 4.6 && l > 0.15 && l < 0.96) {
    l += theme === 'dark' ? -0.01 : 0.01;
    background = fromLch({ ...lch, l, c: Math.min(lch.c, 0.15) });
  }
  const end = fromLch({
    ...lch,
    l: l + (theme === 'dark' ? -0.045 : 0.025),
    c: Math.min(lch.c, 0.15),
  });
  const result = { accent: color, background, gradient: [background, end] as const, foreground };
  // Bound transient colors while retaining all candidates for a normal timetable.
  if (presentationCache.size > 1024) presentationCache.clear();
  presentationCache.set(key, result);
  return result;
}

/** 24 curated hues; expand with a golden-angle sequence and bounded intensity. */
export function candidateColors(count: number): string[] {
  const colors = new Set<string>();
  for (let i = 0; i < 24; i++) colors.add(fromLch({ l: 0.72, c: 0.15, h: i * 15 }));
  for (let i = 0; colors.size < Math.max(24, count + 8); i++) {
    const color = fromLch({
      l: 0.68 + (i % 3) * 0.035,
      c: 0.12 + (i % 2) * 0.035,
      h: (i * 137.507764 + 7.5) % 360,
    });
    // Prefer candidates distinct from existing colors, relax once the gamut gets crowded.
    const lab = toLab(color);
    if (i > count * 12 || [...colors].every((v) => labDistance(toLab(v), lab) > 0.018))
      colors.add(color);
  }
  return [...colors];
}

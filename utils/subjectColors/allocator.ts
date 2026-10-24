import {
  candidateColors,
  hueDistance,
  labDistance,
  subjectPresentation,
  toLab,
  toLch,
  validColor,
} from './colorSpace';
import { ColorLayout, ConflictEdge, buildConflictGraph, compareIds } from './layout';
import { semanticPreference } from './semantics';

export interface ColorAssignment {
  color: string;
  locked?: boolean;
}
export type ColorAssignments = Record<string, ColorAssignment>;
export const ALLOCATION_SETTINGS = {
  hueTarget: 50,
  distanceTarget: 0.09,
  neutralChroma: 0.025,
  stabilityWeight: 220,
  semanticWeight: 24,
  duplicateWeight: 300,
  worstConflictWeight: 8,
  maxPasses: 10,
};
type Settings = typeof ALLOCATION_SETTINGS;
interface PairCost {
  severe: number;
  cost: number;
  hue: number | null;
  distance: number;
}

export function colorConflict(
  a: string,
  b: string,
  settings: Settings = ALLOCATION_SETTINGS,
): PairCost {
  // Compare actual opaque weekly card backgrounds, not bright identity accents.
  const first = subjectPresentation(a).background;
  const second = subjectPresentation(b).background;
  const distance = labDistance(toLab(first), toLab(second));
  const aa = toLch(first);
  const bb = toLch(second);
  const hue = Math.min(aa.c, bb.c) < settings.neutralChroma ? null : hueDistance(aa.h, bb.h);
  const severe = distance < 0.018 || (hue !== null && hue < 10) ? 1 : 0;
  const hueCost = hue === null ? 0 : 16 * Math.max(0, 1 - hue / settings.hueTarget) ** 2;
  const distanceCost = 8 * Math.max(0, 1 - distance / settings.distanceTarget) ** 2;
  return { severe, cost: hueCost + distanceCost, hue, distance };
}

const hash = (value: string) => {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 16777619);
  return result >>> 0;
};
type Score = readonly [severe: number, cost: number];
const better = (a: Score, b: Score) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1] - 1e-7);

/** Weighted DSATUR, followed by bounded best-improvement reassignments and swaps.
 * Severe collisions are lexicographically worse than every soft preference.
 * A squared worst-pair term prevents many easy edges hiding one poor pair.
 */
export function allocateSubjectColors(
  layout: ColorLayout,
  previous: ColorAssignments = {},
  options: { rebalance?: boolean; settings?: Partial<Settings>; edges?: ConflictEdge[] } = {},
): ColorAssignments {
  const settings = { ...ALLOCATION_SETTINGS, ...options.settings };
  const subjects = [
    ...new Map(
      layout.subjects
        .filter((s) => typeof s.id === 'string' && s.id && typeof s.name === 'string')
        .map((s) => [s.id, s]),
    ).values(),
  ].sort((a, b) => compareIds(a.id, b.id));
  const n = subjects.length;
  if (!n) return {};
  const ids = new Map(subjects.map((s, i) => [s.id, i]));
  const colors = candidateColors(n);
  const colorIndex = (color: string) => {
    const value = color.toLowerCase();
    let index = colors.indexOf(value);
    if (index < 0) {
      index = colors.length;
      colors.push(value);
    }
    return index;
  };
  const locked = subjects.map(
    (s) =>
      validColor(s.lockedColor) ||
      (previous[s.id]?.locked === true && validColor(previous[s.id]?.color)),
  );
  const existing = subjects.map((s) => {
    const color = validColor(s.lockedColor) ? s.lockedColor : previous[s.id]?.color;
    return validColor(color) ? colorIndex(color) : -1;
  });
  const assigned = existing.map((color, i) => (locked[i] || !options.rebalance ? color : -1));
  const edges = (options.edges || buildConflictGraph(layout)).flatMap((edge) => {
    const a = ids.get(edge.a);
    const b = ids.get(edge.b);
    return a === undefined || b === undefined || a === b ? [] : [{ a, b, weight: edge.weight }];
  });
  const neighbors = subjects.map(() => [] as { node: number; weight: number }[]);
  for (const edge of edges) {
    neighbors[edge.a].push({ node: edge.b, weight: edge.weight });
    neighbors[edge.b].push({ node: edge.a, weight: edge.weight });
  }
  const degree = neighbors.map((list) => list.reduce((sum, edge) => sum + edge.weight, 0));
  const preferences = subjects.map((s) => semanticPreference(s.name));
  const costs = colors.map((a) => colors.map((b) => colorConflict(a, b, settings)));
  const unary = subjects.map((subject, i) =>
    colors.map((color, index) => {
      const preference = preferences[i];
      const semantic = preference
        ? settings.semanticWeight *
          preference.strength *
          (hueDistance(toLch(color).h, preference.hue) / 180) ** 2
        : 0;
      const stability =
        !options.rebalance && existing[i] >= 0 && existing[i] !== index
          ? settings.stabilityWeight
          : 0;
      return semantic + stability + (hash(`${subject.id}:${color}`) / 0xffffffff) * 0.02;
    }),
  );

  // Scores reuse all color-space calculations. The bounded search remains small
  // for the expected <=30 subjects and is kept outside component rendering.
  const score = (): Score => {
    let severe = 0;
    let total = 0;
    let worst = 0;
    for (const edge of edges) {
      const a = assigned[edge.a];
      const b = assigned[edge.b];
      if (a < 0 || b < 0) continue;
      const pair = costs[a][b];
      severe += pair.severe;
      total += pair.cost * edge.weight;
      worst = Math.max(worst, pair.cost);
    }
    for (let i = 0; i < n; i++) {
      if (assigned[i] < 0) continue;
      total += unary[i][assigned[i]];
      for (let j = 0; j < i; j++) {
        if (assigned[i] === assigned[j]) total += settings.duplicateWeight;
      }
    }
    return [severe, total + settings.worstConflictWeight * worst ** 2];
  };

  while (assigned.some((v) => v < 0)) {
    let selected = -1;
    let priority: number[] = [];
    for (let i = 0; i < n; i++) {
      if (assigned[i] >= 0) continue;
      const saturation = new Set(
        neighbors[i]
          .filter((edge) => assigned[edge.node] >= 0)
          .map((edge) => Math.floor(toLch(colors[assigned[edge.node]]).h / 45)),
      ).size;
      const rank = [saturation, degree[i], preferences[i]?.strength || 0];
      if (
        selected < 0 ||
        rank[0] > priority[0] ||
        (rank[0] === priority[0] &&
          (rank[1] > priority[1] || (rank[1] === priority[1] && rank[2] > priority[2])))
      ) {
        selected = i;
        priority = rank;
      }
    }
    let best: Score = [Infinity, Infinity];
    let chosen = 0;
    for (let c = 0; c < colors.length; c++) {
      assigned[selected] = c;
      const value = score();
      if (better(value, best)) {
        best = value;
        chosen = c;
      }
    }
    assigned[selected] = chosen;
  }

  for (let pass = 0; pass < settings.maxPasses; pass++) {
    let best = score();
    let change: { a: number; color: number; b?: number } | undefined;
    for (let i = 0; i < n; i++) {
      if (locked[i]) continue;
      const old = assigned[i];
      for (let c = 0; c < colors.length; c++) {
        if (c === old) continue;
        assigned[i] = c;
        const value = score();
        if (better(value, best)) {
          best = value;
          change = { a: i, color: c };
        }
      }
      assigned[i] = old;
      for (let j = i + 1; j < n; j++) {
        if (locked[j] || old === assigned[j]) continue;
        const other = assigned[j];
        assigned[i] = other;
        assigned[j] = old;
        const value = score();
        if (better(value, best)) {
          best = value;
          change = { a: i, color: other, b: j };
        }
        assigned[i] = old;
        assigned[j] = other;
      }
    }
    if (!change) break;
    if (change.b !== undefined) assigned[change.b] = assigned[change.a];
    assigned[change.a] = change.color;
  }
  return Object.fromEntries(
    subjects.map((s, i) => [
      s.id,
      { color: colors[assigned[i]], ...(locked[i] ? { locked: true } : {}) },
    ]),
  );
}

export function allocationDiagnostics(layout: ColorLayout, assignments: ColorAssignments) {
  let exactConflicts = 0;
  let similarHueConflicts = 0;
  let weightedCost = 0;
  let minDistance = Infinity;
  let minHueDistance = Infinity;
  for (const edge of buildConflictGraph(layout)) {
    const a = assignments[edge.a]?.color;
    const b = assignments[edge.b]?.color;
    if (!validColor(a) || !validColor(b)) continue;
    const pair = colorConflict(a, b);
    if (a === b) exactConflicts++;
    if (pair.hue !== null && pair.hue < ALLOCATION_SETTINGS.hueTarget) similarHueConflicts++;
    weightedCost += pair.cost * edge.weight;
    minDistance = Math.min(minDistance, pair.distance);
    if (pair.hue !== null) minHueDistance = Math.min(minHueDistance, pair.hue);
  }
  return { exactConflicts, similarHueConflicts, weightedCost, minDistance, minHueDistance };
}

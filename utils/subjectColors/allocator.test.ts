import { sampleSchedule } from '@/test/subjectColorFixtures';

import { allocateSubjectColors, allocationDiagnostics, colorConflict } from './allocator';
import { candidateColors, hueDistance, toLch, validColor } from './colorSpace';
import { ColorLayout, normalizeColorLayout } from './layout';

const sparse = (): ColorLayout => ({
  subjects: ['Math', 'Biology', 'Chemistry', 'History', 'Physics'].map((name) => ({
    id: name,
    name,
  })),
  occurrences: ['Math', 'Biology', 'Chemistry', 'History', 'Physics'].map((subjectId, day) => ({
    subjectId,
    day,
    start: 480,
    end: 560,
    variant: 'both',
  })),
});

export function denseLayout(count: number): ColorLayout {
  return {
    subjects: Array.from({ length: count }, (_, i) => ({ id: `s${i}`, name: `Subject ${i}` })),
    occurrences: Array.from({ length: count }, (_, i) => ({
      subjectId: `s${i}`,
      day: 0,
      start: 480,
      end: 560,
      variant: 'both',
    })),
  };
}

it('assigns zero, one and more than 20 subjects deterministically', () => {
  expect(allocateSubjectColors({ subjects: [], occurrences: [] })).toEqual({});
  for (const count of [1, 5, 20, 30]) {
    const layout = denseLayout(count);
    const first = allocateSubjectColors(layout);
    expect(Object.keys(first)).toHaveLength(count);
    expect(Object.values(first).every((v) => validColor(v.color))).toBe(true);
    expect(allocateSubjectColors(layout)).toEqual(first);
    expect(allocationDiagnostics(layout, first).exactConflicts).toBe(0);
  }
});

it('ignores incidental source, subject and occurrence order', () => {
  const layout = normalizeColorLayout(sampleSchedule(), 'Subgroup 1');
  const first = allocateSubjectColors(layout);
  expect(
    allocateSubjectColors({
      subjects: [...layout.subjects].reverse(),
      occurrences: [...layout.occurrences].reverse(),
    }),
  ).toEqual(first);
});

it('separates sparse spatial neighbors and retains semantic preferences when possible', () => {
  const layout = sparse();
  const result = allocateSubjectColors(layout);
  const metrics = allocationDiagnostics(layout, result);
  expect(metrics.exactConflicts).toBe(0);
  expect(metrics.similarHueConflicts).toBe(0);
  expect(metrics.minDistance).toBeGreaterThan(0.09);
  expect(hueDistance(toLch(result.Math.color).h, 260)).toBeLessThan(20);
});

it('yields a semantic preference to spatial distinction around a locked neighbor', () => {
  const blue = candidateColors(1)[17]; // 255 degrees: preferred mathematical blue.
  const layout: ColorLayout = {
    subjects: [
      { id: 'math', name: 'Math' },
      { id: 'locked', name: 'Unknown', lockedColor: blue },
    ],
    occurrences: ['math', 'locked'].map((subjectId, day) => ({
      subjectId,
      day,
      start: 480,
      end: 560,
      variant: 'both',
    })),
  };
  const result = allocateSubjectColors(layout);
  expect(result.locked.color).toBe(blue);
  expect(colorConflict(blue, result.math.color).hue).toBeGreaterThanOrEqual(49);
});

it('preserves conflicting locked colors and safely handles near-neutral overrides', () => {
  const layout = denseLayout(5);
  layout.subjects[0].lockedColor = '#6699ff';
  layout.subjects[1].lockedColor = '#6699ff';
  layout.subjects[2].lockedColor = '#777777';
  const result = allocateSubjectColors(layout, {}, { rebalance: true });
  expect(result.s0).toEqual({ color: '#6699ff', locked: true });
  expect(result.s1).toEqual(result.s0);
  expect(result.s2.color).toBe('#777777');
  expect(colorConflict('#777777', '#888888').hue).toBeNull();
});

it('retains assignments through reloads, insertions, renames and a small timetable move', () => {
  const layout = sparse();
  const before = allocateSubjectColors(layout);
  expect(allocateSubjectColors(layout, before)).toEqual(before);
  const added = { ...layout, subjects: [...layout.subjects, { id: 'new', name: 'New subject' }] };
  const after = allocateSubjectColors(added, before);
  for (const id of Object.keys(before)) expect(after[id]).toEqual(before[id]);
  layout.occurrences[0].start += 5;
  layout.occurrences[0].end += 5;
  layout.subjects[0].name = 'Matematica';
  expect(allocateSubjectColors(layout, before)).toEqual(before);
});

it('repairs a new collision with limited recoloring and supports a full rebalance', () => {
  const layout = sparse();
  const previous = allocateSubjectColors(layout);
  previous.Biology.color = previous.Math.color;
  const normal = allocateSubjectColors(layout, previous);
  expect(colorConflict(normal.Math.color, normal.Biology.color).severe).toBe(0);
  expect(
    Object.keys(normal).filter((id) => normal[id].color !== previous[id].color).length,
  ).toBeLessThanOrEqual(2);
  const balanced = allocateSubjectColors(layout, previous, { rebalance: true });
  expect(allocationDiagnostics(layout, balanced).weightedCost).toBeLessThanOrEqual(
    allocationDiagnostics(layout, previous).weightedCost,
  );
});

it('improves the screenshot timetable over its former hash palette', () => {
  const layout = normalizeColorLayout(sampleSchedule(), 'Subgroup 1');
  const palette = [
    '#4361EE',
    '#F72585',
    '#4CC9F0',
    '#7209B7',
    '#3A86FF',
    '#FB5607',
    '#06D6A0',
    '#FFBE0B',
    '#8338EC',
    '#FF006E',
    '#38B000',
    '#FF5400',
  ];
  const old = Object.fromEntries(
    layout.subjects.map((s) => {
      let value = 0;
      for (let i = 0; i < s.name.length; i++) value = s.name.charCodeAt(i) + ((value << 5) - value);
      return [s.id, { color: palette[Math.abs(value) % palette.length].toLowerCase() }];
    }),
  );
  const result = allocateSubjectColors(layout);
  const before = allocationDiagnostics(layout, old);
  const after = allocationDiagnostics(layout, result);
  expect(after.exactConflicts).toBe(0);
  expect(after.weightedCost).toBeLessThan(before.weightedCost);
});

it('preserves invariants on reproducible irregular timetable fixtures', () => {
  let seed = 841;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 0x100000000;
  };
  for (let run = 0; run < 8; run++) {
    const layout = denseLayout(5 + run * 3);
    layout.occurrences = Array.from({ length: 35 }, () => {
      const start = 480 + Math.floor(random() * 6) * 45;
      return {
        subjectId: layout.subjects[Math.floor(random() * layout.subjects.length)].id,
        day: Math.floor(random() * 5),
        start,
        end: start + 30 + Math.floor(random() * 80),
        variant: random() > 0.5 ? 'odd' : 'even',
      };
    });
    const result = allocateSubjectColors(layout);
    expect(Object.keys(result)).toHaveLength(layout.subjects.length);
    expect(Object.values(result).every((entry) => validColor(entry.color))).toBe(true);
    expect(
      allocateSubjectColors({ ...layout, occurrences: [...layout.occurrences].reverse() }),
    ).toEqual(result);
  }
});

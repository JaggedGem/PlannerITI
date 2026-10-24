import type { ApiResponse } from '@/services/scheduleService';
import { sampleSchedule, scheduleItem } from '@/test/subjectColorFixtures';

import { ColorOccurrence, buildConflictGraph, normalizeColorLayout, timeMinutes } from './layout';

const card = (
  subjectId: string,
  day: number,
  start: number,
  end: number,
  variant = 'even',
): ColorOccurrence => ({ subjectId, day, start, end, variant });
const graph = (...occurrences: ColorOccurrence[]) =>
  buildConflictGraph({ subjects: [], occurrences });

it('reproduces all eight neighbors of a regular 3x3 grid', () => {
  const cells = Array.from({ length: 9 }, (_, i) =>
    card(String(i), Math.floor(i / 3), 480 + (i % 3) * 90, 560 + (i % 3) * 90),
  );
  const edges = graph(...cells);
  expect(edges.filter((e) => e.a === '4' || e.b === '4')).toHaveLength(8);
  expect(edges.some((e) => e.a === '0' && e.b === '2')).toBe(false);
  expect(edges.some((e) => e.a === '0' && e.b === '6')).toBe(false);
});

it('uses real overlap, gaps, and irregular durations, irrespective of array index', () => {
  const edges = graph(
    card('long', 1, 480, 660),
    card('short1', 2, 490, 520),
    card('short2', 2, 540, 570),
    card('late', 2, 900, 960),
  );
  expect(
    edges.filter((e) => e.a === 'long' || e.b === 'long').map((e) => [e.a, e.b].join(':')),
  ).toEqual(['long:short1', 'long:short2']);
  expect(graph(card('a', 0, 480, 560), card('b', 0, 600, 680))).toHaveLength(1);
  expect(graph(card('a', 0, 480, 560), card('b', 0, 700, 780))).toHaveLength(0);
  expect(
    buildConflictGraph(
      { subjects: [], occurrences: [card('a', 0, 480, 560), card('b', 0, 600, 680)] },
      { gapMinutes: 20, verticalWeight: 10, horizontalWeight: 10, diagonalWeight: 7 },
    ),
  ).toHaveLength(0);
});

it('unions repeated conflicts with bounded frequency growth and no self edges', () => {
  const once = graph(card('a', 0, 480, 560), card('b', 1, 480, 560))[0];
  const repeated = graph(
    ...Array.from({ length: 30 }, (_, i) => [
      card('a', 0, 480, 560, String(i)),
      card('b', 1, 480, 560, String(i)),
    ]).flat(),
  )[0];
  expect(repeated.count).toBe(30);
  expect(repeated.weight).toBeGreaterThan(once.weight);
  expect(repeated.weight).toBeLessThan(once.weight * 4);
  expect(graph(card('a', 0, 480, 560), card('a', 1, 480, 560))).toEqual([]);
});

it('never compares different week variants or different subgroups', () => {
  expect(graph(card('a', 0, 480, 560, 'odd'), card('b', 1, 480, 560, 'even'))).toEqual([]);
  const data = sampleSchedule();
  data.data.monday['1'] = { par: [scheduleItem('even')], impar: [scheduleItem('odd')], both: [] };
  data.data.tuesday['1'] = { par: [scheduleItem('even neighbor')], impar: [], both: [] };
  const subgroup2 = scheduleItem('group 2');
  subgroup2.groupids.name = 'Grupa 2';
  data.data.monday['1'].both.push(subgroup2);
  const layout = normalizeColorLayout(data, 'Subgroup 1');
  const edges = buildConflictGraph(layout);
  expect(edges.some((e) => e.a === 'name:even' && e.b === 'name:even neighbor')).toBe(true);
  expect(
    edges.some((e) => [e.a, e.b].includes('name:odd') && [e.a, e.b].includes('name:even neighbor')),
  ).toBe(false);
  expect(layout.subjects.some((s) => s.name === 'group 2')).toBe(false);
});

it('includes date overrides, removed slots and Friday/Saturday recovery neighbors', () => {
  const data = sampleSchedule();
  const layout = normalizeColorLayout(
    data,
    'Subgroup 1',
    [],
    [
      {
        date: '2026-10-23',
        sourceDay: 'friday',
        week: 'par',
        periods: [{ index: 0, start: '16:00', end: '17:00' }],
      },
      {
        date: '2026-10-24',
        sourceDay: 'tuesday',
        week: 'par',
        periods: [{ index: 0, start: '16:00', end: '17:00' }],
      },
    ],
  );
  const dated = layout.occurrences.filter((o) => o.variant.startsWith('date:'));
  expect(dated.filter((o) => o.day === 4)).toHaveLength(1);
  expect(dated.filter((o) => o.day === 5)).toHaveLength(1);
  expect(
    buildConflictGraph({ ...layout, occurrences: dated }).some(
      (e) => e.a === 'name:biologia' && e.b === 'name:chimia',
    ),
  ).toBe(true);
});

it('keeps stable IDs distinct despite identical names or renames', () => {
  const data = sampleSchedule();
  data.data.monday['1'].both = [scheduleItem('Math', 'a'), scheduleItem('Math', 'b')];
  const first = normalizeColorLayout(data, 'Subgroup 1');
  expect(first.subjects.filter((s) => s.name === 'Math').map((s) => s.id)).toEqual([
    'id:a',
    'id:b',
  ]);
  data.data.monday['1'].both[0].subjectid.name = 'Matematica';
  expect(
    normalizeColorLayout(data, 'Subgroup 1').subjects.find((s) => s.name === 'Matematica')?.id,
  ).toBe('id:a');
});

it('accounts for minimum rendered height and omitted weekend columns', () => {
  expect(graph(card('short', 0, 480, 481), card('next', 1, 540, 560))).toHaveLength(1);
  const layout = normalizeColorLayout(
    sampleSchedule(),
    'Subgroup 1',
    [],
    [
      {
        date: '2026-10-23',
        sourceDay: 'friday',
        week: 'par',
        periods: [{ index: 0, start: '16:00', end: '17:00' }],
      },
      { date: '2026-10-24', sourceDay: 'saturday', week: 'par', periods: [], visible: false },
      {
        date: '2026-10-25',
        sourceDay: 'tuesday',
        week: 'par',
        periods: [{ index: 0, start: '16:00', end: '17:00' }],
        visible: true,
      },
    ],
  );
  const occurrences = layout.occurrences.filter((o) => o.variant.startsWith('date:'));
  expect(
    buildConflictGraph({ ...layout, occurrences }).some(
      (e) => e.a === 'name:biologia' && e.b === 'name:chimia',
    ),
  ).toBe(true);
});

it('does not count an ordinary cached calendar week as extra conflict information', () => {
  const data = sampleSchedule();
  const original = normalizeColorLayout(data, 'Subgroup 1');
  const withDates = normalizeColorLayout(
    data,
    'Subgroup 1',
    [],
    Object.keys(data.data).map((sourceDay, index) => ({
      date: `2026-10-${19 + index}`,
      sourceDay,
      week: 'par' as const,
      periods: data.periods.map((p, i) => ({ index: i, start: p.starttime, end: p.endtime })),
    })),
  );
  expect(buildConflictGraph(withDates)).toEqual(buildConflictGraph(original));
});

it('normalizes source ordering, skips malformed values and retains subjects with missing times', () => {
  const data = sampleSchedule();
  const original = normalizeColorLayout(data, 'Subgroup 1');
  data.data = Object.fromEntries(Object.entries(data.data).reverse()) as ApiResponse['data'];
  expect(normalizeColorLayout(data, 'Subgroup 1')).toEqual(original);
  data.periods = [];
  expect(normalizeColorLayout(data, 'Subgroup 1').subjects).toHaveLength(original.subjects.length);
  expect(normalizeColorLayout(data, 'Subgroup 1').occurrences).toEqual([]);
  expect(
    normalizeColorLayout(
      {
        data: { monday: { '1': { both: [null], par: null } } },
        periods: null,
      } as unknown as ApiResponse,
      'Subgroup 1',
    ),
  ).toEqual({ subjects: [], occurrences: [] });
  expect(timeMinutes('25:00')).toBeNull();
  expect(timeMinutes('08:61')).toBeNull();
  expect(timeMinutes('08:00:00')).toBe(480);
});

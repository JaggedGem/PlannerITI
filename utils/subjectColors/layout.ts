import { Colors } from '@/constants/Colors';
import type { ApiResponse, CustomPeriod, SubGroupType } from '@/services/scheduleService';
import { isRecord } from '@/utils/json';

import { subjectColorId } from './semantics';

export interface ColorSubject {
  id: string;
  name: string;
  lockedColor?: string;
}
export interface ColorOccurrence {
  subjectId: string;
  day: number;
  start: number;
  end: number;
  variant: string;
}
export interface ColorLayout {
  subjects: ColorSubject[];
  occurrences: ColorOccurrence[];
}
export interface DateColorLayout {
  date: string;
  sourceDay: string;
  week: 'par' | 'impar';
  visible?: boolean;
  periods: { index: number; start: string; end: string }[];
}
export interface ConflictEdge {
  a: string;
  b: string;
  weight: number;
  count: number;
}
export const NEIGHBORHOOD = {
  // Minutes, not array rows/pixels: covers the normal 10-minute break and 40-minute lunch.
  gapMinutes: 45,
  // WeekView renders cards at least 35px high at its 65px/hour phone density.
  minimumDurationMinutes: (35 / 65) * 60,
  verticalWeight: 10,
  horizontalWeight: 10,
  diagonalWeight: 7,
};

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
export const compareIds = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function timeMinutes(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{1,2}:\d{2}(?::\d{2})?$/.test(value)) return null;
  const [hour, minute] = value.split(':').map(Number);
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}

export function normalizeColorLayout(
  data: ApiResponse,
  subgroup: SubGroupType,
  customPeriods: readonly CustomPeriod[] = [],
  dates: readonly DateColorLayout[] = [],
): ColorLayout {
  const subjects = new Map<string, ColorSubject>();
  const occurrences = new Map<string, ColorOccurrence>();
  const source: Record<string, unknown> = isRecord(data?.data) ? data.data : {};
  const periods = Array.isArray(data?.periods) ? data.periods : [];
  const addOccurrence = (
    subject: ColorSubject,
    day: number,
    startValue: unknown,
    endValue: unknown,
    variant: string,
  ) => {
    const existing = subjects.get(subject.id);
    if (!existing || compareIds(subject.name, existing.name) < 0) subjects.set(subject.id, subject);
    const start = timeMinutes(startValue);
    const end = timeMinutes(endValue);
    if (start === null || end === null || end <= start) return;
    const item = { subjectId: subject.id, day, start, end, variant };
    occurrences.set(JSON.stringify(item), item);
  };
  const addDay = (
    day: number,
    sourceDay: string,
    week: 'par' | 'impar',
    variant: string,
    override?: DateColorLayout,
    calendarDay = day,
  ) => {
    const dayData = source[sourceDay];
    if (isRecord(dayData)) {
      for (const [periodNumber, schedules] of Object.entries(dayData)) {
        if (!isRecord(schedules)) continue;
        const periodIndex = Number(periodNumber) - 1;
        const timedPeriod = override?.periods.find((p) => p && p.index === periodIndex);
        if (override && !timedPeriod) continue;
        const period = periods[periodIndex];
        for (const kind of ['both', week]) {
          const items: unknown = schedules[kind];
          if (!Array.isArray(items)) continue;
          for (const item of items) {
            if (
              !isRecord(item) ||
              !isRecord(item.subjectid) ||
              typeof item.subjectid.name !== 'string' ||
              !item.subjectid.name.trim()
            )
              continue;
            const group =
              isRecord(item.groupids) && typeof item.groupids.name === 'string'
                ? item.groupids.name.toLowerCase()
                : '';
            // Match getScheduleForDay's entire-class and subgroup filtering.
            const entire =
              [
                'clasă intreagă',
                'clas intreag',
                'clasa intreaga',
                'clasă întreagă',
                'clas întreag',
                'întreaga clasă',
                'class',
              ].some((value) => group.includes(value)) || group.includes('intreag');
            const selected = group.includes('grupa 1')
              ? 'Subgroup 1'
              : group.includes('grupa 2')
                ? 'Subgroup 2'
                : group;
            if (!entire && selected.toLowerCase() !== subgroup.toLowerCase()) continue;
            const subject = item.subjectid as { name: string; _id?: string; id?: string };
            addOccurrence(
              { id: subjectColorId(subject), name: subject.name },
              day,
              timedPeriod?.start ?? period?.starttime,
              timedPeriod?.end ?? period?.endtime,
              variant,
            );
          }
        }
      }
    }
    for (const custom of Array.isArray(customPeriods) ? customPeriods : []) {
      if (
        !custom?.isEnabled ||
        (Array.isArray(custom.daysOfWeek) && !custom.daysOfWeek.includes(calendarDay + 1))
      )
        continue;
      addOccurrence(
        {
          id: `custom:${custom._id}`,
          name: custom.name || 'Custom period',
          lockedColor: custom.color || Colors.dark.customPeriodColor,
        },
        day,
        custom.starttime,
        custom.endtime,
        variant,
      );
    }
  };
  for (const week of ['par', 'impar'] as const) {
    DAYS.slice(0, 5).forEach((day, index) => addDay(index, day, week, `recurring:${week}`));
  }

  // Each actual week is an independent scenario. Include ordinary days alongside
  // overrides, so a Saturday recovery lesson can conflict with Friday, not Monday
  // of a different week or an odd/even lesson that can never appear beside it.
  const weeks = new Map<string, Map<number, DateColorLayout>>();
  for (const date of [...dates]
    .filter((v) => v && typeof v.date === 'string')
    .sort((a, b) => compareIds(a.date, b.date))) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.date) || !Array.isArray(date.periods)) continue;
    const parsed = new Date(`${date.date}T12:00:00Z`);
    if (!Number.isFinite(parsed.getTime())) continue;
    const day = (parsed.getUTCDay() + 6) % 7;
    parsed.setUTCDate(parsed.getUTCDate() - day);
    const key = parsed.toISOString().slice(0, 10);
    if (!weeks.has(key)) weeks.set(key, new Map());
    weeks.get(key)!.set(day, date);
  }
  for (const [key, days] of weeks) {
    const week = days.values().next().value!.week;
    let column = 0;
    DAYS.forEach((day, index) => {
      const date = days.get(index);
      // WeekView omits ordinary weekends, so a lone Sunday recovery column is
      // directly beside Friday even though their weekday numbers differ by two.
      if (index >= 5 && (!date || date.visible === false)) return;
      addDay(column++, date?.sourceDay || day, date?.week || week, `date:${key}`, date, index);
    });
  }
  // Loading another ordinary calendar week must not change conflict frequency.
  // Date scenarios only add information when their actual geometry differs from
  // the recurring schedule (or another already-known override week).
  const scenarios = new Map<string, ColorOccurrence[]>();
  for (const item of occurrences.values()) {
    if (!scenarios.has(item.variant)) scenarios.set(item.variant, []);
    scenarios.get(item.variant)!.push(item);
  }
  const seen = new Set<string>();
  const relevant: ColorOccurrence[] = [];
  for (const [variant, cards] of scenarios) {
    const signature = JSON.stringify(
      cards
        .map(({ subjectId, day, start, end }) => ({ subjectId, day, start, end }))
        .sort(
          (a, b) =>
            a.day - b.day ||
            a.start - b.start ||
            a.end - b.end ||
            compareIds(a.subjectId, b.subjectId),
        ),
    );
    if (variant.startsWith('date:') && seen.has(signature)) continue;
    seen.add(signature);
    relevant.push(...cards);
  }
  return {
    subjects: [...subjects.values()].sort((a, b) => compareIds(a.id, b.id)),
    occurrences: relevant.sort(
      (a, b) =>
        compareIds(a.variant, b.variant) ||
        a.day - b.day ||
        a.start - b.start ||
        a.end - b.end ||
        compareIds(a.subjectId, b.subjectId),
    ),
  };
}

export function buildConflictGraph(
  layout: ColorLayout,
  overrides: Partial<typeof NEIGHBORHOOD> = {},
): ConflictEdge[] {
  const options = { ...NEIGHBORHOOD, ...overrides };
  const pairs = new Map<string, { a: string; b: string; weights: number[] }>();
  const items = layout.occurrences.filter(
    (v) => Number.isFinite(v.start) && Number.isFinite(v.end) && v.end > v.start,
  );
  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    for (let j = i + 1; j < items.length; j++) {
      const b = items[j];
      if (a.variant !== b.variant || a.subjectId === b.subjectId || Math.abs(a.day - b.day) > 1)
        continue;
      const aEnd = Math.max(a.end, a.start + options.minimumDurationMinutes);
      const bEnd = Math.max(b.end, b.start + options.minimumDurationMinutes);
      const gap = Math.max(a.start - bEnd, b.start - aEnd, 0);
      if (gap > options.gapMinutes) continue;
      const base =
        a.day === b.day
          ? options.verticalWeight
          : gap === 0
            ? options.horizontalWeight
            : options.diagonalWeight;
      const weight = base * (gap === 0 ? 1 : 1 - (0.4 * gap) / Math.max(1, options.gapMinutes));
      const ids = [a.subjectId, b.subjectId].sort(compareIds);
      const key = JSON.stringify(ids);
      const pair = pairs.get(key) || { a: ids[0], b: ids[1], weights: [] };
      pair.weights.push(weight);
      pairs.set(key, pair);
    }
  }
  return [...pairs.values()]
    .map(({ a, b, weights }) => {
      // Sort before summing to avoid retrieval-order floating point differences.
      weights.sort((x, y) => x - y);
      return {
        a,
        b,
        count: weights.length,
        weight:
          (weights.reduce((sum, w) => sum + w, 0) / weights.length) *
          (1 + Math.log1p(weights.length)),
      };
    })
    .sort((a, b) => compareIds(a.a, b.a) || compareIds(a.b, b.b));
}

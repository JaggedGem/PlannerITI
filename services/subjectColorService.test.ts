import { sampleSchedule } from '@/test/subjectColorFixtures';
import { allocateSubjectColors } from '@/utils/subjectColors/allocator';
import { normalizeColorLayout } from '@/utils/subjectColors/layout';

import { SubjectColorStore } from './subjectColorService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

function setup(initial?: string) {
  const values = new Map<string, string>();
  const storage = {
    getItem: jest.fn(async (key: string) => values.get(key) || initial || null),
    setItem: jest.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
  };
  return { values, storage, store: new SubjectColorStore(storage) };
}

const layout = () => normalizeColorLayout(sampleSchedule(), 'Subgroup 1');

it('shares one assignment, skips duplicate writes and reuses the exact saved result after reload', async () => {
  const { store, storage } = setup();
  await Promise.all([store.reconcile('group1', layout()), store.reconcile('group1', layout())]);
  const first = store.snapshot('group1');
  expect(storage.setItem).toHaveBeenCalledTimes(1);
  const reloaded = new SubjectColorStore(storage);
  await reloaded.reconcile('group1', layout());
  expect(reloaded.snapshot('group1')).toEqual(first);
  expect(storage.setItem).toHaveBeenCalledTimes(1);
});

it('serializes rapid updates, preserves deleted/reintroduced subjects and isolates groups', async () => {
  const { store } = setup();
  const whole = layout();
  const reduced = {
    ...whole,
    subjects: whole.subjects.slice(1),
    occurrences: whole.occurrences.filter((o) => o.subjectId !== whole.subjects[0].id),
  };
  await store.reconcile('group1', whole);
  const first = store.snapshot('group1');
  await Promise.all([store.reconcile('group1', reduced), store.reconcile('group1', whole)]);
  expect(store.snapshot('group1')).toEqual(first);
  expect(store.snapshot('group2')).toEqual({});
  await store.reconcile('group2', { subjects: [{ id: 'other', name: 'Other' }], occurrences: [] });
  expect(Object.keys(store.snapshot('group2'))).toEqual(['other']);
});

it.each([
  'not json',
  JSON.stringify({ version: 99, assignments: {} }),
  JSON.stringify({ version: 1, assignments: { bad: { color: 'red' } }, signature: 'obsolete' }),
])('recovers missing or obsolete persistence: %s', async (initial) => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const { store } = setup(initial);
  await store.reconcile('group', layout());
  expect(store.snapshot('group')).toEqual(allocateSubjectColors(layout()));
  warn.mockRestore();
});

it('retains explicit overrides during rebalance', async () => {
  const { store } = setup();
  const custom = layout();
  custom.subjects[0].lockedColor = '#aa77cc';
  await store.reconcile('group', custom);
  await store.reconcile('group', custom, { rebalance: true });
  expect(store.snapshot('group')[custom.subjects[0].id]).toEqual({
    color: '#aa77cc',
    locked: true,
  });
});

it('keeps usable assignments after storage errors and retries failed writes', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const { store, storage } = setup();
  storage.getItem.mockRejectedValueOnce(new Error('offline storage'));
  storage.setItem.mockRejectedValueOnce(new Error('full disk'));
  await store.reconcile('group', layout());
  const first = store.snapshot('group');
  expect(Object.keys(first).length).toBeGreaterThan(0);
  await store.reconcile('group', layout());
  expect(store.snapshot('group')).toBe(first);
  expect(storage.setItem).toHaveBeenCalledTimes(2);
  warn.mockRestore();
});

it('does not write again for a small geometry update that preserves all assignments', async () => {
  const { store, storage } = setup();
  const before = layout();
  await store.reconcile('group', before);
  const first = store.snapshot('group');
  const moved = {
    ...before,
    occurrences: before.occurrences.map((o) => ({ ...o, start: o.start + 1, end: o.end + 1 })),
  };
  await store.reconcile('group', moved);
  expect(store.snapshot('group')).toEqual(first);
  expect(storage.setItem).toHaveBeenCalledTimes(1);
});

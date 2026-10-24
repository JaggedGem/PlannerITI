import AsyncStorage from '@react-native-async-storage/async-storage';

import { isRecord } from '@/utils/json';
import { ColorAssignments, allocateSubjectColors } from '@/utils/subjectColors/allocator';
import { validColor } from '@/utils/subjectColors/colorSpace';
import { ColorLayout, buildConflictGraph, compareIds } from '@/utils/subjectColors/layout';

const VERSION = 1;
const EMPTY: ColorAssignments = Object.freeze({});
const STORAGE_PREFIX = '@subject_colors_v1:ceiti:';
interface ColorStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
}
interface State {
  assignments: ColorAssignments;
  signature: string;
  saved: string;
}

/** One serialized reconciliation queue per dataset, shared by both schedule views. */
export class SubjectColorStore {
  private states = new Map<string, State>();
  private queues = new Map<string, Promise<void>>();
  private listeners = new Set<() => void>();

  constructor(private storage: ColorStorage) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  snapshot = (scope: string): ColorAssignments => this.states.get(scope)?.assignments || EMPTY;

  reconcile(
    scope: string,
    layout: ColorLayout,
    options: { rebalance?: boolean } = {},
  ): Promise<void> {
    const prior = this.queues.get(scope) || Promise.resolve();
    const pending = prior.catch(() => {}).then(() => this.update(scope, layout, options));
    this.queues.set(scope, pending);
    void pending
      .finally(() => {
        if (this.queues.get(scope) === pending) this.queues.delete(scope);
      })
      .catch(() => {});
    return pending;
  }

  private async update(scope: string, layout: ColorLayout, options: { rebalance?: boolean }) {
    if (!scope) return;
    const key = STORAGE_PREFIX + encodeURIComponent(scope);
    let state = this.states.get(scope);
    if (!state) {
      let assignments: ColorAssignments = {};
      let signature = '';
      let saved = '';
      try {
        const raw = await this.storage.getItem(key);
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        if (isRecord(parsed) && parsed.version === VERSION && isRecord(parsed.assignments)) {
          assignments = Object.fromEntries(
            Object.entries(parsed.assignments)
              .filter(([, value]) => isRecord(value) && validColor(value.color))
              .sort(([a], [b]) => compareIds(a, b))
              .map(([id, value]) => {
                const item = value as { color: string; locked?: boolean };
                return [
                  id,
                  {
                    color: item.color.toLowerCase(),
                    ...(item.locked === true ? { locked: true } : {}),
                  },
                ];
              }),
          );
          signature = typeof parsed.signature === 'string' ? parsed.signature : '';
          saved = JSON.stringify(assignments);
        }
      } catch (error) {
        console.warn('Unable to load subject colors; using deterministic allocation', error);
      }
      state = { assignments, signature, saved };
      this.states.set(scope, state);
    }
    const edges = buildConflictGraph(layout);
    const signature = JSON.stringify({
      version: VERSION,
      subjects: [...layout.subjects].sort((a, b) => compareIds(a.id, b.id)),
      edges,
    });
    const complete = layout.subjects.every((s) => validColor(state!.assignments[s.id]?.color));
    if (options.rebalance || signature !== state.signature || !complete) {
      const assigned = allocateSubjectColors(layout, state.assignments, { ...options, edges });
      // Retain absent subjects so deletion/reintroduction keeps its familiar color.
      const merged = Object.fromEntries(
        Object.entries({ ...state.assignments, ...assigned }).sort(([a], [b]) => compareIds(a, b)),
      );
      const changed = JSON.stringify(merged) !== JSON.stringify(state.assignments);
      state.assignments = changed ? merged : state.assignments;
      state.signature = signature;
    }
    // A pure geometry change with unchanged colors needs no storage write.
    // Persist the fingerprint with each changed assignment for exact reload reuse.
    const serialized = JSON.stringify(state.assignments);
    for (const listener of this.listeners) listener();
    if (serialized !== state.saved) {
      try {
        await this.storage.setItem(key, this.serialize(state.assignments, state.signature));
        state.saved = serialized;
      } catch (error) {
        console.warn('Unable to save subject colors; will retry on the next update', error);
      }
    }
  }

  private serialize(assignments: ColorAssignments, signature: string) {
    return JSON.stringify({ version: VERSION, signature, assignments });
  }
}

export const subjectColorService = new SubjectColorStore(AsyncStorage);

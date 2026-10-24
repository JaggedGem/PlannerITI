import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { ApiResponse, UserSettings, scheduleService } from '@/services/scheduleService';
import { subjectColorService } from '@/services/subjectColorService';
import { subjectPresentation, validColor } from '@/utils/subjectColors/colorSpace';
import { DateColorLayout, normalizeColorLayout } from '@/utils/subjectColors/layout';
import { subjectColorId } from '@/utils/subjectColors/semantics';

interface ColoredScheduleItem {
  colorSubjectId?: string;
  className: string;
  isCustom?: boolean;
  period?: string;
  color?: string;
}

export function useSubjectColors(
  data: ApiResponse | null,
  settings: UserSettings,
  displayedSchedule: unknown,
) {
  const scope = settings.selectedGroupId ? `${settings.selectedGroupId}:${settings.group}` : '';
  const snapshot = useCallback(() => subjectColorService.snapshot(scope), [scope]);
  const assignments = useSyncExternalStore(subjectColorService.subscribe, snapshot, snapshot);

  useEffect(() => {
    if (!data || !scope || (data.colorGroupId && data.colorGroupId !== settings.selectedGroupId))
      return;
    const dates: DateColorLayout[] = scheduleService
      .getDatePeriodEntriesForCurrentGroup()
      .filter((entry) => entry && typeof entry.date === 'string' && Array.isArray(entry.schedule))
      .map((entry) => ({
        date: entry.date,
        sourceDay:
          entry.override?.replaceWeekday ||
          entry.override?.recoverySource?.weekday ||
          (entry.isWeekend && data.data?.[`weekend_${entry.date}`]
            ? `weekend_${entry.date}`
            : entry.weekday),
        week: scheduleService.isEvenWeek(new Date(`${entry.date}T12:00:00`)) ? 'par' : 'impar',
        visible: !entry.isWeekend || entry.isOverride,
        periods: entry.schedule,
      }));
    const layout = normalizeColorLayout(data, settings.group, settings.customPeriods, dates);
    void subjectColorService.reconcile(scope, layout).catch((error: unknown) => {
      console.warn('Unable to update subject colors', error);
    });
  }, [
    data,
    scope,
    settings.selectedGroupId,
    settings.group,
    settings.customPeriods,
    displayedSchedule,
  ]);

  return useCallback(
    (item: ColoredScheduleItem) => {
      const id =
        item.colorSubjectId ||
        (item.isCustom && item.period
          ? `custom:${item.period}`
          : subjectColorId({ name: item.className }));
      const identity =
        item.isCustom && validColor(item.color) ? item.color : assignments[id]?.color || '#638bdf';
      return subjectPresentation(identity);
    },
    [assignments],
  );
}

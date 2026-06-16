export type AdaptiveWidgetMode =
  | 'morning'
  | 'school-hours'
  | 'evening'
  | 'exam-period'
  | 'weekend'
  | 'no-classes';

export interface AdaptiveContext {
  mode: AdaptiveWidgetMode;
  priority: string;
}

export function getAdaptiveMode(isWeekend: boolean, hasClassesToday: boolean, hasExams: boolean, currentClassIndex: number): AdaptiveContext {
  const now = new Date();
  const hour = now.getHours();

  if (hasExams) {
    return { mode: 'exam-period', priority: 'exams' };
  }

  if (isWeekend) {
    return { mode: 'weekend', priority: 'assignments' };
  }

  if (!hasClassesToday) {
    return { mode: 'no-classes', priority: 'assignments' };
  }

  if (currentClassIndex >= 0) {
    return { mode: 'school-hours', priority: 'schedule' };
  }

  if (hour < 12) {
    return { mode: 'morning', priority: 'schedule' };
  }

  if (hour >= 17) {
    return { mode: 'evening', priority: 'reflection' };
  }

  return { mode: 'school-hours', priority: 'schedule' };
}
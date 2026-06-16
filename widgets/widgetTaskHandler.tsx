'use no memo';
import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { AssignmentPressureWidget } from './AssignmentPressureWidget';
import { CountdownWidget } from './CountdownWidget';
import { EndOfDayWidget } from './EndOfDayWidget';
import { ExamAlertWidget } from './ExamAlertWidget';
import { GradeImpactWidget } from './GradeImpactWidget';
import { NotificationsWidget } from './NotificationsWidget';
import { TodayGlanceWidget } from './TodayGlanceWidget';
import {
  getWidgetAssignments,
  getWidgetDaySummary,
  getWidgetEndOfDay,
  getWidgetExams,
  getWidgetGradeImpact,
  getWidgetNotifications,
  getMinutesUntilNextClass,
  getTotalPendingAssignments,
} from './dataService';

const nameToWidget: Record<string, React.FC<any>> = {
  TodayGlance: TodayGlanceWidget,
  AssignmentPressure: AssignmentPressureWidget,
  GradeImpact: GradeImpactWidget,
  Countdown: CountdownWidget,
  Notifications: NotificationsWidget,
  EndOfDay: EndOfDayWidget,
  ExamAlert: ExamAlertWidget,
};

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const widgetInfo = props.widgetInfo;
  const widgetName = widgetInfo.widgetName as keyof typeof nameToWidget;
  const Widget = nameToWidget[widgetName];

  if (!Widget) return;

  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      try {
        const [summary, assignments, grades, exams, endOfDay, notifications, totalPending] =
          await Promise.all([
            getWidgetDaySummary(),
            getWidgetAssignments(),
            getWidgetGradeImpact(),
            getWidgetExams(),
            getWidgetEndOfDay(),
            getWidgetNotifications(),
            getTotalPendingAssignments(),
          ]);

        const safeSummary = {
          classes: summary?.classes || [],
          currentClassIndex: summary?.currentClassIndex ?? -1,
          nextClass: summary?.nextClass ?? null,
          freeWindows: summary?.freeWindows || [],
          isWeekend: summary?.isWeekend ?? false,
          isSchoolDay: summary?.isSchoolDay ?? false,
        };

        switch (widgetName) {
          case 'TodayGlance':
            props.renderWidget(
              <TodayGlanceWidget
                classes={safeSummary.classes}
                currentClassIndex={safeSummary.currentClassIndex}
                nextClass={safeSummary.nextClass}
                freeWindows={safeSummary.freeWindows}
                isWeekend={safeSummary.isWeekend}
                isSchoolDay={safeSummary.isSchoolDay}
                totalPending={totalPending}
              />
            );
            break;

          case 'AssignmentPressure':
            props.renderWidget(
              <AssignmentPressureWidget
                assignments={assignments}
                totalPending={totalPending}
              />
            );
            break;

          case 'GradeImpact':
            props.renderWidget(
              <GradeImpactWidget subjects={grades} />
            );
            break;

          case 'Countdown': {
            const nextClass = safeSummary.nextClass;
            const currentClass = safeSummary.currentClassIndex >= 0
              ? safeSummary.classes[safeSummary.currentClassIndex]
              : null;
            const minutesUntil = getMinutesUntilNextClass(safeSummary.classes);

            props.renderWidget(
              <CountdownWidget
                subjectName={currentClass?.subjectName || nextClass?.subjectName || ''}
                startTime={currentClass?.startTime || nextClass?.startTime || ''}
                room={currentClass?.room || nextClass?.room || ''}
                minutesUntil={minutesUntil}
                isOngoing={safeSummary.currentClassIndex >= 0}
                hasClassesToday={safeSummary.isSchoolDay}
              />
            );
            break;
          }

          case 'Notifications':
            props.renderWidget(
              <NotificationsWidget notifications={notifications} />
            );
            break;

          case 'EndOfDay':
            props.renderWidget(
              <EndOfDayWidget
                totalClasses={endOfDay?.totalClasses ?? 0}
                completedTasks={endOfDay?.completedTasks ?? 0}
                totalTasks={endOfDay?.totalTasks ?? 0}
                tomorrowClasses={endOfDay?.tomorrowClasses ?? 0}
                message={endOfDay?.message ?? ''}
              />
            );
            break;

          case 'ExamAlert':
            props.renderWidget(
              <ExamAlertWidget
                exams={exams}
                hasExams={exams.length > 0}
              />
            );
            break;

          default:
            props.renderWidget(<Widget />);
        }
      } catch (error) {
        props.renderWidget(
          <TodayGlanceWidget
            classes={[]}
            currentClassIndex={-1}
            nextClass={null}
            freeWindows={[]}
            isWeekend={false}
            isSchoolDay={false}
            totalPending={0}
          />
        );
      }
      break;
    }

    case 'WIDGET_CLICK':
      break;

    case 'WIDGET_DELETED':
      break;

    default:
      break;
  }
}
'use no memo';
import React from 'react';
import {
  FlexWidget,
  TextWidget,
} from 'react-native-android-widget';

import { Colors } from '@/constants/Colors';

const C = Colors.dark;
const TRANSPARENT = '#00000000';

interface TodayGlanceWidgetProps {
  classes: Array<{
    subjectName: string;
    teacher: string;
    room: string;
    startTime: string;
    endTime: string;
    isOngoing: boolean;
  }>;
  currentClassIndex: number;
  nextClass: {
    subjectName: string;
    startTime: string;
    room: string;
  } | null;
  freeWindows: Array<{ start: string; end: string }>;
  isWeekend: boolean;
  isSchoolDay: boolean;
  totalPending: number;
}

interface ClassItem {
  subjectName: string;
  teacher: string;
  room: string;
  startTime: string;
  endTime: string;
  isOngoing: boolean;
}

function ClassItemRow(props: { cls: ClassItem; isOngoing: boolean; isNext: boolean }) {
  const { cls, isOngoing, isNext } = props;
  const bg = isOngoing ? C.overlayPrimary10 : TRANSPARENT;
  const borderColor = isOngoing ? C.primary : (isNext ? C.orange : TRANSPARENT);

  return (
    <FlexWidget
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: bg,
        borderRadius: 10,
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 7,
        paddingBottom: 7,
        marginBottom: 6,
        borderLeftWidth: 3,
        borderLeftColor: borderColor,
      }}
    >
      <FlexWidget style={{ width: 40 }}>
        <TextWidget
          text={cls.startTime}
          style={{
            fontSize: 12,
            fontFamily: 'SpaceMono',
            color: isOngoing ? C.primary : C.mutedText,
            fontWeight: isOngoing ? 'bold' : 'normal',
          }}
        />
      </FlexWidget>
      <FlexWidget
        style={{
          flex: 1,
          flexDirection: 'column',
          marginLeft: 8,
        }}
      >
        <TextWidget
          text={cls.subjectName}
          style={{
            fontSize: 13,
            fontFamily: 'SpaceMono',
            color: isOngoing ? C.primaryAccent : C.text,
            fontWeight: '600',
          }}
        />
        <TextWidget
          text={`${cls.room}${cls.teacher ? ' \u00B7 ' + cls.teacher : ''}`}
          style={{
            fontSize: 10,
            fontFamily: 'SpaceMono',
            color: C.mutedText,
            marginTop: 1,
          }}
        />
      </FlexWidget>
      {isOngoing && (
        <TextWidget
          text={'\u25CF'}
          style={{
            fontSize: 14,
            color: C.green,
            marginLeft: 4,
          }}
        />
      )}
    </FlexWidget>
  );
}

export function TodayGlanceWidget(props: TodayGlanceWidgetProps) {
  const { classes, currentClassIndex, nextClass, isWeekend, isSchoolDay, totalPending } = props;

  if (isWeekend || !isSchoolDay) {
    return (
      <FlexWidget
        style={{
          height: 'match_parent',
          width: 'match_parent',
          backgroundColor: C.background,
          borderRadius: 20,
          padding: 16,
          flexDirection: 'column',
        }}
      >
        <FlexWidget
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <FlexWidget
            style={{
              width: 4,
              height: 24,
              backgroundColor: C.primary,
              borderRadius: 2,
              marginRight: 10,
            }}
          />
          <TextWidget
            text="No classes today"
            style={{
              fontSize: 18,
              fontFamily: 'SpaceMono',
              color: C.text,
              fontWeight: 'bold',
            }}
          />
        </FlexWidget>
        {totalPending > 0 && (
          <FlexWidget
            style={{
              backgroundColor: C.overlayPrimary10,
              borderRadius: 12,
              padding: 12,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <TextWidget
              text={'\uD83D\uDCCB'}
              style={{ fontSize: 18, marginRight: 8 }}
            />
            <TextWidget
              text={`${totalPending} pending ${totalPending === 1 ? 'task' : 'tasks'}`}
              style={{
                fontSize: 14,
                fontFamily: 'SpaceMono',
                color: C.primary,
              }}
            />
          </FlexWidget>
        )}
      </FlexWidget>
    );
  }

  const visibleClasses = classes.slice(0, 4);

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: C.background,
        borderRadius: 20,
        padding: 14,
        flexDirection: 'column',
      }}
    >
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <FlexWidget
          style={{
            width: 4,
            height: 20,
            backgroundColor: C.primary,
            borderRadius: 2,
            marginRight: 8,
          }}
        />
        <FlexWidget style={{ flex: 1 }}>
          <TextWidget
            text="Today's Schedule"
            style={{
              fontSize: 16,
              fontFamily: 'SpaceMono',
              color: C.text,
              fontWeight: 'bold',
            }}
          />
        </FlexWidget>
        {currentClassIndex >= 0 && (
          <FlexWidget
            style={{
              backgroundColor: C.green,
              borderRadius: 8,
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 3,
              paddingBottom: 3,
            }}
          >
            <TextWidget
              text="LIVE"
              style={{
                fontSize: 10,
                fontFamily: 'SpaceMono',
                color: '#000',
                fontWeight: 'bold',
              }}
            />
          </FlexWidget>
        )}
      </FlexWidget>

      <FlexWidget style={{ flexDirection: 'column' }}>
        {visibleClasses.map((cls) => {
          const isOngoing = classes.indexOf(cls) === currentClassIndex;
          const isNext = nextClass !== null && cls.subjectName === nextClass.subjectName && cls.startTime === nextClass.startTime;
          return (
            <ClassItemRow
              key={`${cls.startTime}-${cls.subjectName}`}
              cls={cls}
              isOngoing={isOngoing}
              isNext={isNext}
            />
          );
        })}
      </FlexWidget>

      {nextClass !== null && currentClassIndex < 0 && (
        <FlexWidget
          style={{
            marginTop: 8,
            backgroundColor: C.overlayOrange10,
            borderRadius: 10,
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 6,
            paddingBottom: 6,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <TextWidget
            text={'\u23F0'}
            style={{ fontSize: 14, marginRight: 6 }}
          />
          <TextWidget
            text={`Next: ${nextClass.subjectName} at ${nextClass.startTime} (${nextClass.room})`}
            style={{
              fontSize: 11,
              fontFamily: 'SpaceMono',
              color: C.orange,
            }}
          />
        </FlexWidget>
      )}

      {totalPending > 0 && (
        <FlexWidget
          clickAction="OPEN_APP"
          style={{
            marginTop: 6,
            backgroundColor: C.overlayPrimary10,
            borderRadius: 8,
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 4,
            paddingBottom: 4,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <TextWidget
            text={'\uD83D\uDCCB'}
            style={{ fontSize: 12, marginRight: 4 }}
          />
          <TextWidget
            text={`${totalPending} pending`}
            style={{
              fontSize: 10,
              fontFamily: 'SpaceMono',
              color: C.primary,
            }}
          />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
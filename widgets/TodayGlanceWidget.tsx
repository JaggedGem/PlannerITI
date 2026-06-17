'use no memo';
import React from 'react';
import {
  FlexWidget,
  TextWidget,
} from 'react-native-android-widget';
import type { ColorProp } from 'react-native-android-widget';

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

function WidgetHeader({ accentColor, title, trailing }: { accentColor: ColorProp; title: string; trailing?: React.ReactNode }) {
  return (
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
          height: 20,
          backgroundColor: accentColor,
          borderRadius: 2,
          marginRight: 10,
        }}
      />
      <FlexWidget style={{ flex: 1 }}>
        <TextWidget
          text={title}
          style={{
            fontSize: 16,
            fontFamily: 'SpaceMono',
            color: C.text,
            fontWeight: 'bold',
          }}
        />
      </FlexWidget>
      {trailing}
    </FlexWidget>
  );
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
        borderRadius: 12,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 9,
        paddingBottom: 9,
        marginBottom: 8,
        borderLeftWidth: 3,
        borderLeftColor: borderColor,
      }}
    >
      <FlexWidget style={{ width: 44 }}>
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
          marginLeft: 10,
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
            marginTop: 2,
          }}
        />
      </FlexWidget>
      {isOngoing && (
        <TextWidget
          text={'\u25CF'}
          style={{
            fontSize: 14,
            color: C.green,
            marginLeft: 6,
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
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <TextWidget
          text={'\uD83C\uDF1F'}
          style={{ fontSize: 30, marginBottom: 8 }}
        />
        <TextWidget
          text="No classes today"
          style={{
            fontSize: 16,
            fontFamily: 'SpaceMono',
            color: C.text,
            fontWeight: 'bold',
            textAlign: 'center',
          }}
        />
        {totalPending > 0 && (
          <FlexWidget
            style={{
              marginTop: 12,
              backgroundColor: C.overlayPrimary10,
              borderRadius: 12,
              paddingLeft: 14,
              paddingRight: 14,
              paddingTop: 8,
              paddingBottom: 8,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <TextWidget
              text={'\uD83D\uDCCB'}
              style={{ fontSize: 16, marginRight: 8 }}
            />
            <TextWidget
              text={`${totalPending} pending ${totalPending === 1 ? 'task' : 'tasks'}`}
              style={{
                fontSize: 13,
                fontFamily: 'SpaceMono',
                color: C.primary,
                fontWeight: '600',
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
        padding: 16,
        flexDirection: 'column',
      }}
    >
      <WidgetHeader
        accentColor={C.primary}
        title="Today's Schedule"
        trailing={
          currentClassIndex >= 0 ? (
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
          ) : undefined
        }
      />

      <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
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
            borderRadius: 12,
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 8,
            paddingBottom: 8,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <TextWidget
            text={'\u23F0'}
            style={{ fontSize: 14, marginRight: 8 }}
          />
          <TextWidget
            text={`Next: ${nextClass.subjectName} at ${nextClass.startTime} (${nextClass.room})`}
            style={{
              fontSize: 11,
              fontFamily: 'SpaceMono',
              color: C.orange,
              fontWeight: '600',
            }}
          />
        </FlexWidget>
      )}

      {totalPending > 0 && (
        <FlexWidget
          clickAction="OPEN_APP"
          style={{
            marginTop: 8,
            backgroundColor: C.overlayPrimary10,
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
            text={'\uD83D\uDCCB'}
            style={{ fontSize: 12, marginRight: 6 }}
          />
          <TextWidget
            text={`${totalPending} pending`}
            style={{
              fontSize: 11,
              fontFamily: 'SpaceMono',
              color: C.primary,
              fontWeight: '600',
            }}
          />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

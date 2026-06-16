'use no memo';
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { Colors } from '@/constants/Colors';

const C = Colors.dark;

interface CountdownWidgetProps {
  subjectName: string;
  startTime: string;
  room: string;
  minutesUntil: number;
  isOngoing: boolean;
  hasClassesToday: boolean;
}

function formatCountdown(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function CountdownWidget(props: CountdownWidgetProps) {
  const { subjectName, startTime, room, minutesUntil, isOngoing, hasClassesToday } = props;

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: C.background,
        borderRadius: 20,
        padding: 14,
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      {!hasClassesToday ? (
        <FlexWidget
          style={{
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TextWidget
            text="🎉"
            style={{ fontSize: 28, marginBottom: 4 }}
          />
          <TextWidget
            text="No classes today"
            style={{
              fontSize: 14,
              fontFamily: 'SpaceMono',
              color: C.mutedText,
            }}
          />
        </FlexWidget>
      ) : isOngoing ? (
        <FlexWidget
          style={{
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <FlexWidget
            style={{
              backgroundColor: C.green,
              borderRadius: 6,
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 2,
              paddingBottom: 2,
              marginBottom: 6,
            }}
          >
            <TextWidget
              text="IN PROGRESS"
              style={{
                fontSize: 10,
                fontFamily: 'SpaceMono',
                color: '#000',
                fontWeight: 'bold',
              }}
            />
          </FlexWidget>
          <TextWidget
            text={subjectName}
            style={{
              fontSize: 16,
              fontFamily: 'SpaceMono',
              color: C.text,
              fontWeight: 'bold',
              textAlign: 'center',
            }}
          />
          <TextWidget
            text={`${room} · Started at ${startTime}`}
            style={{
              fontSize: 11,
              fontFamily: 'SpaceMono',
              color: C.mutedText,
              marginTop: 2,
            }}
          />
        </FlexWidget>
      ) : (
        <FlexWidget
          style={{
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <TextWidget
            text="Next class in"
            style={{
              fontSize: 11,
              fontFamily: 'SpaceMono',
              color: C.mutedText,
              marginBottom: 4,
            }}
          />
          <TextWidget
            text={formatCountdown(minutesUntil)}
            style={{
              fontSize: 32,
              fontFamily: 'SpaceMono',
              color: C.primary,
              fontWeight: 'bold',
              letterSpacing: 2,
            }}
          />
          <TextWidget
            text={`${subjectName} · ${room} · ${startTime}`}
            style={{
              fontSize: 11,
              fontFamily: 'SpaceMono',
              color: C.mutedText,
              marginTop: 4,
              textAlign: 'center',
            }}
          />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
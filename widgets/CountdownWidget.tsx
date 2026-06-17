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
        padding: 16,
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {!hasClassesToday ? (
        <FlexWidget
          style={{
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <TextWidget
            text={'\uD83C\uDF89'}
            style={{ fontSize: 30, marginBottom: 8 }}
          />
          <TextWidget
            text="No classes today"
            style={{
              fontSize: 14,
              fontFamily: 'SpaceMono',
              color: C.mutedText,
              textAlign: 'center',
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
              paddingLeft: 10,
              paddingRight: 10,
              paddingTop: 3,
              paddingBottom: 3,
              marginBottom: 8,
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
            text={`${room} \u00B7 Started at ${startTime}`}
            style={{
              fontSize: 11,
              fontFamily: 'SpaceMono',
              color: C.mutedText,
              marginTop: 4,
              textAlign: 'center',
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
              marginBottom: 6,
            }}
          />
          <TextWidget
            text={formatCountdown(minutesUntil)}
            style={{
              fontSize: 34,
              fontFamily: 'SpaceMono',
              color: C.primary,
              fontWeight: 'bold',
              letterSpacing: 2,
            }}
          />
          <TextWidget
            text={`${subjectName} \u00B7 ${room} \u00B7 ${startTime}`}
            style={{
              fontSize: 11,
              fontFamily: 'SpaceMono',
              color: C.mutedText,
              marginTop: 6,
              textAlign: 'center',
            }}
          />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

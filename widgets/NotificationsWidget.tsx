'use no memo';
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { Colors } from '@/constants/Colors';

const C = Colors.dark;

interface NotificationsWidgetProps {
  notifications: Array<{
    id: string;
    title: string;
    body: string;
    daysUntilDue: number;
    type: string;
  }>;
}

export function NotificationsWidget(props: NotificationsWidgetProps) {
  const { notifications } = props;
  const display = notifications.slice(0, 3);

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
            height: 20,
            backgroundColor: C.primary,
            borderRadius: 2,
            marginRight: 10,
          }}
        />
        <TextWidget
          text="Reminders"
          style={{
            fontSize: 16,
            fontFamily: 'SpaceMono',
            color: C.text,
            fontWeight: 'bold',
          }}
        />
      </FlexWidget>

      {display.length === 0 ? (
        <FlexWidget
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <TextWidget
            text={'\u2713'}
            style={{ fontSize: 36, color: C.green, marginBottom: 6 }}
          />
          <TextWidget
            text="No upcoming reminders"
            style={{
              fontSize: 13,
              fontFamily: 'SpaceMono',
              color: C.mutedText,
              textAlign: 'center',
            }}
          />
        </FlexWidget>
      ) : (
        <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
          {display.map((n) => {
            const dotColor = n.daysUntilDue <= 0 ? C.red : (n.daysUntilDue <= 2 ? C.orange : C.green);
            const label = n.daysUntilDue <= 0 ? 'Due!' : `${n.daysUntilDue}d`;

            return (
              <FlexWidget
                key={n.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: C.overlayWhite05,
                  borderRadius: 12,
                  paddingLeft: 12,
                  paddingRight: 12,
                  paddingTop: 9,
                  paddingBottom: 9,
                  marginBottom: 8,
                }}
              >
                <FlexWidget
                  style={{
                    width: 8,
                    height: 8,
                    backgroundColor: dotColor,
                    borderRadius: 4,
                    marginRight: 10,
                  }}
                />
                <FlexWidget style={{ flex: 1, flexDirection: 'column', marginRight: 8 }}>
                  <TextWidget
                    text={n.title}
                    style={{
                      fontSize: 12,
                      fontFamily: 'SpaceMono',
                      color: C.text,
                      fontWeight: '600',
                    }}
                  />
                  <TextWidget
                    text={n.body}
                    style={{
                      fontSize: 10,
                      fontFamily: 'SpaceMono',
                      color: C.mutedText,
                      marginTop: 2,
                    }}
                  />
                </FlexWidget>
                <TextWidget
                  text={label}
                  style={{
                    fontSize: 11,
                    fontFamily: 'SpaceMono',
                    color: dotColor,
                    fontWeight: 'bold',
                  }}
                />
              </FlexWidget>
            );
          })}
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

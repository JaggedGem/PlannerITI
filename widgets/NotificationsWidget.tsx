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
        padding: 14,
        flexDirection: 'column',
      }}
    >
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 8,
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
            text="No upcoming reminders"
            style={{
              fontSize: 13,
              fontFamily: 'SpaceMono',
              color: C.mutedText,
            }}
          />
        </FlexWidget>
      ) : (
        <FlexWidget style={{ flexDirection: 'column' }}>
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
                  borderRadius: 10,
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 7,
                  paddingBottom: 7,
                  marginBottom: 5,
                }}
              >
                <FlexWidget
                  style={{
                    width: 8,
                    height: 8,
                    backgroundColor: dotColor,
                    borderRadius: 4,
                    marginRight: 8,
                  }}
                />
                <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
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
                      marginTop: 1,
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
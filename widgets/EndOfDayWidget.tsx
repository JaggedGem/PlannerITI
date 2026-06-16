'use no memo';
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { Colors } from '@/constants/Colors';

const C = Colors.dark;

interface EndOfDayWidgetProps {
  totalClasses: number;
  completedTasks: number;
  totalTasks: number;
  tomorrowClasses: number;
  message: string;
}

export function EndOfDayWidget(props: EndOfDayWidgetProps) {
  const { totalClasses, completedTasks, totalTasks, tomorrowClasses, message } = props;

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
            backgroundColor: C.green,
            borderRadius: 2,
            marginRight: 8,
          }}
        />
        <TextWidget
          text="Day Summary"
          style={{
            fontSize: 16,
            fontFamily: 'SpaceMono',
            color: C.text,
            fontWeight: 'bold',
          }}
        />
      </FlexWidget>

      <FlexWidget
        style={{
          flexDirection: 'row',
          justifyContent: 'space-around',
          marginBottom: 8,
        }}
      >
        <FlexWidget
          style={{
            flexDirection: 'column',
            alignItems: 'center',
            backgroundColor: C.overlayPrimary10,
            borderRadius: 12,
            paddingLeft: 14,
            paddingRight: 14,
            paddingTop: 8,
            paddingBottom: 8,
          }}
        >
          <TextWidget
            text={`${totalClasses}`}
            style={{
              fontSize: 22,
              fontFamily: 'SpaceMono',
              color: C.primary,
              fontWeight: 'bold',
            }}
          />
          <TextWidget
            text="Classes"
            style={{
              fontSize: 10,
              fontFamily: 'SpaceMono',
              color: C.mutedText,
            }}
          />
        </FlexWidget>

        <FlexWidget
          style={{
            flexDirection: 'column',
            alignItems: 'center',
            backgroundColor: C.overlayOrange10,
            borderRadius: 12,
            paddingLeft: 14,
            paddingRight: 14,
            paddingTop: 8,
            paddingBottom: 8,
          }}
        >
          <TextWidget
            text={`${completedTasks}/${totalTasks}`}
            style={{
              fontSize: 22,
              fontFamily: 'SpaceMono',
              color: C.orange,
              fontWeight: 'bold',
            }}
          />
          <TextWidget
            text="Tasks done"
            style={{
              fontSize: 10,
              fontFamily: 'SpaceMono',
              color: C.mutedText,
            }}
          />
        </FlexWidget>

        <FlexWidget
          style={{
            flexDirection: 'column',
            alignItems: 'center',
            backgroundColor: C.overlayPrimary10,
            borderRadius: 12,
            paddingLeft: 14,
            paddingRight: 14,
            paddingTop: 8,
            paddingBottom: 8,
          }}
        >
          <TextWidget
            text={`${tomorrowClasses}`}
            style={{
              fontSize: 22,
              fontFamily: 'SpaceMono',
              color: C.primary,
              fontWeight: 'bold',
            }}
          />
          <TextWidget
            text="Tomorrow"
            style={{
              fontSize: 10,
              fontFamily: 'SpaceMono',
              color: C.mutedText,
            }}
          />
        </FlexWidget>
      </FlexWidget>

      <TextWidget
        text={message}
        style={{
          fontSize: 12,
          fontFamily: 'SpaceMono',
          color: C.mutedText,
          textAlign: 'center',
          fontStyle: 'italic',
        }}
      />
    </FlexWidget>
  );
}
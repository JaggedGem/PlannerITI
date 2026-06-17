'use no memo';
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { ColorProp } from 'react-native-android-widget';

import { Colors } from '@/constants/Colors';

const C = Colors.dark;

interface EndOfDayWidgetProps {
  totalClasses: number;
  completedTasks: number;
  totalTasks: number;
  tomorrowClasses: number;
  message: string;
}

function StatTile({ value, label, color, bgColor }: { value: string; label: string; color: ColorProp; bgColor: ColorProp }) {
  return (
    <FlexWidget
      style={{
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        backgroundColor: bgColor,
        borderRadius: 12,
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 10,
        paddingBottom: 10,
      }}
    >
      <TextWidget
        text={value}
        style={{
          fontSize: 22,
          fontFamily: 'SpaceMono',
          color: color,
          fontWeight: 'bold',
        }}
      />
      <TextWidget
        text={label}
        style={{
          fontSize: 10,
          fontFamily: 'SpaceMono',
          color: C.mutedText,
          marginTop: 2,
        }}
      />
    </FlexWidget>
  );
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
        padding: 16,
        flexDirection: 'column',
        justifyContent: 'center',
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
            backgroundColor: C.green,
            borderRadius: 2,
            marginRight: 10,
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
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <StatTile value={`${totalClasses}`} label="Classes" color={C.primary} bgColor={C.overlayPrimary10} />
        <FlexWidget style={{ width: 8 }} />
        <StatTile value={`${completedTasks}/${totalTasks}`} label="Tasks done" color={C.orange} bgColor={C.overlayOrange10} />
        <FlexWidget style={{ width: 8 }} />
        <StatTile value={`${tomorrowClasses}`} label="Tomorrow" color={C.primary} bgColor={C.overlayPrimary10} />
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

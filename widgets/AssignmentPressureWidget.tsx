'use no memo';
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { Colors } from '@/constants/Colors';

const C = Colors.dark;

interface AssignmentPressureWidgetProps {
  assignments: Array<{
    id: string;
    title: string;
    courseName: string;
    dueDaysLeft: number;
    isUrgent: boolean;
    isSoon: boolean;
    isLater: boolean;
    assignmentType: string;
    isPriority: boolean;
  }>;
  totalPending: number;
}

export function AssignmentPressureWidget(props: AssignmentPressureWidgetProps) {
  const { assignments, totalPending } = props;
  const top3 = assignments.slice(0, 3);

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
            backgroundColor: C.orange,
            borderRadius: 2,
            marginRight: 8,
          }}
        />
        <FlexWidget style={{ flex: 1 }}>
          <TextWidget
            text="Assignments"
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
            backgroundColor: C.overlayOrange10,
            borderRadius: 10,
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 2,
            paddingBottom: 2,
          }}
        >
          <TextWidget
            text={`${totalPending} total`}
            style={{
              fontSize: 10,
              fontFamily: 'SpaceMono',
              color: C.orange,
            }}
          />
        </FlexWidget>
      </FlexWidget>

      {top3.length === 0 ? (
        <FlexWidget
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <TextWidget
            text={'\u2713'}
            style={{ fontSize: 32, color: C.green, marginBottom: 4 }}
          />
          <TextWidget
            text="All caught up!"
            style={{
              fontSize: 14,
              fontFamily: 'SpaceMono',
              color: C.mutedText,
            }}
          />
        </FlexWidget>
      ) : (
        <FlexWidget style={{ flexDirection: 'column' }}>
          {top3.map((a) => {
            const badgeColor = a.isUrgent
              ? C.red
              : a.isSoon
                ? C.orange
                : C.green;
            const badgeText = a.dueDaysLeft < 0 ? 'Overdue!' : (a.isUrgent ? 'Due today!' : `${a.dueDaysLeft}d`);
            const itemBg = a.isUrgent
              ? 'rgba(255, 59, 48, 0.08)'
              : a.isSoon
                ? C.overlayOrange10
                : C.overlayWhite05;

            return (
              <FlexWidget
                key={a.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: itemBg,
                  borderRadius: 10,
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 7,
                  paddingBottom: 7,
                  marginBottom: 5,
                }}
                clickAction="OPEN_APP"
              >
                <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
                  <TextWidget
                    text={a.title}
                    style={{
                      fontSize: 12,
                      fontFamily: 'SpaceMono',
                      color: C.text,
                      fontWeight: '600',
                    }}
                  />
                  <TextWidget
                    text={`${a.courseName} \u00B7 ${a.assignmentType}`}
                    style={{
                      fontSize: 10,
                      fontFamily: 'SpaceMono',
                      color: C.mutedText,
                      marginTop: 1,
                    }}
                  />
                </FlexWidget>
                <FlexWidget
                  style={{
                    backgroundColor: badgeColor,
                    borderRadius: 8,
                    paddingLeft: 7,
                    paddingRight: 7,
                    paddingTop: 3,
                    paddingBottom: 3,
                  }}
                >
                  <TextWidget
                    text={badgeText}
                    style={{
                      fontSize: 10,
                      fontFamily: 'SpaceMono',
                      color: '#000',
                      fontWeight: 'bold',
                    }}
                  />
                </FlexWidget>
              </FlexWidget>
            );
          })}
        </FlexWidget>
      )}

      {assignments.length > 3 && (
        <FlexWidget
          style={{
            marginTop: 6,
            alignItems: 'center',
          }}
        >
          <TextWidget
            text={`+${assignments.length - 3} more pending`}
            style={{
              fontSize: 10,
              fontFamily: 'SpaceMono',
              color: C.mutedText,
            }}
          />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
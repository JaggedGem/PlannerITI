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
            backgroundColor: C.orange,
            borderRadius: 2,
            marginRight: 10,
          }}
        />
        <FlexWidget style={{ flex: 1, marginRight: 8 }}>
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
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 3,
            paddingBottom: 3,
          }}
        >
          <TextWidget
            text={`${totalPending} total`}
            style={{
              fontSize: 10,
              fontFamily: 'SpaceMono',
              color: C.orange,
              fontWeight: 'bold',
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
            style={{ fontSize: 36, color: C.green, marginBottom: 6 }}
          />
          <TextWidget
            text="All caught up!"
            style={{
              fontSize: 14,
              fontFamily: 'SpaceMono',
              color: C.mutedText,
              textAlign: 'center',
            }}
          />
        </FlexWidget>
      ) : (
        <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
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
                  borderRadius: 12,
                  paddingLeft: 12,
                  paddingRight: 10,
                  paddingTop: 9,
                  paddingBottom: 9,
                  marginBottom: 8,
                }}
                clickAction="OPEN_APP"
              >
                <FlexWidget style={{ flex: 1, flexDirection: 'column', marginRight: 8 }}>
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
                      marginTop: 2,
                    }}
                  />
                </FlexWidget>
                <FlexWidget
                  style={{
                    backgroundColor: badgeColor,
                    borderRadius: 8,
                    paddingLeft: 8,
                    paddingRight: 8,
                    paddingTop: 4,
                    paddingBottom: 4,
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
            marginTop: 4,
            alignItems: 'center',
          }}
        >
          <TextWidget
            text={`+${assignments.length - 3} more pending`}
            style={{
              fontSize: 10,
              fontFamily: 'SpaceMono',
              color: C.mutedText,
              fontStyle: 'italic',
            }}
          />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

'use no memo';
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { Colors } from '@/constants/Colors';

const C = Colors.dark;

interface GradeImpactWidgetProps {
  subjects: Array<{
    subjectName: string;
    currentAverage: number;
    needToScore: number;
    targetAverage: number;
    grades: number[];
    isWeakest: boolean;
  }>;
}

function getBarColor(avg: number): `#${string}` {
  if (avg < 5) return '#FF3B30';
  if (avg < 7) return '#FF9500';
  return '#30D158';
}

export function GradeImpactWidget(props: GradeImpactWidgetProps) {
  const { subjects } = props;
  const displaySubjects = subjects.slice(0, 3);

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
            backgroundColor: C.purple,
            borderRadius: 2,
            marginRight: 8,
          }}
        />
        <TextWidget
          text="Grade Impact"
          style={{
            fontSize: 16,
            fontFamily: 'SpaceMono',
            color: C.text,
            fontWeight: 'bold',
          }}
        />
      </FlexWidget>

      {displaySubjects.length === 0 ? (
        <FlexWidget
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <TextWidget
            text="No grades data yet"
            style={{
              fontSize: 13,
              fontFamily: 'SpaceMono',
              color: C.mutedText,
            }}
          />
        </FlexWidget>
      ) : (
        <FlexWidget style={{ flexDirection: 'column' }}>
          {displaySubjects.map((s) => {
            const barPct = Math.max(10, Math.round(s.currentAverage * 10));
            const barColor = getBarColor(s.currentAverage);
            const needsWork = s.needToScore > 7;
            const critical = s.needToScore > 9;
            const bgColor = s.isWeakest ? C.overlayOrange10 : C.overlayWhite05;
            const needColor = critical ? C.red : (needsWork ? C.orange : C.mutedText);

            return (
              <FlexWidget
                key={s.subjectName}
                style={{
                  flexDirection: 'column',
                  backgroundColor: bgColor,
                  borderRadius: 10,
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 8,
                  paddingBottom: 8,
                  marginBottom: 8,
                }}
              >
                <FlexWidget
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 4,
                  }}
                >
                  <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <TextWidget
                      text={s.subjectName}
                      style={{
                        fontSize: 12,
                        fontFamily: 'SpaceMono',
                        color: C.text,
                        fontWeight: '600',
                      }}
                    />
                    {s.isWeakest && (
                      <FlexWidget
                        style={{
                          marginLeft: 6,
                          backgroundColor: '#FF9500',
                          borderRadius: 4,
                          paddingLeft: 5,
                          paddingRight: 5,
                          paddingTop: 1,
                          paddingBottom: 1,
                        }}
                      >
                        <TextWidget
                          text="weakest"
                          style={{
                            fontSize: 8,
                            fontFamily: 'SpaceMono',
                            color: '#000',
                            fontWeight: 'bold',
                          }}
                        />
                      </FlexWidget>
                    )}
                  </FlexWidget>
                  <TextWidget
                    text={`${s.currentAverage.toFixed(1)}`}
                    style={{
                      fontSize: 14,
                      fontFamily: 'SpaceMono',
                      color: barColor,
                      fontWeight: 'bold',
                    }}
                  />
                </FlexWidget>

                <FlexWidget
                  style={{
                    height: 4,
                    backgroundColor: C.overlayWhite10,
                    borderRadius: 2,
                    marginBottom: 4,
                    flexDirection: 'row',
                  }}
                >
                  <FlexWidget
                    style={{
                      width: barPct,
                      height: 4,
                      backgroundColor: barColor,
                      borderRadius: 2,
                    }}
                  />
                </FlexWidget>

                <TextWidget
                  text={`Need ${s.needToScore.toFixed(1)} on next to reach ${s.targetAverage.toFixed(1)}`}
                  style={{
                    fontSize: 10,
                    fontFamily: 'SpaceMono',
                    color: needColor,
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
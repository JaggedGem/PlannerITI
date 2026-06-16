'use no memo';
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { Colors } from '@/constants/Colors';

const C = Colors.dark;

interface ExamAlertWidgetProps {
  exams: Array<{
    subject: string;
    daysLeft: number;
    type: string;
    needsAttention: boolean;
  }>;
  hasExams: boolean;
}

export function ExamAlertWidget(props: ExamAlertWidgetProps) {
  const { exams, hasExams } = props;

  if (!hasExams || exams.length === 0) {
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
          alignItems: 'center',
        }}
      >
        <TextWidget
          text={'\uD83D\uDCDA'}
          style={{ fontSize: 28, marginBottom: 4 }}
        />
        <TextWidget
          text="No exams scheduled"
          style={{
            fontSize: 13,
            fontFamily: 'SpaceMono',
            color: C.mutedText,
          }}
        />
      </FlexWidget>
    );
  }

  const nextExam = exams[0];
  const urgent = nextExam.daysLeft <= 7;

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
          marginBottom: 8,
        }}
      >
        <FlexWidget
          style={{
            width: 4,
            height: 20,
            backgroundColor: urgent ? C.red : C.orange,
            borderRadius: 2,
            marginRight: 8,
          }}
        />
        <FlexWidget style={{ flex: 1 }}>
          <TextWidget
            text="Exam Alert"
            style={{
              fontSize: 16,
              fontFamily: 'SpaceMono',
              color: C.text,
              fontWeight: 'bold',
            }}
          />
        </FlexWidget>
        {urgent && (
          <FlexWidget
            style={{
              backgroundColor: C.red,
              borderRadius: 8,
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 2,
              paddingBottom: 2,
            }}
          >
            <TextWidget
              text="URGENT"
              style={{
                fontSize: 9,
                fontFamily: 'SpaceMono',
                color: '#000',
                fontWeight: 'bold',
              }}
            />
          </FlexWidget>
        )}
      </FlexWidget>

      <FlexWidget
        style={{
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <TextWidget
          text={`${nextExam.daysLeft}`}
          style={{
            fontSize: 36,
            fontFamily: 'SpaceMono',
            color: urgent ? C.red : C.orange,
            fontWeight: 'bold',
          }}
        />
        <TextWidget
          text={nextExam.daysLeft === 1 ? 'day left' : 'days left'}
          style={{
            fontSize: 12,
            fontFamily: 'SpaceMono',
            color: C.mutedText,
          }}
        />
      </FlexWidget>

      <TextWidget
        text={nextExam.subject}
        style={{
          fontSize: 14,
          fontFamily: 'SpaceMono',
          color: C.text,
          fontWeight: '600',
          textAlign: 'center',
        }}
      />
      <TextWidget
        text={nextExam.type}
        style={{
          fontSize: 11,
          fontFamily: 'SpaceMono',
          color: C.mutedText,
          textAlign: 'center',
          marginTop: 2,
        }}
      />

      {exams.length > 1 && (
        <TextWidget
          text={`+${exams.length - 1} more exam${exams.length > 2 ? 's' : ''}`}
          style={{
            fontSize: 10,
            fontFamily: 'SpaceMono',
            color: C.mutedText,
            textAlign: 'center',
            marginTop: 4,
          }}
        />
      )}
    </FlexWidget>
  );
}
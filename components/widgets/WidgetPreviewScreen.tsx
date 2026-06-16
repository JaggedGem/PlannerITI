import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WidgetPreview } from 'react-native-android-widget';

import { TodayGlanceWidget } from '@/widgets/TodayGlanceWidget';
import { AssignmentPressureWidget } from '@/widgets/AssignmentPressureWidget';
import { GradeImpactWidget } from '@/widgets/GradeImpactWidget';
import { CountdownWidget } from '@/widgets/CountdownWidget';
import { NotificationsWidget } from '@/widgets/NotificationsWidget';
import { EndOfDayWidget } from '@/widgets/EndOfDayWidget';
import { ExamAlertWidget } from '@/widgets/ExamAlertWidget';
import { Colors } from '@/constants/Colors';

const C = Colors.dark;

const sampleClasses = [
  { subjectName: 'Math Analysis', teacher: 'Dr. Popescu', room: '401', startTime: '08:00', endTime: '09:30', isOngoing: false, periodIndex: 480 },
  { subjectName: 'Physics', teacher: 'Prof. Ionescu', room: '203', startTime: '09:40', endTime: '11:10', isOngoing: true, periodIndex: 580 },
  { subjectName: 'Programming', teacher: 'Lect. Dumitru', room: 'Lab 3', startTime: '11:30', endTime: '13:00', isOngoing: false, periodIndex: 690 },
  { subjectName: 'English', teacher: 'Ms. Parker', room: '305', startTime: '13:10', endTime: '14:40', isOngoing: false, periodIndex: 790 },
];

const sampleAssignments = [
  { id: '1', title: 'Calculus Homework', courseName: 'Math Analysis', dueDate: '2026-06-17', dueDaysLeft: 1, isUrgent: true, isSoon: false, isLater: false, assignmentType: 'Homework', isCompleted: false, isPriority: true },
  { id: '2', title: 'Physics Lab Report', courseName: 'Physics', dueDate: '2026-06-19', dueDaysLeft: 3, isUrgent: false, isSoon: true, isLater: false, assignmentType: 'Lab', isCompleted: false, isPriority: false },
  { id: '3', title: 'Programming Project', courseName: 'Programming', dueDate: '2026-06-25', dueDaysLeft: 9, isUrgent: false, isSoon: false, isLater: true, assignmentType: 'Project', isCompleted: false, isPriority: false },
];

const sampleGrades = [
  { subjectName: 'Math Analysis', currentAverage: 7.8, needToScore: 8.5, targetAverage: 8.0, grades: [8, 7, 9, 7], isWeakest: true },
  { subjectName: 'Physics', currentAverage: 8.5, needToScore: 7.0, targetAverage: 8.5, grades: [9, 8, 8, 9], isWeakest: false },
  { subjectName: 'Programming', currentAverage: 9.2, needToScore: 6.0, targetAverage: 9.0, grades: [10, 9, 9, 9], isWeakest: false },
];

const sampleExams = [
  { subject: 'Math Analysis', date: '2026-06-20', daysLeft: 4, type: 'Exam', grade: 'TBD', needsAttention: true },
  { subject: 'Physics', date: '2026-06-25', daysLeft: 9, type: 'Exam', grade: 'TBD', needsAttention: false },
];

export default function WidgetPreviewScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Widget Preview</Text>
        <Text style={styles.headerSubtitle}>
          Preview how widgets will look on your home screen
        </Text>
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Today at a Glance</Text>
        <WidgetPreview
          renderWidget={() => (
            <TodayGlanceWidget
              classes={sampleClasses}
              currentClassIndex={1}
              nextClass={sampleClasses[2]}
              freeWindows={[{ start: '11:10', end: '11:30' }]}
              isWeekend={false}
              isSchoolDay={true}
              totalPending={5}
            />
          )}
          width={320}
          height={200}
        />

        <Text style={styles.sectionTitle}>Assignments Pressure</Text>
        <WidgetPreview
          renderWidget={() => (
            <AssignmentPressureWidget
              assignments={sampleAssignments}
              totalPending={7}
            />
          )}
          width={280}
          height={180}
        />

        <Text style={styles.sectionTitle}>Grade Impact</Text>
        <WidgetPreview
          renderWidget={() => (
            <GradeImpactWidget subjects={sampleGrades} />
          )}
          width={280}
          height={180}
        />

        <Text style={styles.sectionTitle}>Countdown</Text>
        <WidgetPreview
          renderWidget={() => (
            <CountdownWidget
              subjectName="Math Analysis"
              startTime="11:30"
              room="401"
              minutesUntil={85}
              isOngoing={false}
              hasClassesToday={true}
            />
          )}
          width={220}
          height={120}
        />

        <Text style={styles.sectionTitle}>Smart Reminders</Text>
        <WidgetPreview
          renderWidget={() => (
            <NotificationsWidget
              notifications={[
                { id: '1', title: 'Physics Lab Report', body: 'Physics - Lab', daysUntilDue: 3, type: 'Lab' },
                { id: '2', title: 'Calculus Homework', body: 'Math Analysis - Homework', daysUntilDue: 1, type: 'Homework' },
              ]}
            />
          )}
          width={280}
          height={160}
        />

        <Text style={styles.sectionTitle}>Day Summary</Text>
        <WidgetPreview
          renderWidget={() => (
            <EndOfDayWidget
              totalClasses={4}
              completedTasks={2}
              totalTasks={3}
              tomorrowClasses={3}
              message="Great work today!"
            />
          )}
          width={280}
          height={160}
        />

        <Text style={styles.sectionTitle}>Exam Alert</Text>
        <WidgetPreview
          renderWidget={() => (
            <ExamAlertWidget
              exams={sampleExams}
              hasExams={true}
            />
          )}
          width={220}
          height={120}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.backgroundApp,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'SpaceMono',
    fontWeight: 'bold',
    color: C.text,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'SpaceMono',
    color: C.mutedText,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'SpaceMono',
    fontWeight: '600',
    color: C.text,
    marginTop: 16,
    marginBottom: 8,
  },
});
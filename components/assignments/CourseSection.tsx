import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AssignmentItem from './AssignmentItem';
import { Assignment } from '../../utils/assignmentStorage';

type CourseSectionProps = {
  courseCode: string;
  courseName: string;
  assignments: Assignment[];
  onToggleAssignment: (id: string) => void;
  onEditCourse?: () => void;
};

export default function CourseSection({
  courseCode,
  courseName,
  assignments,
  onToggleAssignment,
  onEditCourse,
}: CourseSectionProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  
  // Get course color using the same function as DayView.tsx
  const courseColor = getSubjectColor(courseCode);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.courseTitle, { color: courseColor }]}>
          {courseCode} - {courseName}
        </Text>
        {onEditCourse && (
          <TouchableOpacity style={styles.editButton} onPress={onEditCourse}>
            <Feather name="edit-2" size={18} color={courseColor} />
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.assignmentsContainer}>
        {assignments.map(assignment => (
          <AssignmentItem
            key={assignment.id}
            assignment={assignment}
            onToggle={onToggleAssignment}
          />
        ))}
      </View>
    </View>
  );
}

// Helper function to get subject color consistently with DayView.tsx
function getSubjectColor(subjectName: string): string {
  const colors = [
    '#4169E1', // Royal Blue
    '#FF69B4', // Hot Pink
    '#32CD32', // Lime Green
    '#FF8C00', // Dark Orange
    '#9370DB', // Medium Purple
    '#20B2AA', // Light Sea Green
    '#FF6347', // Tomato
    '#4682B4', // Steel Blue
    '#9ACD32', // Yellow Green
    '#FF4500', // Orange Red
    '#BA55D3', // Medium Orchid
    '#2E8B57', // Sea Green
  ];

  // Generate a number from the subject name
  let hash = 0;
  for (let i = 0; i < subjectName.length; i++) {
    hash = subjectName.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Use the hash to pick a color
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  courseTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  editButton: {
    padding: 4,
  },
  assignmentsContainer: {
    marginTop: 4,
  },
}); 
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Assignment } from '../../utils/assignmentStorage';

type AssignmentItemProps = {
  assignment: Assignment;
  onToggle: (id: string) => void;
};

export default function AssignmentItem({ assignment, onToggle }: AssignmentItemProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  // Get course color consistently with DayView.tsx
  const courseColor = getSubjectColor(assignment.courseCode);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.checkbox}
        onPress={() => onToggle(assignment.id)}
      >
        {assignment.isCompleted ? (
          <View style={[styles.checked, { backgroundColor: courseColor }]}>
            <Feather name="check" size={14} color="white" />
          </View>
        ) : (
          <View style={[styles.unchecked, { borderColor: '#8A8A8D' }]} />
        )}
      </TouchableOpacity>
      <View style={styles.content}>
        <Text 
          style={[
            styles.title,
            assignment.isCompleted && styles.completedText
          ]}
        >
          {assignment.title}
        </Text>
        {assignment.details ? (
          <Text style={styles.note}>
            {assignment.details}
          </Text>
        ) : null}
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  checkbox: {
    marginRight: 12,
    marginTop: 2,
  },
  unchecked: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
  },
  checked: {
    width: 20,
    height: 20,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  completedText: {
    textDecorationLine: 'line-through',
    opacity: 0.7,
  },
  note: {
    fontSize: 14,
    marginTop: 4,
    color: '#8A8A8D',
  },
}); 
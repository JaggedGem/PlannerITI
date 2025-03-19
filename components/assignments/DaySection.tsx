import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useColorScheme } from 'react-native';
import CourseSection from './CourseSection';
import { Assignment } from '../../utils/assignmentStorage';

type DaySectionProps = {
  title: string;
  date: string;
  assignments: Assignment[];
  onToggleAssignment: (id: string) => void;
};

export default function DaySection({
  title,
  date,
  assignments,
  onToggleAssignment,
}: DaySectionProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  // Group assignments by course
  const courseGroups = groupAssignmentsByCourse(assignments);

  return (
    <View style={styles.container}>
      <Text style={styles.dayTitle}>
        {title} - {date}
      </Text>

      {Object.entries(courseGroups).map(([courseKey, courseAssignments]) => {
        // Extract course code and name from the first assignment
        const { courseCode, courseName } = courseAssignments[0];
        
        return (
          <CourseSection
            key={courseKey}
            courseCode={courseCode}
            courseName={courseName}
            assignments={courseAssignments}
            onToggleAssignment={onToggleAssignment}
          />
        );
      })}
    </View>
  );
}

// Helper function to group assignments by course
function groupAssignmentsByCourse(assignments: Assignment[]): { [key: string]: Assignment[] } {
  const groups: { [key: string]: Assignment[] } = {};
  
  assignments.forEach(assignment => {
    const { courseCode } = assignment;
    
    if (!groups[courseCode]) {
      groups[courseCode] = [];
    }
    
    groups[courseCode].push(assignment);
  });
  
  return groups;
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  dayTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginHorizontal: 16,
    marginBottom: 12,
    marginTop: 24,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
}); 
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useColorScheme } from 'react-native';
import CourseAssignment, { CourseAssignmentType } from './CourseAssignment';

type AssignmentDayProps = {
  title: string;
  courses: CourseAssignmentType[];
  onToggleItem: (courseId: string, itemId: string) => void;
  onEditCourse: (courseId: string) => void;
};

export default function AssignmentDay({
  title,
  courses,
  onToggleItem,
  onEditCourse,
}: AssignmentDayProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <View style={styles.container}>
      <Text style={[styles.dayTitle, { color: colors.text }]}>
        {title}
      </Text>
      
      {courses.map(course => (
        <CourseAssignment
          key={course.id}
          course={course}
          onToggleItem={onToggleItem}
          onEditCourse={onEditCourse}
        />
      ))}
    </View>
  );
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
  },
}); 
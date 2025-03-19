import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import ChecklistItem, { ChecklistItemType } from './ChecklistItem';

export type CourseAssignmentType = {
  id: string;
  courseCode: string;
  courseName: string;
  checklistItems: ChecklistItemType[];
  color?: string;
};

type CourseAssignmentProps = {
  course: CourseAssignmentType;
  onToggleItem: (courseId: string, itemId: string) => void;
  onEditCourse: (courseId: string) => void;
};

export default function CourseAssignment({
  course,
  onToggleItem,
  onEditCourse,
}: CourseAssignmentProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.courseTitle, { color: course.color || colors.tint }]}>
          {course.courseCode} - {course.courseName}
        </Text>
        <TouchableOpacity 
          style={styles.editButton}
          onPress={() => onEditCourse(course.id)}
        >
          <Feather name="edit-2" size={18} color={course.color || colors.tint} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.checklistContainer}>
        {course.checklistItems.map(item => (
          <ChecklistItem 
            key={item.id} 
            item={item} 
            onToggle={(itemId) => onToggleItem(course.id, itemId)} 
          />
        ))}
      </View>
    </View>
  );
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
    paddingVertical: 8,
  },
  courseTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  editButton: {
    padding: 4,
  },
  checklistContainer: {
    marginTop: 4,
  },
}); 
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useColorScheme } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import AssignmentItem from './AssignmentItem';
import { Assignment } from '../../utils/assignmentStorage';
import Animated, { FadeIn, Layout } from 'react-native-reanimated';
import { Period } from '../../services/scheduleService';

// Interface for assignment with optional period info
interface EnhancedAssignment extends Assignment {
  periodInfo?: Period;
}

type CourseSectionProps = {
  courseCode: string;
  courseName: string;
  assignments: (Assignment | EnhancedAssignment)[];
  onToggleAssignment: (id: string) => void;
  onEditCourse?: () => void;
};

// Function to get consistent color based on course code
const getSubjectColor = (courseCode: string): string => {
  // Generate a consistent hue based on the course code
  let hash = 0;
  for (let i = 0; i < courseCode.length; i++) {
    hash = courseCode.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Convert to HSL color with high saturation and fixed lightness
  const hue = Math.abs(hash % 360);
  const saturation = 70;
  const lightness = 38;
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
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
  
  const subjectColor = getSubjectColor(courseCode);
  
  // Group assignments by period if they have periodInfo
  const groupedByPeriod: { [key: string]: Assignment[] } = {
    'noPeriod': [] // For assignments without a period
  };
  
  // Sort and group assignments
  assignments.forEach((assignment) => {
    const enhancedAssignment = assignment as EnhancedAssignment;
    if (enhancedAssignment.periodInfo) {
      const periodId = enhancedAssignment.periodInfo._id;
      if (!groupedByPeriod[periodId]) {
        groupedByPeriod[periodId] = [];
      }
      groupedByPeriod[periodId].push(assignment);
    } else {
      groupedByPeriod['noPeriod'].push(assignment);
    }
  });
  
  // Sort period keys numerically
  const sortedPeriodIds = Object.keys(groupedByPeriod)
    .filter(id => id !== 'noPeriod')
    .sort((a, b) => parseInt(a) - parseInt(b));
  
  // Add 'noPeriod' at the end if it has assignments
  if (groupedByPeriod['noPeriod'].length > 0) {
    sortedPeriodIds.push('noPeriod');
  }

  return (
    <Animated.View 
      style={styles.container}
      entering={FadeIn.duration(300)}
      layout={Layout.springify()}
    >
      <View style={[styles.headerBar, { backgroundColor: subjectColor }]} />
      <View style={styles.contentContainer}>
        <View style={styles.header}>
          <View style={[styles.dot, { backgroundColor: subjectColor }]} />
          <Text style={[styles.courseTitle, { color: subjectColor }]}>
            {courseCode} - {courseName}
          </Text>
          {onEditCourse && (
            <TouchableOpacity style={styles.editButton} onPress={onEditCourse}>
              <Feather name="edit-2" size={18} color={subjectColor} />
            </TouchableOpacity>
          )}
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{assignments.length}</Text>
          </View>
        </View>
        
        <View style={styles.assignmentsContainer}>
          {sortedPeriodIds.map((periodId, groupIndex) => (
            <View key={periodId} style={styles.periodGroup}>
              {periodId !== 'noPeriod' && (
                <View style={styles.periodHeader}>
                  {/* Use the first assignment's periodInfo to show period details */}
                  {(groupedByPeriod[periodId][0] as EnhancedAssignment).periodInfo && (
                    <View style={styles.periodHeaderContent}>
                      <Ionicons name="time-outline" size={14} color="#8A8A8D" style={styles.periodIcon} />
                      <Text style={styles.periodText}>
                        Period {(groupedByPeriod[periodId][0] as EnhancedAssignment).periodInfo!._id}: {
                          (groupedByPeriod[periodId][0] as EnhancedAssignment).periodInfo!.starttime
                        } - {
                          (groupedByPeriod[periodId][0] as EnhancedAssignment).periodInfo!.endtime
                        }
                      </Text>
                    </View>
                  )}
                </View>
              )}
              
              {groupedByPeriod[periodId].map((assignment, index) => (
                <Animated.View 
                  key={assignment.id}
                  entering={FadeIn.duration(300).delay(index * 50 + groupIndex * 100)}
                  layout={Layout.springify()}
                >
                  <AssignmentItem
                    assignment={assignment}
                    onToggle={() => onToggleAssignment(assignment.id)}
                  />
                </Animated.View>
              ))}
            </View>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 8,
    marginVertical: 8,
    borderRadius: 12,
    backgroundColor: '#232433',
    overflow: 'hidden',
    flexDirection: 'row',
  },
  headerBar: {
    width: 6,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  contentContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  courseTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.3,
    flex: 1,
  },
  editButton: {
    padding: 4,
  },
  assignmentsContainer: {
    paddingVertical: 4,
  },
  countBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  periodGroup: {
    marginBottom: 8,
  },
  periodHeader: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    marginHorizontal: 8,
    marginBottom: 6,
    marginTop: 8,
  },
  periodHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  periodIcon: {
    marginRight: 6,
  },
  periodText: {
    fontSize: 12,
    color: '#AAAAAA',
    fontWeight: '500',
  },
}); 
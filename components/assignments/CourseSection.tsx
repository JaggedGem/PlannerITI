import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Assignment } from '../../utils/assignmentStorage';
import AssignmentItem from './AssignmentItem';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  FadeIn,
  Layout
} from 'react-native-reanimated';
import { useTranslation } from '@/hooks/useTranslation';
import { format, isToday, isYesterday, isTomorrow, differenceInDays } from 'date-fns';

interface CourseSectionProps {
  courseCode: string;
  courseName: string;
  assignments: Assignment[];
  onToggleAssignment: (id: string) => void;
  onDeleteAssignment?: (id: string) => void;
  showDueDate?: boolean;
  assignmentToHighlight?: string | null;
}

// Function to get a color for a course code
const getCourseColor = (courseCode: string, isOrphaned: boolean): string => {
  if (isOrphaned) {
    return '#8E8E93'; // Gray for orphaned courses
  }

  // Simple hash function to generate a consistent color for each course code
  let hash = 0;
  for (let i = 0; i < courseCode.length; i++) {
    hash = courseCode.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Generate HSL color with good saturation and lightness for dark theme
  const h = Math.abs(hash) % 360;
  const s = 65 + (Math.abs(hash) % 15); // 65-80% saturation
  const l = 45 + (Math.abs(hash) % 10); // 45-55% lightness
  
  return `hsl(${h}, ${s}%, ${l}%)`;
};

// Helper to format due date label
const formatDueDate = (dueDate: string, t: any): string => {
  const date = new Date(dueDate);
  const now = new Date();
  
  if (isToday(date)) {
    return t('assignments').days.today;
  } else if (isTomorrow(date)) {
    return t('assignments').days.tomorrow;
  } else if (isYesterday(date)) {
    return t('assignments').days.yesterday;
  }
  
  const daysDiff = differenceInDays(date, now);
  
  if (daysDiff > 0 && daysDiff < 7) {
    return format(date, 'EEEE'); // Day name
  } else {
    return format(date, 'MMM d'); // Month and day
  }
};

export default function CourseSection({
  courseCode,
  courseName,
  assignments,
  onToggleAssignment,
  onDeleteAssignment,
  showDueDate = false,
  assignmentToHighlight = null
}: CourseSectionProps) {
  const { t } = useTranslation();
  
  // Determine if the entire course is orphaned (all assignments are orphaned)
  const isCourseOrphaned = useMemo(() => {
    // If there are no assignments, course is not orphaned
    if (!assignments.length) return false;
    
    // Course is orphaned if ALL assignments are orphaned
    return assignments.every(assignment => assignment.isOrphaned);
  }, [assignments]);
  
  // Calculate the color based on course code and orphaned status
  const courseColor = useMemo(() => 
    getCourseColor(courseCode, isCourseOrphaned), 
  [courseCode, isCourseOrphaned]);
  
  // Sort assignments by due date
  const sortedAssignments = useMemo(() => {
    return [...assignments].sort((a, b) => {
      const dateA = new Date(a.dueDate);
      const dateB = new Date(b.dueDate);
      return dateA.getTime() - dateB.getTime();
    });
  }, [assignments]);
  
  // Memoize which assignment should be highlighted to avoid re-renders
  // This will only update when assignmentToHighlight or assignments change
  const highlightedAssignmentId = useMemo(() => assignmentToHighlight, [assignmentToHighlight]);
  
  // Determine if courseName is different enough from courseCode to display separately
  const shouldShowCourseName = courseName && 
    courseCode !== courseName && 
    !courseName.includes(courseCode) && 
    !courseCode.includes(courseName);
  
  return (
    <Animated.View
      style={[
        styles.container,
        isCourseOrphaned && styles.orphanedContainer
      ]}
      layout={Layout.springify().mass(0.5)}
    >
      <View style={styles.header}>
        <View style={[styles.courseAccent, { backgroundColor: courseColor }]} />
        <View style={[
          styles.headerContent,
          isCourseOrphaned && styles.orphanedHeaderContent
        ]}>
          <View style={styles.courseInfo}>
            <Text style={[
              styles.courseCode,
              isCourseOrphaned && styles.orphanedText
            ]}>
              {courseCode}
              {isCourseOrphaned && ' (Orphaned)'}
            </Text>
            {shouldShowCourseName && (
              <Text style={[
                styles.courseName,
                isCourseOrphaned && styles.orphanedText
              ]} numberOfLines={1}>
                {courseName}
              </Text>
            )}
            {isCourseOrphaned && (
              <Text style={styles.orphanedDescription}>
                {t('assignments').common.orphanedReason || 'Course not found in your schedule'}
              </Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={[
              styles.count,
              isCourseOrphaned && styles.orphanedText
            ]}>
              {assignments.length}
            </Text>
          </View>
        </View>
      </View>
      
      <View style={styles.content}>
        {sortedAssignments.map((assignment, index) => {
          // Create a copy of the assignment with modified properties for orphaned courses
          const assignmentToRender = isCourseOrphaned 
            ? { ...assignment, isOrphaned: false, inOrphanedCourse: true }
            : assignment;
            
          // Check if this assignment should be highlighted
          const isHighlighted = highlightedAssignmentId === assignment.id;
          
          return (
            <AssignmentItem
              key={assignment.id}
              assignment={assignmentToRender}
              onToggle={() => onToggleAssignment(assignment.id)}
              onDelete={onDeleteAssignment ? () => onDeleteAssignment(assignment.id) : undefined}
              showDueDate={showDueDate}
              dueDateLabel={showDueDate ? formatDueDate(assignment.dueDate, t) : undefined}
              inOrphanedCourse={isCourseOrphaned}
              isHighlighted={isHighlighted}
            />
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },
  orphanedContainer: {
    backgroundColor: '#191919',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    opacity: 0.9,
  },
  header: {
    flexDirection: 'row',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  courseAccent: {
    width: 4,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  headerContent: {
    flex: 1,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#232323',
  },
  orphanedHeaderContent: {
    backgroundColor: '#1E1E1E',
  },
  courseInfo: {
    flex: 1,
  },
  courseCode: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  courseName: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  orphanedText: {
    color: '#8E8E93',
  },
  orphanedDescription: {
    fontSize: 11,
    color: '#E0383E',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  count: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingBottom: 6,
  }
}); 
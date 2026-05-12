import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { Assignment } from '../../utils/assignmentStorage';
import AssignmentItem from './AssignmentItem';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  FadeIn,
  Layout
} from 'react-native-reanimated';
import { useTranslation } from '@/hooks/useTranslation';
import { format, isToday, isYesterday, isTomorrow, differenceInDays } from 'date-fns';
import { Colors } from '@/constants/Colors';
import { useThemedStyles } from '@/hooks/useThemedStyles';

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
type ThemeColors = typeof Colors.light;

const getCourseColor = (courseCode: string, isOrphaned: boolean, colors: ThemeColors): string => {
  if (isOrphaned) {
    return colors.gray;
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
  const { colors, styles } = useThemedStyles(createStyles);
  
  // Determine if the entire course is orphaned (all assignments are orphaned)
  const isCourseOrphaned = useMemo(() => {
    // If there are no assignments, course is not orphaned
    if (!assignments.length) return false;
    
    // Course is orphaned if ALL assignments are orphaned
    return assignments.every(assignment => assignment.isOrphaned);
  }, [assignments]);
  
  // Calculate the color based on course code and orphaned status
  const courseColor = useMemo(() => 
    getCourseColor(courseCode, isCourseOrphaned, colors), 
  [courseCode, isCourseOrphaned, colors]);
  
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
              {isCourseOrphaned && ` (${t('assignments').common.orphaned})`}
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
                {t('assignments').common.orphanedReason}
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

const createStyles = (colors: ThemeColors) => ({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSecondary,
  },
  orphanedContainer: {
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
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
    backgroundColor: colors.surfaceRaised,
  },
  orphanedHeaderContent: {
    backgroundColor: colors.cardMuted,
  },
  courseInfo: {
    flex: 1,
  },
  courseCode: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  courseName: {
    fontSize: 13,
    color: colors.text,
  },
  orphanedText: {
    color: colors.gray,
  },
  orphanedDescription: {
    fontSize: 11,
    color: colors.danger,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  count: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  content: {
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingBottom: 6,
  }
});
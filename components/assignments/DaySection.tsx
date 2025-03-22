import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import CourseSection from './CourseSection';
import { Assignment, getPeriodById } from '../../utils/assignmentStorage';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  FadeIn,
  FadeOut,
  Layout,
  Easing
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Period } from '../../services/scheduleService';

type DaySectionProps = {
  title: string;
  date: string;
  assignments: Assignment[];
  onToggleAssignment: (id: string) => void;
  onDeleteAssignment?: (id: string) => void;
};

interface EnhancedAssignment extends Assignment {
  periodInfo?: Period;
}

const getDayColor = (title: string): [string, string] => {
  if (title.includes('Today')) {
    return ['#4A76F1', '#2C3DCD'] as [string, string];
  } else if (title.includes('Tomorrow')) {
    return ['#614FE0', '#4A2CD0'] as [string, string];
  } else if (title.startsWith('Monday')) {
    return ['#3A6073', '#16222A'] as [string, string];
  } else if (title.startsWith('Tuesday')) {
    return ['#3F5C6C', '#203A43'] as [string, string];
  } else if (title.startsWith('Wednesday')) {
    return ['#5B5F97', '#373860'] as [string, string];
  } else if (title.startsWith('Thursday')) {
    return ['#4B6073', '#252f3b'] as [string, string];
  } else if (title.startsWith('Friday')) {
    return ['#526175', '#2E3951'] as [string, string];
  } else if (title.startsWith('Saturday')) {
    return ['#755B69', '#3F2E38'] as [string, string];
  } else if (title.startsWith('Sunday')) {
    return ['#5E4266', '#39274A'] as [string, string];
  } else {
    return ['#333440', '#1F1F28'] as [string, string];
  }
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function DaySection({ title, date, assignments, onToggleAssignment, onDeleteAssignment }: DaySectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const rotation = useSharedValue(0);
  const [enhancedAssignments, setEnhancedAssignments] = useState<EnhancedAssignment[]>([]);
  
  // Fetch period info for assignments with periodId
  useEffect(() => {
    const loadPeriodInfo = async () => {
      const enhanced = await Promise.all(
        assignments.map(async (assignment) => {
          if (assignment.periodId) {
            try {
              const periodInfo = await getPeriodById(assignment.periodId);
              return {
                ...assignment,
                periodInfo: periodInfo
              };
            } catch (error) {
              console.error('Error loading period info:', error);
            }
          }
          return assignment;
        })
      );
      
      setEnhancedAssignments(enhanced);
    };
    
    loadPeriodInfo();
  }, [assignments]);
  
  // Group assignments by course and sort by period if available
  const groupedByCourse: { [key: string]: EnhancedAssignment[] } = {};
  enhancedAssignments.forEach(assignment => {
    // Use courseName as the grouping key to ensure same subject assignments stay together
    // Fall back to id if courseName is empty
    const courseKey = assignment.courseName || assignment.courseCode || `uncategorized-${assignment.id}`;
    
    if (!groupedByCourse[courseKey]) {
      groupedByCourse[courseKey] = [];
    }
    groupedByCourse[courseKey].push(assignment);
  });
  
  // Sort assignments in each course group by period if available, then by type
  Object.keys(groupedByCourse).forEach(courseKey => {
    groupedByCourse[courseKey].sort((a, b) => {
      // First sort by period
      if (a.periodInfo && b.periodInfo) {
        const periodA = parseInt(a.periodInfo._id);
        const periodB = parseInt(b.periodInfo._id);
        if (periodA !== periodB) {
          return periodA - periodB;
        }
      } else if (a.periodInfo) {
        return -1; // a has period, b doesn't
      } else if (b.periodInfo) {
        return 1; // b has period, a doesn't
      }
      
      // Then by due date
      const dateComparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (dateComparison !== 0) return dateComparison;
      
      // Finally by assignment type
      return a.assignmentType.localeCompare(b.assignmentType);
    });
  });
  
  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
    rotation.value = withSequence(
      withTiming(rotation.value + 0.05, { duration: 50 }),
      withTiming(isCollapsed ? 0 : 0.5, { 
        duration: 150,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1)
      })
    );
  };
  
  const chevronStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value * 180}deg` }],
    };
  });
  
  const colors = getDayColor(title);
  
  return (
    <Animated.View 
      style={styles.container}
      layout={Layout.springify().mass(0.5)}
    >
      <AnimatedPressable 
        onPress={toggleCollapse}
        style={({ pressed }) => [
          styles.headerContainer,
          pressed && styles.headerPressed
        ]}
      >
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.date}>{date}</Text>
            </View>
            <View style={styles.countContainer}>
              <Text style={styles.count}>{assignments.length}</Text>
              <Animated.View style={[styles.chevron, chevronStyle]}>
                <Ionicons name="chevron-down" size={18} color="#FFFFFF" />
              </Animated.View>
            </View>
          </View>
        </LinearGradient>
      </AnimatedPressable>
      
      {!isCollapsed && (
        <Animated.View 
          style={styles.content}
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(100)}
          layout={Layout.springify().mass(0.5)}
        >
          {Object.entries(groupedByCourse).map(([courseKey, courseAssignments], index) => (
            <Animated.View
              key={courseKey}
              entering={FadeIn.duration(150).delay(index * 50)}
              layout={Layout.springify().mass(0.5)}
              style={styles.courseSection}
            >
              <CourseSection
                courseCode={courseAssignments[0].courseCode || courseKey}
                courseName={courseAssignments[0].courseName || 'Uncategorized'}
                assignments={courseAssignments}
                onToggleAssignment={onToggleAssignment}
                onDeleteAssignment={onDeleteAssignment}
                showDueDate={false}
              />
            </Animated.View>
          ))}
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#141414',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerContainer: {
    borderRadius: 16,
  },
  headerPressed: {
    opacity: 0.9,
  },
  headerGradient: {
    borderRadius: 16,
  },
  headerContent: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  date: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  countContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  count: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 8,
  },
  chevron: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 12,
  },
  courseSection: {
    marginBottom: 8,
  }
}); 
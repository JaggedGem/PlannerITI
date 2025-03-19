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
};

interface EnhancedAssignment extends Assignment {
  periodInfo?: Period;
}

const getDayColor = (title: string): [string, string] => {
  if (title.includes('Today')) {
    return ['#4A76F1', '#2C3DCD'] as [string, string];
  } else if (title.includes('Tomorrow')) {
    return ['#614FE0', '#4A2CD0'] as [string, string];
  } else {
    return ['#333440', '#1F1F28'] as [string, string];
  }
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function DaySection({ title, date, assignments, onToggleAssignment }: DaySectionProps) {
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
    const courseCode = assignment.courseCode;
    if (!groupedByCourse[courseCode]) {
      groupedByCourse[courseCode] = [];
    }
    groupedByCourse[courseCode].push(assignment);
  });
  
  // Sort assignments in each course group by period if available
  Object.keys(groupedByCourse).forEach(courseCode => {
    groupedByCourse[courseCode].sort((a, b) => {
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
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  });
  
  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
    rotation.value = withSequence(
      withTiming(rotation.value + 0.05, { duration: 100 }),
      withTiming(isCollapsed ? 0 : 0.5, { 
        duration: 300,
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
      layout={Layout.springify().mass(0.8)}
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
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
          layout={Layout.springify()}
        >
          {Object.entries(groupedByCourse).map(([courseCode, courseAssignments], index) => (
            <Animated.View
              key={courseCode}
              entering={FadeIn.duration(300).delay(index * 100)}
              layout={Layout.springify()}
              style={styles.courseSection}
            >
              <CourseSection
                courseCode={courseCode}
                courseName={courseAssignments[0].courseName}
                assignments={courseAssignments}
                onToggleAssignment={onToggleAssignment}
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
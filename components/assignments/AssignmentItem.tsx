import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Assignment, getPeriodById } from '../../utils/assignmentStorage';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSpring,
  FadeIn,
  Layout 
} from 'react-native-reanimated';
import { Period } from '../../services/scheduleService';

interface AssignmentItemProps {
  assignment: Assignment;
  onToggle: () => void;
  onDelete?: () => void;
  showDueDate?: boolean;
  dueDateLabel?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function AssignmentItem({ 
  assignment, 
  onToggle, 
  onDelete, 
  showDueDate = false,
  dueDateLabel 
}: AssignmentItemProps) {
  // State for period information
  const [period, setPeriod] = useState<Period | null>(null);
  
  // Animated values for interactive feedback
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const checkScale = useSharedValue(assignment.isCompleted ? 1 : 0);
  
  // Update check animation when completion status changes
  React.useEffect(() => {
    checkScale.value = withTiming(assignment.isCompleted ? 1 : 0, {
      duration: 150,
    });
  }, [assignment.isCompleted, checkScale]);
  
  // Load period information if assignment has periodId
  useEffect(() => {
    const loadPeriodInfo = async () => {
      if (assignment.periodId) {
        try {
          const periodInfo = await getPeriodById(assignment.periodId);
          if (periodInfo) {
            setPeriod(periodInfo);
          }
        } catch (error) {
          console.error('Error loading period info:', error);
        }
      }
    };
    
    loadPeriodInfo();
  }, [assignment.periodId]);
  
  // Format the due date/time for display
  const formattedTime = format(new Date(assignment.dueDate), 'h:mm a');
  
  // Animation styles
  const containerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });
  
  const checkboxStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: checkScale.value }],
      opacity: checkScale.value,
    };
  });
  
  // Press handlers for interactive feedback
  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 12, stiffness: 400 });
    opacity.value = withTiming(0.9, { duration: 100 });
  };
  
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    opacity.value = withTiming(1, { duration: 100 });
  };
  
  // Determine priority styles
  const priorityColor = assignment.isPriority ? '#FF3B30' : 'transparent';
  
  return (
    <AnimatedPressable
      style={[styles.container, containerStyle]}
      onPress={onToggle}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <View style={styles.leftSection}>
        <View style={styles.checkboxContainer}>
          <View style={[styles.checkbox, assignment.isCompleted && styles.checkboxChecked]}>
            <Animated.View style={[styles.checkIcon, checkboxStyle]}>
              <Ionicons name="checkmark" size={14} color="#FFFFFF" />
            </Animated.View>
          </View>
        </View>
        
        <View style={styles.contentContainer}>
          <Text 
            style={[
              styles.title,
              assignment.isCompleted && styles.completedTitle
            ]}
            numberOfLines={2}
          >
            {assignment.title}
          </Text>
          
          {assignment.description ? (
            <Text 
              style={styles.description}
              numberOfLines={1}
            >
              {assignment.description}
            </Text>
          ) : null}
          
          {period && (
            <View style={styles.periodContainer}>
              <Ionicons name="time-outline" size={12} color="#8A8A8D" style={styles.periodIcon} />
              <Text style={styles.periodText}>
                Period {period._id}: {period.starttime} - {period.endtime}
              </Text>
            </View>
          )}
          
          {showDueDate && dueDateLabel && (
            <View style={styles.dueDateContainer}>
              <Ionicons name="calendar-outline" size={12} color="#8A8A8D" style={styles.periodIcon} />
              <Text style={styles.dueDateText}>
                Due: {dueDateLabel}
              </Text>
            </View>
          )}
        </View>
      </View>
      
      <View style={styles.rightSection}>
        {assignment.isPriority && (
          <View style={[styles.priorityIndicator, { backgroundColor: priorityColor }]}>
            <Ionicons name="star" size={12} color="#FFFFFF" />
          </View>
        )}
        <Text style={styles.timeText}>{formattedTime}</Text>
        
        {onDelete && (
          <Pressable 
            style={styles.deleteButton}
            onPress={onDelete}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <Ionicons name="trash-outline" size={16} color="#FF3B30" />
          </Pressable>
        )}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#232323',
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkboxContainer: {
    marginRight: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#3478F6',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: '#3478F6',
    borderColor: '#3478F6',
  },
  checkIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 14,
    height: 14,
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  completedTitle: {
    textDecorationLine: 'line-through',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  description: {
    fontSize: 13,
    color: '#8A8A8D',
    marginBottom: 4,
  },
  periodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  periodIcon: {
    marginRight: 4,
  },
  periodText: {
    fontSize: 12,
    color: '#8A8A8D',
  },
  dueDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  dueDateText: {
    fontSize: 12,
    color: '#8A8A8D',
    fontWeight: '500',
  },
  rightSection: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  timeText: {
    fontSize: 12,
    color: '#8A8A8D',
    marginTop: 4,
  },
  priorityIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  deleteButton: {
    marginTop: 8,
    padding: 2,
  },
}); 
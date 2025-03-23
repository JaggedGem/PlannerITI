import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Assignment, getPeriodById, AssignmentType } from '../../utils/assignmentStorage';
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
import { useTranslation } from '@/hooks/useTranslation';

interface AssignmentItemProps {
  assignment: Assignment;
  onToggle: () => void;
  onDelete?: () => void;
  showDueDate?: boolean;
  dueDateLabel?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Function to get translated label for each assignment type
const getAssignmentTypeLabel = (type: AssignmentType): string => {
  const { t } = useTranslation();
  
  switch (type) {
    case AssignmentType.HOMEWORK:
      return t('assignments').types.homework;
    case AssignmentType.TEST:
      return t('assignments').types.test;
    case AssignmentType.EXAM:
      return t('assignments').types.exam;
    case AssignmentType.PROJECT:
      return t('assignments').types.project;
    case AssignmentType.QUIZ:
      return t('assignments').types.quiz;
    case AssignmentType.LAB:
      return t('assignments').types.lab;
    case AssignmentType.ESSAY:
      return t('assignments').types.essay;
    case AssignmentType.PRESENTATION:
      return t('assignments').types.presentation;
    default:
      return t('assignments').types.other;
  }
};

// Function to get icon for each assignment type
const getAssignmentTypeIcon = (type: AssignmentType): any => {
  switch (type) {
    case AssignmentType.HOMEWORK:
      return 'book-outline';
    case AssignmentType.TEST:
      return 'document-text-outline';
    case AssignmentType.EXAM:
      return 'school-outline';
    case AssignmentType.PROJECT:
      return 'construct-outline';
    case AssignmentType.QUIZ:
      return 'clipboard-outline';
    case AssignmentType.LAB:
      return 'flask-outline';
    case AssignmentType.ESSAY:
      return 'create-outline';
    case AssignmentType.PRESENTATION:
      return 'easel-outline';
    default:
      return 'ellipsis-horizontal-outline';
  }
};

// Function to get color for each assignment type
const getAssignmentTypeColor = (type: AssignmentType): string => {
  switch (type) {
    case AssignmentType.HOMEWORK:
      return '#3478F6'; // iOS Blue
    case AssignmentType.TEST:
      return '#FF9500'; // iOS Orange
    case AssignmentType.EXAM:
      return '#FF3B30'; // iOS Red
    case AssignmentType.PROJECT:
      return '#5E5CE6'; // iOS Purple
    case AssignmentType.QUIZ:
      return '#FF375F'; // iOS Pink
    case AssignmentType.LAB:
      return '#64D2FF'; // iOS Light Blue
    case AssignmentType.ESSAY:
      return '#30D158'; // iOS Green
    case AssignmentType.PRESENTATION:
      return '#FFD60A'; // iOS Yellow
    default:
      return '#8E8E93'; // iOS Gray
  }
};

export default function AssignmentItem({ 
  assignment, 
  onToggle, 
  onDelete, 
  showDueDate = false,
  dueDateLabel 
}: AssignmentItemProps) {
  // State for period information
  const [period, setPeriod] = useState<Period | null>(null);
  const { t, currentLanguage } = useTranslation();
  
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
  
  // Format the due date/time for display with localization
  const formattedTime = (() => {
    const date = new Date(assignment.dueDate);
    
    // Format time as localized string (e.g., "3:30 PM" or "15:30")
    if (currentLanguage === 'en') {
      return format(date, 'h:mm a');  // 12-hour format with AM/PM
    } else {
      return format(date, 'HH:mm');   // 24-hour format
    }
  })();
  
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
  
  // Get assignment type icon and color
  const typeIcon = getAssignmentTypeIcon(assignment.assignmentType);
  const typeColor = getAssignmentTypeColor(assignment.assignmentType);
  const typeLabel = getAssignmentTypeLabel(assignment.assignmentType);
  
  // Display style for orphaned assignments
  const isOrphaned = assignment.isOrphaned;
  
  return (
    <AnimatedPressable
      style={[
        styles.container, 
        containerStyle,
        isOrphaned && styles.orphanedContainer
      ]}
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
          <View style={styles.titleRow}>
            <View style={[styles.typeIndicator, { backgroundColor: isOrphaned ? '#8E8E93' : typeColor }]}>
              <Ionicons name={isOrphaned ? 'alert-circle' : typeIcon} size={12} color="#FFFFFF" />
            </View>
            <Text 
              style={[
                styles.title,
                assignment.isCompleted && styles.completedTitle,
                isOrphaned && styles.orphanedText
              ]}
              numberOfLines={2}
            >
              {assignment.title}
            </Text>
          </View>
          
          {assignment.description ? (
            <Text 
              style={[
                styles.description,
                isOrphaned && styles.orphanedDescription
              ]}
              numberOfLines={1}
            >
              {assignment.description}
            </Text>
          ) : null}
          
          <View style={styles.metadataContainer}>
            {isOrphaned ? (
              <View style={styles.orphanedBadge}>
                <Text style={styles.orphanedBadgeText}>
                  {t('assignments').common.orphanedReason}
                </Text>
              </View>
            ) : (
              <View style={styles.typeTextContainer}>
                <Text style={[styles.typeText, { color: typeColor }]}>
                  {typeLabel}
                </Text>
              </View>
            )}
            
            {period && !isOrphaned && (
              <View style={styles.periodContainer}>
                <Ionicons name="time-outline" size={12} color="#8A8A8D" style={styles.periodIcon} />
                <Text style={styles.periodText}>
                  {t('assignments').common.period} {period._id}: {period.starttime} - {period.endtime}
                </Text>
              </View>
            )}
            
            {showDueDate && dueDateLabel && (
              <View style={styles.dueDateContainer}>
                <Ionicons name="calendar-outline" size={12} color="#8A8A8D" style={styles.periodIcon} />
                <Text style={styles.dueDateText}>
                  {t('assignments').common.due}: {dueDateLabel}
                </Text>
              </View>
            )}
          </View>
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  typeIndicator: {
    width: 20,
    height: 20,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    flex: 1,
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
  metadataContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 4,
  },
  typeTextContainer: {
    marginRight: 8,
    marginBottom: 2,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  periodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 2,
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
    marginBottom: 2,
  },
  dueDateText: {
    fontSize: 12,
    color: '#8A8A8D',
  },
  rightSection: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 8,
  },
  priorityIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  timeText: {
    fontSize: 12,
    color: '#8A8A8D',
    marginBottom: 4,
  },
  deleteButton: {
    padding: 4,
  },
  orphanedContainer: {
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#3A3A3A',
    opacity: 0.8
  },
  orphanedText: {
    color: '#8E8E93',
  },
  orphanedBadge: {
    backgroundColor: '#E0383E',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  orphanedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  orphanedDescription: {
    color: '#6E6E73',
  },
}); 
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity, TextInput } from 'react-native';
import { Assignment, getPeriodById, AssignmentType, Subtask, toggleSubtaskCompletion, addSubtask, deleteSubtask, updateAllSubtaskCompletion } from '../../utils/assignmentStorage';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSpring,
  FadeIn,
  Layout,
  FadeOut,
  Easing
} from 'react-native-reanimated';
import { Period } from '../../services/scheduleService';
import { useTranslation } from '@/hooks/useTranslation';
import { getRemainingTimeText } from '../../utils/notificationUtils';
import * as Haptics from 'expo-haptics';

interface AssignmentItemProps {
  assignment: Assignment;
  onToggle: () => void;
  onDelete?: () => void;
  showDueDate?: boolean;
  dueDateLabel?: string;
  inOrphanedCourse?: boolean;
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
  dueDateLabel,
  inOrphanedCourse = false
}: AssignmentItemProps) {
  // State for period information
  const [period, setPeriod] = useState<Period | null>(null);
  const [remainingTime, setRemainingTime] = useState<string>('');
  const { t, currentLanguage } = useTranslation();
  
  // Add state for subtasks
  const [expanded, setExpanded] = useState(false);
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [localSubtasks, setLocalSubtasks] = useState<Subtask[]>(assignment.subtasks || []);
  
  // Animated values for interactive feedback
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const checkScale = useSharedValue(assignment.isCompleted ? 1 : 0);
  const expandHeight = useSharedValue(0);
  
  // Sync local subtasks with assignment subtasks
  useEffect(() => {
    setLocalSubtasks(assignment.subtasks || []);
  }, [assignment.subtasks]);
  
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

  // Update remaining time text
  useEffect(() => {
    // Initial update
    setRemainingTime(getRemainingTimeText(assignment.dueDate));
    
    // Update remaining time every minute
    const interval = setInterval(() => {
      setRemainingTime(getRemainingTimeText(assignment.dueDate));
    }, 60000); // 1 minute
    
    return () => clearInterval(interval);
  }, [assignment.dueDate]);
  
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
  
  // Determine if assignment is overdue
  const isOverdue = remainingTime === 'Overdue' && !assignment.isCompleted;
  
  // Toggle the expanded state
  const toggleExpanded = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpanded(!expanded);
  };
  
  // Custom handler for toggling assignment completion
  const handleToggleAssignment = async () => {
    // Determine the new completion state (opposite of current)
    const newCompletionState = !assignment.isCompleted;
    
    // Update subtasks locally for immediate UI response
    const updatedSubtasks = localSubtasks.map(subtask => ({
      ...subtask,
      isCompleted: newCompletionState // Set all subtasks to the same completion state
    }));
    
    // Update local state immediately
    setLocalSubtasks(updatedSubtasks);
    
    // Call the parent's onToggle to handle the assignment toggle
    onToggle();
    
    // Update all subtasks in storage (done asynchronously)
    if (localSubtasks.length > 0) {
      updateAllSubtaskCompletion(assignment.id, newCompletionState);
    }
  };
  
  // Handle adding new subtask
  const handleAddSubtask = async () => {
    if (newSubtaskTitle.trim() === '') return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const subtask = await addSubtask(assignment.id, newSubtaskTitle.trim());
    if (subtask) {
      setLocalSubtasks([...localSubtasks, subtask]);
      setNewSubtaskTitle('');
      setShowAddSubtask(false);
    }
  };
  
  // Handle toggling subtask completion
  const handleToggleSubtask = async (subtaskId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Find the subtask
    const subtaskIndex = localSubtasks.findIndex(st => st.id === subtaskId);
    if (subtaskIndex === -1) return;
    
    // Determine new completion state (opposite of current)
    const newCompletionState = !localSubtasks[subtaskIndex].isCompleted;
    
    // Update local state first for immediate UI response
    const updatedSubtasks = localSubtasks.map(st => 
      st.id === subtaskId 
        ? { ...st, isCompleted: newCompletionState } 
        : st
    );
    setLocalSubtasks(updatedSubtasks);
    
    // Check if all subtasks are now completed or uncompleted
    const allCompleted = updatedSubtasks.every(st => st.isCompleted);
    const allUncompleted = updatedSubtasks.every(st => !st.isCompleted);
    
    // If completion state should affect the parent assignment
    if ((allCompleted && !assignment.isCompleted) || 
        (allUncompleted && assignment.isCompleted)) {
      // Call parent toggle to update assignment
      onToggle();
    }
    
    // Then update in storage (asynchronous)
    await toggleSubtaskCompletion(assignment.id, subtaskId);
  };
  
  // Handle deleting a subtask
  const handleDeleteSubtask = async (subtaskId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Optimistically update UI first
    setLocalSubtasks(localSubtasks.filter(st => st.id !== subtaskId));
    
    // Then update in storage
    await deleteSubtask(assignment.id, subtaskId);
  };
  
  // Calculate subtask progress
  const completedSubtasks = localSubtasks.filter(st => st.isCompleted).length;
  const hasSubtasks = localSubtasks.length > 0;
  const subtaskProgress = hasSubtasks ? 
    Math.round((completedSubtasks / localSubtasks.length) * 100) : 0;
  
  return (
    <View style={styles.outerContainer}>
      <AnimatedPressable
        style={[
          styles.container, 
          containerStyle,
          isOrphaned && styles.orphanedContainer,
          isOverdue && styles.overdueContainer,
          inOrphanedCourse && styles.inOrphanedCourseContainer
        ]}
        onPress={handleToggleAssignment}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        entering={FadeIn.duration(300)}
        layout={Layout.springify()}
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
                  isOrphaned && styles.orphanedText,
                  inOrphanedCourse && styles.inOrphanedCourseText
                ]}
                numberOfLines={2}
              >
                {assignment.title}
              </Text>
              
              {/* Subtask expand button */}
              {hasSubtasks && (
                <TouchableOpacity 
                  style={styles.expandButton}
                  onPress={toggleExpanded}
                  hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                >
                  <Ionicons 
                    name={expanded ? "chevron-up" : "chevron-down"} 
                    size={16} 
                    color="#8A8A8D" 
                  />
                </TouchableOpacity>
              )}
            </View>
            
            {/* Subtask progress indicator */}
            {hasSubtasks && !expanded && (
              <View style={styles.subtaskProgressContainer}>
                <View style={styles.subtaskProgressBar}>
                  <View 
                    style={[
                      styles.subtaskProgressFill, 
                      { width: `${subtaskProgress}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.subtaskProgressText}>
                  {completedSubtasks}/{localSubtasks.length}
                </Text>
              </View>
            )}
            
            {/* Show description if available and no subtasks or not expanded */}
            {assignment.description && (!hasSubtasks || !expanded) ? (
              <Text 
                style={[
                  styles.description,
                  isOrphaned && styles.orphanedDescription,
                  inOrphanedCourse && styles.inOrphanedCourseText
                ]}
                numberOfLines={1}
              >
                {assignment.description}
              </Text>
            ) : null}
          </View>
        </View>
        
        <View style={styles.rightSection}>
          {assignment.isPriority && (
            <View style={[styles.priorityIndicator, { backgroundColor: priorityColor }]}>
              <Ionicons name="star" size={14} color="#FFFFFF" />
            </View>
          )}
          <Text style={[
            styles.timeText,
            inOrphanedCourse && styles.inOrphanedCourseMetadata
          ]}>
            {formattedTime}
          </Text>
          
          {/* Remaining time display */}
          {!assignment.isCompleted && (
            <Text style={[
              styles.remainingTime,
              isOverdue && styles.overdueText,
              inOrphanedCourse && styles.inOrphanedCourseMetadata
            ]}>
              {remainingTime}
            </Text>
          )}
          
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
      
      {/* Subtasks dropdown section */}
      {expanded && hasSubtasks && (
        <Animated.View 
          style={styles.subtasksContainer}
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          layout={Layout.springify().mass(0.3)}
        >
          {localSubtasks.map((subtask) => (
            <Animated.View 
              key={subtask.id}
              style={styles.subtaskItem}
              entering={FadeIn.duration(200)}
              layout={Layout.springify()}
            >
              <Pressable
                style={styles.subtaskLeftSection}
                onPress={() => handleToggleSubtask(subtask.id)}
              >
                <View
                  style={[
                    styles.subtaskCheckbox,
                    subtask.isCompleted && styles.subtaskCheckboxChecked
                  ]}
                >
                  {subtask.isCompleted && (
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  )}
                </View>
                <Text 
                  style={[
                    styles.subtaskTitle,
                    subtask.isCompleted && styles.subtaskTitleCompleted
                  ]}
                >
                  {subtask.title}
                </Text>
              </Pressable>
              
              <TouchableOpacity
                style={styles.subtaskDeleteButton}
                onPress={() => handleDeleteSubtask(subtask.id)}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <Ionicons name="close-circle" size={16} color="#8A8A8D" />
              </TouchableOpacity>
            </Animated.View>
          ))}
          
          {/* Add new subtask button */}
          {showAddSubtask ? (
            <Animated.View 
              style={styles.addSubtaskInputContainer}
              entering={FadeIn.duration(200)}
              layout={Layout.springify()}
            >
              <TouchableOpacity
                style={styles.subtaskCheckbox}
                onPress={() => setShowAddSubtask(false)}
              >
                <Ionicons name="add" size={16} color="#3478F6" />
              </TouchableOpacity>
              <TextInput
                style={styles.subtaskInput}
                placeholder="Add subtask..."
                placeholderTextColor="#8A8A8D"
                value={newSubtaskTitle}
                onChangeText={setNewSubtaskTitle}
                onSubmitEditing={handleAddSubtask}
                autoFocus
                onBlur={() => {
                  setTimeout(() => {
                    if (newSubtaskTitle.trim() === '') {
                      setShowAddSubtask(false);
                    }
                  }, 200);
                }}
              />
              <TouchableOpacity
                style={[
                  styles.subtaskAddButton,
                  newSubtaskTitle.trim() === '' && styles.subtaskAddButtonDisabled
                ]}
                onPress={handleAddSubtask}
                disabled={newSubtaskTitle.trim() === ''}
              >
                <Ionicons 
                  name="checkmark" 
                  size={16} 
                  color={newSubtaskTitle.trim() === '' ? "#8A8A8D" : "#FFFFFF"} 
                />
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <TouchableOpacity
              style={styles.addSubtaskButton}
              onPress={() => setShowAddSubtask(true)}
            >
              <Ionicons name="add-circle-outline" size={16} color="#3478F6" />
              <Text style={styles.addSubtaskText}>Add subtask</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}
      
      {/* Add subtask button when no subtasks exist yet */}
      {!hasSubtasks && !showAddSubtask && (
        <TouchableOpacity
          style={styles.addFirstSubtaskButton}
          onPress={() => setShowAddSubtask(true)}
        >
          <Ionicons name="add-circle-outline" size={16} color="#3478F6" />
          <Text style={styles.addSubtaskText}>Add subtask</Text>
        </TouchableOpacity>
      )}
      
      {/* Input for first subtask */}
      {!hasSubtasks && showAddSubtask && (
        <Animated.View 
          style={styles.addFirstSubtaskInputContainer}
          entering={FadeIn.duration(200)}
          layout={Layout.springify()}
        >
          <TouchableOpacity
            style={styles.subtaskCheckbox}
            onPress={() => setShowAddSubtask(false)}
          >
            <Ionicons name="add" size={16} color="#3478F6" />
          </TouchableOpacity>
          <TextInput
            style={styles.subtaskInput}
            placeholder="Add subtask..."
            placeholderTextColor="#8A8A8D"
            value={newSubtaskTitle}
            onChangeText={setNewSubtaskTitle}
            onSubmitEditing={handleAddSubtask}
            autoFocus
            onBlur={() => {
              setTimeout(() => {
                if (newSubtaskTitle.trim() === '') {
                  setShowAddSubtask(false);
                }
              }, 200);
            }}
          />
          <TouchableOpacity
            style={[
              styles.subtaskAddButton,
              newSubtaskTitle.trim() === '' && styles.subtaskAddButtonDisabled
            ]}
            onPress={handleAddSubtask}
            disabled={newSubtaskTitle.trim() === ''}
          >
            <Ionicons 
              name="checkmark" 
              size={16} 
              color={newSubtaskTitle.trim() === '' ? "#8A8A8D" : "#FFFFFF"} 
            />
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    marginBottom: 8,
  },
  container: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkboxContainer: {
    marginRight: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
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
    width: 18,
    height: 18,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  title: {
    fontSize: 15,
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
    marginBottom: 3,
  },
  metadataContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 3,
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
    marginRight: 3,
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
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
    overflow: 'hidden',
  },
  starIcon: {
    alignSelf: 'center',
    textAlign: 'center',
    lineHeight: 14,
  },
  timeText: {
    fontSize: 12,
    color: '#8A8A8D',
    marginBottom: 3,
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
  overdueContainer: {
    borderLeftColor: '#FF3B30',
    borderLeftWidth: 2,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  remainingTime: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
    textAlign: 'right',
  },
  overdueText: {
    color: '#FF3B30',
    fontWeight: '500',
  },
  inOrphanedCourseContainer: {
    opacity: 0.9,
    backgroundColor: '#222222',
  },
  inOrphanedCourseText: {
    color: '#AAAAAA',
  },
  inOrphanedCourseMetadata: {
    color: '#6E6E73',
  },
  expandButton: {
    marginLeft: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(142, 142, 142, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subtasksContainer: {
    backgroundColor: '#242426',
    marginTop: 1,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3478F6',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderRightColor: '#2C2C2E',
    borderBottomColor: '#2C2C2E',
    marginLeft: 8,
    marginRight: 8,
  },
  subtaskProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  subtaskProgressBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(142, 142, 142, 0.2)',
    borderRadius: 2,
    marginRight: 8,
    overflow: 'hidden',
  },
  subtaskProgressFill: {
    height: '100%',
    backgroundColor: '#3478F6',
    borderRadius: 2,
  },
  subtaskProgressText: {
    fontSize: 12,
    color: '#8A8A8D',
    marginLeft: 8,
  },
  subtaskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(142, 142, 142, 0.15)',
    backgroundColor: 'rgba(28, 28, 30, 0.5)',
    borderRadius: 8,
    marginBottom: 4,
    paddingHorizontal: 8,
  },
  subtaskLeftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingVertical: 4,
  },
  subtaskCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#3478F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  subtaskCheckboxChecked: {
    backgroundColor: '#3478F6',
  },
  subtaskTitle: {
    fontSize: 14,
    color: '#FFFFFF',
    flex: 1,
  },
  subtaskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#8A8A8D',
  },
  subtaskDeleteButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addSubtaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 8,
  },
  addFirstSubtaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#242426',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginTop: 1,
    marginLeft: 8,
    marginRight: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3478F6',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderRightColor: '#2C2C2E',
    borderBottomColor: '#2C2C2E',
  },
  addSubtaskText: {
    fontSize: 14,
    color: '#3478F6',
    marginLeft: 8,
  },
  addSubtaskInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  addFirstSubtaskInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#242426',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginTop: 1,
    marginLeft: 8,
    marginRight: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3478F6',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderRightColor: '#2C2C2E',
    borderBottomColor: '#2C2C2E',
  },
  subtaskInput: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    paddingVertical: 4,
  },
  subtaskAddButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3478F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subtaskAddButtonDisabled: {
    backgroundColor: 'rgba(142, 142, 142, 0.2)',
  },
}); 
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Assignment, getPeriodById, AssignmentType, Subtask, toggleSubtaskCompletion, addSubtask, deleteSubtask, updateAllSubtaskCompletion, getSubtasksForAssignment } from '../../utils/assignmentStorage';
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
  Easing,
  withSequence
} from 'react-native-reanimated';
import { Period } from '../../services/scheduleService';
import { useTranslation } from '@/hooks/useTranslation';
import { getRemainingTimeText } from '../../utils/notificationUtils';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

interface AssignmentItemProps {
  assignment: Assignment;
  onToggle: () => void;
  onDelete?: () => void;
  showDueDate?: boolean;
  dueDateLabel?: string;
  inOrphanedCourse?: boolean;
  isHighlighted?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Key to store highlighted assignment IDs
const HIGHLIGHTED_ASSIGNMENTS_KEY = 'highlighted_assignments';

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

// Effect to handle highlighting animation
const useHighlightEffect = (
  isHighlighted: boolean,
  assignment: Assignment,
  highlightOpacity: Animated.SharedValue<number>,
  setExpanded: React.Dispatch<React.SetStateAction<boolean>>,
  setHighlight: React.Dispatch<React.SetStateAction<boolean>>
) => {
  // Use ref to track if animation has already played
  const animationPlayedRef = useRef(false);
  
  useEffect(() => {
    if (!isHighlighted) return;
    
    let isMounted = true;
    
    const checkIfAlreadyHighlighted = async () => {
      try {
        // Get previously highlighted assignments
        const highlightedJson = await AsyncStorage.getItem(HIGHLIGHTED_ASSIGNMENTS_KEY);
        const highlightedIds = highlightedJson ? JSON.parse(highlightedJson) : [];
        
        // If this assignment was already highlighted, don't play the animation again
        if (highlightedIds.includes(assignment.id)) {
          animationPlayedRef.current = true;
          return;
        }
        
        if (isHighlighted && !animationPlayedRef.current && isMounted) {
          // Mark as animation played so it doesn't repeat on re-renders
          animationPlayedRef.current = true;
          
          // Auto-expand highlighted items
          setExpanded(true);
          
          // Start with a visible highlight
          setHighlight(true);
          
          // Create a smooth pulse animation that fades out
          highlightOpacity.value = withSequence(
            // First pulse up quickly
            withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }),
            // Then hold for 2 seconds
            withTiming(1, { duration: 2000 }),
            // Then pulse down slightly
            withTiming(0.8, { duration: 300, easing: Easing.inOut(Easing.cubic) }),
            // Then pulse up again
            withTiming(0.9, { duration: 300, easing: Easing.inOut(Easing.cubic) }),
            // Finally fade out slowly
            withTiming(0, { 
              duration: 1000,
              easing: Easing.out(Easing.cubic)
            })
          );
          
          // Add this assignment to the highlighted list
          const updatedHighlightedIds = [...highlightedIds, assignment.id];
          await AsyncStorage.setItem(HIGHLIGHTED_ASSIGNMENTS_KEY, JSON.stringify(updatedHighlightedIds));
        }
      } catch (error) {
        console.error('Error handling highlight effect:', error);
      }
    };
    
    checkIfAlreadyHighlighted();
    
    return () => {
      isMounted = false;
    };
  }, [isHighlighted, highlightOpacity, assignment.id, setExpanded, setHighlight]);
};

export default function AssignmentItem({ 
  assignment, 
  onToggle, 
  onDelete, 
  showDueDate = false,
  dueDateLabel,
  inOrphanedCourse = false,
  isHighlighted = false
}: AssignmentItemProps) {
  // State for period information
  const [period, setPeriod] = useState<Period | null>(null);
  const [remainingTime, setRemainingTime] = useState<string>('');
  const { t, currentLanguage } = useTranslation();
  
  // Add state for subtasks
  const [expanded, setExpanded] = useState(isHighlighted);
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [isLoadingSubtasks, setIsLoadingSubtasks] = useState(false);
  const [highlight, setHighlight] = useState(isHighlighted);
  
  // Add state for description expansion
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  // Add ref to measure if description is multiline (needs expansion)
  const descriptionRef = useRef<Text>(null);
  const [isDescriptionMultiline, setIsDescriptionMultiline] = useState(false);
  
  // Use ref to track if animation has already played
  const animationPlayedRef = useRef(false);
  
  // Animated values for interactive feedback
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const checkScale = useSharedValue(assignment.isCompleted ? 1 : 0);
  const expandHeight = useSharedValue(0);
  const highlightOpacity = useSharedValue(0);
  
  // Add state for options modal
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const longPressTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Load subtasks from storage when needed
  const loadSubtasks = async () => {
    setIsLoadingSubtasks(true);
    try {
      const storedSubtasks = await getSubtasksForAssignment(assignment.id);
      setSubtasks(storedSubtasks);
    } catch (error) {
      console.error('Error loading subtasks:', error);
    } finally {
      setIsLoadingSubtasks(false);
    }
  };
  
  // Load subtasks when assignment changes or when expanded
  useEffect(() => {
    loadSubtasks();
  }, [assignment.id, expanded]);
  
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

  // Function to get remaining time text with translations
  const updateRemainingTimeText = (dueDate: string): string => {
    // Code from getRemainingTimeText function but with translated strings
    const now = new Date();
    const due = new Date(dueDate);
    
    // If due date is in the past and not completed, show as overdue
    if (due < now) {
      return t('assignments').status.overdue;
    }
    
    const diffMs = due.getTime() - now.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    // Less than a day
    if (diffMinutes < 24 * 60) {
      // Less than an hour
      if (diffMinutes < 60) {
        return `${t('assignments').status.in} ${diffMinutes} ${diffMinutes === 1 ? t('assignments').status.inMinute : t('assignments').status.inMinutes}`;
      }
      
      // A few hours
      const hours = Math.floor(diffMinutes / 60);
      return `${t('assignments').status.in} ${hours} ${hours === 1 ? t('assignments').status.inHour : t('assignments').status.inHours}`;
    }
    
    // Less than 2 days
    if (diffMinutes < 48 * 60) {
      return t('assignments').status.dueTomorrow;
    }
    
    // Less than a week
    if (diffMinutes < 7 * 24 * 60) {
      const days = Math.floor(diffMinutes / (24 * 60));
      return `${t('assignments').status.in} ${days} ${days === 1 ? t('assignments').status.inDay : t('assignments').status.inDays}`;
    }
    
    // More than a week
    const weeks = Math.floor(diffMinutes / (7 * 24 * 60));
    return `${t('assignments').status.in} ${weeks} ${weeks === 1 ? t('assignments').status.inWeek : t('assignments').status.inWeeks}`;
  };

  // Update remaining time text
  useEffect(() => {
    // Initial update
    setRemainingTime(updateRemainingTimeText(assignment.dueDate));
    
    // Update remaining time every minute
    const interval = setInterval(() => {
      setRemainingTime(updateRemainingTimeText(assignment.dueDate));
    }, 60000); // 1 minute
    
    return () => clearInterval(interval);
  }, [assignment.dueDate, t]);
  
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
  
  const highlightStyle = useAnimatedStyle(() => {
    return {
      opacity: highlightOpacity.value,
      backgroundColor: '#3478F620', // More subtle blue color with 20% opacity
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 12, // Match container border radius
      zIndex: 1, // Ensure highlight is above all other content
    };
  });
  
  // Press handlers for interactive feedback
  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 12, stiffness: 400 });
    opacity.value = withTiming(0.9, { duration: 100 });
    
    // Start timer for long press
    longPressTimeout.current = setTimeout(() => {
      handleLongPress();
    }, 500); // 500ms long press duration
  };
  
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    opacity.value = withTiming(1, { duration: 100 });
    
    // Clear timeout if press is released
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
      longPressTimeout.current = null;
    }
  };
  
  // Toggle the expanded state
  const toggleExpanded = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpanded(!expanded);
  };
  
  // Custom handler for toggling assignment completion
  const handleToggleAssignment = async () => {
    // If the assignment has subtasks, we need special handling
    if (subtasks.length > 0) {
      // If trying to mark as complete, first check that all subtasks are completed
      if (!assignment.isCompleted) {
        // Mark all subtasks as completed when we complete the assignment
        await updateAllSubtaskCompletion(assignment.id, true);
        // Then toggle the assignment
        onToggle();
        // Reload subtasks to reflect the changes
        await loadSubtasks();
      } else {
        // If uncompleting the assignment, also uncomplete all subtasks
        onToggle(); // First toggle the assignment
        await updateAllSubtaskCompletion(assignment.id, false);
        await loadSubtasks(); // Reload subtasks to reflect changes
      }
    } else {
      // If no subtasks, just toggle normally
      onToggle();
    }
  };
  
  // Handle adding new subtask
  const handleAddSubtask = async () => {
    if (newSubtaskTitle.trim() === '') return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setNewSubtaskTitle('');
    setShowAddSubtask(false);
    
    // Add subtask to storage
    await addSubtask(assignment.id, newSubtaskTitle.trim());
    
    // Reload subtasks from storage
    await loadSubtasks();
  };
  
  // Handle toggling subtask completion
  const handleToggleSubtask = async (subtaskId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Get the current subtask and its state before toggling
    const subtask = subtasks.find(st => st.id === subtaskId);
    if (!subtask) return;
    const willBeCompleted = !subtask.isCompleted;
    
    // Get current subtasks to work with
    let updatedSubtasks = [...subtasks];
    
    // Update the specific subtask in our local copy
    updatedSubtasks = updatedSubtasks.map(st => 
      st.id === subtaskId ? {...st, isCompleted: willBeCompleted} : st
    );
    
    // Check if all subtasks are now completed
    const allCompleted = updatedSubtasks.every(st => st.isCompleted);
    
    // Toggle in storage first - this changes the subtask's completion state
    await toggleSubtaskCompletion(assignment.id, subtaskId);
    
    // Manual handling of assignment completion state
    if (!willBeCompleted && assignment.isCompleted) {
      // We're uncompleting a subtask and the assignment is completed,
      // so we need to uncomplete the assignment
      onToggle();
    } else if (allCompleted && !assignment.isCompleted) {
      // All subtasks are now completed but the assignment isn't,
      // so complete the assignment
      onToggle();
    }
    
    // Reload subtasks from storage to update UI
    await loadSubtasks();
  };
  
  // Handle deleting a subtask
  const handleDeleteSubtask = async (subtaskId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Get current subtask to know if it was completed
    const subtask = subtasks.find(st => st.id === subtaskId);
    if (!subtask) return;
    
    // Get a copy of subtasks without the one being deleted
    const remainingSubtasks = subtasks.filter(st => st.id !== subtaskId);
    
    // Delete from storage
    await deleteSubtask(assignment.id, subtaskId);
    
    // After deleting, determine if all remaining subtasks are completed
    if (remainingSubtasks.length > 0) {
      const allRemainSubtasksCompleted = remainingSubtasks.every(st => st.isCompleted);
      
      // If assignment completion state doesn't match remaining subtasks state, update it
      if (allRemainSubtasksCompleted !== assignment.isCompleted) {
        onToggle();
      }
    }
    
    // Reload subtasks
    await loadSubtasks();
  };
  
  // Calculate subtask progress
  const completedSubtasks = subtasks.filter(st => st.isCompleted).length;
  const hasSubtasks = subtasks.length > 0;
  const subtaskProgress = hasSubtasks ? 
    Math.round((completedSubtasks / subtasks.length) * 100) : 0;
  
  // Determine priority styles
  const priorityColor = assignment.isPriority ? '#FF3B30' : 'transparent';
  
  // Get assignment type icon and color
  const typeIcon = getAssignmentTypeIcon(assignment.assignmentType);
  const typeColor = getAssignmentTypeColor(assignment.assignmentType);
  const typeLabel = getAssignmentTypeLabel(assignment.assignmentType);
  
  // Display style for orphaned assignments
  const isOrphaned = assignment.isOrphaned;
  
  // Determine if assignment is overdue
  const isOverdue = remainingTime === t('assignments').status.overdue && !assignment.isCompleted;
  
  // Effect to handle highlighting animation
  useHighlightEffect(isHighlighted, assignment, highlightOpacity, setExpanded, setHighlight);
  
  // Toggle description expansion with haptic feedback
  const toggleDescriptionExpanded = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsDescriptionExpanded(!isDescriptionExpanded);
  };

  // Add animation value for description height
  const descriptionHeight = useSharedValue('auto');
  
  // Check if the description is long enough to need expansion
  useEffect(() => {
    if (assignment.description && descriptionRef.current) {
      // We'll set this to true if the description is long enough
      // This is a simplified approach - for a more accurate solution, you'd measure the text
      setIsDescriptionMultiline(assignment.description.length > 30);
    }
  }, [assignment.description]);
  
  // Function to handle edit option
  const handleEditAssignment = () => {
    setShowOptionsModal(false);
    router.push({
      pathname: '/edit-assignment',
      params: { id: assignment.id }
    } as any);
  };
  
  // Function to handle long press
  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowOptionsModal(true);
  };

  // Show options modal
  const renderOptionsModal = () => {
    if (!showOptionsModal) return null;
    
    return (
      <Pressable 
        style={styles.modalOverlay} 
        onPress={() => setShowOptionsModal(false)}
      >
        <Animated.View 
          style={styles.optionsContainer}
          entering={FadeIn.duration(200)}
        >
          <TouchableOpacity 
            style={styles.optionItem}
            onPress={handleEditAssignment}
          >
            <Ionicons name="create-outline" size={20} color="#3478F6" />
            <Text style={styles.optionText}>{t('assignments').edit}</Text>
          </TouchableOpacity>
          
          {onDelete && (
            <TouchableOpacity 
              style={[styles.optionItem, styles.deleteOption]}
              onPress={() => {
                setShowOptionsModal(false);
                onDelete();
              }}
            >
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              <Text style={styles.deleteOptionText}>{t('assignments').delete}</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </Pressable>
    );
  };
  
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
        {/* Highlight overlay for animation - always present but controlled by opacity */}
        <Animated.View style={highlightStyle} pointerEvents="none" />
        
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
                  {completedSubtasks}/{subtasks.length}
                </Text>
              </View>
            )}
            
            {/* Show description if available and no subtasks or not expanded */}
            {assignment.description && (!hasSubtasks || !expanded) ? (
              <Animated.View 
                style={styles.descriptionContainer}
                layout={Layout.springify().mass(0.3)}
              >
                <View style={styles.descriptionRow}>
                  <Text 
                    ref={descriptionRef}
                    style={[
                      styles.description,
                      isOrphaned && styles.orphanedDescription,
                      inOrphanedCourse && styles.inOrphanedCourseText
                    ]}
                    numberOfLines={isDescriptionExpanded ? undefined : 1}
                    onLayout={(event) => {
                      // Check if text is clipped (needs expansion)
                      const { height } = event.nativeEvent.layout;
                      // If the height is greater than a single line (approx 18-20px), 
                      // we consider it multiline
                      if (height > 20 && !isDescriptionMultiline) {
                        setIsDescriptionMultiline(true);
                      }
                    }}
                  >
                    {assignment.description}
                  </Text>
                  
                  {/* Show expand/collapse button only if description is multiline and not expanded */}
                  {isDescriptionMultiline && !isDescriptionExpanded && (
                    <TouchableOpacity 
                      style={styles.expandDescriptionButton}
                      onPress={toggleDescriptionExpanded}
                      hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                    >
                      <Text style={styles.expandDescriptionText}>
                        {t('general').more}
                      </Text>
                      <Ionicons 
                        name="chevron-down"
                        size={14} 
                        color="#3478F6" 
                      />
                    </TouchableOpacity>
                  )}
                </View>
                
                {/* Show less button if expanded */}
                {isDescriptionExpanded && (
                  <TouchableOpacity 
                    style={styles.collapseDescriptionButton}
                    onPress={toggleDescriptionExpanded}
                    hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                  >
                    <Text style={styles.expandDescriptionText}>
                      {t('general').less}
                    </Text>
                    <Ionicons 
                      name="chevron-up" 
                      size={14} 
                      color="#3478F6" 
                    />
                  </TouchableOpacity>
                )}
              </Animated.View>
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
          {isLoadingSubtasks ? (
            <Text style={styles.loadingText}>{t('assignments').subtasks.loading}</Text>
          ) : (
            subtasks.map((subtask) => (
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
            ))
          )}
          
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
                placeholder={t('assignments').subtasks.placeholder}
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
              <Text style={styles.addSubtaskText}>{t('assignments').subtasks.add}</Text>
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
          <Text style={styles.addSubtaskText}>{t('assignments').subtasks.addFirst}</Text>
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
            placeholder={t('assignments').subtasks.placeholder}
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
      
      {/* Options Modal */}
      {renderOptionsModal()}
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
    lineHeight: 18,
    flex: 1,
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
  loadingText: {
    fontSize: 14,
    color: '#8A8A8D',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  highlightedContainer: {
    backgroundColor: '#3478F620', // More subtle color to match animation
    borderRadius: 12,
  },
  descriptionContainer: {
    marginTop: 3,
  },
  descriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expandDescriptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
    paddingVertical: 2,
  },
  expandDescriptionText: {
    fontSize: 12,
    color: '#3478F6',
    marginRight: 2,
  },
  collapseDescriptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    alignSelf: 'flex-end',
    paddingVertical: 2,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  optionsContainer: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    width: '80%',
    padding: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  optionText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 12,
  },
  deleteOption: {
    borderBottomWidth: 0,
    marginTop: 4,
  },
  deleteOptionText: {
    fontSize: 16,
    color: '#FF3B30',
    marginLeft: 12,
  },
}); 
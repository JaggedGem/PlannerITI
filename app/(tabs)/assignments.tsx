import React, { useState, useEffect, useMemo, memo, useRef, useLayoutEffect } from 'react';
import { StyleSheet, ScrollView, SafeAreaView, StatusBar, View, Text, ActivityIndicator, Platform, InteractionManager } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useColorScheme } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import SegmentedControl from '../../components/assignments/SegmentedControl';
import DaySection from '../../components/assignments/DaySection';
import FloatingActionButton from '../../components/assignments/FloatingActionButton';
import { 
  getAssignments, 
  toggleAssignmentCompletion, 
  deleteAssignment,
  Assignment, 
  groupAssignmentsByDate,
  AssignmentGroup,
  getCourses
} from '../../utils/assignmentStorage';
import { scheduleAllNotifications, cancelNotificationsForAssignment } from '@/utils/notificationUtils';
import { useCallback } from 'react';
import Animated, { FadeInDown, Layout, FadeOut } from 'react-native-reanimated';
import CourseSection from '../../components/assignments/CourseSection';
import { useTranslation } from '@/hooks/useTranslation';

// Function to group assignments by course - super-optimized version
const groupAssignmentsByCourse = (assignments: Assignment[]): {[key: string]: Assignment[]} => {
  if (!assignments || assignments.length === 0) return {};
  
  const groupedAssignments: {[key: string]: Assignment[]} = {};
  
  // Process in batches to avoid blocking the main thread
  const batchSize = 50;
  const batchCount = Math.ceil(assignments.length / batchSize);
  
  for (let i = 0; i < batchCount; i++) {
    const start = i * batchSize;
    const end = Math.min(start + batchSize, assignments.length);
    const batch = assignments.slice(start, end);
    
    for (let j = 0; j < batch.length; j++) {
      const assignment = batch[j];
    // Handle assignments with empty course codes
    const courseKey = assignment.courseCode || assignment.courseName || `uncategorized-${assignment.id}`;
    
    if (!groupedAssignments[courseKey]) {
      groupedAssignments[courseKey] = [];
    }
    
    groupedAssignments[courseKey].push(assignment);
    }
  }
  
  // Sort each course's assignments by due date then by type
  Object.keys(groupedAssignments).forEach(key => {
    groupedAssignments[key].sort((a, b) => {
      // First compare by due date
      const dateComparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (dateComparison !== 0) return dateComparison;
      
      // If same date, sort by assignment type
      return a.assignmentType.localeCompare(b.assignmentType);
    });
  });
  
  return groupedAssignments;
};

// Memoized empty state display
const EmptyState = memo(({ t }: { t: any }) => (
  <Animated.View 
    style={styles.emptyContainer}
    entering={FadeInDown.duration(150)}
  >
    <Text style={styles.emptyText}>
      {t('assignments').empty}
    </Text>
    <Text style={styles.emptySubtext}>
      {t('assignments').addNew}
    </Text>
  </Animated.View>
));

// Memoized loading state display
const LoadingState = memo(({ t }: { t: any }) => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#3478F6" />
    <Text style={styles.loadingText}>{t('assignments').loading}</Text>
  </View>
));

// Super-optimized CoursesView with on-demand rendering
const CoursesView = memo(({ 
  courseGroups, 
  onToggle, 
  onDelete 
}: { 
  courseGroups: {[key: string]: Assignment[]}, 
  onToggle: (id: string) => void,
  onDelete: (id: string) => void
}) => {
  const courseKeys = Object.keys(courseGroups);
  const { t } = useTranslation();
  
  // State to manage which courses are rendered
  const [readyToRender, setReadyToRender] = useState(false);
  const [visibleCourseCount, setVisibleCourseCount] = useState(0);
  
  // Refs to track and cancel pending operations
  const timersRef = useRef<Array<NodeJS.Timeout>>([]);
  const isComponentMountedRef = useRef(true);
  
  // Pre-calculate course sections to avoid jank
  useLayoutEffect(() => {
    // Reset states when courseGroups changes
    if (isComponentMountedRef.current) {
      setReadyToRender(false);
      setVisibleCourseCount(0);
    }
    
    // Clear any pending timers
    timersRef.current.forEach(timer => clearTimeout(timer));
    timersRef.current = [];
    
    // Schedule first batch of work after all current UI work completes
    const interaction = InteractionManager.runAfterInteractions(() => {
      // Then use RAF to schedule the update for next frame
      const frameId = requestAnimationFrame(() => {
        if (!isComponentMountedRef.current) return;
        
        setReadyToRender(true);
        // Start with just a few courses
        setVisibleCourseCount(Math.min(3, courseKeys.length));
        
        // Schedule additional courses to be rendered in the background
        const timer1 = setTimeout(() => {
          if (!isComponentMountedRef.current) return;
          setVisibleCourseCount(Math.min(7, courseKeys.length));
          
          // Final batch after another delay
          const timer2 = setTimeout(() => {
            if (!isComponentMountedRef.current) return;
            setVisibleCourseCount(courseKeys.length);
          }, 50);
          timersRef.current.push(timer2);
        }, 16);
        timersRef.current.push(timer1);
      });
      
      // Store frameId for cleanup
      return () => cancelAnimationFrame(frameId);
    });
    
    // Cleanup function
    return () => {
      // Cancel the interaction
      interaction.cancel();
      
      // Clear all timers
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current = [];
    };
  }, [courseGroups, courseKeys.length]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isComponentMountedRef.current = false;
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current = [];
    };
  }, []);
  
  // Load more courses when user scrolls near the bottom
  const handleScroll = useCallback(
    ({ nativeEvent }: any) => {
      const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
      const paddingToBottom = 200;
      
      if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
        if (visibleCourseCount < courseKeys.length && isComponentMountedRef.current) {
          // Incrementally add more courses
          setVisibleCourseCount(prevCount => Math.min(prevCount + 3, courseKeys.length));
        }
      }
    },
    [visibleCourseCount, courseKeys.length]
  );
  
  if (courseKeys.length === 0) {
    return <EmptyState t={t} />;
  }
  
  if (!readyToRender) {
    return <LoadingState t={t} />;
  }
  
  const visibleCourseKeys = courseKeys.slice(0, visibleCourseCount);
  
  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={true}
      onScroll={handleScroll}
      scrollEventThrottle={400}
    >
      {visibleCourseKeys.map((courseCode, index) => (
        <Animated.View
          key={`course-${courseCode}`}
          entering={FadeInDown.duration(200).delay(index * 30)}
          layout={Layout.springify().mass(0.3)}
          style={styles.courseContainer}
        >
          <CourseSection
            courseCode={courseCode}
            courseName={courseGroups[courseCode][0].courseName || 'Uncategorized'}
            assignments={courseGroups[courseCode]}
            onToggleAssignment={onToggle}
            onDeleteAssignment={onDelete}
            showDueDate={true}
          />
        </Animated.View>
      ))}
      {visibleCourseCount < courseKeys.length && (
        <View style={styles.loadingMoreContainer}>
          <ActivityIndicator size="small" color="#3478F6" />
        </View>
      )}
    </ScrollView>
  );
});

// Memoized date grouped view with optimized entry timing
const DateGroupedView = memo(({
  groups,
  onToggle, 
  onDelete,
  isTransitioningFromClasses = false
}: {
  groups: AssignmentGroup[],
  onToggle: (id: string) => void,
  onDelete: (id: string) => void,
  isTransitioningFromClasses?: boolean
}) => {
  // Use a ref to track whether we've rendered once already
  const [isFirstRender, setIsFirstRender] = useState(true);
  const isComponentMountedRef = useRef(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { t } = useTranslation();
  
  // Reset first render flag when groups change
  useEffect(() => {
    if (isComponentMountedRef.current) {
      setIsFirstRender(true);
    }
    
    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    // Set a short timeout to mark as not first render after frame is drawn
    timerRef.current = setTimeout(() => {
      if (isComponentMountedRef.current) {
        setIsFirstRender(false);
      }
    }, 10);
    
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [groups]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isComponentMountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);
  
  if (groups.length === 0) {
    return <EmptyState t={t} />;
  }
  
  // When transitioning from Classes tab, use a simplified render initially
  // to avoid stutter, then animate in the items on next frame
  const shouldDelayAnimations = isTransitioningFromClasses && isFirstRender;
  
  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={true}
    >
      {groups.map((group, index) => (
        <Animated.View 
          key={`${group.date}-${index}`}
          entering={shouldDelayAnimations ? undefined : FadeInDown.duration(150).delay(index * 20)}
          layout={shouldDelayAnimations ? undefined : Layout.springify().mass(0.3)}
        >
          <DaySection
            title={group.title}
            date={group.date}
            assignments={group.assignments}
            onToggleAssignment={onToggle}
            onDeleteAssignment={onDelete}
          />
        </Animated.View>
      ))}
    </ScrollView>
  );
});

export default function Assignments() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const darkMode = colorScheme === 'dark';
  const { t, formatDate } = useTranslation();
  
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [allAssignments, setAllAssignments] = useState<Assignment[]>([]);
  
  // Pre-computed view caches
  const [hasPrecomputedCourses, setHasPrecomputedCourses] = useState(false);
  const [isTransitioningFromClasses, setIsTransitioningFromClasses] = useState(false);
  const [isRapidSwitching, setIsRapidSwitching] = useState(false);
  
  // Add a forced refresh counter to trigger recalculation when needed
  const [forceRefreshCounter, setForceRefreshCounter] = useState(0);
  
  const segments = [t('assignments').segments.dueDate, t('assignments').segments.classes, t('assignments').segments.priority];

  // Reference to store last active segment for restoration
  const lastSegmentRef = useRef(0);
  const prevSegmentRef = useRef(0);
  const pendingTimersRef = useRef<Array<NodeJS.Timeout>>([]);
  const pendingRAFRef = useRef<number | null>(null);
  const isTabSwitchingRef = useRef(false);
  const isMountedRef = useRef(true);
  const lastSwitchTimeRef = useRef(Date.now());
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const switchCountRef = useRef(0);
  const pendingTabIndexRef = useRef<number | null>(null);
  const pendingInteractionsRef = useRef<Array<{cancel: () => void}>>([]);
  
  // Add a ref to track pending notification operations
  const pendingNotificationOpRef = useRef<boolean>(false);
  
  // Clear all pending operations
  const clearPendingOperations = useCallback(() => {
    if (pendingRAFRef.current) {
      cancelAnimationFrame(pendingRAFRef.current);
      pendingRAFRef.current = null;
    }
    
    pendingTimersRef.current.forEach(timer => clearTimeout(timer));
    pendingTimersRef.current = [];
    
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    
    // Cancel any pending interaction manager tasks
    pendingInteractionsRef.current.forEach(interaction => {
      if (interaction && interaction.cancel) {
        interaction.cancel();
      }
    });
    pendingInteractionsRef.current = [];
  }, []);
  
  // Full reset of the tab state to recover from any inconsistent state
  const performFullReset = useCallback(() => {
    // First clean up any pending operations
    clearPendingOperations();
    
    // Reset all internal state flags
    isTabSwitchingRef.current = false;
    pendingTabIndexRef.current = null;
    switchCountRef.current = 0;
    
    // Force a refresh of the memoized data by incrementing the counter
    setForceRefreshCounter(prev => prev + 1);
    
    // Reset to non-transitioning state
    setIsTransitioningFromClasses(false);
    
    // Set loading true briefly to force a clean rerender
    setIsLoading(true);
    
    // Schedule a fetch of assignments to ensure fresh data
    const refreshTimer = setTimeout(() => {
      if (isMountedRef.current) {
        fetchAssignments();
      }
    }, 50);
    
    pendingTimersRef.current.push(refreshTimer);
  }, [clearPendingOperations]);
  
  // Debounced segment change implementation
  const debouncedTabChange = useCallback((index: number) => {
    // Clear any pending tab changes
    if (pendingTabIndexRef.current !== null) {
      pendingTabIndexRef.current = index;
      return;
    }
    
    // Set the pending tab index
    pendingTabIndexRef.current = index;
    
    // Process the tab change after a short delay
    const timer = setTimeout(() => {
      if (!isMountedRef.current) return;
      
      const indexToSet = pendingTabIndexRef.current;
      pendingTabIndexRef.current = null;
      
      if (indexToSet !== null && indexToSet !== selectedSegmentIndex) {
        setSelectedSegmentIndex(indexToSet);
        lastSegmentRef.current = indexToSet;
      }
      
      isTabSwitchingRef.current = false;
    }, isRapidSwitching ? 70 : 20); // Shorter delays to be more responsive
    
    pendingTimersRef.current.push(timer);
  }, [selectedSegmentIndex, isRapidSwitching]);
  
  // Fetch assignments from storage with proper error handling
  const fetchAssignments = useCallback(async () => {
    if (isTabSwitchingRef.current && isRapidSwitching) return; // Skip during rapid switching
    
    if (isMountedRef.current) {
      setIsLoading(true);
    }
    
    try {
      // Use a safe pattern for async operations
      const assignments = await getAssignments();
      
      // Avoid state updates if component unmounted during async operation
      if (!isMountedRef.current) return;
      
      setAllAssignments(assignments);
      
      // If not in rapid switching mode, precompute in background
      if (!isRapidSwitching) {
        // After loading assignments, precompute course grouping in the background
        const interaction = InteractionManager.runAfterInteractions(() => {
          if (!isMountedRef.current) return;
          
          // This will run in background after UI interactions are done
          try {
            groupAssignmentsByCourse(assignments);
            if (isMountedRef.current) {
              setHasPrecomputedCourses(true);
            }
          } catch (error) {
            console.error('Error precomputing courses:', error);
          }
        });
        
        // Store the interaction for potential cancellation
        pendingInteractionsRef.current.push(interaction);
        
        return () => {
          try {
            interaction.cancel();
          } catch (e) {
            // Ignore errors from cancellation
          }
        };
      }
    } catch (error) {
      console.error('Error loading assignments:', error);
      // Recover from error by returning to a stable state
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    } finally {
      if (isMountedRef.current) {
      setIsLoading(false);
      }
    }
  }, [isRapidSwitching]);
  
  // Exit rapid switching mode with safety measures
  const exitRapidSwitchingMode = useCallback(() => {
    if (!isMountedRef.current) return;
    
    // First set the flag to false
    setIsRapidSwitching(false);
    
    // Reset switch counter
    switchCountRef.current = 0;
    
    // Perform a full state reset to ensure clean continuation
    performFullReset();
    
    // If we're on the Classes tab and courses aren't precomputed, do that now
    if (selectedSegmentIndex === 1 && !hasPrecomputedCourses) {
      // Schedule computation in the next frame
      pendingRAFRef.current = requestAnimationFrame(() => {
        const interaction = InteractionManager.runAfterInteractions(() => {
          if (!isMountedRef.current) return;
          setHasPrecomputedCourses(true);
        });
        pendingInteractionsRef.current.push(interaction);
      });
    }
  }, [selectedSegmentIndex, hasPrecomputedCourses, performFullReset]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      isTabSwitchingRef.current = false;
      clearPendingOperations();
    };
  }, [clearPendingOperations]);
  
  // Memoized priority assignments - now with refresh counter
  const priorityAssignments = useMemo(() => {
    return allAssignments.filter(a => a.isPriority);
  }, [allAssignments, forceRefreshCounter]);
  
  // Memoized assignment groups by date - now with refresh counter
  const dateAssignmentGroups = useMemo(() => {
    return groupAssignmentsByDate(allAssignments, t, formatDate);
  }, [allAssignments, t, formatDate, forceRefreshCounter]);
  
  // Memoized priority assignment groups by date - now with refresh counter
  const priorityAssignmentGroups = useMemo(() => {
    return groupAssignmentsByDate(priorityAssignments, t, formatDate);
  }, [priorityAssignments, t, formatDate, forceRefreshCounter]);
  
  // Lazy-computed assignment groups by course - now with refresh counter and safer computation
  const courseAssignmentGroups = useMemo(() => {
    try {
      // If we're not even planning to view the courses tab, defer computation
      if (selectedSegmentIndex !== 1 && !hasPrecomputedCourses) {
        return {};
      }
      return groupAssignmentsByCourse(allAssignments);
    } catch (error) {
      console.error('Error computing course groups:', error);
      return {}; // Return empty object on error rather than crashing
    }
  }, [allAssignments, selectedSegmentIndex, hasPrecomputedCourses, forceRefreshCounter]);
  
  // Initial load
  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);
  
  // Safer notification scheduling with concurrency and error checking
  const safeScheduleNotifications = useCallback(async (assignments: Assignment[], isTabSwitch = false) => {
    // Skip if we're in rapid switching mode
    if (isRapidSwitching) {
      console.log('Skipping notification scheduling during rapid switching');
      return;
    }
    
    // Skip if there's already a pending notification operation
    if (pendingNotificationOpRef.current) {
      console.log('Skipping notification scheduling - another operation in progress');
      return;
    }
    
    try {
      // Set the flag to prevent concurrent operations
      pendingNotificationOpRef.current = true;
      
      // Call the actual scheduling function
      await scheduleAllNotifications(assignments, isTabSwitch);
    } catch (error) {
      console.error('Error in safeScheduleNotifications:', error);
    } finally {
      // Always clear the flag when done
      pendingNotificationOpRef.current = false;
    }
  }, [isRapidSwitching]);
  
  // Refresh when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchAssignments();
      // Restore last active segment
      if (lastSegmentRef.current !== selectedSegmentIndex) {
        setSelectedSegmentIndex(lastSegmentRef.current);
      }
      
      // Schedule notifications only when app is first loaded, not on every focus
      // We rely on the time-based throttling in scheduleAllNotifications to prevent excessive updates
      const updateNotifications = async () => {
        try {
          // Get the assignments but don't trigger notifications every time
          // The scheduleAllNotifications function now has built-in throttling
          const assignments = await getAssignments();
          
          // This will only update if enough time has passed since the last update
          await safeScheduleNotifications(assignments, false);
        } catch (error) {
          console.error('Error updating notifications:', error);
        }
      };
      
      updateNotifications();
    }, [fetchAssignments, selectedSegmentIndex, safeScheduleNotifications])
  );
  
  // Toggle assignment completion with optimized state update
  const handleToggleAssignment = useCallback(async (id: string) => {
    // Update local state immediately for UI responsiveness
    setAllAssignments(current => {
      const assignments = current.map(a => a.id === id ? {...a, isCompleted: !a.isCompleted} : a);
      
      // Schedule a notification update when an assignment is toggled
      // This ensures completed items don't get notifications and uncompleted items get rescheduled
      const updateNotifications = async () => {
        try {
          // Focus on this specific assignment to reduce unnecessary processing
          const assignment = assignments.find(a => a.id === id);
          if (assignment) {
            if (assignment.isCompleted) {
              // If completed, just cancel notifications for this assignment
              await cancelNotificationsForAssignment(id);
            } else {
              // If uncompleted, reschedule all notifications to be safe
              await safeScheduleNotifications(assignments, false);
            }
          }
        } catch (error) {
          console.error('Error updating notifications after toggle:', error);
        }
      };
      
      // Trigger the notification update in the background
      updateNotifications();
      
      return assignments;
    });
    
    // Update database in background
    toggleAssignmentCompletion(id).catch(err => 
      console.error('Error toggling assignment:', err)
    );
  }, [safeScheduleNotifications]);
  
  // Delete assignment with optimized state update
  const handleDeleteAssignment = useCallback(async (id: string) => {
    // Update local state immediately
    setAllAssignments(current => {
      const filteredAssignments = current.filter(a => a.id !== id);
      
      // Cancel notifications for the deleted assignment
      const cancelNotification = async () => {
        try {
          await cancelNotificationsForAssignment(id);
        } catch (error) {
          console.error('Error canceling notifications for deleted assignment:', error);
        }
      };
      
      // Trigger the notification cancellation in the background
      cancelNotification();
      
      return filteredAssignments;
    });
    
    // Update database in background
    deleteAssignment(id).catch(err => 
      console.error('Error deleting assignment:', err)
    );
  }, []);
  
  // Check if user is continuously/rapidly switching tabs with safety checks
  const checkRapidSwitching = useCallback(() => {
    try {
      const now = Date.now();
      const timeSinceLastSwitch = now - lastSwitchTimeRef.current;
      lastSwitchTimeRef.current = now;
      
      // Reset counter if it's been a while since last switch
      if (timeSinceLastSwitch > 350) { // Reduced from 500ms
        switchCountRef.current = 0;
        if (isRapidSwitching) {
          exitRapidSwitchingMode();
        }
      }
      
      // Increment switch counter
      switchCountRef.current++;
      
      // If user has switched tabs quickly multiple times, activate rapid switching mode
      // Require more switches (4 vs 3) and allow slightly more time between them (250ms vs 200ms)
      if (switchCountRef.current >= 4 && timeSinceLastSwitch < 250 && !isRapidSwitching) {
        setIsRapidSwitching(true);
        
        // Cancel any previous cooldown
        if (cooldownTimerRef.current) {
          clearTimeout(cooldownTimerRef.current);
          cooldownTimerRef.current = null;
        }
        
        // Schedule exit from rapid switching mode after a cooldown period
        cooldownTimerRef.current = setTimeout(() => {
          if (!isMountedRef.current) return;
          exitRapidSwitchingMode();
          cooldownTimerRef.current = null;
        }, 800); // Reduced from 1500ms to 800ms for faster return to normal mode
      }
    } catch (error) {
      console.error('Error in checkRapidSwitching:', error);
      // Safe recovery - exit rapid switching mode if there's an error
      if (isRapidSwitching && isMountedRef.current) {
        exitRapidSwitchingMode();
      }
    }
  }, [isRapidSwitching, exitRapidSwitchingMode]);
  
  // Crash-resistant segment change handler with special transitions FROM Classes and rapid switching detection
  const handleSegmentChange = useCallback((index: number) => {
    try {
      if (index === selectedSegmentIndex) return; // Skip if already on this tab
      
      // Detect rapid switching
      checkRapidSwitching();
      
      // If we're already switching and in rapid switch mode, just queue the tab change
      if (isTabSwitchingRef.current && isRapidSwitching) {
        debouncedTabChange(index);
        return;
      }
      
      // Set tab switching flag to avoid concurrent operations
      isTabSwitchingRef.current = true;
      
      // Clear any pending operations from previous tab switches
      clearPendingOperations();
      
      // Track which segment we're coming from
      prevSegmentRef.current = selectedSegmentIndex;
      
      // During rapid switching, just update the state directly with minimal effects
      if (isRapidSwitching) {
        debouncedTabChange(index);
        return;
      }
      
      // Special handling for transitioning FROM Classes tab
      if (prevSegmentRef.current === 1 && index !== 1) {
        // Set transition flag to optimize DateGroupedView rendering
        if (isMountedRef.current) {
          setIsTransitioningFromClasses(true);
        }
        
        // First update the segment immediately
        if (isMountedRef.current) {
          setSelectedSegmentIndex(index);
          lastSegmentRef.current = index;
        }
        
        // Then after animations have settled, clear the transition flag
        const timer = setTimeout(() => {
          if (isMountedRef.current) {
            setIsTransitioningFromClasses(false);
            isTabSwitchingRef.current = false; // Reset flag
          }
        }, 150); // just enough time for initial render without animations
        
        pendingTimersRef.current.push(timer);
        return;
      }
      
      // If switching TO Classes view but not precomputed yet, show loading
      if (index === 1 && !hasPrecomputedCourses) {
        if (isMountedRef.current) {
          setIsLoading(true);
        }
        
        // Defer state update to next frame
        pendingRAFRef.current = requestAnimationFrame(() => {
          if (!isMountedRef.current) return;
          
          setSelectedSegmentIndex(index);
          lastSegmentRef.current = index;
          
          // Allow time for UI to show loading state before heavy computation
          const timer = setTimeout(() => {
            if (!isMountedRef.current) return;
            
            // The useMemo for courseAssignmentGroups will now compute since selectedSegmentIndex === 1
            const interaction = InteractionManager.runAfterInteractions(() => {
              if (!isMountedRef.current) return;
              
              setHasPrecomputedCourses(true);
              setIsLoading(false);
              isTabSwitchingRef.current = false; // Reset flag
            });
            
            pendingInteractionsRef.current.push(interaction);
          }, 10);
          
          pendingTimersRef.current.push(timer);
        });
      } else {
        // For other transitions, just set the index - already precomputed
        if (isMountedRef.current) {
          setSelectedSegmentIndex(index);
          lastSegmentRef.current = index;
        }
        isTabSwitchingRef.current = false; // Reset flag
        
        // Only schedule notifications if not in rapid switching mode
        if (!isRapidSwitching) {
          // Schedule notifications with the tab switch flag to apply cooldown
          const updateTabChangeNotifications = async () => {
            try {
              const assignments = await getAssignments();
              await safeScheduleNotifications(assignments, true);
            } catch (error) {
              console.error('Error updating notifications on tab change:', error);
            }
          };
          
          // Don't delay the UI by waiting for this
          updateTabChangeNotifications();
        }
      }
    } catch (error) {
      console.error('Error in handleSegmentChange:', error);
      // Safe recovery - just set the segment directly and reset flags
      if (isMountedRef.current) {
        setSelectedSegmentIndex(index);
        lastSegmentRef.current = index;
        isTabSwitchingRef.current = false;
        // If we're in rapid switching mode, exit it safely
        if (isRapidSwitching) {
          exitRapidSwitchingMode();
        }
      }
    }
  }, [
    hasPrecomputedCourses, 
    selectedSegmentIndex, 
    clearPendingOperations,
    isRapidSwitching,
    checkRapidSwitching,
    debouncedTabChange,
    exitRapidSwitchingMode,
    safeScheduleNotifications
  ]);
  
  // Navigate to new assignment screen
  const handleAddAssignment = useCallback(() => {
    router.push('/new-assignment');
  }, []);
  
  // Render simplified but visually similar content during rapid switching
  const renderSimplifiedContent = useCallback(() => {
    if (selectedSegmentIndex === 1) {
      return (
        <View style={styles.simplifiedContainer}>
          <Text style={styles.simplifiedText}>{t('assignments').segments.classes}</Text>
          {/* Add minimal placeholder content to make it look less empty */}
          {Object.keys(courseAssignmentGroups).length > 0 && (
            <View style={styles.placeholderContent}>
              <View style={styles.placeholderItem} />
              <View style={styles.placeholderItem} />
            </View>
          )}
        </View>
      );
    } else if (selectedSegmentIndex === 2) {
      return (
        <View style={styles.simplifiedContainer}>
          <Text style={styles.simplifiedText}>{t('assignments').segments.priority}</Text>
          {priorityAssignmentGroups.length > 0 && (
            <View style={styles.placeholderContent}>
              <View style={styles.placeholderItem} />
              <View style={styles.placeholderItem} />
            </View>
          )}
        </View>
      );
    } else {
      return (
        <View style={styles.simplifiedContainer}>
          <Text style={styles.simplifiedText}>{t('assignments').segments.dueDate}</Text>
          {dateAssignmentGroups.length > 0 && (
            <View style={styles.placeholderContent}>
              <View style={styles.placeholderItem} />
              <View style={styles.placeholderItem} />
            </View>
          )}
        </View>
      );
    }
  }, [
    selectedSegmentIndex, 
    t, 
    courseAssignmentGroups, 
    priorityAssignmentGroups, 
    dateAssignmentGroups
  ]);
  
  // Render the appropriate content based on selected segment
  const renderContent = useCallback(() => {
    // During rapid switching, show a simplified version
    if (isRapidSwitching) {
      return renderSimplifiedContent();
    }
    
    if (isLoading) {
      return <LoadingState t={t} />;
    }
    
    // Classes view
    if (selectedSegmentIndex === 1) {
      return (
        <CoursesView 
          courseGroups={courseAssignmentGroups} 
          onToggle={handleToggleAssignment}
          onDelete={handleDeleteAssignment}
        />
      );
    }
    
    // Priority view
    if (selectedSegmentIndex === 2) {
      return (
        <DateGroupedView 
          groups={priorityAssignmentGroups}
          onToggle={handleToggleAssignment}
          onDelete={handleDeleteAssignment}
          isTransitioningFromClasses={isTransitioningFromClasses}
        />
      );
    }
    
    // Due date view (default)
    return (
      <DateGroupedView 
        groups={dateAssignmentGroups}
        onToggle={handleToggleAssignment}
        onDelete={handleDeleteAssignment}
        isTransitioningFromClasses={isTransitioningFromClasses}
      />
    );
  }, [
    isLoading, 
    selectedSegmentIndex, 
    courseAssignmentGroups,
    dateAssignmentGroups,
    priorityAssignmentGroups,
    handleToggleAssignment,
    handleDeleteAssignment,
    isTransitioningFromClasses,
    isRapidSwitching,
    renderSimplifiedContent,
    t
  ]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('assignments').title}</Text>
          
          <SegmentedControl
            segments={segments}
            selectedIndex={selectedSegmentIndex}
            onChange={handleSegmentChange}
          />
        </View>
      </View>
      
      <View style={styles.contentContainer}>
        {renderContent()}
        <FloatingActionButton onPress={handleAddAssignment} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  headerContainer: {
    zIndex: 10,
  },
  header: {
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    backgroundColor: '#141414',
    borderBottomRightRadius: 32,
    borderBottomLeftRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  contentContainer: {
    flex: 1,
    paddingTop: 10,
    zIndex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#8A8A8D',
    fontSize: 16,
    marginTop: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 80, // Provide space for the FAB
    paddingHorizontal: 20,
  },
  emptyContainer: {
    flex: 1,
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 8,
    color: '#FFFFFF',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8A8A8D',
  },
  courseContainer: {
    marginBottom: 8,
  },
  loadingMoreContainer: {
    padding: 20,
    alignItems: 'center',
  },
  simplifiedContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: '#141414',
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 16,
    paddingVertical: 30,
  },
  simplifiedText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 20,
  },
  placeholderContent: {
    width: '80%',
    marginTop: 20,
  },
  placeholderItem: {
    height: 50,
    backgroundColor: '#1d1d1d',
    borderRadius: 8,
    marginVertical: 10,
  },
});
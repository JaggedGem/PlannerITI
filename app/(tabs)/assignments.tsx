import React, { useState, useEffect, useMemo, memo, useRef, useLayoutEffect, createContext, useContext } from 'react';
import { StyleSheet, ScrollView, SafeAreaView, StatusBar, View, Text, ActivityIndicator, Platform, InteractionManager, AppState, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useColorScheme } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import DaySection from '../../components/assignments/DaySection';
import FloatingActionButton from '../../components/assignments/FloatingActionButton';
import { Ionicons } from '@expo/vector-icons';
import { 
  getAssignments, 
  toggleAssignmentCompletion, 
  deleteAssignment,
  Assignment, 
  groupAssignmentsByDate,
  AssignmentGroup,
  getCourses
} from '../../utils/assignmentStorage';
import { scheduleAllNotifications, cancelNotificationsForAssignment } from '../../utils/notificationHelper';
import { useCallback } from 'react';
import Animated, { FadeInDown, Layout, FadeOut } from 'react-native-reanimated';
import CourseSection from '../../components/assignments/CourseSection';
import { useTranslation } from '@/hooks/useTranslation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ArchiveView from '../../components/assignments/ArchiveView';
import * as Haptics from 'expo-haptics';
import { AssignmentOptionsMenu } from '../../components/assignments/AssignmentOptionsMenu';

// Add circuit breaker constants
const CRASH_DETECTION_KEY = 'assignment_tab_crash_detection';
const CRASH_COUNT_KEY = 'assignment_tab_crash_count';
const LAST_CRASH_TIME_KEY = 'assignment_tab_last_crash_time';
const MAX_CRASHES = 3;
const CRASH_WINDOW_MS = 60000; // 1 minute

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

// Memoized Archive view with lazy loading
const ArchivedAssignmentsView = memo(({ 
  assignments, 
  onToggle, 
  onDelete 
}: { 
  assignments: Assignment[], 
  onToggle: (id: string) => void,
  onDelete: (id: string) => void
}) => {
  const { t } = useTranslation();
  
  // State for lazy loading
  const [visibleItems, setVisibleItems] = useState(15);
  const [hasMore, setHasMore] = useState(true);
  const isLoadingMoreRef = useRef(false);
  
  // Sort assignments by due date, newest first
  const sortedAssignments = useMemo(() => {
    return [...assignments].sort((a, b) => 
      new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
    );
  }, [assignments]);
  
  // Handle loading more items
  const loadMoreItems = useCallback(() => {
    if (isLoadingMoreRef.current || !hasMore) return;
    
    isLoadingMoreRef.current = true;
    
    // Simulate delay to avoid UI jank
    setTimeout(() => {
      setVisibleItems(prev => {
        const newValue = prev + 10;
        if (newValue >= sortedAssignments.length) {
          setHasMore(false);
        }
        return newValue;
      });
      isLoadingMoreRef.current = false;
    }, 100);
  }, [hasMore, sortedAssignments.length]);
  
  // Handle scroll to detect when to load more
  const handleScroll = useCallback(({ nativeEvent }: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const paddingToBottom = 200;
    
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
      loadMoreItems();
    }
  }, [loadMoreItems]);
  
  if (sortedAssignments.length === 0) {
    return <EmptyState t={t} />;
  }
  
  // Only show the visible items
  const itemsToRender = sortedAssignments.slice(0, visibleItems);
  
  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      onScroll={handleScroll}
      scrollEventThrottle={400}
    >
      <Text style={styles.archivedHeaderText}>{t('assignments').archive.pastDue}</Text>
      {itemsToRender.map((assignment, index) => (
        <Animated.View
          key={assignment.id}
          entering={FadeInDown.duration(150).delay(index % 10 * 30)}
          layout={Layout.springify().mass(0.3)}
          style={styles.archivedItemContainer}
          exiting={FadeOut.duration(150)}
        >
          <View style={styles.archivedItem}>
            <View style={styles.archivedItemLeft}>
              <TouchableOpacity
                onPress={() => onToggle(assignment.id)}
                style={[
                  styles.archivedCheckbox,
                  assignment.isCompleted && styles.archivedCheckboxCompleted
                ]}
              >
                {assignment.isCompleted && (
                  <Text style={styles.archivedCheckmark}>✓</Text>
                )}
              </TouchableOpacity>
              <View style={styles.archivedTextContainer}>
                <Text 
                  style={[
                    styles.archivedTitle, 
                    assignment.isCompleted && styles.archivedTitleCompleted
                  ]} 
                  numberOfLines={1}
                >
                  {assignment.title}
                </Text>
                <Text style={styles.archivedSubtitle}>
                  {assignment.courseCode} • {new Date(assignment.dueDate).toLocaleDateString()}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => onDelete(assignment.id)}
              style={styles.archivedDeleteButton}
            >
              <Text style={styles.archivedDeleteText}>×</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      ))}
      {hasMore && (
        <View style={styles.loadingMoreContainer}>
          <ActivityIndicator size="small" color="#3478F6" />
        </View>
      )}
    </ScrollView>
  );
});

// Error boundary component
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorCount: number;
}

class AssignmentsErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, errorCount: 0 };
  
  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Increment error count
    this.setState(prevState => ({
      errorCount: prevState.errorCount + 1
    }));
    
    // Store error info in AsyncStorage to track crash patterns
    try {
      AsyncStorage.getItem(CRASH_DETECTION_KEY).then(value => {
        const crashData = value ? JSON.parse(value) : { count: 0, lastTime: Date.now() };
        crashData.count += 1;
        crashData.lastTime = Date.now();
        AsyncStorage.setItem(CRASH_DETECTION_KEY, JSON.stringify(crashData));
      });
    } catch (e) {
      // Silently handle error in crash detection
    }
  }
  
  componentDidUpdate(prevProps: ErrorBoundaryProps, prevState: ErrorBoundaryState): void {
    // Reset error state after a moment to attempt recovery
    if (this.state.hasError && !prevState.hasError) {
      setTimeout(() => {
        this.setState({ hasError: false });
      }, 1000);
    }
  }

  render() {
    if (this.state.hasError) {
      // Use translation directly with useTranslation hook
      const { t } = useTranslation();
      
      // Fallback UI when an error occurs
      return (
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="light-content" />
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>{t('assignments').errors.somethingWrong}</Text>
            <Text style={styles.errorMessage}>{t('assignments').errors.recovering}</Text>
            {this.state.errorCount > 2 && (
              <Text style={styles.errorHint}>
                {t('assignments').errors.tip}: Avoid rapid switching between tabs
              </Text>
            )}
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

// Add this new component before the Assignments component
const ModernDropdown = memo(({ 
  isVisible, 
  onClose, 
  segments, 
  selectedIndex, 
  onSelect,
  styles 
}: { 
  isVisible: boolean;
  onClose: () => void;
  segments: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  styles: any;
}) => {
  const { t } = useTranslation();

  const handleSelect = (index: number) => {
    // Trigger haptic feedback
    Haptics.selectionAsync();
    onSelect(index);
    onClose();
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable 
        style={styles.modalOverlay} 
        onPress={onClose}
      >
        <View style={styles.dropdownContainer}>
          <View style={styles.dropdownHeader}>
            <Text style={styles.dropdownTitle}>{t('assignments').title}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#8A8A8D" />
            </Pressable>
          </View>
          
          {segments.map((segment, index) => (
            <Pressable
              key={segment}
              style={({ pressed }) => [
                styles.dropdownItem,
                selectedIndex === index && styles.dropdownItemSelected,
                pressed && styles.dropdownItemPressed
              ]}
              onPress={() => handleSelect(index)}
            >
              <View style={styles.dropdownItemContent}>
                <Text 
                  style={[
                    styles.dropdownItemText,
                    selectedIndex === index && styles.dropdownItemTextSelected
                  ]}
                >
                  {segment}
                </Text>
                {selectedIndex === index && (
                  <Ionicons name="checkmark" size={20} color="#3478F6" />
                )}
              </View>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
});

// Create context for the options menu
interface AssignmentOptionsContextType {
  showOptionsMenu: (assignmentId: string, position: { top: number; right: number }, deleteHandler?: () => void) => void;
  hideOptionsMenu: () => void;
}

export const AssignmentOptionsContext = createContext<AssignmentOptionsContextType>({
  showOptionsMenu: () => {},
  hideOptionsMenu: () => {}
});

// Hook to use the options context
export const useAssignmentOptions = () => useContext(AssignmentOptionsContext);

// Options menu provider component
const AssignmentOptionsProvider = ({ children }: { children: React.ReactNode }) => {
  const [menuVisible, setMenuVisible] = useState(false);
  const [currentAssignmentId, setCurrentAssignmentId] = useState<string>('');
  const [deleteHandler, setDeleteHandler] = useState<(() => void) | undefined>(undefined);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number }>({ top: 0, right: 0 });

  const showOptionsMenu = (assignmentId: string, position: { top: number; right: number }, onDelete?: () => void) => {
    setCurrentAssignmentId(assignmentId);
    setMenuPosition(position);
    setDeleteHandler(() => onDelete);
    setMenuVisible(true);
  };

  const hideOptionsMenu = () => {
    setMenuVisible(false);
  };

  return (
    <AssignmentOptionsContext.Provider value={{ showOptionsMenu, hideOptionsMenu }}>
      <View style={{ flex: 1 }}>
        {children}
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          elevation: 9999,
          pointerEvents: menuVisible ? 'auto' : 'none'
        }}>
          <AssignmentOptionsMenu
            isVisible={menuVisible}
            onClose={hideOptionsMenu}
            assignmentId={currentAssignmentId}
            onDelete={deleteHandler}
            position={menuPosition}
          />
        </View>
      </View>
    </AssignmentOptionsContext.Provider>
  );
};

// Define the main Assignments component - this needs to be before AssignmentsWithErrorBoundary
const Assignments = () => {
  const colorScheme = useColorScheme() ?? 'light';
  const { t, formatDate } = useTranslation();
  
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [allAssignments, setAllAssignments] = useState<Assignment[]>([]);
  const [archivedAssignments, setArchivedAssignments] = useState<Assignment[]>([]);
  const [isSafeMode, setIsSafeMode] = useState(false);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [isArchiveModalVisible, setIsArchiveModalVisible] = useState(false);
  
  // For auto-expanding a specific assignment when navigating from the DayView
  // Store these in refs to avoid re-renders when clearing them
  const assignmentToExpandRef = useRef<string | null>(null);
  const dateToExpandRef = useRef<string | null>(null);
  
  // Track which tabs have been viewed already to disable animations after first view
  const [hasViewedTab, setHasViewedTab] = useState<{[key: number]: boolean}>({0: false, 1: false, 2: false, 3: false});
  
  // Track if a tab switch is currently in progress
  const [isTabSwitching, setIsTabSwitching] = useState(false);
  
  // Use refs to store memoized data to prevent recalculations
  const memoizedDataRef = useRef<{
    dateGroups: AssignmentGroup[];
    priorityGroups: AssignmentGroup[];
    courseGroups: {[key: string]: Assignment[]};
  }>({
    dateGroups: [],
    priorityGroups: [],
    courseGroups: {}
  });
  
  const segments = [
    t('assignments').segments.dueDate, 
    t('assignments').segments.classes, 
    t('assignments').segments.priority
  ];
  
  // Get current date for archive comparison
  const currentDate = useMemo(() => new Date(), []);
  
  // Check for navigation data when screen is focused
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const checkNavigationData = async () => {
        try {
          const navigationDataJson = await AsyncStorage.getItem('assignment_navigation_data');
          
          if (navigationDataJson && isMounted) {
            const navigationData = JSON.parse(navigationDataJson);
            
            if (navigationData.autoExpand && navigationData.assignmentId) {
              // Store in ref to avoid re-renders when we clear it
              assignmentToExpandRef.current = navigationData.assignmentId;
              
              // If we have a date, store it too
              if (navigationData.date) {
                dateToExpandRef.current = navigationData.date;
              }
              
              // Switch to the due date view (index 0) if not already there
              if (selectedSegmentIndex !== 0) {
                setSelectedSegmentIndex(0);
              }
            }
            
            // Clear the navigation data after using it
            await AsyncStorage.removeItem('assignment_navigation_data');
          }
        } catch (error) {
          console.error('Error reading navigation data:', error);
        }
      };
      
      checkNavigationData();
      
      return () => {
        isMounted = false;
      };
    }, [selectedSegmentIndex])
  );
  
  // Reset the highlighted assignments list when the component mounts
  // This ensures we can re-highlight assignments after app restarts
  useEffect(() => {
    const resetHighlightedAssignments = async () => {
      try {
        // Check if the app was recently launched (within the last minute)
        const now = Date.now();
        const lastReset = await AsyncStorage.getItem('last_highlight_reset');
        const lastResetTime = lastReset ? parseInt(lastReset) : 0;
        
        // Only reset if the app hasn't been active for more than a minute
        if (now - lastResetTime > 60000) {
          await AsyncStorage.removeItem('highlighted_assignments');
          await AsyncStorage.setItem('last_highlight_reset', now.toString());
        }
      } catch (error) {
        console.error('Error resetting highlighted assignments:', error);
      }
    };
    
    resetHighlightedAssignments();
  }, []);
  
  // No need for additional useEffects to clear the highlight state
  // as we're now using refs which don't cause re-renders

  // Simple fetch assignments implementation with data caching
  const fetchAssignments = useCallback(async () => {
    try {
      setIsLoading(true);
      const assignments = await getAssignments();
      
      // Separate current and archived assignments
      const now = new Date();
      const current: Assignment[] = [];
      const archived: Assignment[] = [];
      
      assignments.forEach(assignment => {
        const dueDate = new Date(assignment.dueDate);
        // If due date is in the past and assignment is not completed, move to archive
        if (dueDate < now && !assignment.isCompleted) {
          archived.push(assignment);
        } else {
          current.push(assignment);
        }
      });
      
      setAllAssignments(current);
      setArchivedAssignments(archived);
      
      // Precompute all data once to avoid jank during tab switches
      const priorityAssignments = current.filter(a => a.isPriority);
      memoizedDataRef.current = {
        dateGroups: groupAssignmentsByDate(current, t, formatDate),
        priorityGroups: groupAssignmentsByDate(priorityAssignments, t, formatDate),
        courseGroups: groupAssignmentsByCourse(current)
      };
    } catch (error) {
      // Silently handle error
    } finally {
      setIsLoading(false);
    }
  }, [t, formatDate]);
  
  // Add useFocusEffect to refresh assignments when returning to this screen
  // This ensures new assignments are loaded when created
  useFocusEffect(
    useCallback(() => {
      fetchAssignments();
      
      return () => {
        // Cleanup when screen is unfocused
      };
    }, [fetchAssignments])
  );
  
  // Load assignments when component mounts
  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);
  
  // Handle segment change with selection from dropdown
  const handleSegmentChange = useCallback((index: number) => {
    if (isSafeMode || index === selectedSegmentIndex) {
      return;
    }
    
    // Hide dropdown when selection is made
    setIsDropdownVisible(false);
    
    // Mark this tab as viewed to disable animations on next view
    setHasViewedTab(prev => ({...prev, [index]: true}));
    
    // Update the selected segment
    setSelectedSegmentIndex(index);
  }, [isSafeMode, selectedSegmentIndex]);
  
  // Handle add assignment
  const handleAddAssignment = useCallback(() => {
    router.push('/new-assignment');
  }, []);
  
  // Handle toggle assignment with optimized state update
  const handleToggleAssignment = useCallback((id: string) => {
    // Check if the assignment is in the archived list
    const isArchived = archivedAssignments.some(a => a.id === id);
    
    if (isArchived) {
      setArchivedAssignments(current => {
        return current.map(a => a.id === id ? {...a, isCompleted: !a.isCompleted} : a);
      });
    } else {
      setAllAssignments(current => {
        const updated = current.map(a => a.id === id ? {...a, isCompleted: !a.isCompleted} : a);
        
        // Update the memoized data
        const priorityAssignments = updated.filter(a => a.isPriority);
        memoizedDataRef.current = {
          dateGroups: groupAssignmentsByDate(updated, t, formatDate),
          priorityGroups: groupAssignmentsByDate(priorityAssignments, t, formatDate),
          courseGroups: groupAssignmentsByCourse(updated)
        };
        
        return updated;
      });
    }
    
    // Update database in background
    toggleAssignmentCompletion(id).catch(() => {
      // Silently handle error
    });
  }, [t, formatDate, archivedAssignments]);
  
  // Handle delete assignment with optimized state update
  const handleDeleteAssignment = useCallback((id: string) => {
    // Check if the assignment is in the archived list
    const isArchived = archivedAssignments.some(a => a.id === id);
    
    if (isArchived) {
      setArchivedAssignments(current => current.filter(a => a.id !== id));
    } else {
      setAllAssignments(current => {
        const updated = current.filter(a => a.id !== id);
        
        // Update the memoized data
        const priorityAssignments = updated.filter(a => a.isPriority);
        memoizedDataRef.current = {
          dateGroups: groupAssignmentsByDate(updated, t, formatDate),
          priorityGroups: groupAssignmentsByDate(priorityAssignments, t, formatDate),
          courseGroups: groupAssignmentsByCourse(updated)
        };
        
        return updated;
      });
    }
    
    // Update database in background
    deleteAssignment(id).catch(() => {
      // Silently handle error
    });
  }, [t, formatDate, archivedAssignments]);
  
  // Handle archive all past due assignments
  const handleArchiveAll = useCallback(() => {
    const now = new Date();
    
    setAllAssignments(current => {
      const toKeep: Assignment[] = [];
      const toArchive: Assignment[] = [];
      
      current.forEach(assignment => {
        const dueDate = new Date(assignment.dueDate);
        if (dueDate < now && !assignment.isCompleted) {
          toArchive.push(assignment);
        } else {
          toKeep.push(assignment);
        }
      });
      
      // Update archived assignments
      setArchivedAssignments(prev => [...prev, ...toArchive]);
      
      // Update the memoized data for remaining assignments
      const priorityAssignments = toKeep.filter(a => a.isPriority);
      memoizedDataRef.current = {
        dateGroups: groupAssignmentsByDate(toKeep, t, formatDate),
        priorityGroups: groupAssignmentsByDate(priorityAssignments, t, formatDate),
        courseGroups: groupAssignmentsByCourse(toKeep)
      };
      
      // Open archive modal if we archived items
      if (toArchive.length > 0) {
        setIsArchiveModalVisible(true);
      }
      
      return toKeep;
    });
  }, [t, formatDate]);
  
  // Replace the toggleArchiveModal function with this:
  const handleArchivePress = useCallback(() => {
    console.log('Archive button clicked');
    router.push('/archive');
  }, []);
  
  // Custom DateGroupedView that uses memoized data and disables animations after first view
  const CustomDateGroupedView = useCallback(({
    groups,
    onToggle,
    onDelete,
    disableAnimations
  }: {
    groups: AssignmentGroup[],
    onToggle: (id: string) => void,
    onDelete: (id: string) => void,
    disableAnimations: boolean
  }) => {
    if (groups.length === 0) {
      return <EmptyState t={t} />;
    }
    
    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
      >
        {groups.map((group, index) => {
          // Determine if this day should be expanded
          let shouldExpandDay = index === 0; // Default: expand first day
          
          // If we have an assignment to expand and a date to expand
          if (assignmentToExpandRef.current && dateToExpandRef.current) {
            // Check if this group contains the target date
            const groupDate = new Date(group.date);
            const targetDate = new Date(dateToExpandRef.current);
            
            // If the dates match (same day), this group should be expanded
            if (groupDate.getFullYear() === targetDate.getFullYear() &&
                groupDate.getMonth() === targetDate.getMonth() &&
                groupDate.getDate() === targetDate.getDate()) {
              shouldExpandDay = true;
              
              // If this is not the first iteration, scroll to this section
              if (index > 0) {
                // Use setTimeout to ensure the section is rendered before scrolling
                setTimeout(() => {
                  // We don't have a direct ref to the ScrollView from here,
                  // but we can use scrollTo in the next frame
                  // This is a simple approach - a more robust approach would use a ref
                }, 300);
              }
            }
          }
          
          return (
            <View key={`${group.date}-${index}`} style={{marginBottom: 8}}>
              {disableAnimations ? (
                <View>
                  <DaySection
                    title={group.title}
                    date={group.date}
                    assignments={group.assignments}
                    onToggleAssignment={onToggle}
                    onDeleteAssignment={onDelete}
                    defaultExpanded={shouldExpandDay}
                    assignmentToHighlight={assignmentToExpandRef.current}
                  />
                </View>
              ) : (
                <Animated.View 
                  entering={FadeInDown.duration(150).delay(index * 20)}
                  layout={Layout.springify().mass(0.3)}
                >
                  <DaySection
                    title={group.title}
                    date={group.date}
                    assignments={group.assignments}
                    onToggleAssignment={onToggle}
                    onDeleteAssignment={onDelete}
                    defaultExpanded={shouldExpandDay}
                    assignmentToHighlight={assignmentToExpandRef.current}
                  />
                </Animated.View>
              )}
            </View>
          );
        })}
      </ScrollView>
    );
  }, [t]);
  
  // Simplified CoursesView with disabled animations after first view
  const SimplifiedCoursesView = useCallback(({
    courseGroups,
    onToggle,
    onDelete,
    disableAnimations
  }: {
    courseGroups: {[key: string]: Assignment[]},
    onToggle: (id: string) => void,
    onDelete: (id: string) => void,
    disableAnimations: boolean
  }) => {
    const courseKeys = Object.keys(courseGroups);
    
    if (courseKeys.length === 0) {
      return <EmptyState t={t} />;
    }
    
    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
      >
        {courseKeys.map((courseCode, index) => (
          <View key={`course-${courseCode}`} style={{marginBottom: 8}}>
            {disableAnimations ? (
              <View>
                <CourseSection
                  courseCode={courseCode}
                  courseName={courseGroups[courseCode][0]?.courseName || 'Uncategorized'}
                  assignments={courseGroups[courseCode]}
                  onToggleAssignment={onToggle}
                  onDeleteAssignment={onDelete}
                  showDueDate={true}
                />
              </View>
            ) : (
              <Animated.View
                entering={FadeInDown.duration(150).delay(index * 20)}
                layout={Layout.springify().mass(0.3)}
              >
                <CourseSection
                  courseCode={courseCode}
                  courseName={courseGroups[courseCode][0]?.courseName || 'Uncategorized'}
                  assignments={courseGroups[courseCode]}
                  onToggleAssignment={onToggle}
                  onDeleteAssignment={onDelete}
                  showDueDate={true}
                />
              </Animated.View>
            )}
          </View>
        ))}
      </ScrollView>
    );
  }, [t]);
  
  // Custom rendering based on selected segment
  const renderContent = () => {
    // Don't show animations if we've viewed this tab before
    const disableAnimations = hasViewedTab[selectedSegmentIndex];
    
    if (isLoading) {
      return <LoadingState t={t} />;
    }
    
    if (isSafeMode) {
      return <LoadingState t={t} />;
    }
    
    switch (selectedSegmentIndex) {
      case 0: // Due Date
        return (
          <CustomDateGroupedView
            groups={memoizedDataRef.current.dateGroups}
            onToggle={handleToggleAssignment}
            onDelete={handleDeleteAssignment}
            disableAnimations={disableAnimations}
          />
        );
      case 1: // Classes
        return (
          <SimplifiedCoursesView
            courseGroups={memoizedDataRef.current.courseGroups}
            onToggle={handleToggleAssignment}
            onDelete={handleDeleteAssignment}
            disableAnimations={disableAnimations}
          />
        );
      case 2: // Priority
        return (
          <CustomDateGroupedView
            groups={memoizedDataRef.current.priorityGroups}
            onToggle={handleToggleAssignment}
            onDelete={handleDeleteAssignment}
            disableAnimations={disableAnimations}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <Text style={styles.headerTitle}>{t('assignments').title}</Text>
            
            <TouchableOpacity
              style={styles.archiveButton}
              onPress={handleArchivePress}
              activeOpacity={0.7}
            >
              <Ionicons name="folder-open" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          
          <Pressable 
            style={({ pressed }) => [
              styles.dropdownButton,
              pressed && styles.dropdownButtonPressed
            ]} 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsDropdownVisible(true);
            }}
          >
            <View style={styles.dropdownButtonContent}>
              <Text style={styles.dropdownButtonText}>{segments[selectedSegmentIndex]}</Text>
              <Ionicons 
                name="chevron-down" 
                size={16} 
                color="#8A8A8D" 
                style={[
                  styles.dropdownArrow,
                  isDropdownVisible && styles.dropdownArrowRotated
                ]} 
              />
            </View>
          </Pressable>
          
          <ModernDropdown
            isVisible={isDropdownVisible}
            onClose={() => setIsDropdownVisible(false)}
            segments={segments}
            selectedIndex={selectedSegmentIndex}
            onSelect={handleSegmentChange}
            styles={styles}
          />
          
          {isSafeMode && (
            <Text style={styles.safeModeIndicator}>Stability mode active</Text>
          )}
        </View>
      </View>
      
      <View style={styles.contentContainer}>
        {renderContent()}
        <FloatingActionButton onPress={handleAddAssignment} />
      </View>
    </SafeAreaView>
  );
};

// Wrap the main component with the error boundary
const AssignmentsWithErrorBoundary = () => (
  <AssignmentsErrorBoundary>
    <AssignmentOptionsProvider>
      <Assignments />
    </AssignmentOptionsProvider>
  </AssignmentsErrorBoundary>
);

export default AssignmentsWithErrorBoundary;

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
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  archiveButton: {
    backgroundColor: '#2C3DCD',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  archiveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  archiveButtonIcon: {
    fontSize: 18,
    color: '#FFFFFF',
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
  safeModeBanner: {
    backgroundColor: '#2C2C2E',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  safeModeText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  safeModeDescription: {
    fontSize: 14,
    color: '#AEAEB2',
    textAlign: 'center',
  },
  safeModeIndicator: {
    fontSize: 12,
    color: '#FFC107',
    textAlign: 'center',
    marginTop: 8,
  },
  safeScrollContent: {
    paddingTop: 20,
  },
  simplifiedSection: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  simplifiedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  simplifiedItem: {
    height: 40,
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    marginBottom: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    padding: 20,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 16,
    color: '#8A8A8D',
    marginBottom: 20,
    textAlign: 'center',
  },
  errorHint: {
    fontSize: 14,
    color: '#FF9500',
    textAlign: 'center',
    padding: 16,
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderRadius: 8,
    overflow: 'hidden',
    width: '100%',
  },
  dropdownButton: {
    backgroundColor: '#232323',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  dropdownButtonPressed: {
    backgroundColor: '#2A2A2A',
  },
  dropdownButtonContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dropdownArrow: {
    transform: [{ rotate: '0deg' }],
  },
  dropdownArrowRotated: {
    transform: [{ rotate: '180deg' }],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  dropdownContainer: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  dropdownTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#8A8A8D',
  },
  closeButton: {
    padding: 4,
  },
  dropdownItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  dropdownItemPressed: {
    backgroundColor: '#2C2C2E',
  },
  dropdownItemSelected: {
    backgroundColor: '#2C3DCD20',
  },
  dropdownItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownItemText: {
    fontSize: 17,
    color: '#FFFFFF',
  },
  dropdownItemTextSelected: {
    color: '#3478F6',
    fontWeight: '600',
  },
  // Archive specific styles
  archivedHeaderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8A8A8D',
    marginBottom: 16,
    marginTop: 8,
  },
  archivedItemContainer: {
    marginBottom: 12,
  },
  archivedItem: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  archivedItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  archivedCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3478F6',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  archivedCheckboxCompleted: {
    backgroundColor: '#3478F6',
    borderColor: '#3478F6',
  },
  archivedCheckmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  archivedTextContainer: {
    flex: 1,
  },
  archivedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  archivedTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#8A8A8D',
  },
  archivedSubtitle: {
    fontSize: 14,
    color: '#8A8A8D',
  },
  archivedDeleteButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  archivedDeleteText: {
    fontSize: 20,
    color: '#FF3B30',
    fontWeight: 'bold',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
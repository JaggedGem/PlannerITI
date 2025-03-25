import React, { useState, useEffect, useMemo, memo, useRef, useLayoutEffect } from 'react';
import { StyleSheet, ScrollView, SafeAreaView, StatusBar, View, Text, ActivityIndicator, Platform, InteractionManager, AppState } from 'react-native';
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
import AsyncStorage from '@react-native-async-storage/async-storage';

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
      // Fallback UI when an error occurs
      return (
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="light-content" />
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Something went wrong</Text>
            <Text style={styles.errorMessage}>The app is recovering...</Text>
            {this.state.errorCount > 2 && (
              <Text style={styles.errorHint}>
                Tip: Avoid rapid switching between tabs
              </Text>
            )}
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

// Define the main Assignments component - this needs to be before AssignmentsWithErrorBoundary
const Assignments = () => {
  const colorScheme = useColorScheme() ?? 'light';
  const { t, formatDate } = useTranslation();
  
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [allAssignments, setAllAssignments] = useState<Assignment[]>([]);
  const [isSafeMode, setIsSafeMode] = useState(false);
  
  // Track which tabs have been viewed already to disable animations after first view
  const [hasViewedTab, setHasViewedTab] = useState<{[key: number]: boolean}>({0: false, 1: false, 2: false});
  
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
  
  const segments = [t('assignments').segments.dueDate, t('assignments').segments.classes, t('assignments').segments.priority];
  
  // Simple fetch assignments implementation with data caching
  const fetchAssignments = useCallback(async () => {
    try {
      setIsLoading(true);
      const assignments = await getAssignments();
      setAllAssignments(assignments);
      
      // Precompute all data once to avoid jank during tab switches
      const priorityAssignments = assignments.filter(a => a.isPriority);
      memoizedDataRef.current = {
        dateGroups: groupAssignmentsByDate(assignments, t, formatDate),
        priorityGroups: groupAssignmentsByDate(priorityAssignments, t, formatDate),
        courseGroups: groupAssignmentsByCourse(assignments)
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
  
  // Handle segment change with debounce to prevent rapid switching
  const handleSegmentChange = useCallback((index: number) => {
    if (isSafeMode || index === selectedSegmentIndex) {
      return;
    }
    
    // If we're currently switching, we'll allow the next switch only if it's not too quick
    if (isTabSwitching) {
      // Allow the change after a brief timeout to prevent ultra-rapid switches
      setTimeout(() => {
        setSelectedSegmentIndex(index);
        // Mark this tab as viewed to disable animations on next view
        setHasViewedTab(prev => ({...prev, [index]: true}));
      }, 30);
      return;
    }
    
    // Mark tab switching in progress
    setIsTabSwitching(true);
    
    // Mark this tab as viewed to disable animations on next view
    setHasViewedTab(prev => ({...prev, [index]: true}));
    
    // Update the selected segment immediately for better responsiveness
    setSelectedSegmentIndex(index);
    
    // Allow tab switching again after a very short cooldown
    setTimeout(() => {
      setIsTabSwitching(false);
    }, 50); // Much shorter cooldown
  }, [isSafeMode, isTabSwitching, selectedSegmentIndex]);
  
  // Handle add assignment
  const handleAddAssignment = useCallback(() => {
    router.push('/new-assignment');
  }, []);
  
  // Handle toggle assignment with optimized state update
  const handleToggleAssignment = useCallback((id: string) => {
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
    
    // Update database in background
    toggleAssignmentCompletion(id).catch(() => {
      // Silently handle error
    });
  }, [t, formatDate]);
  
  // Handle delete assignment with optimized state update
  const handleDeleteAssignment = useCallback((id: string) => {
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
    
    // Update database in background
    deleteAssignment(id).catch(() => {
      // Silently handle error
    });
  }, [t, formatDate]);
  
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
        {groups.map((group, index) => (
          <View key={`${group.date}-${index}`} style={{marginBottom: 8}}>
            {disableAnimations ? (
              <View>
                <DaySection
                  title={group.title}
                  date={group.date}
                  assignments={group.assignments}
                  onToggleAssignment={onToggle}
                  onDeleteAssignment={onDelete}
                  defaultExpanded={index === 0} // Only first day will be expanded by default
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
                  defaultExpanded={index === 0} // Only first day will be expanded by default
                />
              </Animated.View>
            )}
          </View>
        ))}
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
          <Text style={styles.headerTitle}>{t('assignments').title}</Text>
          
          <SegmentedControl
            segments={segments}
            selectedIndex={selectedSegmentIndex}
            onChange={handleSegmentChange}
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
    <Assignments />
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
});
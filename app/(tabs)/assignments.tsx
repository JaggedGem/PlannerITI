import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, SafeAreaView, StatusBar, View, Text, ActivityIndicator, Platform } from 'react-native';
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
import { useCallback } from 'react';
import Animated, { FadeInDown, Layout, FadeOut } from 'react-native-reanimated';
import CourseSection from '../../components/assignments/CourseSection';
import { useTranslation } from '@/hooks/useTranslation';

// Function to group assignments by course
const groupAssignmentsByCourse = (assignments: Assignment[]): {[key: string]: Assignment[]} => {
  const groupedAssignments: {[key: string]: Assignment[]} = {};
  
  assignments.forEach(assignment => {
    // Handle assignments with empty course codes
    const courseKey = assignment.courseCode || assignment.courseName || `uncategorized-${assignment.id}`;
    const courseName = assignment.courseName || 'Uncategorized';
    
    if (!groupedAssignments[courseKey]) {
      groupedAssignments[courseKey] = [];
    }
    
    groupedAssignments[courseKey].push(assignment);
  });
  
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

export default function Assignments() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const darkMode = colorScheme === 'dark';
  const { t, formatDate } = useTranslation();
  
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState(0);
  const [assignmentGroups, setAssignmentGroups] = useState<AssignmentGroup[]>([]);
  const [courseGroups, setCourseGroups] = useState<{[key: string]: Assignment[]}>({});
  const [isLoading, setIsLoading] = useState(true);
  const [allAssignments, setAllAssignments] = useState<Assignment[]>([]);
  
  const segments = [t('assignments').segments.dueDate, t('assignments').segments.classes, t('assignments').segments.priority];
  
  // Load assignments initially and when screen comes into focus
  const loadAssignments = useCallback(async () => {
    setIsLoading(true);
    try {
      const assignments = await getAssignments();
      setAllAssignments(assignments);
      
      let filteredAssignments = [...assignments];
      
      // Apply filtering based on selected segment
      if (selectedSegmentIndex === 2) {
        // Filter by priority
        filteredAssignments = assignments.filter(a => a.isPriority);
        
        // Group by date for priority view
        const groups = groupAssignmentsByDate(filteredAssignments, t, formatDate);
        setAssignmentGroups(groups);
      } else if (selectedSegmentIndex === 1) {
        // Group by class for class view
        const grouped = groupAssignmentsByCourse(assignments);
        setCourseGroups(grouped);
      } else {
        // Group by date for default view
        const groups = groupAssignmentsByDate(filteredAssignments, t, formatDate);
        setAssignmentGroups(groups);
      }
    } catch (error) {
      console.error('Error loading assignments:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSegmentIndex, t, formatDate]);
  
  // Initial load
  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);
  
  // Refresh when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadAssignments();
    }, [loadAssignments])
  );
  
  // Handle segment change
  const handleSegmentChange = (index: number) => {
    setSelectedSegmentIndex(index);
    // The loadAssignments dependency will handle refreshing the data
  };
  
  // Toggle assignment completion
  const handleToggleAssignment = async (id: string) => {
    // Update local state first for instant UI feedback
    const updatedAssignments = allAssignments.map(a => 
      a.id === id ? {...a, isCompleted: !a.isCompleted} : a
    );
    setAllAssignments(updatedAssignments);
    
    // Apply filtering based on selected segment
    if (selectedSegmentIndex === 2) {
      // Filter by priority
      const filteredAssignments = updatedAssignments.filter(a => a.isPriority);
      const groups = groupAssignmentsByDate(filteredAssignments, t, formatDate);
      setAssignmentGroups(groups);
    } else if (selectedSegmentIndex === 1) {
      // Group by class
      const grouped = groupAssignmentsByCourse(updatedAssignments);
      setCourseGroups(grouped);
    } else {
      // Group by date
      const groups = groupAssignmentsByDate(updatedAssignments, t, formatDate);
      setAssignmentGroups(groups);
    }
    
    // Then update the database
    await toggleAssignmentCompletion(id);
  };
  
  // Delete assignment
  const handleDeleteAssignment = async (id: string) => {
    // Update local state first for instant UI feedback
    const updatedAssignments = allAssignments.filter(a => a.id !== id);
    setAllAssignments(updatedAssignments);
    
    // Apply filtering based on selected segment
    if (selectedSegmentIndex === 2) {
      // Filter by priority
      const filteredAssignments = updatedAssignments.filter(a => a.isPriority);
      const groups = groupAssignmentsByDate(filteredAssignments, t, formatDate);
      setAssignmentGroups(groups);
    } else if (selectedSegmentIndex === 1) {
      // Group by class
      const grouped = groupAssignmentsByCourse(updatedAssignments);
      setCourseGroups(grouped);
    } else {
      // Group by date
      const groups = groupAssignmentsByDate(updatedAssignments, t, formatDate);
      setAssignmentGroups(groups);
    }
    
    // Then update the database
    await deleteAssignment(id);
  };
  
  // Navigate to new assignment screen
  const handleAddAssignment = () => {
    router.push('/new-assignment');
  };
  
  // Render content based on selected segment
  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3478F6" />
          <Text style={styles.loadingText}>{t('assignments').loading}</Text>
        </View>
      );
    }
    
    // Classes view (grouped by course)
    if (selectedSegmentIndex === 1) {
      const courseKeys = Object.keys(courseGroups);
      
      if (courseKeys.length === 0) {
        return (
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
        );
      }
      
      return (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {courseKeys.map((courseCode, index) => (
            <Animated.View
              key={`course-${courseCode}`}
              entering={FadeInDown.duration(150).delay(index * 50)}
              exiting={FadeOut.duration(100)}
              layout={Layout.springify().mass(0.5)}
              style={styles.courseContainer}
            >
              <CourseSection
                courseCode={courseCode}
                courseName={courseGroups[courseCode][0].courseName || 'Uncategorized'}
                assignments={courseGroups[courseCode]}
                onToggleAssignment={handleToggleAssignment}
                onDeleteAssignment={handleDeleteAssignment}
                showDueDate={true}
              />
            </Animated.View>
          ))}
        </ScrollView>
      );
    }
    
    // Due date or Priority view (grouped by date)
    if (assignmentGroups.length === 0) {
      return (
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
      );
    }
    
    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {assignmentGroups.map((group, index) => (
          <Animated.View
            key={`${group.date}-${index}`}
            entering={FadeInDown.duration(150).delay(index * 50)}
            exiting={FadeOut.duration(100)}
            layout={Layout.springify().mass(0.5)}
          >
            <DaySection
              title={group.title}
              date={group.date}
              assignments={group.assignments}
              onToggleAssignment={handleToggleAssignment}
              onDeleteAssignment={handleDeleteAssignment}
            />
          </Animated.View>
        ))}
      </ScrollView>
    );
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
});
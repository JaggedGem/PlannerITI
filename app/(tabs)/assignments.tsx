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
  Assignment, 
  groupAssignmentsByDate,
  AssignmentGroup
} from '../../utils/assignmentStorage';
import { useCallback } from 'react';

export default function Assignments() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const darkMode = colorScheme === 'dark';
  
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState(0);
  const [assignmentGroups, setAssignmentGroups] = useState<AssignmentGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const segments = ['Due date', 'Classes', 'Priority'];
  
  // Load assignments initially and when screen comes into focus
  const loadAssignments = useCallback(async () => {
    setIsLoading(true);
    try {
      const assignments = await getAssignments();
      let filteredAssignments = [...assignments];
      
      // Apply filtering based on selected segment
      if (selectedSegmentIndex === 2) {
        // Filter by priority
        filteredAssignments = assignments.filter(a => a.isPriority);
      } else if (selectedSegmentIndex === 1) {
        // Sort by class
        filteredAssignments.sort((a, b) => a.courseCode.localeCompare(b.courseCode));
      }
      
      const groups = groupAssignmentsByDate(filteredAssignments);
      setAssignmentGroups(groups);
    } catch (error) {
      console.error('Error loading assignments:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSegmentIndex]);
  
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
    await toggleAssignmentCompletion(id);
    loadAssignments();
  };
  
  // Navigate to new assignment screen
  const handleAddAssignment = () => {
    router.push('/new-assignment');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Assignments</Text>
          
          <SegmentedControl
            segments={segments}
            selectedIndex={selectedSegmentIndex}
            onChange={handleSegmentChange}
          />
        </View>
      </View>
      
      <View style={styles.contentContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3478F6" />
            <Text style={styles.loadingText}>Loading assignments...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {assignmentGroups.length > 0 ? (
              assignmentGroups.map((group, index) => (
                <DaySection
                  key={index}
                  title={group.title}
                  date={group.date}
                  assignments={group.assignments}
                  onToggleAssignment={handleToggleAssignment}
                />
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  No assignments found
                </Text>
                <Text style={styles.emptySubtext}>
                  Tap the + button to add a new assignment
                </Text>
              </View>
            )}
          </ScrollView>
        )}
        
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
});
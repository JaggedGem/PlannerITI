import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  Modal, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator,
  StatusBar,
  Dimensions,
  Platform,
  SafeAreaView
} from 'react-native';
import { Assignment } from '../../utils/assignmentStorage';
import Animated, { FadeInDown, Layout, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/hooks/useTranslation';

// Get screen dimensions
const { width, height } = Dimensions.get('window');

interface ArchiveViewProps {
  isVisible: boolean;
  onClose: () => void;
  assignments: Assignment[];
  onToggleAssignment: (id: string) => void;
  onDeleteAssignment: (id: string) => void;
  onArchiveAll?: () => void;
}

export default function ArchiveView({
  isVisible,
  onClose,
  assignments,
  onToggleAssignment,
  onDeleteAssignment,
  onArchiveAll
}: ArchiveViewProps) {
  const { t } = useTranslation();
  
  // State for lazy loading
  const [visibleItems, setVisibleItems] = useState(15);
  const [hasMore, setHasMore] = useState(true);
  const isLoadingMoreRef = useRef(false);

  // Helper function to log modal status
  useEffect(() => {
    console.log('Modal visibility:', isVisible);
  }, [isVisible]);
  
  // Group assignments by month
  const groupedAssignments = useMemo(() => {
    // Skip processing if modal is not visible or no assignments
    if (!isVisible || !assignments.length) {
      return {};
    }
    
    const grouped: { [key: string]: Assignment[] } = {};
    
    // Sort assignments by due date (newest first)
    const sorted = [...assignments].sort((a, b) => 
      new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
    );
    
    // Only take the visible items
    const visibleAssignments = sorted.slice(0, visibleItems);
    
    // Group by month
    visibleAssignments.forEach(assignment => {
      const date = new Date(assignment.dueDate);
      const monthYear = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
      
      if (!grouped[monthYear]) {
        grouped[monthYear] = [];
      }
      
      grouped[monthYear].push(assignment);
    });
    
    return grouped;
  }, [assignments, visibleItems, isVisible]);
  
  // Handle loading more items
  const loadMoreItems = useCallback(() => {
    if (isLoadingMoreRef.current || !hasMore) return;
    
    isLoadingMoreRef.current = true;
    
    // Simulate delay to avoid UI jank
    setTimeout(() => {
      setVisibleItems(prev => {
        const newValue = prev + 10;
        if (newValue >= assignments.length) {
          setHasMore(false);
        }
        return newValue;
      });
      isLoadingMoreRef.current = false;
    }, 100);
  }, [hasMore, assignments.length]);
  
  // Handle scroll to detect when to load more
  const handleScroll = useCallback(({ nativeEvent }: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const paddingToBottom = 200;
    
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
      loadMoreItems();
    }
  }, [loadMoreItems]);
  
  // Handle closing
  const handleClose = useCallback(() => {
    console.log('Closing archive modal');
    onClose();
  }, [onClose]);
  
  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
      statusBarTranslucent={false}
      hardwareAccelerated={true}
    >
      <SafeAreaView style={styles.safeAreaContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#141414" />
        
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={handleClose}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Archived Assignments</Text>
            <View style={styles.placeholder} />
          </View>
          
          {onArchiveAll && (
            <TouchableOpacity style={styles.archiveAllButton} onPress={onArchiveAll}>
              <Ionicons name="archive" size={16} color="#FFFFFF" style={styles.archiveAllIcon} />
              <Text style={styles.archiveAllText}>Archive All Past Due</Text>
            </TouchableOpacity>
          )}
          
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={400}
          >
            {Object.keys(groupedAssignments).length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No archived assignments</Text>
                <Text style={styles.emptySubtext}>Past due assignments will appear here</Text>
              </View>
            ) : (
              Object.entries(groupedAssignments).map(([month, monthAssignments], monthIndex) => (
                <View key={month} style={styles.monthSection}>
                  <Text style={styles.monthTitle}>{month}</Text>
                  
                  {monthAssignments.map((assignment, index) => (
                    <Animated.View
                      key={assignment.id}
                      entering={FadeInDown.duration(150).delay((monthIndex * 2 + index % 5) * 30)}
                      layout={Layout.springify().mass(0.3)}
                      style={styles.assignmentContainer}
                      exiting={FadeOut.duration(150)}
                    >
                      <View style={styles.assignmentItem}>
                        <View style={styles.assignmentLeft}>
                          <TouchableOpacity
                            onPress={() => onToggleAssignment(assignment.id)}
                            style={[
                              styles.checkbox,
                              assignment.isCompleted && styles.checkboxCompleted
                            ]}
                          >
                            {assignment.isCompleted && (
                              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                            )}
                          </TouchableOpacity>
                          <View style={styles.textContainer}>
                            <Text 
                              style={[
                                styles.title, 
                                assignment.isCompleted && styles.titleCompleted
                              ]} 
                              numberOfLines={1}
                            >
                              {assignment.title}
                            </Text>
                            <View style={styles.detailsRow}>
                              <Text style={styles.subtitle}>
                                {assignment.courseCode || "No Course"} • {assignment.assignmentType}
                              </Text>
                              <Text style={styles.dueDate}>
                                {new Date(assignment.dueDate).toLocaleDateString()}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <TouchableOpacity
                          onPress={() => onDeleteAssignment(assignment.id)}
                          style={styles.deleteButton}
                        >
                          <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                        </TouchableOpacity>
                      </View>
                    </Animated.View>
                  ))}
                </View>
              ))
            )}
            
            {hasMore && (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator size="small" color="#3478F6" />
                <Text style={styles.loadingMoreText}>Loading more...</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeAreaContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 16 : 16,
    backgroundColor: '#141414',
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: height * 0.25,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8A8A8D',
  },
  monthSection: {
    marginBottom: 24,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8A8A8D',
    marginBottom: 12,
    marginLeft: 4,
  },
  assignmentContainer: {
    marginBottom: 12,
  },
  assignmentItem: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assignmentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3478F6',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxCompleted: {
    backgroundColor: '#3478F6',
    borderColor: '#3478F6',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: '#8A8A8D',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#8A8A8D',
    flex: 1,
  },
  dueDate: {
    fontSize: 12,
    color: '#8A8A8D',
    fontStyle: 'italic',
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  loadingMoreContainer: {
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loadingMoreText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#8A8A8D',
  },
  archiveAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2C3DCD',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  archiveAllIcon: {
    marginRight: 8,
  },
  archiveAllText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
}); 
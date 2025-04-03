import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
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
import { router } from 'expo-router';

// Get screen dimensions
const { width, height } = Dimensions.get('window');

interface ArchiveViewProps {
  assignments: Assignment[];
  onToggleAssignment: (id: string) => void;
  onDeleteAssignment: (id: string) => void;
}

export default function ArchiveView({
  assignments,
  onToggleAssignment,
  onDeleteAssignment,
}: ArchiveViewProps) {
  const { t } = useTranslation();
  
  // State for lazy loading
  const [visibleItems, setVisibleItems] = useState(15);
  const [hasMore, setHasMore] = useState(true);
  const isLoadingMoreRef = useRef(false);

  // Group assignments by month
  const groupedAssignments = useMemo(() => {
    if (!assignments.length) {
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
      const monthIndex = date.getMonth();
      const year = date.getFullYear();
      // Use translated month names
      const monthYear = `${t('months')[monthIndex]} ${year}`;
      
      if (!grouped[monthYear]) {
        grouped[monthYear] = [];
      }
      
      grouped[monthYear].push(assignment);
    });
    
    return grouped;
  }, [assignments, visibleItems, t]);
  
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
    console.log('Closing archive view');
    router.back();
  }, []);
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.closeButton} 
          onPress={handleClose}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('assignments').archive.title}</Text>
        <View style={{width: 40}} />
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={400}
      >
        {assignments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>
              {t('assignments').archive.noItems}
            </Text>
            <Text style={styles.emptySubtitle}>
              {t('assignments').archive.pastDue}
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.assignmentsCount}>
              {t('general').found} {assignments.length} {t('assignments').archive.title.toLowerCase()}
            </Text>
            
            {Object.entries(groupedAssignments).map(([monthYear, monthAssignments]) => (
              <View key={monthYear} style={styles.monthSection}>
                <Text style={styles.monthTitle}>{monthYear}</Text>
                {monthAssignments.map((assignment) => (
                  <Animated.View
                    key={assignment.id}
                    entering={FadeInDown.duration(150)}
                    layout={Layout.springify().mass(0.3)}
                    style={styles.assignmentCard}
                  >
                    <TouchableOpacity
                      style={styles.assignmentContent}
                      onPress={() => onToggleAssignment(assignment.id)}
                    >
                      <View style={[
                        styles.checkbox,
                        assignment.isCompleted && styles.checkboxCompleted
                      ]}>
                        {assignment.isCompleted && (
                          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                        )}
                      </View>
                      
                      <View style={styles.assignmentInfo}>
                        <Text style={[
                          styles.assignmentTitle,
                          assignment.isCompleted && styles.assignmentTitleCompleted
                        ]}>
                          {assignment.title}
                        </Text>
                        <Text style={styles.assignmentSubtitle}>
                          {assignment.courseName || t('assignments').common.uncategorized} • {new Date(assignment.dueDate).toLocaleDateString()}
                        </Text>
                      </View>
                      
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => onDeleteAssignment(assignment.id)}
                      >
                        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </View>
            ))}
            
            {hasMore && visibleItems < assignments.length && (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator color="#3478F6" />
                <Text style={styles.loadingMoreText}>{t('loading')}...</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 80 : 40,
    paddingBottom: 20,
    backgroundColor: '#141414',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#8A8A8D',
    fontSize: 14,
  },
  assignmentsCount: {
    color: 'white',
    fontSize: 18,
    marginBottom: 16,
  },
  monthSection: {
    marginBottom: 24,
  },
  monthTitle: {
    color: '#8A8A8D',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  assignmentCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  assignmentContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
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
  assignmentInfo: {
    flex: 1,
  },
  assignmentTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  assignmentTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#8A8A8D',
  },
  assignmentSubtitle: {
    color: '#8A8A8D',
    fontSize: 14,
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  loadingMoreContainer: {
    alignItems: 'center',
    padding: 16,
  },
  loadingMoreText: {
    color: '#8A8A8D',
    fontSize: 14,
    marginTop: 8,
  },
}); 
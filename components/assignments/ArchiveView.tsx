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
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Assignment } from '../../utils/assignmentStorage';
import Animated, { FadeInDown, Layout, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/hooks/useTranslation';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';

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
  const { t, formatFullDate } = useTranslation();
  
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
          <Ionicons name="arrow-back" size={24} color={Colors.dark.white} />
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
                          <Ionicons name="checkmark" size={16} color={Colors.dark.white} />
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
                          {assignment.courseName || t('assignments').common.uncategorized} • {formatFullDate(new Date(assignment.dueDate), false)}
                        </Text>
                      </View>
                      
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => onDeleteAssignment(assignment.id)}
                      >
                        <Ionicons name="trash-outline" size={20} color={Colors.dark.red} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </View>
            ))}
            
            {hasMore && visibleItems < assignments.length && (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator color={Colors.dark.primary} />
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
    backgroundColor: Colors.dark.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 80 : 40,
    paddingBottom: 20,
    backgroundColor: Colors.dark.backgroundApp,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.dark.white,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.overlayWhite10,
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
    color: Colors.dark.white,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: Colors.dark.mutedText,
    fontSize: 14,
  },
  assignmentsCount: {
    color: Colors.dark.white,
    fontSize: 18,
    marginBottom: 16,
  },
  monthSection: {
    marginBottom: 24,
  },
  monthTitle: {
    color: Colors.dark.mutedText,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  assignmentCard: {
    backgroundColor: Colors.dark.card,
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
    borderColor: Colors.dark.primary,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxCompleted: {
    backgroundColor: Colors.dark.primary,
    borderColor: Colors.dark.primary,
  },
  assignmentInfo: {
    flex: 1,
  },
  assignmentTitle: {
    color: Colors.dark.white,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  assignmentTitleCompleted: {
    textDecorationLine: 'line-through',
    color: Colors.dark.mutedText,
  },
  assignmentSubtitle: {
    color: Colors.dark.mutedText,
    fontSize: 14,
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.overlayBlack20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  loadingMoreContainer: {
    alignItems: 'center',
    padding: 16,
  },
  loadingMoreText: {
    color: Colors.dark.mutedText,
    fontSize: 14,
    marginTop: 8,
  },
}); 
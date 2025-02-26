import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, FlatList, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { scheduleService, SubGroupType, Language, Group } from '@/services/scheduleService';
import { useTranslation } from '@/hooks/useTranslation';
import { MaterialIcons } from '@expo/vector-icons';

const languages = {
  en: 'English',
  ro: 'Română'
};

const groups: SubGroupType[] = ['Subgroup 1', 'Subgroup 2'];

// Optimized item comparison function for memo
const areGroupItemPropsEqual = (prevProps: any, nextProps: any) => {
  return (
    prevProps.item._id === nextProps.item._id &&
    prevProps.item.name === nextProps.item.name &&
    prevProps.item.diriginte?.name === nextProps.item.diriginte?.name &&
    prevProps.isSelected === nextProps.isSelected
  );
};

// Memoized group item component for better performance
const GroupItem = memo(({ 
  item, 
  isSelected, 
  onPress 
}: { 
  item: Group; 
  isSelected: boolean; 
  onPress: () => void;
}) => {
  // Memoize styles to prevent unnecessary recalculations
  const itemStyle = useMemo(() => [
    styles.groupItem,
    isSelected && styles.selectedGroupItem
  ], [isSelected]);

  const textStyle = useMemo(() => [
    styles.groupItemText,
    isSelected && styles.selectedOptionText
  ], [isSelected]);

  const teacherStyle = useMemo(() => [
    styles.teacherText,
    isSelected && styles.selectedTeacherText
  ], [isSelected]);

  return (
    <TouchableOpacity
      style={itemStyle}
      onPress={onPress}
    >
      <Text style={textStyle}>
        {item.name}
      </Text>
      {item.diriginte && (
        <Text style={teacherStyle}>
          {item.diriginte.name}
        </Text>
      )}
    </TouchableOpacity>
  );
}, areGroupItemPropsEqual);

GroupItem.displayName = 'GroupItem';

export default function Settings() {
  const { t } = useTranslation();
  const flatListRef = useRef<FlatList<Group>>(null);
  
  // State hooks
  const [settings, setSettings] = useState(scheduleService.getSettings());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupsList, setGroupsList] = useState<Group[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [initialScrollDone, setInitialScrollDone] = useState(false);

  // Callback functions
  const handleLanguageChange = useCallback((language: Language) => {
    scheduleService.updateSettings({ language });
  }, []);

  const handleGroupChange = useCallback((group: SubGroupType) => {
    scheduleService.updateSettings({ group });
  }, []);

  const handleGroupSelection = useCallback((group: Group) => {
    scheduleService.updateSettings({ 
      selectedGroupId: group._id,
      selectedGroupName: group.name
    });
    setShowGroupModal(false);
    setSearchQuery('');
  }, []);

  const handleSearchClear = useCallback(() => {
    setSearchQuery('');
  }, []);

  const keyExtractor = useCallback((item: Group) => item._id, []);

  const getItemLayout = useCallback((data: ArrayLike<Group> | null | undefined, index: number) => ({
    length: 82,
    offset: 82 * index,
    index,
  }), []);

  const renderGroupItem = useCallback(({ item }: { item: Group }) => {
    const isSelected = settings.selectedGroupId === item._id;
    const onItemPress = () => handleGroupSelection(item);
    
    return (
      <GroupItem
        item={item}
        isSelected={isSelected}
        onPress={onItemPress}
      />
    );
  }, [settings.selectedGroupId, handleGroupSelection]);

  const onScrollToIndexFailed = useCallback((info: {
    index: number;
    highestMeasuredFrameIndex: number;
    averageItemLength: number;
  }) => {
    console.log('Scroll to index failed:', info);
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({
        offset: 0,
        animated: false
      });
      
      setTimeout(() => {
        if (flatListRef.current && info.index < filteredGroups.length) {
          const approximateOffset = info.index * info.averageItemLength;
          flatListRef.current.scrollToOffset({
            offset: approximateOffset,
            animated: true
          });
          setInitialScrollDone(true);
        }
      }, 100);
    }
  }, [filteredGroups.length]);

  // Normalize text helper
  const normalizeText = useCallback((text: string): string => {
    return text.toLowerCase().replace(/[-\s]/g, '');
  }, []);

  // Effect hooks
  useEffect(() => {
    const unsubscribe = scheduleService.subscribe(() => {
      setSettings(scheduleService.getSettings());
    });

    const fetchGroups = async () => {
      try {
        setIsLoading(true);
        const groups = await scheduleService.getGroups();
        setGroupsList(groups);
        setFilteredGroups(groups);
      } catch (err) {
        setError('Failed to load groups. Please check your connection.');
        console.error('Error fetching groups:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGroups();
    
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredGroups(groupsList);
    } else {
      const normalizedQuery = normalizeText(searchQuery);
      const filtered = groupsList.filter(group => {
        const normalizedName = normalizeText(group.name);
        return normalizedName.includes(normalizedQuery);
      });
      setFilteredGroups(filtered);
    }
    setInitialScrollDone(false);
  }, [searchQuery, groupsList, normalizeText]);

  useEffect(() => {
    if (!showGroupModal) {
      setInitialScrollDone(false);
    }
  }, [showGroupModal]);

  useEffect(() => {
    if (showGroupModal && !isLoading && flatListRef.current && !initialScrollDone && filteredGroups.length > 0) {
      const selectedIndex = filteredGroups.findIndex(group => group._id === settings.selectedGroupId);
      
      if (selectedIndex !== -1) {
        setTimeout(() => {
          if (flatListRef.current && selectedIndex >= 0) {
            flatListRef.current.scrollToOffset({
              offset: 0,
              animated: false
            });
            
            requestAnimationFrame(() => {
              if (flatListRef.current) {
                try {
                  flatListRef.current.scrollToIndex({
                    index: selectedIndex,
                    animated: true,
                    viewPosition: 0.5
                  });
                } catch (e) {
                  console.log('Fallback to offset scroll');
                  const itemHeight = 82;
                  flatListRef.current.scrollToOffset({
                    offset: selectedIndex * itemHeight,
                    animated: true
                  });
                }
                setInitialScrollDone(true);
              }
            });
          }
        }, 600);
      } else {
        setInitialScrollDone(true);
      }
    }
  }, [showGroupModal, isLoading, filteredGroups, settings.selectedGroupId, initialScrollDone]);

  // Memoize empty component for FlatList
  const ListEmptyComponent = useCallback(() => (
    <View style={styles.errorContainer}>
      <Text style={styles.loadingText}>No classes found matching "{searchQuery}"</Text>
    </View>
  ), [searchQuery]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Class Selection Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Class</Text>
        <TouchableOpacity
          style={styles.classSelector}
          onPress={() => setShowGroupModal(true)}
        >
          <View style={styles.classSelectorContent}>
            <Text style={styles.selectedClassName}>
              {settings.selectedGroupName || 'Select a class'}
            </Text>
            <MaterialIcons name="keyboard-arrow-down" size={24} color="#8A8A8D" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Language Selection Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings').language}</Text>
        <View style={styles.optionsContainer}>
          {(Object.keys(languages) as Language[]).map(lang => (
            <TouchableOpacity
              key={lang}
              style={[
                styles.optionButton,
                settings.language === lang && styles.selectedOption
              ]}
              onPress={() => handleLanguageChange(lang)}
            >
              <Text style={[
                styles.optionText,
                settings.language === lang && styles.selectedOptionText
              ]}>
                {languages[lang]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Subgroup Selection Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings').group}</Text>
        <View style={styles.optionsContainer}>
          {groups.map(group => (
            <TouchableOpacity
              key={group}
              style={[
                styles.optionButton,
                settings.group === group && styles.selectedOption
              ]}
              onPress={() => handleGroupChange(group)}
            >
              <Text style={[
                styles.optionText,
                settings.group === group && styles.selectedOptionText
              ]}>
                {group === 'Subgroup 1' ? t('subgroup').group1 : t('subgroup').group2}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Groups Selection Modal */}
      <Modal
        visible={showGroupModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowGroupModal(false);
          setSearchQuery('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Class</Text>
              <TouchableOpacity onPress={() => {
                setShowGroupModal(false);
                setSearchQuery('');
              }}>
                <MaterialIcons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>
            
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <MaterialIcons name="search" size={20} color="#8A8A8D" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search classes..."
                placeholderTextColor="#8A8A8D"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={handleSearchClear} style={styles.clearButton}>
                  <MaterialIcons name="clear" size={20} color="#8A8A8D" />
                </TouchableOpacity>
              )}
            </View>

            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3478F6" />
                <Text style={styles.loadingText}>Loading classes...</Text>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : filteredGroups.length === 0 ? (
              <ListEmptyComponent />
            ) : (
              <FlatList
                ref={flatListRef}
                data={filteredGroups}
                renderItem={renderGroupItem}
                keyExtractor={keyExtractor}
                style={styles.groupsList}
                contentContainerStyle={styles.groupsListContent}
                onScrollToIndexFailed={onScrollToIndexFailed}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                updateCellsBatchingPeriod={50}
                windowSize={5}
                removeClippedSubviews={true}
                getItemLayout={getItemLayout}
                ListEmptyComponent={ListEmptyComponent}
                showsVerticalScrollIndicator={false}
                maintainVisibleContentPosition={{
                  minIndexForVisible: 0,
                  autoscrollToTopThreshold: 10
                }}
                // Performance optimizations
                bounces={false}
                scrollEventThrottle={16}
                directionalLockEnabled={true}
                disableIntervalMomentum={true}
                decelerationRate="fast"
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1b26',
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
  },
  optionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  optionButton: {
    flex: 1,
    backgroundColor: '#232433',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  selectedOption: {
    backgroundColor: '#3478F6',
  },
  optionText: {
    color: '#8A8A8D',
    fontSize: 16,
    fontWeight: '600',
  },
  selectedOptionText: {
    color: 'white',
  },
  classSelector: {
    backgroundColor: '#232433',
    padding: 16,
    borderRadius: 12,
  },
  classSelectorContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedClassName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1b26',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2b36',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  searchContainer: {
    flexDirection: 'row',
    backgroundColor: '#232433',
    borderRadius: 12,
    marginBottom: 16,
    paddingVertical: 10,
    paddingHorizontal: 15,
    alignItems: 'center',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    padding: 0,
  },
  clearButton: {
    padding: 5,
  },
  groupsList: {
    width: '100%',
  },
  groupsListContent: {
    paddingBottom: 20,
  },
  groupItem: {
    backgroundColor: '#232433',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  selectedGroupItem: {
    backgroundColor: '#3478F6',
  },
  groupItemText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  teacherText: {
    color: '#8A8A8D',
    fontSize: 14,
    marginTop: 4,
  },
  selectedTeacherText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  loadingContainer: {
    padding: 30,
    alignItems: 'center',
  },
  loadingText: {
    color: '#8A8A8D',
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    padding: 30,
    alignItems: 'center',
  },
  errorText: {
    color: '#ff6b6b',
    textAlign: 'center',
    fontSize: 16,
  },
});
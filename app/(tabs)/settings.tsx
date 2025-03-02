import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, FlatList, Modal, TextInput, Switch, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { scheduleService, SubGroupType, Language, Group, CustomPeriod } from '@/services/scheduleService';
import { useTranslation } from '@/hooks/useTranslation';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import ColorPicker from 'react-native-wheel-color-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { DeviceEventEmitter } from 'react-native';

const IDNP_KEY = '@planner_idnp';
const IDNP_UPDATE_EVENT = 'idnp_updated';

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
    isSelected && { ...styles.selectedOption, backgroundColor: '#2C3DCD' }
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
  const router = useRouter();
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
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<CustomPeriod | null>(null);
  const [periodName, setPeriodName] = useState('');
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [selectedColor, setSelectedColor] = useState('#2C3DCD');
  const [isEnabled, setIsEnabled] = useState(true);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [savedIdnp, setSavedIdnp] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Add useEffect to load IDNP and listen for updates
  useEffect(() => {
    const loadIdnp = async () => {
      try {
        const idnp = await AsyncStorage.getItem(IDNP_KEY);
        setSavedIdnp(idnp); // Set the savedIdnp state with the retrieved value
      } catch (error) {
        // Silent error handling
      }
    };
    
    loadIdnp();
    
    // Add event listener for IDNP updates using DeviceEventEmitter
    const subscription = DeviceEventEmitter.addListener(IDNP_UPDATE_EVENT, (newIdnp: string | null) => {
      setSavedIdnp(newIdnp);
    });
    
    // Cleanup event listener on unmount
    return () => {
      subscription.remove();
    };
  }, []);

  // Custom clear IDNP function
  const handleClearIdnp = useCallback(() => {
    setShowConfirmDialog(true);
  }, []);

  // Handle IDNP confirmation
  const handleConfirmClearIdnp = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(IDNP_KEY);
      setSavedIdnp(null);
      // Emit null to notify that IDNP has been cleared
      DeviceEventEmitter.emit(IDNP_UPDATE_EVENT, null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowConfirmDialog(false);
      
      // Use replace instead of push to force a screen refresh
      router.replace('/grades');
    } catch (error) {
      // Silent error handling
    }
  }, [router]);

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

  const resetPeriodForm = useCallback(() => {
    setPeriodName('');
    setStartTime(new Date());
    setEndTime(new Date());
    setSelectedDays([]);
    setSelectedColor('#2C3DCD');
    setIsEnabled(true);
    setEditingPeriod(null);
  }, []);

  const handleAddPeriod = useCallback(() => {
    resetPeriodForm();
    setShowPeriodModal(true);
  }, [resetPeriodForm]);

  const handleEditPeriod = useCallback((period: CustomPeriod) => {
    setEditingPeriod(period);
    setPeriodName(period.name || '');
    setStartTime(new Date(`2000-01-01T${period.starttime}`));
    setEndTime(new Date(`2000-01-01T${period.endtime}`));
    setSelectedDays(period.daysOfWeek || []);
    setSelectedColor(period.color || '#2C3DCD');
    setIsEnabled(period.isEnabled);
    setShowPeriodModal(true);
  }, []);

  const handleDeletePeriod = useCallback((periodId: string) => {
    scheduleService.deleteCustomPeriod(periodId);
  }, []);

  const handleSavePeriod = useCallback(() => {
    const periodData = {
      name: periodName,
      starttime: startTime.toTimeString().slice(0, 5),
      endtime: endTime.toTimeString().slice(0, 5),
      daysOfWeek: selectedDays,
      color: selectedColor,
      isEnabled,
      isCustom: true
    };

    if (editingPeriod) {
      scheduleService.updateCustomPeriod(editingPeriod._id, periodData);
    } else {
      scheduleService.addCustomPeriod(periodData);
    }

    setShowPeriodModal(false);
    resetPeriodForm();
  }, [periodName, startTime, endTime, selectedDays, selectedColor, isEnabled, editingPeriod, resetPeriodForm]);

  const toggleDay = useCallback((day: number) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    );
  }, []);

  const handleTimePickerChange = (type: 'start' | 'end') => (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      type === 'start' ? setShowStartPicker(false) : setShowEndPicker(false);
    }
    if (event.type === 'set' && date) {
      type === 'start' ? setStartTime(date) : setEndTime(date);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Add IDNP section before Language Selection */}
      {savedIdnp && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings').idnp.title}</Text>
          <TouchableOpacity
            style={styles.clearIdnpButton}
            onPress={handleClearIdnp}
          >
            <MaterialIcons name="delete-outline" size={24} color="#FF6B6B" />
            <Text style={styles.clearIdnpText}>{t('settings').idnp.clearButton}</Text>
          </TouchableOpacity>
        </View>
      )}

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

      {/* Custom Periods Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Custom Periods</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddPeriod}
          >
            <MaterialIcons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>

        <View style={styles.periodsListContainer}>
          {settings.customPeriods.map((period) => (
            <View key={period._id} style={styles.periodItem}>
              <View style={styles.periodItemHeader}>
                <View style={[styles.colorDot, { backgroundColor: period.color || '#2C3DCD' }]} />
                <Text style={styles.periodName}>{period.name || 'Custom Period'}</Text>
                <Switch
                  value={period.isEnabled}
                  onValueChange={(value) => {
                    scheduleService.updateCustomPeriod(period._id, { isEnabled: value });
                  }}
                />
              </View>
              
              <View style={styles.periodItemContent}>
                <Text style={styles.periodTime}>
                  {period.starttime} - {period.endtime}
                </Text>
                <Text style={styles.periodDays}>
                  {period.daysOfWeek?.map(day => t('weekdays').short[day - 1]).join(', ') || 'All weekdays'}
                </Text>
              </View>

              <View style={styles.periodItemActions}>
                <TouchableOpacity
                  style={styles.periodAction}
                  onPress={() => handleEditPeriod(period)}
                >
                  <MaterialIcons name="edit" size={20} color="#8A8A8D" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.periodAction}
                  onPress={() => handleDeletePeriod(period._id)}
                >
                  <MaterialIcons name="delete" size={20} color="#ff6b6b" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
          
          {settings.customPeriods.length === 0 && (
            <Text style={styles.noPeriods}>No custom periods added yet</Text>
          )}
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
                <TouchableOpacity onPress={handleSearchClear} style={styles.searchClearButton}>
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

      {/* Custom Period Modal */}
      <Modal
        visible={showPeriodModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowPeriodModal(false);
          resetPeriodForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingPeriod ? 'Edit Period' : 'Add New Period'}
              </Text>
              <TouchableOpacity onPress={() => {
                setShowPeriodModal(false);
                resetPeriodForm();
              }}>
                <MaterialIcons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

            <View style={styles.formContainer}>
              {/* Name Input */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Name</Text>
                <TextInput
                  style={styles.formInput}
                  value={periodName}
                  onChangeText={setPeriodName}
                  placeholder="Enter period name"
                  placeholderTextColor="#8A8A8D"
                />
              </View>

              {/* Time Selection */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Time</Text>
                <View style={styles.timeContainer}>
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => setShowStartPicker(true)}
                  >
                    <Text style={styles.timeButtonText}>
                      {startTime.toTimeString().slice(0, 5)}
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.timeSeparator}>-</Text>
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => setShowEndPicker(true)}
                  >
                    <Text style={styles.timeButtonText}>
                      {endTime.toTimeString().slice(0, 5)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Days Selection */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Days</Text>
                <View style={styles.daysContainer}>
                  {[1, 2, 3, 4, 5].map((day) => (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.dayButton,
                        selectedDays.includes(day) && styles.selectedDayButton
                      ]}
                      onPress={() => toggleDay(day)}
                    >
                      <Text style={[
                        styles.dayButtonText,
                        selectedDays.includes(day) && styles.selectedDayButtonText
                      ]}>
                        {t('weekdays').short[day]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Color Selection */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Color</Text>
                <TouchableOpacity
                  style={[styles.colorPreview, { backgroundColor: selectedColor }]}
                  onPress={() => setShowColorPicker(true)}
                />
              </View>

              {/* Enabled Toggle */}
              <View style={styles.formGroup}>
                <View style={styles.switchContainer}>
                  <Text style={styles.formLabel}>Enabled</Text>
                  <Switch value={isEnabled} onValueChange={setIsEnabled} />
                </View>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSavePeriod}
              >
                <Text style={styles.saveButtonText}>Save Period</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Color Picker Modal */}
      <Modal
        visible={showColorPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowColorPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.colorPickerModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Color</Text>
              <TouchableOpacity onPress={() => setShowColorPicker(false)}>
                <MaterialIcons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>
            <View style={styles.colorPickerContainer}>
              <ColorPicker
                color={selectedColor}
                onColorChange={setSelectedColor}
                thumbSize={30}
                sliderSize={30}
                noSnap={true}
                row={false}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Confirmation Dialog */}
      <Modal
        visible={showConfirmDialog}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmDialog}>
            <Text style={styles.confirmTitle}>{t('settings').idnp.clearConfirmTitle}</Text>
            <Text style={styles.confirmMessage}>{t('settings').idnp.clearConfirmMessage}</Text>
            
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.cancelButton]}
                onPress={() => setShowConfirmDialog(false)}
              >
                <Text style={styles.cancelButtonText}>{t('settings').idnp.clearConfirmCancel}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.confirmButton, styles.clearButton]}
                onPress={handleConfirmClearIdnp}
              >
                <Text style={styles.clearButtonText}>{t('settings').idnp.clearConfirmConfirm}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Time Pickers */}
      {(showStartPicker || showEndPicker) && (Platform.OS === 'android' ? (
        <DateTimePicker
          value={showStartPicker ? startTime : endTime}
          mode="time"
          is24Hour={true}
          onChange={handleTimePickerChange(showStartPicker ? 'start' : 'end')}
        />
      ) : Platform.OS === 'ios' && (
        <>
          {showStartPicker && (
            <DateTimePicker
              value={startTime}
              mode="time"
              is24Hour={true}
              onChange={handleTimePickerChange('start')}
              display="spinner"
            />
          )}
          {showEndPicker && (
            <DateTimePicker
              value={endTime}
              mode="time"
              is24Hour={true}
              onChange={handleTimePickerChange('end')}
              display="spinner"
            />
          )}
        </>
      ))}
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
    backgroundColor: '#2C3DCD',
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
  searchClearButton: {
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addButton: {
    backgroundColor: '#2C3DCD',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  periodsListContainer: {
    gap: 12,
  },
  periodItem: {
    backgroundColor: '#232433',
    borderRadius: 12,
    padding: 16,
  },
  periodItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  periodName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  periodItemContent: {
    marginBottom: 12,
  },
  periodTime: {
    color: '#8A8A8D',
    fontSize: 14,
    marginBottom: 4,
  },
  periodDays: {
    color: '#8A8A8D',
    fontSize: 14,
  },
  periodItemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  periodAction: {
    padding: 4,
  },
  noPeriods: {
    color: '#8A8A8D',
    textAlign: 'center',
    padding: 20,
  },
  formContainer: {
    gap: 20,
  },
  formGroup: {
    gap: 8,
  },
  formLabel: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  formInput: {
    backgroundColor: '#232433',
    borderRadius: 12,
    padding: 16,
    color: 'white',
    fontSize: 16,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeButton: {
    flex: 1,
    backgroundColor: '#232433',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  timeButtonText: {
    color: 'white',
    fontSize: 16,
  },
  timeSeparator: {
    color: 'white',
    fontSize: 20,
  },
  daysContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  dayButton: {
    flex: 1,
    backgroundColor: '#232433',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  selectedDayButton: {
    backgroundColor: '#2C3DCD',
  },
  dayButtonText: {
    color: '#8A8A8D',
    fontSize: 14,
    fontWeight: '600',
  },
  selectedDayButtonText: {
    color: 'white',
  },
  colorPreview: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#232433',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#2C3DCD',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  colorPickerModal: {
    backgroundColor: '#1a1b26',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  colorPickerContainer: {
    height: 300,
    padding: 20,
  },
  clearIdnpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#232433',
    padding: 16,
    borderRadius: 12,
  },
  clearIdnpText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmDialog: {
    backgroundColor: '#1a1b26',
    borderRadius: 20,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
  },
  confirmMessage: {
    color: '#8A8A8D',
    fontSize: 16,
    marginBottom: 20,
  },
  confirmButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  confirmButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#232433',
    marginRight: 10,
  },
  clearButton: {
    backgroundColor: '#FF6B6B',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  clearButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
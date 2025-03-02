import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, FlatList, Modal, TextInput, Switch, Platform, Alert, Animated, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { scheduleService, SubGroupType, Language, Group, CustomPeriod } from '@/services/scheduleService';
import { useTranslation } from '@/hooks/useTranslation';
import { MaterialIcons } from '@expo/vector-icons';
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

// Array of theme-appropriate colors for random selection
const THEME_COLORS = [
  '#2C3DCD', // Blue
  '#9D54BB', // Purple
  '#D85A77', // Pink
  '#FF9566', // Coral
  '#FFBE3F', // Amber
  '#42A5F5', // Light Blue
  '#26A69A', // Teal
  '#66BB6A', // Green
  '#EC407A', // Deep Pink
  '#7986CB', // Indigo
];

const getRandomColor = () => {
  return THEME_COLORS[Math.floor(Math.random() * THEME_COLORS.length)];
};

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

// Custom TimePicker component
const TimePicker = ({ 
  value, 
  onChange, 
  label,
  onClose,
  use12HourFormat = false,
  translations = { cancel: 'Cancel', confirm: 'Confirm' }
}: { 
  value: Date;
  onChange: (date: Date) => void;
  label: string;
  onClose: () => void;
  use12HourFormat?: boolean;
  translations?: { cancel: string; confirm: string };
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const [localValue, setLocalValue] = useState(value);
  const [period, setPeriod] = useState(value.getHours() >= 12 ? 'PM' : 'AM');
  const hoursRef = useRef<ScrollView>(null);
  const minutesRef = useRef<ScrollView>(null);
  const itemHeight = 56;
  const visibleItems = 5;
  const [isScrolling, setIsScrolling] = useState(false);

  const hours = useMemo(() => {
    if (use12HourFormat) {
      return Array.from({ length: 12 }, (_, i) => i === 0 ? 12 : i);
    }
    return Array.from({ length: 24 }, (_, i) => i);
  }, [use12HourFormat]);

  const minutes = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => i);
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      })
    ]).start();

    // Scroll to initial positions
    setTimeout(() => {
      let hour = localValue.getHours();
      if (use12HourFormat) {
        hour = hour % 12;
        if (hour === 0) hour = 12;
      }
      const minute = localValue.getMinutes();

      hoursRef.current?.scrollTo({ y: hour * itemHeight, animated: false });
      minutesRef.current?.scrollTo({ y: minute * itemHeight, animated: false });
    }, 50);
  }, []);

  const formatNumber = (num: number, padLength = 2) => {
    return num.toString().padStart(padLength, '0');
  };

  const formatTimeForDisplay = (date: Date) => {
    if (use12HourFormat) {
      const hours = date.getHours();
      const hour12 = hours % 12 || 12;
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    }
    return date.toTimeString().slice(0, 5);
  };

  const handleHourScroll = (event: any) => {
    if (!event.nativeEvent) return;
    
    const offsetY = event.nativeEvent.contentOffset.y;
    const selectedHour = Math.round(offsetY / itemHeight);
    
    if (selectedHour >= 0 && selectedHour < (use12HourFormat ? 12 : 24)) {
      let newHour = selectedHour;
      if (use12HourFormat) {
        if (newHour === 12) newHour = 0;
        if (period === 'PM') newHour += 12;
      }
      
      const newDate = new Date(localValue);
      if (newDate.getHours() !== newHour) {
        newDate.setHours(newHour);
        setLocalValue(newDate);
      }
    }
  };

  const handleMinuteScroll = (event: any) => {
    if (!event.nativeEvent) return;
    
    const offsetY = event.nativeEvent.contentOffset.y;
    const selectedMinute = Math.round(offsetY / itemHeight);
    
    if (selectedMinute >= 0 && selectedMinute < 60) {
      const newDate = new Date(localValue);
      if (newDate.getMinutes() !== selectedMinute) {
        newDate.setMinutes(selectedMinute);
        setLocalValue(newDate);
      }
    }
  };

  const handleScrollBeginDrag = () => {
    setIsScrolling(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleScrollEndDrag = (event: any, type: 'hours' | 'minutes') => {
    setIsScrolling(false);
    if (type === 'hours') {
      handleHourScroll(event);
    } else {
      handleMinuteScroll(event);
    }
  };

  const togglePeriod = () => {
    const newPeriod = period === 'AM' ? 'PM' : 'AM';
    setPeriod(newPeriod);
    
    const newDate = new Date(localValue);
    const currentHours = newDate.getHours();
    const newHours = newPeriod === 'PM' 
      ? (currentHours + 12) % 24 
      : (currentHours - 12 + 24) % 24;
    
    newDate.setHours(newHours);
    setLocalValue(newDate);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleConfirm = () => {
    onChange(localValue);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
  };

  return (
    <Modal
      transparent
      visible
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.timePickerOverlay}>
        <Animated.View 
          style={[
            styles.timePickerContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <View style={styles.timePickerHeader}>
            <Text style={styles.timePickerTitle}>{label}</Text>
            <Text style={styles.timePickerValue}>
              {formatTimeForDisplay(localValue)}
            </Text>
          </View>

          <View style={styles.timePickerContent}>
            <View style={styles.timePickerColumn}>
              <ScrollView
                ref={hoursRef}
                showsVerticalScrollIndicator={false}
                snapToInterval={itemHeight}
                decelerationRate={Platform.select({ ios: 0.992, android: 0.985 })}
                onScroll={handleHourScroll}
                onMomentumScrollEnd={() => Haptics.selectionAsync()}
                scrollEventThrottle={16}
                style={{ height: itemHeight * visibleItems }}
                contentContainerStyle={{ paddingVertical: itemHeight * 2 }}
              >
                {hours.map((hour) => (
                  <View key={`hour-${hour}`} style={[styles.timePickerItem, { height: itemHeight }]}>
                    <Text style={[
                      styles.timePickerItemText,
                      hour === (use12HourFormat ? (localValue.getHours() % 12 || 12) : localValue.getHours()) && styles.timePickerItemTextSelected
                    ]}>
                      {formatNumber(hour, use12HourFormat ? 1 : 2)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            <Text style={styles.timePickerSeparator}>:</Text>

            <View style={styles.timePickerColumn}>
              <ScrollView
                ref={minutesRef}
                showsVerticalScrollIndicator={false}
                snapToInterval={itemHeight}
                decelerationRate={Platform.select({ ios: 0.992, android: 0.985 })}
                onScroll={handleMinuteScroll}
                onMomentumScrollEnd={() => Haptics.selectionAsync()}
                scrollEventThrottle={16}
                style={{ height: itemHeight * visibleItems }}
                contentContainerStyle={{ paddingVertical: itemHeight * 2 }}
              >
                {minutes.map((minute) => (
                  <View key={`minute-${minute}`} style={[
                    styles.timePickerItem, 
                    { height: itemHeight }
                  ]}>
                    <Text style={[
                      styles.timePickerItemText,
                      minute === localValue.getMinutes() && styles.timePickerItemTextSelected
                    ]}>
                      {formatNumber(minute)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            {use12HourFormat && (
              <TouchableOpacity
                style={styles.timePickerPeriodButton}
                onPress={togglePeriod}
              >
                <Text style={[
                  styles.timePickerPeriodText,
                  { color: period === 'AM' ? '#ffffff' : '#8A8A8D' }
                ]}>AM</Text>
                <Text style={[
                  styles.timePickerPeriodText,
                  { color: period === 'PM' ? '#ffffff' : '#8A8A8D' }
                ]}>PM</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.timePickerActions}>
            <TouchableOpacity
              style={[styles.timePickerButton, styles.timePickerCancelButton]}
              onPress={onClose}
            >
              <Text style={styles.timePickerButtonText}>{translations.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.timePickerButton, styles.timePickerConfirmButton]}
              onPress={handleConfirm}
            >
              <Text style={[styles.timePickerButtonText, styles.timePickerConfirmText]}>{translations.confirm}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

// Custom Toggle Switch component
const CustomToggle = ({ 
  value, 
  onValueChange, 
  activeColor = '#2C3DCD',
  inactiveColor = '#232433',
  thumbColor = '#ffffff'
}: { 
  value: boolean;
  onValueChange: (value: boolean) => void;
  activeColor?: string;
  inactiveColor?: string;
  thumbColor?: string;
}) => {
  const translateX = useRef(new Animated.Value(value ? 22 : 2)).current;
  const backgroundColorAnim = useRef(new Animated.Value(value ? 1 : 0)).current;
  
  const backgroundColor = backgroundColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [inactiveColor, activeColor]
  });

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: value ? 22 : 2,
        friction: 6,
        tension: 60,
        useNativeDriver: false
      }),
      Animated.timing(backgroundColorAnim, {
        toValue: value ? 1 : 0,
        duration: 200,
        useNativeDriver: false
      })
    ]).start();
  }, [value]);

  const toggleSwitch = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onValueChange(!value);
  };

  return (
    <TouchableOpacity 
      activeOpacity={0.8} 
      onPress={toggleSwitch}
    >
      <Animated.View style={[
        styles.toggleContainer,
        { backgroundColor }
      ]}>
        <Animated.View style={[
          styles.toggleThumb,
          { transform: [{ translateX }] }
        ]}>
          {value && (
            <MaterialIcons name="check" size={14} color={activeColor} style={styles.toggleIcon} />
          )}
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
};

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
  const [selectedColor, setSelectedColor] = useState(getRandomColor());
  const [isEnabled, setIsEnabled] = useState(true);
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
        setError(t('settings').group.failed);
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
      <Text style={styles.loadingText}>{t('settings').group.notFound} "{searchQuery}"</Text>
    </View>
  ), [searchQuery]);

  const resetPeriodForm = useCallback(() => {
    setPeriodName('');
    setStartTime(new Date());
    setEndTime(new Date());
    setSelectedDays([]);
    setSelectedColor(getRandomColor());
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

  const handleTimePickerChange = (type: 'start' | 'end') => (date: Date) => {
    type === 'start' ? setStartTime(date) : setEndTime(date);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
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
          <Text style={styles.sectionTitle}>{t('settings').group.title}</Text>
          <TouchableOpacity
            style={styles.classSelector}
            onPress={() => setShowGroupModal(true)}
          >
            <View style={styles.classSelectorContent}>
              <Text style={styles.selectedClassName}>
                {settings.selectedGroupName || t('settings').group.select}
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
          <Text style={styles.sectionTitle}>{t('settings').subGroup}</Text>
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
            <Text style={styles.sectionTitle}>{t('settings').customPeriods.title}</Text>
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
                  <CustomToggle
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
              <Text style={styles.noPeriods}>{t('settings').customPeriods.noPeriodsYet}</Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Time Pickers */}
      {showStartPicker && (
        <TimePicker
          value={startTime}
          onChange={handleTimePickerChange('start')}
          label={t('settings').customPeriods.time}
          onClose={() => setShowStartPicker(false)}
          use12HourFormat={settings.language === 'en'}
          translations={{ cancel: t('settings').customPeriods.cancel, confirm: t('settings').customPeriods.confirm }}
        />
      )}
      {showEndPicker && (
        <TimePicker
          value={endTime}
          onChange={handleTimePickerChange('end')}
          label={t('settings').customPeriods.time}
          onClose={() => setShowEndPicker(false)}
          use12HourFormat={settings.language === 'en'}
          translations={{ cancel: t('settings').customPeriods.cancel, confirm: t('settings').customPeriods.confirm }}
        />
      )}

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
              <Text style={styles.modalTitle}>{t('settings').group.select}</Text>
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
                placeholder={t('settings').group.search}
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
                <Text style={styles.loadingText}>{t('settings').group.searching}</Text>
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
                {editingPeriod ? t('settings').customPeriods.edit : t('settings').customPeriods.add}
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
                <Text style={styles.formLabel}>{t('settings').customPeriods.name}</Text>
                <TextInput
                  style={styles.formInput}
                  value={periodName}
                  onChangeText={setPeriodName}
                  placeholder={t('settings').customPeriods.name}
                  placeholderTextColor="#8A8A8D"
                />
              </View>

              {/* Time Selection */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{t('settings').customPeriods.time}</Text>
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
                <Text style={styles.formLabel}>{t('settings').customPeriods.days}</Text>
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

              {/* Enabled Toggle */}
              <View style={styles.formGroup}>
                <View style={styles.switchContainer}>
                  <Text style={styles.formLabel}>{t('settings').customPeriods.enabled}</Text>
                  <CustomToggle
                    value={isEnabled}
                    onValueChange={setIsEnabled}
                  />
                </View>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSavePeriod}
              >
                <Text style={styles.saveButtonText}>{t('settings').customPeriods.save}</Text>
              </TouchableOpacity>
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
  timePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timePickerContainer: {
    backgroundColor: '#1a1b26',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  timePickerHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  timePickerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  timePickerValue: {
    fontSize: 16,
    color: '#8A8A8D',
  },
  timePickerContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 12,
  },
  timePickerColumn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#232433',
    borderRadius: 12,
    overflow: 'hidden',
    minWidth: 100,
  },
  timePickerItem: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timePickerItemText: {
    fontSize: 38,
    color: '#8A8A8D',
    opacity: 0.15,
    fontWeight: '400',
  },
  timePickerItemTextSelected: {
    fontSize: 44,
    color: '#ffffff',
    opacity: 1,
    fontWeight: '600',
  },
  timePickerSeparator: {
    fontSize: 52,
    color: '#ffffff',
    marginHorizontal: 20,
    opacity: 0.8,
    fontWeight: '300',
  },
  timePickerPeriodButton: {
    marginLeft: 20,
    backgroundColor: '#232433',
    borderRadius: 12,
    padding: 12,
    width: 60,
    height: 80,
    justifyContent: 'space-evenly',
  },
  timePickerPeriodText: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  timePickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  timePickerButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  timePickerCancelButton: {
    backgroundColor: '#232433',
  },
  timePickerConfirmButton: {
    backgroundColor: '#2C3DCD',
  },
  timePickerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  timePickerConfirmText: {
    color: 'white',
    fontWeight: '600',
  },
  toggleContainer: {
    width: 50,
    height: 30,
    borderRadius: 15,
    padding: 2,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleIcon: {
    position: 'absolute',
    top: 6,
    left: 6,
  },
});
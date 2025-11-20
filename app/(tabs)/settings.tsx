import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, FlatList, Modal, TextInput, Switch, Platform, Alert, Animated, ScrollView, Linking, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { scheduleService, SubGroupType, Language, Group, CustomPeriod } from '@/services/scheduleService';
import { useTranslation } from '@/hooks/useTranslation';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useRouter, useFocusEffect } from 'expo-router';
import { DeviceEventEmitter } from 'react-native';
import { useAuthContext } from '@/components/auth/AuthContext';
import authService from '@/services/authService';
import { 
  handleGroupChange as handleOrphanedAssignments 
} from '../../utils/assignmentStorage';
import { 
  getNotificationSettings, 
  saveNotificationSettings, 
  DEFAULT_NOTIFICATION_SETTINGS, 
  NotificationSettings, 
  scheduleAllNotifications,
  createAndScheduleDailyDigest
} from '../../utils/notificationUtils';
import { getAssignments, AssignmentType } from '../../utils/assignmentStorage';
import { StorageViewer } from '../../components/StorageViewer';
import * as Notifications from 'expo-notifications';
import { initializeNotifications } from '../../utils/notificationUtils';
import { formatCompactDate } from '@/utils/dateLocalization';
import { updateService } from '@/services/updateService';

// Store keys
const IDNP_KEY = '@planner_idnp';
const SKIP_LOGIN_KEY = '@planner_skip_login';
const AUTH_STATE_CHANGE_EVENT = 'auth_state_changed';
const IDNP_UPDATE_EVENT = 'IDNP_UPDATE';
const AUTH_TOKEN_KEY = '@auth_token';  // Adding this constant
const IDNP_SYNC_KEY = '@planner_idnp_sync';

// Import CACHE_KEYS from scheduleService
// We need to access this directly from scheduleService to use the same keys
const { SCHEDULE_PREFIX } = scheduleService.CACHE_KEYS;

// Check if app is running in development mode
const IS_DEV = __DEV__;

const languages = {
  en: { name: 'English', icon: '🇬🇧' },
  ro: { name: 'Română', icon: '🇷🇴' },
  ru: { name: 'Русский', icon: '🇷🇺' }
};

const SUBGROUPS: SubGroupType[] = ['Subgroup 1', 'Subgroup 2'];

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
  onConfirm,
  use12HourFormat = false,
  translations = { cancel: 'Cancel', confirm: 'Confirm' }
}: { 
  value: Date;
  onChange: (date: Date) => void;
  label: string;
  onClose: () => void;
  onConfirm?: (date: Date) => void;
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
    if (onConfirm) {
      onConfirm(localValue);
    }
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
                onScrollBeginDrag={handleScrollBeginDrag}
                onScrollEndDrag={(e) => handleScrollEndDrag(e, 'hours')}
                onMomentumScrollEnd={() => Haptics.selectionAsync()}
                scrollEventThrottle={16}
                style={{ height: itemHeight * visibleItems }}
                contentContainerStyle={{ paddingVertical: itemHeight * 2 }}
                nestedScrollEnabled={true}
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
                onScrollBeginDrag={handleScrollBeginDrag}
                onScrollEndDrag={(e) => handleScrollEndDrag(e, 'minutes')}
                onMomentumScrollEnd={() => Haptics.selectionAsync()}
                scrollEventThrottle={16}
                style={{ height: itemHeight * visibleItems }}
                contentContainerStyle={{ paddingVertical: itemHeight * 2 }}
                nestedScrollEnabled={true}
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
  thumbColor = '#ffffff',
  disabled = false
}: { 
  value: boolean;
  onValueChange: (value: boolean) => void;
  activeColor?: string;
  inactiveColor?: string;
  thumbColor?: string;
  disabled?: boolean;
}) => {
  const translateX = useRef(new Animated.Value(value ? 22 : 2)).current;
  const backgroundColorAnim = useRef(new Animated.Value(value ? 1 : 0)).current;
  
  const backgroundColor = backgroundColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [disabled ? '#3A3A3A' : inactiveColor, disabled ? '#6B7DB3' : activeColor]
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
    if (disabled) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onValueChange(!value);
  };

  return (
    <TouchableOpacity 
      activeOpacity={disabled ? 1 : 0.8} 
      onPress={toggleSwitch}
    >
      <Animated.View style={[
        styles.toggleContainer,
        { backgroundColor, opacity: disabled ? 0.6 : 1 }
      ]}>
        <Animated.View style={[
          styles.toggleThumb,
          { transform: [{ translateX }], backgroundColor: disabled ? '#CCCCCC' : thumbColor }
        ]}>
          {value && !disabled && (
            <MaterialIcons name="check" size={14} color={activeColor} style={styles.toggleIcon} />
          )}
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
};

export default function Settings() {
  const { t, currentLanguage } = useTranslation();
  const router = useRouter();
  const flatListRef = useRef<FlatList<Group>>(null);
  const { user, logout, reloadUser, loading } = useAuthContext();
  
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
  const [confirmDialogType, setConfirmDialogType] = useState<'idnp' | 'period' | 'account'>('idnp');
  const [periodToDelete, setPeriodToDelete] = useState<string | null>(null);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showAccountActionSheet, setShowAccountActionSheet] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [passwordForDeletion, setPasswordForDeletion] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeletionSuccessModal, setShowDeletionSuccessModal] = useState(false);
  const [isRefreshingAccount, setIsRefreshingAccount] = useState(false);
  // Use a single source of truth for current auth state that can be updated from multiple places
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!user);
  // Add state for tracking whether the user has skipped login
  const [skipLogin, setSkipLogin] = useState<boolean>(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [showNotificationTimeModal, setShowNotificationTimeModal] = useState(false);
  const [tempNotificationTime, setTempNotificationTime] = useState(new Date());
  const [storageModalVisible, setStorageModalVisible] = useState(false);
  const [storageItems, setStorageItems] = useState<[string, string | null][]>([]);
  const [syncIdnp, setSyncIdnp] = useState<boolean>(true);
  // Schedule refresh state
  const [isRefreshingSchedule, setIsRefreshingSchedule] = useState(false);
  const [lastScheduleRefresh, setLastScheduleRefresh] = useState<Date | null>(null);
  // Update check state
  const [isCheckingForUpdate, setIsCheckingForUpdate] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [showUpToDateModal, setShowUpToDateModal] = useState(false);
  const [currentAppVersion, setCurrentAppVersion] = useState('');

  // Load last refresh time on mount
  useEffect(() => {
    (async () => {
      const last = await scheduleService.getLastScheduleFetchTime();
      setLastScheduleRefresh(last);
    })();
  }, []);

  const handleManualScheduleRefresh = useCallback(async () => {
    if (isRefreshingSchedule) return;
    setIsRefreshingSchedule(true);
    try {
      const refreshed = await scheduleService.refreshSchedule(true);
      if (refreshed) {
        const last = await scheduleService.getLastScheduleFetchTime();
        setLastScheduleRefresh(last);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert('Offline', 'Using cached schedule');
      }
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Schedule', 'Failed to refresh schedule');
    } finally {
      setIsRefreshingSchedule(false);
    }
  }, [isRefreshingSchedule]);

  const handleClearScheduleCache = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await scheduleService.clearScheduleCache();
    setLastScheduleRefresh(null);
    Alert.alert('Cache Cleared', 'Schedule cache removed. Refresh to fetch latest data.');
  }, []);

  const handleCheckForUpdate = useCallback(async () => {
    if (isCheckingForUpdate) return;
    setIsCheckingForUpdate(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const update = await updateService.manualCheckForUpdate();
      if (update && update.isAvailable) {
        setUpdateAvailable(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          '🚀 Update Available!',
          `Version ${update.latestVersion} is available.\n\nThe update notification will appear shortly.`,
          [{ text: 'OK', style: 'default' }]
        );
      } else {
        setCurrentAppVersion(updateService.getCurrentVersion());
        setShowUpToDateModal(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to check for updates. Please try again later.');
    } finally {
      setIsCheckingForUpdate(false);
    }
  }, [isCheckingForUpdate]);

  // Add useEffect to load IDNP and listen for updates
  useEffect(() => {
    const loadIdnp = async () => {
      try {
        const idnp = await AsyncStorage.getItem(IDNP_KEY);
        const hasSkipped = await AsyncStorage.getItem(SKIP_LOGIN_KEY);
        const syncSetting = await AsyncStorage.getItem(IDNP_SYNC_KEY);
        setSavedIdnp(idnp);
        setSkipLogin(hasSkipped === 'true');
        setSyncIdnp(syncSetting !== 'false'); // Default to true if not set
      } catch (error) {
        // Silent error handling
      }
    };
    
    loadIdnp();
    
    // Add event listener for IDNP updates using DeviceEventEmitter
    const idnpSubscription = DeviceEventEmitter.addListener(IDNP_UPDATE_EVENT, (newIdnp: string | null) => {
      setSavedIdnp(newIdnp);
    });

    // Add event listener for auth state changes
    const authSubscription = DeviceEventEmitter.addListener(
      AUTH_STATE_CHANGE_EVENT, 
      (authState: { isAuthenticated: boolean; skipped?: boolean }) => {
        setIsAuthenticated(authState.isAuthenticated);
        if (typeof authState.skipped === 'boolean') {
          setSkipLogin(authState.skipped);
        }
        // Reload user data when auth state changes to true
        if (authState.isAuthenticated) {
          reloadUser();
        }
      }
    );
    
    // Cleanup event listeners on unmount
    return () => {
      idnpSubscription.remove();
      authSubscription.remove();
    };
  }, [reloadUser]);

  // Update authentication state when user changes
  useEffect(() => {
    setIsAuthenticated(!!user);
  }, [user]);

  // Use useFocusEffect to check auth state when screen becomes focused
  useFocusEffect(
    useCallback(() => {
      const checkAuthState = async () => {
        try {
          // Check if the skip login flag is set
          const hasSkipped = await AsyncStorage.getItem(SKIP_LOGIN_KEY);
          setSkipLogin(hasSkipped === 'true');
        } catch (error) {
          // Silent error handling
        }
      };

      checkAuthState();
    }, [])
  );

  // Use useFocusEffect to ensure settings are up to date when the screen is focused
  useFocusEffect(
    useCallback(() => {
      // Update settings from the service when the screen comes into focus
      setSettings(scheduleService.getSettings());
      
      // Check auth state
      const checkAuthState = async () => {
        try {
          // Check if the skip login flag is set
          const hasSkipped = await AsyncStorage.getItem(SKIP_LOGIN_KEY);
          setSkipLogin(hasSkipped === 'true');
        } catch (error) {
          // Silent error handling
        }
      };

      checkAuthState();
    }, [])
  );

  // Custom clear IDNP function
  const handleClearIdnp = useCallback(() => {
    setConfirmDialogType('idnp');
    setShowConfirmDialog(true);
  }, []);

  // Handle IDNP confirmation
  const handleConfirmClearIdnp = useCallback(async () => {
    try {
      const currentIdnp = await AsyncStorage.getItem(IDNP_KEY);
      
      // Remove local IDNP
      await AsyncStorage.removeItem(IDNP_KEY);
      setSavedIdnp(null);
      
      // Clear ALL grades-related cached data (legacy and new cache keys)
      await AsyncStorage.removeItem('@planner_grades_data');
      await AsyncStorage.removeItem('@planner_grades_timestamp');
      
      // Clear the new gradesService cache keys if we have an IDNP
      if (currentIdnp) {
        await AsyncStorage.removeItem(`@grades_cache_html_${currentIdnp}`);
        await AsyncStorage.removeItem(`@grades_cache_time_${currentIdnp}`);
      }
      
      // Emit null to notify that IDNP has been cleared
      DeviceEventEmitter.emit(IDNP_UPDATE_EVENT, null);
      
      // Delete from server if sync is enabled and user is authenticated - Temporarily disabled
      /* if (syncIdnp && isAuthenticated) {
        try {
          await authService.deleteEncryptedData('idnp');
        } catch (error) {
          console.error('Error deleting IDNP from server:', error);
          // Continue even if server deletion fails - local data is already cleared
        }
      } */
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowConfirmDialog(false);
      
      // Use replace instead of push to force a screen refresh
      router.replace('/grades');
    } catch (error) {
      console.error('Error clearing IDNP:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [router, syncIdnp, isAuthenticated]);

  const handleDeletePeriod = useCallback((periodId: string) => {
    setPeriodToDelete(periodId);
    setConfirmDialogType('period');
    setShowConfirmDialog(true);
  }, []);

  const handleConfirmDeletePeriod = useCallback(() => {
    if (periodToDelete) {
      scheduleService.deleteCustomPeriod(periodToDelete);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setShowConfirmDialog(false);
    setPeriodToDelete(null);
  }, [periodToDelete]);

  // Callback functions
  const handleLanguageChange = useCallback((language: Language) => {
    scheduleService.updateSettings({ language });
  }, []);

  const handleGroupChange = useCallback((group: SubGroupType) => {
    scheduleService.updateSettings({ group });
  }, []);

  const handleGroupSelection = useCallback(async (group: Group) => {
    // Get the current settings to preserve the subgroup selection
    const currentSettings = scheduleService.getSettings();
    
    // Update the group settings - maintain the current subgroup or set default if not set
    scheduleService.updateSettings({ 
      selectedGroupId: group._id,
      selectedGroupName: group.name,
      group: currentSettings.group || SUBGROUPS[0]
    });
    
    // Update the last refresh timestamp to current time
    setLastScheduleRefresh(new Date());
    
    // Handle orphaned assignments asynchronously after settings update
    setTimeout(async () => {
      try {
        // Pass the group ID (string) to handle orphaned assignments
        await handleOrphanedAssignments(group._id);
      } catch (error) {
        console.error("Error handling group change for assignments:", error);
      }
    }, 100);
    
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
      const updatedSettings = scheduleService.getSettings();
      setSettings(updatedSettings);
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

  const handleTimePickerChange = useCallback((type: 'start' | 'end') => (date: Date) => {
    type === 'start' ? setStartTime(date) : setEndTime(date);
  }, []);

  const handleLogout = async () => {
    setShowAccountActionSheet(false);
    try {
      // Clear the skip login flag as well when explicitly logging out
      await AsyncStorage.removeItem(SKIP_LOGIN_KEY);
      await logout();
      // Immediately update local state
      setIsAuthenticated(false);
      setSkipLogin(false);
      // Broadcast auth state change to all components
      DeviceEventEmitter.emit(AUTH_STATE_CHANGE_EVENT, { 
        isAuthenticated: false,
        skipped: false 
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleDeleteAccount = useCallback(async () => {
    const AUTH_TOKEN_KEY = '@auth_token';
    // Reset any previous errors
    setPasswordError(null);
    
    if (!passwordForDeletion.trim()) {
      setPasswordError("Please enter your password");
      return;
    }
    
    setDeletingAccount(true);
    try {
      await authService.deleteAccount(passwordForDeletion);
      
      // Properly clean up user data
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY); // Clear cached user data
      await logout(); // This will clear the user state internally
      
      // Immediately update local state
      setIsAuthenticated(false);
      setSkipLogin(false);
      
      // Broadcast auth state change with complete reset
      DeviceEventEmitter.emit(AUTH_STATE_CHANGE_EVENT, { 
        isAuthenticated: false,
        skipped: false 
      });
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Show success modal instead of navigating away immediately
      setShowPasswordModal(false);
      setShowDeletionSuccessModal(true);
      setPasswordForDeletion('');
    } catch (error) {
      // Check if it's a network error or authentication error
      if (error instanceof Error) {
        if (error.message === 'Request timeout' || error.message.includes('network')) {
          setPasswordError("Network error. Please check your connection.");
        } else {
          setPasswordError("Incorrect password. Please try again.");
        }
      } else {
        setPasswordError("Something went wrong. Please try again.");
      }
    } finally {
      setDeletingAccount(false);
    }
  }, [t, router, passwordForDeletion, logout]);

  const openEmailApp = useCallback(() => {
    // Try to open the default email app
    Linking.canOpenURL('mailto:')
      .then(supported => {
        if (supported) {
          Linking.openURL('mailto:');
        } else {
          // If generic mailto doesn't work, try popular email apps
          Linking.openURL('gmail://')
            .catch(() => Linking.openURL('mailto:'));
        }
      })
      .catch(() => {
        // Silently fail
      });
  }, []);

  const completeAccountDeletion = useCallback(() => {
    setShowDeletionSuccessModal(false);
    router.replace('/auth');
  }, [router]);

  const handleRefreshAccount = async () => {
    setIsRefreshingAccount(true);
    try {
      await reloadUser();
      // Immediately update local state based on user context
      setIsAuthenticated(!!user);
      // Broadcast auth state change
      DeviceEventEmitter.emit(AUTH_STATE_CHANGE_EVENT, { isAuthenticated: !!user });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Refresh error:", error);
    } finally {
      setIsRefreshingAccount(false);
    }
  };

  // Function to render the account section based on authentication state
  const renderAccountSection = useCallback(() => {
    // Use MemoizedGravatarProfile component instead of creating state inside render function
    if (!isAuthenticated) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings').account.title}</Text>
          <TouchableOpacity style={styles.signInButton} onPress={() => router.push('/auth')}>
            <Text style={styles.signInButtonText}>{t('settings').account.signIn}</Text>
          </TouchableOpacity>
        </View>
      );
    }
  
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings').account.title}</Text>
        <View style={styles.accountInfo}>
          <MemoizedGravatarProfile />
        </View>
      </View>
    );
  }, [isAuthenticated, router, t]);
  
  // Separate component for Gravatar profile to handle its own state
  const MemoizedGravatarProfile = memo(() => {
    const [gravatarProfile, setGravatarProfile] = useState<{ display_name?: string; avatar_url?: string } | null>(null);
    
    useEffect(() => {
      const loadGravatarProfile = async () => {
        if (user?.email) {
          const profile = await authService.getGravatarProfile(user.email);
          setGravatarProfile(profile);
        }
      };
      loadGravatarProfile();
    }, []);
    
    return (
      <>
        <TouchableOpacity 
          style={styles.accountAvatar}
          onPress={() => Linking.openURL('https://gravatar.com')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {gravatarProfile?.avatar_url ? (
            <Image 
              source={{ uri: gravatarProfile.avatar_url }} 
              style={styles.avatarImage}
              defaultSource={require('../../assets/images/default-avatar.jpg')}
            />
          ) : (
            <Text style={styles.avatarText}>
              {user?.email.charAt(0).toUpperCase()}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.accountDetails}
          onPress={() => setShowAccountActionSheet(true)}
          activeOpacity={0.7}
        >
          <View style={styles.accountDetailsContent}>
            <Text style={styles.accountEmail} numberOfLines={1}>
              {gravatarProfile?.display_name || user?.email}
            </Text>
            {!user?.is_verified && (
              <View style={styles.verificationBadge}>
                <MaterialIcons name="warning" size={14} color="#FFB020" />
                <Text style={styles.verificationText}>
                  {t('settings').account.notVerified}
                </Text>
              </View>
            )}
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#8A8A8D" />
        </TouchableOpacity>
      </>
    );
  });

  // Function to render the developer section
  const renderDeveloperSection = () => {
    if (!IS_DEV) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Developer Tools</Text>
        
        <View style={styles.devToolsList}>
          <TouchableOpacity
            style={styles.devToolButton}
            onPress={async () => {
              await AsyncStorage.clear();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'AsyncStorage has been cleared');
            }}
          >
            <MaterialIcons name="delete-sweep" size={24} color="#FF6B6B" />
            <Text style={styles.devToolText}>Clear AsyncStorage</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.devToolButton}
            onPress={() => {
              scheduleService.resetSettings();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'Schedule settings have been reset');
            }}
          >
            <MaterialIcons name="restart-alt" size={24} color="#FFD700" />
            <Text style={styles.devToolText}>Reset Schedule Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.devToolButton}
            onPress={async () => {
              try {
                // Cancel all existing notifications
                await Notifications.cancelAllScheduledNotificationsAsync();
                
                // Reset notification channels (Android only)
                if (Platform.OS === 'android') {
                  try {
                    await Notifications.deleteNotificationChannelAsync('assignments');
                  } catch (e) {
                    // Channel may not exist, ignore error
                  }
                }
                
                // Re-initialize the notification system
                await initializeNotifications();
                
                // Refresh all notifications
                const assignments = await getAssignments();
                await scheduleAllNotifications(assignments);
                
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Success', 'Notification system reset. This can resolve issues with timing.');
              } catch (error) {
                console.error('Error resetting notification system:', error);
                Alert.alert('Error', 'Failed to reset notification system');
              }
            }}
          >
            <MaterialIcons name="refresh" size={24} color="#9C27B0" />
            <Text style={styles.devToolText}>Reset Notification System</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.devToolButton}
            onPress={async () => {
              try {
                // Get all keys
                const keys = await AsyncStorage.getAllKeys();
                
                // Get all values for the keys
                const results = await AsyncStorage.multiGet(keys);
                
                // Save storage items and show modal
                setStorageItems([...results]);
                setStorageModalVisible(true);
                
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch (error) {
                console.error('Error viewing AsyncStorage:', error);
                Alert.alert('Error', 'Failed to view AsyncStorage contents');
              }
            }}
          >
            <MaterialIcons name="storage" size={24} color="#42A5F5" />
            <Text style={styles.devToolText}>View AsyncStorage</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.devToolButton}
            onPress={async () => {
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                const testUpdate = await updateService.getLatestReleaseForTesting();
                
                if (testUpdate) {
                  // Clear any dismissed version to ensure the modal shows
                  await updateService.clearDismissedVersion();
                  
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  Alert.alert(
                    '✓ Test Update Modal',
                    `Fetched latest release info:\n\nVersion: ${testUpdate.latestVersion}\nCurrent: ${testUpdate.currentVersion}\n\nThe update notification will appear shortly.`,
                    [{ text: 'OK', style: 'default' }]
                  );
                  
                  // Trigger a check that will show the modal
                  setTimeout(async () => {
                    const update = await updateService.checkForUpdate(true);
                    if (!update) {
                      // If no real update, force show with test data
                      DeviceEventEmitter.emit('TEST_UPDATE_AVAILABLE', testUpdate);
                    }
                  }, 500);
                } else {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                  Alert.alert('Error', 'Failed to fetch latest release from GitHub');
                }
              } catch (error) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                Alert.alert('Error', 'Failed to test update modal');
                console.error('Test update modal error:', error);
              }
            }}
          >
            <MaterialIcons name="new-releases" size={24} color="#FF9800" />
            <Text style={styles.devToolText}>Test Update Modal</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Load notification settings
  useEffect(() => {
    const loadNotificationSettings = async () => {
      try {
        const settings = await getNotificationSettings();
        setNotificationSettings(settings);
        
        // Set up temp notification time from stored settings
        const notificationTime = new Date();
        const timeFromSettings = new Date(settings.notificationTime);
        notificationTime.setHours(timeFromSettings.getHours());
        notificationTime.setMinutes(timeFromSettings.getMinutes());
        setTempNotificationTime(notificationTime);
      } catch (error) {
        console.error('Error loading notification settings:', error);
      }
    };
    
    loadNotificationSettings();
  }, []);
  
  // Handle notification toggle
  const handleToggleNotifications = useCallback(async (value: boolean) => {
    try {
      const updatedSettings = { ...notificationSettings, enabled: value };
      setNotificationSettings(updatedSettings);
      await saveNotificationSettings(updatedSettings);
      
      // If enabling notifications, schedule them for all assignments
      if (value) {
        const assignments = await getAssignments();
        await scheduleAllNotifications(assignments);
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
    }
  }, [notificationSettings]);
  
  // Handle saving notification time
  const handleSaveNotificationTime = useCallback(async () => {
    try {
      // Create a new date object with just the time component
      const updatedTime = new Date();
      updatedTime.setHours(tempNotificationTime.getHours());
      updatedTime.setMinutes(tempNotificationTime.getMinutes());
      updatedTime.setSeconds(0);
      updatedTime.setMilliseconds(0);
      
      const updatedSettings = { 
        ...notificationSettings, 
        notificationTime: updatedTime.toISOString() 
      };
      
      setNotificationSettings(updatedSettings);
      await saveNotificationSettings(updatedSettings);
      
      // Reschedule notifications with the new time
      const assignments = await getAssignments();
      await scheduleAllNotifications(assignments);
      
      setShowNotificationTimeModal(false);
    } catch (error) {
      console.error('Error saving notification time:', error);
    }
  }, [notificationSettings, tempNotificationTime]);
  
  // Handle updating reminder days setting
  const handleUpdateReminderDays = useCallback(async (setting: keyof NotificationSettings, value: number) => {
    try {
      if (value < 0) return; // Prevent negative values
      
      const updatedSettings = { ...notificationSettings, [setting]: value };
      setNotificationSettings(updatedSettings);
      await saveNotificationSettings(updatedSettings);
      
      // Reschedule notifications with the new settings
      const assignments = await getAssignments();
      await scheduleAllNotifications(assignments);
    } catch (error) {
      console.error('Error updating reminder days:', error);
    }
  }, [notificationSettings]);
  
  // Handle daily reminders toggle
  const handleToggleDailyReminders = useCallback(async (setting: keyof NotificationSettings, value: boolean) => {
    try {
      const updatedSettings = { ...notificationSettings, [setting]: value };
      setNotificationSettings(updatedSettings);
      await saveNotificationSettings(updatedSettings);
      
      // Reschedule notifications with the new settings
      const assignments = await getAssignments();
      await scheduleAllNotifications(assignments);
    } catch (error) {
      console.error('Error toggling daily reminders:', error);
    }
  }, [notificationSettings]);
  
  // Format time for display (12 or 24 hour)
  const formatTimeDisplay = useCallback((date: Date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    
    // 12-hour format
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12; // Convert 0 to 12 for 12 AM
    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
    
    return `${displayHours}:${displayMinutes} ${period}`;
  }, []);
  
  // Show notification time picker
  const handleShowNotificationTimePicker = useCallback(() => {
    // Create a date object from the stored notification time
    const date = new Date(notificationSettings.notificationTime);
    setTempNotificationTime(date);
    setShowNotificationTimeModal(true);
  }, [notificationSettings]);
  
  // Render notification settings section
  const renderNotificationSettings = useCallback(() => {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="notifications" size={24} color="#3478F6" style={styles.sectionIcon} />
          <Text style={styles.sectionTitle}>{t('settings').notifications.title}</Text>
        </View>
        
        {/* Master toggle card */}
        <View style={styles.card}>
          <View style={styles.settingItem}>
            <View style={styles.settingLabelContainer}>
              <Text style={styles.settingLabel}>{t('settings').notifications.enabled}</Text>
              <Text style={styles.settingDescription}>
                {notificationSettings.enabled 
                  ? t('settings').notifications.enabledDescription 
                  : t('settings').notifications.disabledDescription}
              </Text>
            </View>
            <CustomToggle
              value={notificationSettings.enabled}
              onValueChange={handleToggleNotifications}
              activeColor="#3478F6"
            />
          </View>
        </View>
        
        {notificationSettings.enabled && (
          <>
            {/* Time settings card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="access-time" size={20} color="#3478F6" />
                <Text style={styles.cardTitle}>{t('settings').notifications.timeSettings}</Text>
              </View>
              
              <View style={styles.settingItem}>
                <View style={styles.settingLabelContainer}>
                  <Text style={styles.settingLabel}>{t('settings').notifications.time}</Text>
                  <Text style={styles.settingDescription}>
                    {t('settings').notifications.timeDescription}
                  </Text>
                </View>
          <TouchableOpacity
                  style={styles.timeButton}
                  onPress={handleShowNotificationTimePicker}
                >
                  <Text style={styles.timeButtonText}>
                    {formatTimeDisplay(new Date(notificationSettings.notificationTime))}
                  </Text>
                  <MaterialIcons name="edit" size={16} color="#3478F6" />
          </TouchableOpacity>
              </View>
            </View>
            
            {/* Reminder days card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="event" size={20} color="#3478F6" />
                <Text style={styles.cardTitle}>{t('settings').notifications.reminderDays}</Text>
              </View>
              
              <Text style={styles.cardDescription}>
                {t('settings').notifications.reminderDaysDescription}
              </Text>
              
              {/* Important assignments group */}
              <View style={styles.reminderGroup}>
                <Text style={styles.reminderGroupTitle}>{t('settings').notifications.importantAssignments}</Text>
                
                <ReminderSetting
                  label={t('settings').notifications.exams}
                  value={notificationSettings.examReminderDays}
                  onDecrease={() => handleUpdateReminderDays('examReminderDays', notificationSettings.examReminderDays - 1)}
                  onIncrease={() => handleUpdateReminderDays('examReminderDays', notificationSettings.examReminderDays + 1)}
                  isMinValue={notificationSettings.examReminderDays <= 1}
                  icon="school"
                  accentColor="#FF5757"
                />
                
                <ReminderSetting
                  label={t('settings').notifications.tests}
                  value={notificationSettings.testReminderDays}
                  onDecrease={() => handleUpdateReminderDays('testReminderDays', notificationSettings.testReminderDays - 1)}
                  onIncrease={() => handleUpdateReminderDays('testReminderDays', notificationSettings.testReminderDays + 1)}
                  isMinValue={notificationSettings.testReminderDays <= 1}
                  icon="assignment"
                  accentColor="#3478F6"
                />
                
                <ReminderSetting
                  label={t('settings').notifications.quizzes}
                  value={notificationSettings.quizReminderDays}
                  onDecrease={() => handleUpdateReminderDays('quizReminderDays', notificationSettings.quizReminderDays - 1)}
                  onIncrease={() => handleUpdateReminderDays('quizReminderDays', notificationSettings.quizReminderDays + 1)}
                  isMinValue={notificationSettings.quizReminderDays <= 1}
                  icon="quiz"
                  accentColor="#FFB930"
                />
              </View>
              
              {/* Other assignments group */}
              <View style={styles.reminderGroup}>
                <Text style={styles.reminderGroupTitle}>{t('settings').notifications.otherAssignments}</Text>
                
                <ReminderSetting
                  label={t('settings').notifications.projects}
                  value={notificationSettings.projectReminderDays}
                  onDecrease={() => handleUpdateReminderDays('projectReminderDays', notificationSettings.projectReminderDays - 1)}
                  onIncrease={() => handleUpdateReminderDays('projectReminderDays', notificationSettings.projectReminderDays + 1)}
                  isMinValue={notificationSettings.projectReminderDays <= 1}
                  icon="category"
                  accentColor="#4CAF50"
                />
                
                <ReminderSetting
                  label={t('settings').notifications.homework}
                  value={notificationSettings.homeworkReminderDays}
                  onDecrease={() => handleUpdateReminderDays('homeworkReminderDays', notificationSettings.homeworkReminderDays - 1)}
                  onIncrease={() => handleUpdateReminderDays('homeworkReminderDays', notificationSettings.homeworkReminderDays + 1)}
                  isMinValue={notificationSettings.homeworkReminderDays <= 1}
                  icon="book"
                  accentColor="#9C27B0"
                />
                
                <ReminderSetting
                  label={t('settings').notifications.other}
                  value={notificationSettings.otherReminderDays}
                  onDecrease={() => handleUpdateReminderDays('otherReminderDays', notificationSettings.otherReminderDays - 1)}
                  onIncrease={() => handleUpdateReminderDays('otherReminderDays', notificationSettings.otherReminderDays + 1)}
                  isMinValue={notificationSettings.otherReminderDays <= 1}
                  icon="more-horiz"
                  accentColor="#607D8B"
                />
              </View>
            </View>
            
            {/* Daily reminders card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="update" size={20} color="#3478F6" />
                <Text style={styles.cardTitle}>{t('settings').notifications.dailyReminders}</Text>
              </View>
              
              <Text style={styles.cardDescription}>
                {t('settings').notifications.dailyRemindersDescription}
              </Text>
              
              <View style={styles.settingItem}>
                <View style={styles.settingLabelContainer}>
                  <View style={styles.settingLabelWithIcon}>
                    <MaterialIcons name="school" size={18} color="#FF5757" style={styles.settingItemIcon} />
                    <Text style={styles.settingLabel}>{t('settings').notifications.dailyExams}</Text>
                  </View>
                </View>
                <CustomToggle
                  value={notificationSettings.dailyRemindersForExams}
                  onValueChange={(value) => handleToggleDailyReminders('dailyRemindersForExams', value)}
                  activeColor="#FF5757"
                />
              </View>
              
              <View style={styles.settingItem}>
                <View style={styles.settingLabelContainer}>
                  <View style={styles.settingLabelWithIcon}>
                    <MaterialIcons name="assignment" size={18} color="#3478F6" style={styles.settingItemIcon} />
                    <Text style={styles.settingLabel}>{t('settings').notifications.dailyTests}</Text>
                  </View>
                </View>
                <CustomToggle
                  value={notificationSettings.dailyRemindersForTests}
                  onValueChange={(value) => handleToggleDailyReminders('dailyRemindersForTests', value)}
                  activeColor="#3478F6"
                />
              </View>
              
              <View style={styles.settingItem}>
                <View style={styles.settingLabelContainer}>
                  <View style={styles.settingLabelWithIcon}>
                    <MaterialIcons name="quiz" size={18} color="#FFB930" style={styles.settingItemIcon} />
                    <Text style={styles.settingLabel}>{t('settings').notifications.dailyQuizzes}</Text>
                  </View>
                </View>
                <CustomToggle
                  value={notificationSettings.dailyRemindersForQuizzes}
                  onValueChange={(value) => handleToggleDailyReminders('dailyRemindersForQuizzes', value)}
                  activeColor="#FFB930"
                />
              </View>
            </View>

            {/* Send daily digest now button */}
            {IS_DEV && (
              <TouchableOpacity
                style={[styles.testNotificationButton, { backgroundColor: '#4CAF50', marginTop: 8 }]}
                onPress={async () => {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    const assignments = await getAssignments();
                    await createAndScheduleDailyDigest(assignments, true);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    Alert.alert(
                      t('settings').notifications.digestSentTitle,
                      t('settings').notifications.digestSentMessage
                    );
                  } catch (error) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    Alert.alert(
                      t('settings').notifications.errorTitle,
                      t('settings').notifications.digestErrorMessage
                    );
                    console.error('Daily digest error:', error);
                  }
                }}
              >
                <MaterialIcons name="calendar-today" size={20} color="#FFFFFF" style={styles.testNotificationIcon} />
                <Text style={styles.testNotificationText}>
                  {t('settings').notifications.sendDigestNow}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    );
  }, [
    t, 
    notificationSettings, 
    handleToggleNotifications, 
    handleUpdateReminderDays, 
    handleToggleDailyReminders, 
    handleShowNotificationTimePicker,
    formatTimeDisplay
  ]);

  // Component for reminder day settings with consistent styling
  const ReminderSetting = ({
    label,
    value,
    onDecrease,
    onIncrease,
    isMinValue,
    icon,
    accentColor = '#3478F6'
  }: {
    label: string;
    value: number;
    onDecrease: () => void;
    onIncrease: () => void;
    isMinValue: boolean;
    icon: keyof typeof MaterialIcons.glyphMap;
    accentColor?: string;
  }) => (
    <View style={styles.reminderSettingItem}>
      <View style={styles.settingLabelWithIcon}>
        <MaterialIcons name={icon} size={18} color={accentColor} style={styles.settingItemIcon} />
        <Text style={styles.settingLabel}>{label}</Text>
      </View>
      <View style={styles.dayCounter}>
          <TouchableOpacity
          style={[styles.counterButton, isMinValue && styles.counterButtonDisabled]}
          onPress={onDecrease}
          disabled={isMinValue}
        >
          <MaterialIcons name="remove" size={18} color={isMinValue ? '#555' : accentColor} />
          </TouchableOpacity>
        
        <View style={[styles.counterValueContainer, { borderColor: accentColor }]}>
          <Text style={styles.counterValue}>{value}</Text>
          <Text style={styles.counterUnit}>{t('settings').notifications.days}</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.counterButton}
          onPress={onIncrease}
        >
          <MaterialIcons name="add" size={18} color={accentColor} />
        </TouchableOpacity>
        </View>
      </View>
    );

  // Handle notification time change 
  const handleNotificationTimeChange = useCallback((date: Date) => {
    setTempNotificationTime(date);
  }, []);

  const handleCloseTimePicker = useCallback(() => {
    setShowNotificationTimeModal(false);
  }, []);

  const handleConfirmTimePicker = useCallback(async (date: Date) => {
    try {
      // Create a new date object with just the time component
      const updatedTime = new Date();
      updatedTime.setHours(date.getHours());
      updatedTime.setMinutes(date.getMinutes());
      updatedTime.setSeconds(0);
      updatedTime.setMilliseconds(0);
      
      const updatedSettings = { 
        ...notificationSettings, 
        notificationTime: updatedTime.toISOString() 
      };
      
      setNotificationSettings(updatedSettings);
      await saveNotificationSettings(updatedSettings);
      
      // Reschedule notifications with the new time
      const assignments = await getAssignments();
      await scheduleAllNotifications(assignments);
      
      // Close the modal
      setShowNotificationTimeModal(false);
      
      // Debugging
    } catch (error) {
      console.error('Error saving notification time:', error);
    }
  }, [notificationSettings]);

  // Handle IDNP sync toggle - Temporarily disabled - To be implemented later
  /* const handleIdnpSyncToggle = useCallback(async (value: boolean) => {
    try {
      // Check if user is authenticated before proceeding
      if (!isAuthenticated) {
        // If not authenticated, prompt to sign in
        router.push('/auth');
        return;
      }
      
      setSyncIdnp(value);
      await AsyncStorage.setItem(IDNP_SYNC_KEY, value ? 'true' : 'false');
      
      // If sync is disabled, delete IDNP from server (placeholder for future implementation)
      if (!value && savedIdnp) {
        // Placeholder for API call to delete IDNP from server
        // Example: await apiService.deleteIdnp();
      }
      
      // If sync is enabled and we have an IDNP, sync it to server (placeholder)
      if (value && savedIdnp) {
        // Placeholder for API call to sync IDNP to server
        // Example: await apiService.syncIdnp(savedIdnp);
      }
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Error toggling IDNP sync:', error);
    }
  }, [savedIdnp, isAuthenticated, router]); */

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Account Section */}
        {renderAccountSection()}

        {/* IDNP Sync Settings - Temporarily disabled - To be implemented later */}
        {/* <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings').idnp.syncTitle}</Text>
          
          <View style={styles.elevatedContainer}>
            <View style={styles.syncHeader}>
              <View style={styles.syncIconContainer}>
                <MaterialIcons name="security" size={22} color="#FFFFFF" />
              </View>
              <View style={styles.syncContent}>
                <Text style={styles.syncLabel}>{t('settings').idnp.syncToggle}</Text>
                <CustomToggle
                  value={isAuthenticated && syncIdnp}
                  onValueChange={handleIdnpSyncToggle}
                  activeColor="#2C3DCD"
                  disabled={!isAuthenticated}
                />
              </View>
            </View>
            
            {!isAuthenticated ? (
              <View style={styles.loginPromptContainer}>
                <View style={styles.loginPromptContent}>
                  <MaterialIcons name="info-outline" size={20} color="#FFB020" style={{marginRight: 8}} />
                  <Text style={styles.loginPromptText}>
                    {t('settings').idnp.loginRequired}
                  </Text>
                </View>
                <TouchableOpacity 
                  style={styles.loginButton}
                  onPress={() => router.push('/auth')}
                >
                  <Text style={styles.loginButtonText}>{t('settings').account.signIn}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.infoText}>
                {syncIdnp 
                  ? t('settings').idnp.syncEnabledInfo 
                  : t('settings').idnp.syncDisabledInfo}
              </Text>
            )}
            
            {isAuthenticated && syncIdnp && (
              <View style={styles.syncStatusIndicator}>
                <MaterialIcons name="check-circle" size={16} color="#4CAF50" style={{marginRight: 6}} />
                <Text style={styles.syncStatusText}>
                  {savedIdnp ? t('settings').idnp.syncedStatus : t('settings').idnp.noIdnpSaved}
                </Text>
              </View>
            )}
          </View>
        </View> */}

        {/* Add IDNP management section when IDNP is saved */}
        {savedIdnp && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings').idnp.title}</Text>
            <View style={styles.idnpInfo}>
              <Text style={styles.idnpValue}>
                {savedIdnp.substring(0, 4) + '••••••' + savedIdnp.substring(10)}
              </Text>
              <TouchableOpacity
                style={styles.clearIdnpButton}
                onPress={handleClearIdnp}
              >
                <MaterialIcons name="delete-outline" size={24} color="#FF6B6B" />
                <Text style={styles.clearIdnpText}>{t('settings').idnp.clearButton}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Language Selection Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings').language}</Text>
          <TouchableOpacity
            style={styles.languageSelector}
            onPress={() => setShowLanguageModal(true)}
          >
            <View style={styles.languageSelectorContent}>
              <Text style={styles.selectedLanguageIcon}>{languages[settings.language].icon}</Text>
              <Text style={styles.selectedLanguageName}>{languages[settings.language].name}</Text>
              <MaterialIcons name="keyboard-arrow-down" size={24} color="#8A8A8D" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Manual Schedule Refresh Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="schedule" size={24} color="#2C3DCD" style={styles.sectionIcon} />
            <Text style={styles.sectionTitle}>{t('settings').schedule.title}</Text>
          </View>
          <View style={[styles.card, styles.scheduleCard]}>
            <View style={styles.scheduleDetails}>
              {/* Group Selection Dropdown */}
              <TouchableOpacity
                style={styles.scheduleDetailRow}
                onPress={() => setShowGroupModal(true)}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name="group"
                  size={20}
                  color="#8A8A8D"
                  style={styles.scheduleDetailIcon}
                />
                <View style={styles.scheduleDetailTextGroup}>
                  <Text style={styles.scheduleDetailLabel}>{t('settings').schedule.group}</Text>
                  <View style={styles.scheduleGroupValueContainer}>
                    <Text style={styles.scheduleDetailValue} numberOfLines={1}>
                      {settings.selectedGroupName || t('settings').group.select}
                    </Text>
                    <MaterialIcons name="arrow-drop-down" size={20} color="#8A8A8D" />
                  </View>
                </View>
              </TouchableOpacity>

              {/* Last Updated */}
              <View style={[styles.scheduleDetailRow, styles.scheduleDetailRowLast]}>
                <MaterialIcons
                  name="update"
                  size={20}
                  color="#8A8A8D"
                  style={styles.scheduleDetailIcon}
                />
                <View style={styles.scheduleDetailTextGroup}>
                  <Text style={styles.scheduleDetailLabel}>{t('settings').schedule.lastUpdated}</Text>
                  <Text style={styles.scheduleDetailValue}>
                    {lastScheduleRefresh
                      ? formatCompactDate(lastScheduleRefresh, currentLanguage, true)
                      : t('settings').schedule.noRecentRefresh}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.refreshButton,
                styles.scheduleRefreshButton,
                isRefreshingSchedule && { opacity: 0.7 }
              ]}
              onPress={handleManualScheduleRefresh}
              disabled={isRefreshingSchedule}
            >
              {isRefreshingSchedule ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <MaterialIcons name="refresh" size={20} color="#ffffff" />
              )}
              <Text style={[styles.refreshButtonText, styles.scheduleRefreshButtonText]}>
                {isRefreshingSchedule ? t('settings').schedule.refreshing : t('settings').schedule.refresh}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* App Updates Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="system-update" size={24} color="#2C3DCD" style={styles.sectionIcon} />
            <Text style={styles.sectionTitle}>App Updates</Text>
          </View>
          <View style={[styles.card, styles.updateCard]}>
            <View style={styles.updateDetails}>
              <View style={styles.updateDetailRow}>
                <MaterialIcons
                  name="info-outline"
                  size={20}
                  color="#8A8A8D"
                  style={styles.scheduleDetailIcon}
                />
                <View style={styles.scheduleDetailTextGroup}>
                  <Text style={styles.scheduleDetailLabel}>Current Version</Text>
                  <Text style={styles.scheduleDetailValue}>
                    {updateService.getCurrentVersion()}
                  </Text>
                </View>
              </View>

              <View style={[styles.updateDetailRow, styles.scheduleDetailRowLast]}>
                <MaterialIcons
                  name="label-outline"
                  size={20}
                  color="#8A8A8D"
                  style={styles.scheduleDetailIcon}
                />
                <View style={styles.scheduleDetailTextGroup}>
                  <Text style={styles.scheduleDetailLabel}>Release Channel</Text>
                  <Text style={[styles.scheduleDetailValue, styles.channelBadge]}>
                    {updateService.getChannelDisplay()}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.refreshButton,
                styles.updateCheckButton,
                isCheckingForUpdate && { opacity: 0.7 }
              ]}
              onPress={handleCheckForUpdate}
              disabled={isCheckingForUpdate}
            >
              {isCheckingForUpdate ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <MaterialIcons name="download" size={20} color="#ffffff" />
              )}
              <Text style={[styles.refreshButtonText, styles.updateCheckButtonText]}>
                {isCheckingForUpdate ? 'Checking...' : 'Check for Updates'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.updateNote}>
              Updates are checked automatically once per day when you open the app.
            </Text>
          </View>
        </View>

        {/* Subgroup Selection Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings').subGroup}</Text>
          <View style={styles.optionsContainer}>
            {SUBGROUPS.map(group => (
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
            <View style={{ flex: 1 }} />
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
                    {period.daysOfWeek?.map(day => t('weekdays').long[day]).join(', ') || 'All weekdays'}
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

        {/* Developer Section */}
        {renderDeveloperSection()}

        {/* Notification Settings Section */}
        {renderNotificationSettings()}
      </ScrollView>

      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('settings').language}</Text>
              <TouchableOpacity onPress={() => setShowLanguageModal(false)}>
                <MaterialIcons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>
            <View style={styles.languagesList}>
              {Object.entries(languages).map(([code, { name, icon }]) => (
                <TouchableOpacity
                  key={code}
                  style={[
                    styles.languageOption,
                    settings.language === code && styles.selectedLanguageOption
                  ]}
                  onPress={() => {
                    handleLanguageChange(code as keyof typeof languages);
                    setShowLanguageModal(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Text style={styles.languageIcon}>{icon}</Text>
                  <Text style={[
                    styles.languageOptionText,
                    settings.language === code && styles.selectedLanguageOptionText
                  ]}>
                    {name}
                  </Text>
                  {settings.language === code && (
                    <MaterialIcons name="check" size={24} color="white" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Time Pickers */}
      {showStartPicker && (
        <TimePicker
          value={startTime}
          onChange={handleTimePickerChange('start')}
          label={t('settings').customPeriods.time}
          onClose={() => setShowStartPicker(false)}
          onConfirm={handleTimePickerChange('start')}
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
          onConfirm={handleTimePickerChange('end')}
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
            <Text style={styles.confirmTitle}>
              {confirmDialogType === 'idnp' 
                ? t('settings').idnp.clearConfirmTitle 
                : t('settings').customPeriods.deleteConfirmTitle}
            </Text>
            <Text style={styles.confirmMessage}>
              {confirmDialogType === 'idnp'
                ? t('settings').idnp.clearConfirmMessage
                : t('settings').customPeriods.deleteConfirmMessage}
            </Text>
            
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.cancelButton]}
                onPress={() => {
                  setShowConfirmDialog(false);
                  setPeriodToDelete(null);
                }}
              >
                <Text style={styles.cancelButtonText}>
                  {confirmDialogType === 'idnp'
                    ? t('settings').idnp.clearConfirmCancel
                    : t('settings').customPeriods.cancel}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.confirmButton, styles.clearButton]}
                onPress={confirmDialogType === 'idnp' ? handleConfirmClearIdnp : handleConfirmDeletePeriod}
              >
                <Text style={styles.clearButtonText}>
                  {confirmDialogType === 'idnp'
                    ? t('settings').idnp.clearConfirmConfirm
                    : t('settings').customPeriods.delete}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Account Action Sheet */}
      <Modal
        visible={showAccountActionSheet}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAccountActionSheet(false)}
      >
        <TouchableOpacity
          style={styles.actionSheetOverlay}
          activeOpacity={1}
          onPress={() => setShowAccountActionSheet(false)}
        >
          <View style={styles.actionSheet}>
            <View style={styles.actionSheetHeader}>
              <Text style={styles.actionSheetTitle}>
                {t('settings').account.actions.title}
              </Text>
              <TouchableOpacity 
                style={styles.actionSheetClose}
                onPress={() => setShowAccountActionSheet(false)}
              >
                <MaterialIcons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.actionSheetButton}
              onPress={handleLogout}
            >
              <MaterialIcons name="logout" size={24} color="#FF6B6B" />
              <Text style={[styles.actionSheetButtonText, { color: '#FF6B6B' }]}>
                {t('settings').account.actions.logout}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSheetButton}
              onPress={() => {
                setShowAccountActionSheet(false);
                setShowDeleteAccountConfirm(true);
              }}
            >
              <MaterialIcons name="delete-forever" size={24} color="#FF6B6B" />
              <Text style={[styles.actionSheetButtonText, { color: '#FF6B6B' }]}>
                {t('settings').account.actions.delete}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Delete Account Confirmation */}
      <Modal
        visible={showDeleteAccountConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteAccountConfirm(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmDialog}>
            <Text style={styles.confirmTitle}>
              {t('settings').account.deleteConfirm.title}
            </Text>
            <Text style={styles.confirmMessage}>
              {t('settings').account.deleteConfirm.message}
            </Text>
            
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.cancelButton]}
                onPress={() => setShowDeleteAccountConfirm(false)}
              >
                <Text style={styles.cancelButtonText}>
                  {t('settings').account.deleteConfirm.cancel}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.confirmButton, styles.deleteButton]}
                onPress={() => {
                  setShowDeleteAccountConfirm(false);
                  setShowPasswordModal(true);
                }}
              >
                <Text style={styles.deleteButtonText}>
                  {t('settings').account.deleteConfirm.confirm}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Password Confirmation Modal */}
      <Modal
        visible={showPasswordModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowPasswordModal(false);
          setPasswordForDeletion('');
          setPasswordError(null);
        }}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmDialog}>
            <Text style={styles.confirmTitle}>Confirm Account Deletion</Text>
            <Text style={styles.confirmMessage}>
              Please enter your password to confirm account deletion.
            </Text>
            
            <View style={[
              styles.passwordInputContainer,
              passwordError ? styles.passwordInputError : null
            ]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Your password"
                placeholderTextColor="#666"
                secureTextEntry
                value={passwordForDeletion}
                onChangeText={(text) => {
                  setPasswordForDeletion(text);
                  if (passwordError) setPasswordError(null);
                }}
                editable={!deletingAccount}
              />
            </View>
            
            {passwordError && (
              <Text style={styles.errorText}>{passwordError}</Text>
            )}
            
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.cancelButton]}
                onPress={() => {
                  setShowPasswordModal(false);
                  setPasswordForDeletion('');
                  setPasswordError(null);
                }}
                disabled={deletingAccount}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.confirmButton, styles.deleteButton]}
                onPress={handleDeleteAccount}
                disabled={deletingAccount}
              >
                {deletingAccount ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.deleteButtonText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Deletion Success Modal */}
      <Modal
        visible={showDeletionSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => completeAccountDeletion()}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmDialog}>
            <View style={styles.successIconContainer}>
              <MaterialIcons name="check-circle" size={64} color="#4CAF50" />
            </View>
            
            <Text style={styles.confirmTitle}>Deletion Request Sent</Text>
            <Text style={styles.confirmMessage}>
              We've sent a confirmation email to verify your account deletion request. 
              Please check your email inbox and follow the instructions to complete the process.
            </Text>
            
            <TouchableOpacity
              style={styles.emailButton}
              onPress={openEmailApp}
            >
              <MaterialIcons name="email" size={20} color="white" />
              <Text style={styles.emailButtonText}>Open Email App</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.doneButton}
              onPress={completeAccountDeletion}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Notification time picker modal */}
      {showNotificationTimeModal && (
        <TimePicker 
          value={tempNotificationTime}
          onChange={handleNotificationTimeChange}
          label={t('settings').notifications.selectTime}
          onClose={handleCloseTimePicker}
          onConfirm={handleConfirmTimePicker}
          use12HourFormat={true}
          translations={{
            cancel: t('settings').customPeriods.cancel,
            confirm: t('settings').customPeriods.confirm
          }}
        />
      )}

      {/* Storage Content Modal */}
      <StorageViewer 
        visible={storageModalVisible}
        onClose={() => setStorageModalVisible(false)}
        items={storageItems}
      />

      {/* Up to Date Modal */}
      <Modal
        visible={showUpToDateModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowUpToDateModal(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.upToDateDialog}>
            <View style={styles.upToDateIconContainer}>
              <MaterialIcons name="check-circle" size={64} color="#2C3DCD" />
            </View>
            
            <Text style={styles.upToDateTitle}>You're Up to Date!</Text>
            <Text style={styles.upToDateMessage}>
              You're running the latest version of PlannerITI.
            </Text>
            
            <View style={styles.upToDateVersionContainer}>
              <Text style={styles.upToDateVersionLabel}>Current Version</Text>
              <Text style={styles.upToDateVersionNumber}>{currentAppVersion}</Text>
            </View>
            
            <TouchableOpacity
              style={styles.upToDateButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowUpToDateModal(false);
              }}
            >
              <Text style={styles.upToDateButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141414',
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
    backgroundColor: '#1A1A1A',
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
    backgroundColor: '#1A1A1A',
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
    backgroundColor: '#141414',
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
    backgroundColor: '#1A1A1A',
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
    backgroundColor: '#1A1A1A',
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    justifyContent: 'space-between',
  },
  sectionIcon: {
    marginRight: 8,
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
    backgroundColor: '#1A1A1A',
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
    backgroundColor: '#1A1A1A',
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
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
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
    backgroundColor: '#1A1A1A',
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
    borderColor: '#1A1A1A',
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
    backgroundColor: '#1A1A1A',
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
    backgroundColor: '#141414',
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
    backgroundColor: '#1A1A1A',
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
    backgroundColor: '#141414',
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
    backgroundColor: '#1A1A1A',
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
    backgroundColor: '#1A1A1A',
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
    backgroundColor: '#1A1A1A',
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
  periodSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
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
  languageSelector: {
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
  },
  languageSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedLanguageIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  selectedLanguageName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  languagesList: {
    gap: 8,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
  },
  selectedLanguageOption: {
    backgroundColor: '#2C3DCD',
  },
  languageIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  languageOptionText: {
    color: '#8A8A8D',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  selectedLanguageOptionText: {
    color: 'white',
  },
  // Account section styles
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
  },
  accountAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2C3DCD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  accountDetails: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginRight: 4,
  },
  accountDetailsContent: {
    flex: 1,
    marginRight: 12,
  },
  accountEmail: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  verificationText: {
    color: '#FFB020',
    fontSize: 14,
    marginLeft: 4,
  },
  accountActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  accountAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    padding: 12,
    borderRadius: 12,
    flex: 1,
    marginRight: 8,
  },
  accountActionText: {
    color: '#2C3DCD',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  signInButton: {
    backgroundColor: '#2C3DCD',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  signInButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: '#141414',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  actionSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  actionSheetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  actionSheetClose: {
    padding: 5,
  },
  actionSheetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#1A1A1A',
  },
  actionSheetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  deleteButton: {
    backgroundColor: '#FF6B6B',
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  passwordInputContainer: {
    width: '100%',
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    marginTop: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  
  passwordInputError: {
    borderColor: '#FF6B6B',
  },
  
  passwordInput: {
    height: 50,
    paddingHorizontal: 15,
    color: 'white',
  },
  
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    marginBottom: 12,
    paddingHorizontal: 5,
  },
  
  successIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  
  emailButton: {
    flexDirection: 'row',
    backgroundColor: '#2C3DCD',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 8,
    gap: 8,
  },
  
  emailButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  
  doneButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  
  doneButtonText: {
    color: '#8A8A8D',
    fontSize: 16,
    fontWeight: '600',
  },
    devToolsList: {
    gap: 12,
  },
  devToolButton: {
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devToolText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  settingLabel: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  settingButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValue: {
    color: '#8A8A8D',
    fontSize: 16,
    marginRight: 8,
  },
  sectionSubtitle: {
    color: '#8A8A8D',
    fontSize: 14,
    marginTop: 16,
    marginBottom: 8,
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  counterButton: {
    padding: 4,
    marginHorizontal: 4,
    borderRadius: 4,
    backgroundColor: '#1A1A1A',
  },
  counterValue: {
    color: 'white',
    fontSize: 16,
    marginHorizontal: 8,
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  scheduleCard: {
    paddingBottom: 20,
  },
  scheduleCardTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  scheduleDetails: {
    marginBottom: 16,
  },
  scheduleDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  scheduleDetailRowLast: {
    marginBottom: 0,
  },
  scheduleDetailIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  scheduleDetailTextGroup: {
    flex: 1,
  },
  scheduleDetailLabel: {
    color: '#8A8A8D',
    fontSize: 12,
    marginBottom: 2,
  },
  scheduleDetailValue: {
    color: 'white',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  scheduleGroupValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 8,
  },
  cardDescription: {
    color: '#8A8A8D',
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  settingLabelContainer: {
    flex: 1,
    marginRight: 8,
  },
  settingDescription: {
    color: '#8A8A8D',
    fontSize: 14,
    marginTop: 2,
  },
  settingLabelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingItemIcon: {
    marginRight: 8,
  },
  reminderGroup: {
    marginBottom: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 12,
  },
  reminderGroupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#BBBBBB',
    marginBottom: 12,
  },
  reminderSettingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 4,
  },
  dayCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  counterValueContainer: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginHorizontal: 8,
    minWidth: 45,
    alignItems: 'center',
  },
  counterUnit: {
    color: '#8A8A8D',
    fontSize: 10,
    fontWeight: '500',
  },
  counterButtonDisabled: {
    opacity: 0.5,
  },
  testNotificationButton: {
    flexDirection: 'row',
    backgroundColor: '#3478F6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  testNotificationIcon: {
    marginRight: 8,
  },
  testNotificationText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  elevatedContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoText: {
    color: '#E0E0E6',
    fontSize: 14,
    marginTop: 12,
    lineHeight: 20,
  },
  idnpInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  idnpValue: {
    color: '#8A8A8D',
    fontSize: 16,
    fontWeight: '600',
  },
  syncHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  syncIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#2C3DCD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  syncLabel: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  syncStatusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 8,
  },
  syncStatusText: {
    color: '#A2E1A6',
    fontSize: 14,
    fontWeight: '500',
  },
  syncContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  loginPromptContainer: {
    marginVertical: 12,
  },
  loginPromptContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 176, 32, 0.15)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  loginPromptText: {
    color: '#FFB020',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  loginButton: {
    backgroundColor: '#2C3DCD',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  loginButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  refreshButton: {
    flexDirection: 'row',
    backgroundColor: '#2C3DCD',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 6,
  },
  scheduleRefreshButton: {
    marginTop: 4,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  scheduleRefreshButtonText: {
    flexShrink: 1,
  },
  // Update section styles
  updateCard: {
    paddingBottom: 12,
  },
  updateDetails: {
    marginBottom: 16,
  },
  updateDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  channelBadge: {
    textTransform: 'uppercase',
    color: '#3478F6',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  updateCheckButton: {
    backgroundColor: '#2C3DCD',
    marginTop: 4,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  updateCheckButtonText: {
    flexShrink: 1,
  },
  updateNote: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  // Up to date modal styles
  upToDateDialog: {
    backgroundColor: '#141414',
    borderRadius: 24,
    padding: 32,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
  },
  upToDateIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(44, 61, 205, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  upToDateTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
    marginBottom: 12,
    textAlign: 'center',
  },
  upToDateMessage: {
    fontSize: 15,
    color: '#8A8A8D',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  upToDateVersionContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2C3DCD',
  },
  upToDateVersionLabel: {
    fontSize: 12,
    color: '#8A8A8D',
    fontWeight: '500',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  upToDateVersionNumber: {
    fontSize: 20,
    color: '#2C3DCD',
    fontWeight: '700',
  },
  upToDateButton: {
    backgroundColor: '#2C3DCD',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
    alignItems: 'center',
    minWidth: 150,
  },
  upToDateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Dimensions, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { scheduleService, DAYS_MAP, ApiResponse } from '@/services/scheduleService';
import { useTranslation } from '@/hooks/useTranslation';
import { useTimeUpdate } from '@/hooks/useTimeUpdate';
import Animated, { useAnimatedStyle, withTiming, withSpring, FadeIn, FadeOut, useSharedValue, withSequence, withDelay } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import ViewModeMenu from './ViewModeMenu';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { getAssignmentsForPeriod, Assignment, AssignmentType } from '@/utils/assignmentStorage';

// Key for storing whether the tutorial has been shown
const TUTORIAL_SHOWN_KEY = 'schedule_tutorial_shown';

// Function to get assignment type icon name
const getAssignmentTypeIcon = (type: AssignmentType): React.ComponentProps<typeof Ionicons>['name'] => {
  switch (type) {
    case AssignmentType.HOMEWORK:
      return 'book-outline';
    case AssignmentType.TEST:
      return 'document-text-outline';
    case AssignmentType.EXAM:
      return 'school-outline';
    case AssignmentType.PROJECT:
      return 'construct-outline';
    case AssignmentType.QUIZ:
      return 'clipboard-outline';
    case AssignmentType.LAB:
      return 'flask-outline';
    case AssignmentType.ESSAY:
      return 'create-outline';
    case AssignmentType.PRESENTATION:
      return 'easel-outline';
    default:
      return 'ellipsis-horizontal-outline';
  }
};

// Function to get assignment type color
const getAssignmentTypeColor = (type: AssignmentType): string => {
  switch (type) {
    case AssignmentType.HOMEWORK:
      return '#3478F6'; // iOS Blue
    case AssignmentType.TEST:
      return '#FF9500'; // iOS Orange
    case AssignmentType.EXAM:
      return '#FF3B30'; // iOS Red
    case AssignmentType.PROJECT:
      return '#5E5CE6'; // iOS Purple
    case AssignmentType.QUIZ:
      return '#FF375F'; // iOS Pink
    case AssignmentType.LAB:
      return '#64D2FF'; // iOS Light Blue
    case AssignmentType.ESSAY:
      return '#30D158'; // iOS Green
    case AssignmentType.PRESENTATION:
      return '#FFD60A'; // iOS Yellow
    default:
      return '#8E8E93'; // iOS Gray
  }
};

const formatTimeByLocale = (time: string, isEnglish: boolean) => {
  if (!isEnglish) return time;

  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

const getMinutesBetween = (currentTime: Date, targetTime: string) => {
  const [hours, minutes] = targetTime.split(':').map(Number);
  const target = new Date(
    currentTime.getFullYear(),
    currentTime.getMonth(),
    currentTime.getDate(),
    hours,
    minutes
  );
  return Math.round((target.getTime() - currentTime.getTime()) / 1000 / 60);
};

interface TimeIndicatorProps {
  startTime: string;
  endTime: string;
  containerHeight: number;
  hasNextItem?: boolean;
  timestamp: number;
}

type ScheduleItem = {
  isBreak?: boolean;
  startTime: string;
  endTime: string;
  className: string;
  teacherName: string;
  roomNumber: string;
  _height?: number;
  hasNextItem?: boolean;
  period?: string;
  assignmentCount: number;
};

interface RecoveryDayInfoProps {
  reason: string;
}

const RecoveryDayInfo = ({ reason }: RecoveryDayInfoProps) => {
  const [showInfo, setShowInfo] = useState(false);
  const { t } = useTranslation();

  // Add animated value for popup transitions
  const popupAnimation = useAnimatedStyle(() => {
    return {
      opacity: withTiming(showInfo ? 1 : 0, { duration: 200 }),
      transform: [
        {
          scale: withSpring(showInfo ? 1 : 0.95, {
            damping: 15,
            stiffness: 150,
          })
        }
      ],
    };
  }, [showInfo]);

  // Add button animation
  const buttonAnimation = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: withSpring(showInfo ? 0.95 : 1, {
            damping: 15,
            stiffness: 150,
          })
        }
      ]
    };
  }, [showInfo]);

  return (
    <View style={styles.recoveryDayInfoContainer}>
      <Animated.View style={buttonAnimation}>
        <TouchableOpacity
          style={styles.recoveryDayInfoButton}
          onPress={() => setShowInfo(!showInfo)}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <LinearGradient
            colors={['#FF5733', '#FF3333']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.recoveryDayInfoButtonGradient}
          >
            <Text style={styles.recoveryDayInfoIcon}>ⓘ</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        style={[styles.recoveryDayTooltipContainer, popupAnimation]}
        pointerEvents={showInfo ? 'auto' : 'none'}
      >
        <View style={styles.recoveryDayTooltip}>
          <View style={styles.recoveryDayTooltipHeader}>
            <Text style={styles.recoveryDayTooltipTitle}>{t('recovery').recoveryDay}</Text>
            <TouchableOpacity
              style={styles.closeTooltipButton}
              onPress={() => setShowInfo(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeTooltipText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.recoveryDayTooltipReason}>
            {reason || t('recovery').noReason}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
};

// Add this interface near the top of the file with other interfaces
interface WeekDateInfo {
  date: Date;
  day: string;
  dateNum: number;
  isToday: boolean;
  isRecoveryDay: boolean;
  totalAssignments: number;
}

export default function DayView() {
  const [scheduleData, setScheduleData] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [settings, setSettings] = useState(scheduleService.getSettings());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [todaySchedule, setTodaySchedule] = useState<any[]>([]);
  const [initialLoadAttempted, setInitialLoadAttempted] = useState(false);
  const currentDate = new Date();
  const isEvenWeek = scheduleService.isEvenWeek(selectedDate);
  const { t, formatDate } = useTranslation();
  const recoveryDay = useMemo(() => scheduleService.isRecoveryDay(selectedDate), [selectedDate]);
  const currentTime = useTimeUpdate();
  
  // Initialize refs at the top level
  const settingsRef = useRef(scheduleService.getSettings());
  const scrollViewRef = useRef<ScrollView>(null);
  const [showFirstTimeIndicator, setShowFirstTimeIndicator] = useState(false);
  const firstTimeAnimValue = useSharedValue(0);
  const hasShownFirstTimeIndicator = useRef(false);
  const [tutorialShown, setTutorialShown] = useState(true); // Assume shown by default, will be updated
  const [expandedPeriods, setExpandedPeriods] = useState<{[key: string]: boolean}>({});
  const [periodAssignments, setPeriodAssignments] = useState<{[key: string]: Assignment[]}>({});
  const [loadingAssignments, setLoadingAssignments] = useState<{[key: string]: boolean}>({});

  // Check if tutorial has been shown before
  useEffect(() => {
    const checkTutorialShown = async () => {
      try {
        const value = await AsyncStorage.getItem(TUTORIAL_SHOWN_KEY);
        if (value === null) {
          // Tutorial has not been shown before
          setTutorialShown(false);
        }
      } catch (e) {
        // Error reading value, assume it hasn't been shown
        setTutorialShown(false);
      }
    };
    
    checkTutorialShown();
  }, []);

  // Generate current week dates (Monday to Friday, plus Saturday if it's a recovery day)
  const weekDates = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 is Sunday, 1 is Monday, etc.

    // Calculate the Monday date
    const monday = new Date(today);
    let daysFromMonday;

    // Special handling for weekends
    if (currentDay === 0 || currentDay === 6) { // If weekend (Saturday or Sunday)
      // Check if current Saturday is a recovery day
      const currentSaturday = new Date(today);
      if (currentDay === 0) { // If Sunday
        currentSaturday.setDate(today.getDate() - 1); // Yesterday was Saturday
      }
      
      const saturdayIsRecovery = scheduleService.isRecoveryDay(currentSaturday) !== null;
      
      if (saturdayIsRecovery && currentDay === 6) {
        // If it's Saturday and it's a recovery day, stay on current week
        daysFromMonday = 1 - currentDay; // -5 to get to Monday of current week
      } else if (saturdayIsRecovery && currentDay === 0) {
        // If it's Sunday and yesterday (Saturday) was a recovery day, stay on current week
        daysFromMonday = 1 - 7; // -6 to get to Monday of current week
      } else {
        // Otherwise, go to next week as before
        daysFromMonday = currentDay === 0 ? 1 : 2; // Sunday: +1, Saturday: +2
      }
    } else {
      // For weekdays, calculate normally
      daysFromMonday = 1 - currentDay; // Formula to get to Monday (e.g., if Wednesday (3), -2)
    }

    monday.setDate(today.getDate() + daysFromMonday);

    // First generate Monday-Friday
    const dates = Array.from({ length: 5 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      
      // Calculate total assignments for this day
      let totalAssignments = 0;
      if (scheduleData) {
        const dayKey = DAYS_MAP[date.getDay() as keyof typeof DAYS_MAP];
        const daySchedule = scheduleService.getScheduleForDay(scheduleData, dayKey, date);
        // Since we're in a useMemo, we can't use await, so we'll default to 0 and update later
        totalAssignments = 0;
      }
      
      return {
        date,
        day: t('weekdays').short[date.getDay()],
        dateNum: date.getDate(),
        isToday: date.toDateString() === currentDate.toDateString(),
        isRecoveryDay: scheduleService.isRecoveryDay(date) !== null,
        totalAssignments
      };
    });

    // Check if Saturday is a recovery day, and if so, add it to the array
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5); // Saturday is 5 days from Monday

    const saturdayIsRecovery = scheduleService.isRecoveryDay(saturday) !== null;

    if (saturdayIsRecovery) {
      // Calculate Saturday's assignments if it's a recovery day
      let totalAssignments = 0;
      if (scheduleData) {
        const dateString = saturday.toISOString().split('T')[0];
        const dayKey = `weekend_${dateString}`;
        // Since we're in a useMemo, we can't use await, so we'll default to 0 and update later
        totalAssignments = 0;
      }
      
      dates.push({
        date: saturday,
        day: t('weekdays').short[saturday.getDay()],
        dateNum: saturday.getDate(),
        isToday: saturday.toDateString() === currentDate.toDateString(),
        isRecoveryDay: true,
        totalAssignments
      });
    }

    return dates;
  }, [currentDate, t, scheduleData]);

  // Update the useEffect for assignment counts
  useEffect(() => {
    const updateAssignmentCounts = async () => {
      if (!scheduleData) return;

      const updatedDates = await Promise.all(weekDates.map(async (dateInfo) => {
        let totalAssignments = 0;
        if (dateInfo.isRecoveryDay) {
          const dateString = dateInfo.date.toISOString().split('T')[0];
          const dayKey = `weekend_${dateString}`;
          const daySchedule = await scheduleService.getScheduleForDay(scheduleData, dayKey, dateInfo.date);
          if (Array.isArray(daySchedule)) { // Check if daySchedule is an array
            totalAssignments = daySchedule.reduce((sum: number, item: ScheduleItem) => sum + (item.assignmentCount || 0), 0);
          }
        } else {
          const dayKey = DAYS_MAP[dateInfo.date.getDay() as keyof typeof DAYS_MAP];
          const daySchedule = await scheduleService.getScheduleForDay(scheduleData, dayKey, dateInfo.date);
          if (Array.isArray(daySchedule)) { // Check if daySchedule is an array
            totalAssignments = daySchedule.reduce((sum: number, item: ScheduleItem) => sum + (item.assignmentCount || 0), 0);
          }
        }
        return { ...dateInfo, totalAssignments };
      }));

      // Force a re-render with updated assignment counts
      setWeekDates(updatedDates);
    };

    updateAssignmentCounts();
  }, [scheduleData, weekDates]);

  // Update the state declaration with proper typing
  const [weekDatesWithAssignments, setWeekDates] = useState<WeekDateInfo[]>(weekDates);

  // Add these functions after the main hook declarations, before updateSchedule
  const scrollToDate = useCallback((date: Date) => {
    if (!scrollViewRef.current) return;

    const dateIndex = weekDates.findIndex(
      d => d.date.toDateString() === date.toDateString()
    );

    if (dateIndex !== -1) {
      scrollViewRef.current.scrollTo({
        x: dateIndex * ((Dimensions.get('window').width - 40) / 5),
        animated: true
      });
    }
  }, [weekDates]);

  const handleDatePress = useCallback((date: Date) => {
    // Immediately set the selected date for better responsiveness
    setSelectedDate(date);
    
    // Only scroll if within the range of available weekDates
    const dateTime = date.getTime();
    const minDate = weekDates[0].date.getTime();
    const maxDate = weekDates[weekDates.length - 1].date.getTime();

    if (dateTime >= minDate && dateTime <= maxDate) {
      // Use requestAnimationFrame for smoother UI updates
      requestAnimationFrame(() => {
        scrollToDate(date);
      });
    }
  }, [scrollToDate, weekDates]);

  // Schedule data fetching function using useCallback
  const fetchSchedule = useCallback(async (groupId?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Check for internet connection before attempting to fetch
      const hasInternet = await scheduleService.hasInternetConnection();
      
      // If no internet and this is the initial load (no cached data)
      if (!hasInternet && !initialLoadAttempted) {
        setError('No internet connection. Please connect to the internet for the initial load.');
        setIsLoading(false);
        setInitialLoadAttempted(true);
        return;
      }
      
      const data = await scheduleService.getClassSchedule(groupId);
      
      // If we got here successfully, update state
      setScheduleData(data);
      setInitialLoadAttempted(true);
      
      // Now that we have data, also update the day schedule
      if (data) {
        let dayKey;
        const dateString = selectedDate.toISOString().split('T')[0];
        const isRecDay = scheduleService.isRecoveryDay(selectedDate);
        
        if (isRecDay) {
          dayKey = `weekend_${dateString}`;
        } else {
          dayKey = DAYS_MAP[selectedDate.getDay() as keyof typeof DAYS_MAP];
        }
        
        const daySchedule = await scheduleService.getScheduleForDay(
          data,
          dayKey,
          selectedDate
        );
        
        setTodaySchedule(daySchedule);
      }
    } catch (error) {
      setError(t('schedule').error || 'Unable to load schedule. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, initialLoadAttempted, t]);

  // Schedule update function using useCallback
  const updateSchedule = useCallback(async () => {
    if (!scheduleData) {
      // If we don't have schedule data yet, try to fetch it
      await fetchSchedule();
      return;
    }
    
    // If we have data, update the day schedule
    const daySchedule = await scheduleService.getScheduleForDay(
      scheduleData,
      DAYS_MAP[selectedDate.getDay() as keyof typeof DAYS_MAP],
      selectedDate // Pass the selected date to handle recovery days
    );
    setTodaySchedule(daySchedule);
  }, [scheduleData, selectedDate, fetchSchedule]);

  // Settings subscription effect to check for any kind of settings changes
  useEffect(() => {
    // Capture current references to avoid stale closures
    const currentScheduleData = scheduleData;
    const currentSelectedDate = selectedDate;
    const currentFetchSchedule = fetchSchedule;
    
    const updateHandler = () => {
      // Get latest settings
      const newSettings = scheduleService.getSettings();
      const prevSettings = settingsRef.current;
      
      // Update the ref and state
      settingsRef.current = newSettings;
      setSettings(newSettings);
      
      // Skip updates if we don't have schedule data yet
      if (!currentScheduleData) return;
      
      // Handle group ID change (full refetch needed)
      if (newSettings.selectedGroupId !== prevSettings.selectedGroupId) {
        currentFetchSchedule(newSettings.selectedGroupId);
        return;
      }
      
      // Check explicitly if custom periods have changed using JSON comparison
      const oldCustomPeriods = JSON.stringify(prevSettings.customPeriods);
      const newCustomPeriods = JSON.stringify(newSettings.customPeriods);
      
      if (oldCustomPeriods !== newCustomPeriods) {
        // Force update the current schedule for custom period changes
        updateCurrentSchedule();
        return;
      }
      
      // For group/subgroup changes
      if (newSettings.group !== prevSettings.group) {
        updateCurrentSchedule();
        return;
      }
    };
    
    // Helper function to update the schedule with the correct day key
    const updateCurrentSchedule = async () => {
      // Make sure scheduleData is not null
      if (!currentScheduleData) return;
      
      let dayKey;
      const dateString = currentSelectedDate.toISOString().split('T')[0];
      const isRecDay = scheduleService.isRecoveryDay(currentSelectedDate);
      
      if (isRecDay) {
        dayKey = `weekend_${dateString}`;
      } else {
        dayKey = DAYS_MAP[currentSelectedDate.getDay() as keyof typeof DAYS_MAP];
      }
      
      const daySchedule = await scheduleService.getScheduleForDay(
        currentScheduleData,
        dayKey,
        currentSelectedDate
      );
      
      setTodaySchedule(daySchedule);
    };
    
    // Subscribe to settings changes
    const unsubscribe = scheduleService.subscribe(updateHandler);
    
    return () => unsubscribe();
  }, [scheduleData, selectedDate, fetchSchedule, updateSchedule]);

  // Schedule data fetching effect
  useEffect(() => {
    const loadData = async () => {
      try {
        // Check if we need to fetch data
        await fetchSchedule();
      } catch (err) {
        console.error('Failed to load schedule:', err);
        setError('Unable to load schedule. Please try again later.');
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [fetchSchedule]);

  // Initial scroll to today, only once on mount
  useEffect(() => {
    if (scrollViewRef.current) {
      // Wait for layout to complete
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          x: (3 * (Dimensions.get('window').width - 40) / 5),
          animated: false
        });
      }, 100);
    }
  }, []); // Empty dependency array ensures this only runs once

  // Handle empty schedule differently for weekends
  const isWeekend = selectedDate.getDay() === 0 || selectedDate.getDay() === 6;

  const currentTimestamp = currentTime.getTime();

  const TimeIndicator = useCallback((props: TimeIndicatorProps) => {
    const animatedStyle = useAnimatedStyle(() => {
      'worklet';
      const date = new Date(props.timestamp);
      const currentHours = date.getHours();
      const currentMinutes = date.getMinutes();
      const currentSeconds = date.getSeconds();
      const currentTimeInMinutes = currentHours * 60 + currentMinutes + (currentSeconds / 60);

      const [startHours, startMinutes] = props.startTime.split(':').map(Number);
      const [endHours, endMinutes] = props.endTime.split(':').map(Number);

      const startTimeInMinutes = startHours * 60 + startMinutes;
      const endTimeInMinutes = endHours * 60 + endMinutes;
      const timeSlotDuration = endTimeInMinutes - startTimeInMinutes;

      if (currentTimeInMinutes < startTimeInMinutes) return { top: withTiming('0%') };
      if (currentTimeInMinutes > endTimeInMinutes) return { top: withTiming('100%') };

      const progress = (currentTimeInMinutes - startTimeInMinutes) / timeSlotDuration;
      return {
        top: withTiming(`${progress * 100}%`, { duration: 1000 }),
      };
    }, [props.timestamp]);

    const animatedTimeStyle = useAnimatedStyle(() => {
      'worklet';
      const date = new Date(props.timestamp);
      const currentHours = date.getHours();
      const currentMinutes = date.getMinutes();
      const currentSeconds = date.getSeconds();
      const currentTimeInMinutes = currentHours * 60 + currentMinutes + (currentSeconds / 60);

      const [startHours, startMinutes] = props.startTime.split(':').map(Number);
      const [endHours, endMinutes] = props.endTime.split(':').map(Number);

      const startTimeInMinutes = startHours * 60 + startMinutes;
      const endTimeInMinutes = endHours * 60 + endMinutes;
      const timeSlotDuration = endTimeInMinutes - startTimeInMinutes;
      const progress = (currentTimeInMinutes - startTimeInMinutes) / timeSlotDuration;

      // Improved positioning calculation to avoid overlap
      // Calculate if the time indicator is in the top half or bottom half
      const isInTopHalf = progress < 0.5;
      
      return {
        transform: [{
          translateY: withTiming(isInTopHalf ? 24 : -24, { duration: 300 })
        }]
      };
    }, [props.timestamp, props.containerHeight]);

    return (
      <View style={styles.timeIndicatorContainer}>
        <Animated.View style={[styles.timeIndicator, animatedStyle]}>
          <View style={styles.timeIndicatorLine} />
          <View style={styles.timeIndicatorArrowContainer}>
            <View style={styles.timeIndicatorArrow} />
          </View>
          <Animated.Text style={[styles.timeLeftText, animatedTimeStyle]}>
            {(() => {
              const now = new Date();
              // Use the current period's end time for the line indicator
              const [endHours, endMinutes] = props.endTime.split(':').map(Number);

              const endTime = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                endHours,
                endMinutes
              );

              // Calculate minutes until the current period ends
              const diffInMinutes = Math.ceil(
                (endTime.getTime() - now.getTime()) / (1000 * 60)
              );

              return diffInMinutes > 0 ? `${diffInMinutes}m` : '';
            })()}
          </Animated.Text>
        </Animated.View>
      </View>
    );
  }, []);

  const isCurrentTimeSlot = (startTime: string, endTime: string): boolean => {
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    const currentHours = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();

    const currentTimeInMinutes = currentHours * 60 + currentMinutes;
    const startTimeInMinutes = startHours * 60 + startMinutes;
    const endTimeInMinutes = endHours * 60 + endMinutes;

    return currentTimeInMinutes >= startTimeInMinutes &&
      currentTimeInMinutes <= endTimeInMinutes;
  };

  const isCurrentTimeInSchedule = (item: ScheduleItem): boolean => {
    // First check if selected date is today
    const today = new Date();
    const isSelectedDateToday = selectedDate.toDateString() === today.toDateString();

    // If not today, don't show the time indicator
    if (!isSelectedDateToday) return false;

    const [startHours, startMinutes] = item.startTime.split(':').map(Number);
    const [endHours, endMinutes] = item.endTime.split(':').map(Number);
    const currentHours = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();

    const currentTimeInMinutes = currentHours * 60 + currentMinutes;
    const startTimeInMinutes = startHours * 60 + startMinutes;
    const endTimeInMinutes = endHours * 60 + endMinutes;

    return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes;
  };

  // Add back the useEffect for date changes
  useEffect(() => {
    // Update schedule whenever selected date changes
    if (scheduleData) {
      let dayKey;
      const dateString = selectedDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD

      // Check if this is a recovery day
      const isRecDay = scheduleService.isRecoveryDay(selectedDate);

      if (isRecDay) {
        // For recovery days, use the special weekend key format
        dayKey = `weekend_${dateString}`;
      } else {
        // For regular days, use the standard day name
        dayKey = DAYS_MAP[selectedDate.getDay() as keyof typeof DAYS_MAP];
      }

      const fetchDaySchedule = async () => {
        const daySchedule = await scheduleService.getScheduleForDay(
          scheduleData,
          dayKey,
          selectedDate // Pass the actual date to check for recovery days
        );
        setTodaySchedule(daySchedule);
      };
      
      fetchDaySchedule();
    }
  }, [selectedDate, scheduleData]);

  // Initial selected date setup - if weekend, select next Monday
  useEffect(() => {
    const today = new Date();
    const currentDay = today.getDay();

    if (currentDay === 0 || currentDay === 6) { // If weekend
      const nextMonday = new Date(today);
      const daysUntilMonday = currentDay === 0 ? 1 : 2;
      nextMonday.setDate(today.getDate() + daysUntilMonday);
      setSelectedDate(nextMonday);
    }
  }, []);

  useEffect(() => {
    // Skip animation if data isn't loaded yet or if tutorial has been shown before
    if (isLoading || !scheduleData || tutorialShown) return;
    
    // Only show the first-time indicator once and save the state
    if (!hasShownFirstTimeIndicator.current) {
      hasShownFirstTimeIndicator.current = true;
      
      // Show the first-time indicators after a short delay
      setTimeout(() => {
        setShowFirstTimeIndicator(true);
        
        // Animate in and then fade out after 2 seconds
        firstTimeAnimValue.value = withSequence(
          withTiming(1, { duration: 300 }),
          withDelay(2000, withTiming(0, { duration: 500 }))
        );
        
        // Hide the component after animation completes
        setTimeout(() => {
          setShowFirstTimeIndicator(false);
          
          // Save that tutorial has been shown
          AsyncStorage.setItem(TUTORIAL_SHOWN_KEY, 'true').catch(err => {
            console.error('Error saving tutorial state:', err);
          });
        }, 2800);
      }, 800);
    }
  }, [isLoading, scheduleData, tutorialShown]);

  const firstTimeAnimStyle = useAnimatedStyle(() => {
    return {
      opacity: firstTimeAnimValue.value,
      transform: [
        { scale: 0.9 + firstTimeAnimValue.value * 0.1 }
      ]
    };
  }, []);

  // Function to toggle period expansion
  const togglePeriodExpansion = async (periodId: string) => {
    // If not already expanded, fetch the assignments
    if (!expandedPeriods[periodId]) {
      // Set loading state for this period
      setLoadingAssignments(prev => ({
        ...prev,
        [periodId]: true
      }));
      
      try {
        const assignments = await getAssignmentsForPeriod(periodId);
        setPeriodAssignments(prev => ({
          ...prev,
          [periodId]: assignments
        }));
      } catch (error) {
        console.error('Error loading assignments:', error);
        // In case of error, set empty array
        setPeriodAssignments(prev => ({
          ...prev,
          [periodId]: []
        }));
      } finally {
        // Clear loading state
        setLoadingAssignments(prev => ({
          ...prev,
          [periodId]: false
        }));
      }
    }
    
    setExpandedPeriods(prev => ({
      ...prev,
      [periodId]: !prev[periodId]
    }));
  };

  if (isLoading && !scheduleData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerContainer}>
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={styles.headerTitle}>
                {formatDate(selectedDate, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </Text>
              <TouchableOpacity
                style={styles.weekInfo}
                onPress={() => setIsMenuOpen(true)}
              >
                <Text style={styles.weekText}>
                  {isEvenWeek ? t('schedule').evenWeek : t('schedule').oddWeek}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3478F6" />
              <Text style={styles.loadingText}>{t('schedule').loading}</Text>
            </View>
            <ViewModeMenu
              isOpen={isMenuOpen}
              onClose={() => setIsMenuOpen(false)}
              isEvenWeek={isEvenWeek}
              weekText={isEvenWeek ? t('schedule').evenWeek : t('schedule').oddWeek}
              currentView="day"
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !scheduleData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerContainer}>
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={styles.headerTitle}>
                {formatDate(selectedDate, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </Text>
              <TouchableOpacity
                style={styles.weekInfo}
                onPress={() => setIsMenuOpen(true)}
              >
                <Text style={styles.weekText}>
                  {isEvenWeek ? t('schedule').evenWeek : t('schedule').oddWeek}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              {/* Add retry button for initial load errors */}
              {!initialLoadAttempted || error.includes('internet') ? (
                <TouchableOpacity 
                  style={{
                    marginTop: 16,
                    paddingVertical: 10,
                    paddingHorizontal: 20,
                    backgroundColor: '#2C3DCD',
                    borderRadius: 8
                  }}
                  onPress={() => fetchSchedule()}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>
                    Retry
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <ViewModeMenu
              isOpen={isMenuOpen}
              onClose={() => setIsMenuOpen(false)}
              isEvenWeek={isEvenWeek}
              weekText={isEvenWeek ? t('schedule').evenWeek : t('schedule').oddWeek}
              currentView="day"
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>
              {formatDate(selectedDate, {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })}
            </Text>
            <TouchableOpacity
              style={styles.weekInfo}
              onPress={() => setIsMenuOpen(true)}
            >
              <Text style={styles.weekText}>
                {isEvenWeek ? t('schedule').evenWeek : t('schedule').oddWeek}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.dateList}>
            {/* Left gradient fade */}
            <LinearGradient
              colors={['#141414', 'rgba(20, 20, 20, 0)']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}
              style={styles.leftGradient}
              pointerEvents="none"
            />

            <ScrollView
              ref={scrollViewRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dateListScrollContent}
            >
              {weekDatesWithAssignments.map((date, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleDatePress(date.date)}
                  style={[
                    styles.dateItem,
                    date.date.getDate() === selectedDate.getDate() && !date.isRecoveryDay && styles.selectedDay,
                    date.date.getDate() === selectedDate.getDate() && date.isRecoveryDay && styles.selectedRecoveryDay,
                    date.isToday && date.date.getDate() !== selectedDate.getDate() && styles.todayDateItem,
                    date.isRecoveryDay && date.date.getDate() !== selectedDate.getDate() && styles.recoveryDayItem
                  ]}
                >
                  {date.totalAssignments > 0 && (
                    <View style={[
                      index === weekDatesWithAssignments.length - 1 ? styles.lastDateAssignmentBadge : styles.dateAssignmentBadge,
                      date.date.getDate() === selectedDate.getDate() && styles.selectedDateAssignmentBadge
                    ]}>
                      <Text style={[
                        styles.dateAssignmentBadgeText,
                        date.date.getDate() === selectedDate.getDate() && styles.selectedDateAssignmentBadgeText
                      ]}>
                        {date.totalAssignments}
                      </Text>
                    </View>
                  )}
                  <Text style={[
                    styles.dateDay,
                    date.date.getDate() === selectedDate.getDate() && !date.isRecoveryDay && styles.selectedDayText,
                    date.date.getDate() === selectedDate.getDate() && date.isRecoveryDay && styles.selectedRecoveryDayText,
                    date.isToday && date.date.getDate() !== selectedDate.getDate() && styles.todayText,
                    date.isRecoveryDay && date.date.getDate() !== selectedDate.getDate() && styles.recoveryDayText
                  ]}>
                    {date.day}
                  </Text>
                  <Text style={[
                    styles.dateNumber,
                    date.date.getDate() === selectedDate.getDate() && !date.isRecoveryDay && styles.selectedDayText,
                    date.date.getDate() === selectedDate.getDate() && date.isRecoveryDay && styles.selectedRecoveryDayText,
                    date.isToday && date.date.getDate() !== selectedDate.getDate() && styles.todayText,
                    date.isRecoveryDay && date.date.getDate() !== selectedDate.getDate() && styles.recoveryDayText
                  ]}>
                    {date.dateNum}
                  </Text>
                  {date.isToday && date.date.getDate() !== selectedDate.getDate() && <View style={styles.todayDot} />}
                  {date.isRecoveryDay && <View style={styles.recoveryDot} />}
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Right gradient fade */}
            <LinearGradient
              colors={['rgba(20, 20, 20, 0)', '#141414']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}
              style={styles.rightGradient}
              pointerEvents="none"
            />
            
            {/* First-time indicator */}
            {showFirstTimeIndicator && (
              <Animated.View style={[styles.firstTimeIndicatorContainer, firstTimeAnimStyle]}>
                <View style={styles.firstTimeIndicator}>
                  <Text style={styles.firstTimeIndicatorArrow}>‹</Text>
                  <Text style={styles.firstTimeIndicatorText}>Swipe to see more</Text>
                  <Text style={styles.firstTimeIndicatorArrow}>›</Text>
                </View>
              </Animated.View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.contentContainer}>
        <ScrollView style={styles.scheduleContainer}>
          {isWeekend && !recoveryDay ? (
            <View style={styles.noSchedule}>
              <Text style={styles.noScheduleText}>{t('schedule').noClassesWeekend}</Text>
            </View>
          ) : (
              todaySchedule.map((item, index) => {
                // Skip the recovery-info item but just use it to display the banner
                if (item.period === 'recovery-info') {
                  // We're already showing the recovery day banner separately
                  return null;
                }

                if (item.isEvenWeek !== undefined && item.isEvenWeek !== isEvenWeek) {
                  return null;
                }

                const nextItem = todaySchedule[index + 1];
                const showTimeIndicator = isCurrentTimeInSchedule(item);
                const hasAssignments = item.assignmentCount > 0;
                const isPeriodExpanded = item.period ? expandedPeriods[item.period] : false;
                const periodAssignmentsList = item.period ? periodAssignments[item.period] || [] : [];

                return (
                  <View
                    key={index}
                    style={[styles.scheduleItem]}
                    onLayout={(event) => {
                      item._height = event.nativeEvent.layout.height;
                    }}
                  >
                    <View style={[styles.classCard, {
                      borderLeftColor: getSubjectColor(item.className),
                      backgroundColor: '#1A1A1A',
                      shadowOpacity: 0.1,
                      minHeight: 100,
                    }]}
                    >
                      <View style={[styles.timeContainer, {
                        borderRightColor: 'rgba(138, 138, 141, 0.2)'
                      }]}
                      >
                        <Text style={[styles.time, { marginBottom: 'auto' }]}>
                          {formatTimeByLocale(item.startTime, settings.language === 'en')}
                        </Text>

                        {/* Time separator - show chevron if has assignments, otherwise show dot */}
                        <TouchableOpacity 
                          style={styles.timeDotContainer}
                          disabled={!hasAssignments}
                          onPress={() => item.period && hasAssignments ? togglePeriodExpansion(item.period) : null}
                        >
                          {hasAssignments ? (
                            <Animated.View style={[
                              styles.timeChevronContainer,
                              { transform: [{ rotate: isPeriodExpanded ? '180deg' : '0deg' }] }
                            ]}>
                              <Ionicons 
                                name="chevron-down" 
                                size={14} 
                                color={getSubjectColor(item.className)} 
                              />
                            </Animated.View>
                          ) : (
                            <View style={[styles.timeDot, { backgroundColor: getSubjectColor(item.className) }]} />
                          )}
                        </TouchableOpacity>

                        <Text style={[styles.time, { marginTop: 'auto' }]}>
                          {formatTimeByLocale(item.endTime, settings.language === 'en')}
                        </Text>
                      </View>

                      <View style={styles.classContent}>
                        <View style={styles.classHeaderRow}>
                          <Text style={styles.className} numberOfLines={1}>
                            {item.className}
                          </Text>
                          
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {/* Assignment count badge */}
                            {item.assignmentCount > 0 && (
                              <TouchableOpacity
                                style={styles.assignmentBadge}
                                onPress={() => item.period ? togglePeriodExpansion(item.period) : null}
                              >
                                <Text style={styles.assignmentBadgeText}>
                                  {item.assignmentCount}
                                </Text>
                              </TouchableOpacity>
                            )}
                            
                            {/* Status text */}
                            <Text style={[styles.statusText, showTimeIndicator && styles.activeStatusText]}>
                              {showTimeIndicator ? 'Now' :
                                (() => {
                                  const currentTimeMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
                                  const [startHours, startMinutes] = item.startTime.split(':').map(Number);
                                  const startTimeMinutes = startHours * 60 + startMinutes;

                                  if (currentTimeMinutes < startTimeMinutes) {
                                    const previousItem = index > 0 ? todaySchedule[index - 1] : null;
                                    if (previousItem && isCurrentTimeInSchedule(previousItem)) {
                                      // Calculate minutes until start and round up (so 59 seconds = 1 minute)
                                      const now = new Date();
                                      const target = new Date(
                                        now.getFullYear(),
                                        now.getMonth(),
                                        now.getDate(),
                                        startHours,
                                        startMinutes
                                      );
                                      const diffInMs = target.getTime() - now.getTime();
                                      const minutesUntilStart = Math.ceil(diffInMs / (1000 * 60));
                                      // Only show if less than 60 minutes
                                      return minutesUntilStart <= 60 ? `In ${minutesUntilStart}m` : '';
                                    } else if (!previousItem && currentTimeMinutes < startTimeMinutes) {
                                      // If this is the first class and it hasn't started yet
                                      const now = new Date();
                                      const target = new Date(
                                        now.getFullYear(),
                                        now.getMonth(),
                                        now.getDate(),
                                        startHours,
                                        startMinutes
                                      );
                                      const diffInMs = target.getTime() - now.getTime();
                                      const minutesUntilStart = Math.ceil(diffInMs / (1000 * 60));
                                      // Only show if less than 60 minutes
                                      return minutesUntilStart <= 60 ? `${t('schedule').in} ${minutesUntilStart}m` : '';
                                    }
                                  }
                                  return '';
                                })()
                              }
                            </Text>
                          </View>
                        </View>
                        <View style={styles.detailsContainer}>
                          <View style={styles.teacherContainer}>
                            <Text style={styles.teacherName}>{item.teacherName}</Text>
                            {item.group && (item.group === 'Subgroup 1' || item.group === 'Subgroup 2') && (
                              <Text style={styles.groupName}>
                                {item.group === 'Subgroup 1' ? t('subgroup').group1 : t('subgroup').group2}
                              </Text>
                            )}
                          </View>
                          <View style={styles.roomContainer}>
                            <Text style={styles.roomNumber}>{t('schedule').room} {item.roomNumber}</Text>
                          </View>
                        </View>
                        
                        {/* Assignments expandable section */}
                        {hasAssignments && isPeriodExpanded && (
                          <Animated.View 
                            style={styles.assignmentsContainer}
                            entering={FadeIn.duration(200)}
                            exiting={FadeOut.duration(150)}
                          >
                            <View style={styles.assignmentsSeparator} />
                            <Text style={styles.assignmentsSectionTitle}>
                              {'Assignments'}
                            </Text>
                            
                            {loadingAssignments[item.period || ''] ? (
                              <View style={styles.loadingAssignments}>
                                <ActivityIndicator size="small" color="#3478F6" />
                                <Text style={styles.loadingAssignmentsText}>
                                  {'Loading assignments...'}
                                </Text>
                              </View>
                            ) : periodAssignmentsList.length > 0 ? (
                              periodAssignmentsList.map((assignment, idx) => (
                                <View key={assignment.id} style={styles.assignmentItem}>
                                  <View style={[
                                    styles.assignmentTypeIndicator, 
                                    { backgroundColor: getAssignmentTypeColor(assignment.assignmentType) }
                                  ]}>
                                    <Ionicons 
                                      name={getAssignmentTypeIcon(assignment.assignmentType)} 
                                      size={12} 
                                      color="#FFFFFF" 
                                    />
                                  </View>
                                  <View style={styles.assignmentDetails}>
                                    <Text style={styles.assignmentTitle}>{assignment.title}</Text>
                                    {assignment.description ? (
                                      <Text style={styles.assignmentDescription} numberOfLines={2}>
                                        {assignment.description}
                                      </Text>
                                    ) : null}
                                  </View>
                                </View>
                              ))
                            ) : (
                              <View style={styles.noAssignments}>
                                <Text style={styles.noAssignmentsText}>
                                  {'No assignments for this period'}
                                </Text>
                              </View>
                            )}
                          </Animated.View>
                        )}
                      </View>
                      {showTimeIndicator && (
                        <TimeIndicator
                          startTime={item.startTime}
                          endTime={item.endTime} // Use item's end time for the period indicator
                          containerHeight={item._height || 100}
                          hasNextItem={item.hasNextItem}
                          timestamp={currentTimestamp}
                        />
                      )}
                    </View>
                  </View>
                );
              })
            )}
        </ScrollView>

        {/* Position the recovery day info button at the top right corner */}
        {recoveryDay && (
          <View style={styles.fixedRecoveryInfoContainer}>
            <RecoveryDayInfo reason={recoveryDay.reason || ''} />
          </View>
        )}
      </View>

      <ViewModeMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        isEvenWeek={isEvenWeek}
        weekText={isEvenWeek ? t('schedule').evenWeek : t('schedule').oddWeek}
        currentView="day"
      />
    </SafeAreaView>
  );
}

// Function to generate consistent colors for subjects
function getSubjectColor(subjectName: string): string {
  const colors = [
    '#4169E1', // Royal Blue
    '#FF69B4', // Hot Pink
    '#32CD32', // Lime Green
    '#FF8C00', // Dark Orange
    '#9370DB', // Medium Purple
    '#20B2AA', // Light Sea Green
    '#FF6347', // Tomato
    '#4682B4', // Steel Blue
    '#9ACD32', // Yellow Green
    '#FF4500', // Orange Red
    '#BA55D3', // Medium Orchid
    '#2E8B57', // Sea Green
  ];

  // Generate a number from the subject name
  let hash = 0;
  for (let i = 0; i < subjectName.length; i++) {
    hash = subjectName.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Use the hash to pick a color
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

type Styles = {
  container: ViewStyle;
  header: ViewStyle;
  headerTop: ViewStyle;
  headerTitle: TextStyle;
  dateList: ViewStyle;
  dateListScrollContent: ViewStyle;
  dateListContent: ViewStyle;
  dateItem: ViewStyle;
  activeDateItem: ViewStyle;
  todayDateItem: ViewStyle;
  dateDay: TextStyle;
  dateNumber: TextStyle;
  activeDateText: TextStyle;
  todayText: TextStyle;
  todayDot: ViewStyle;
  scheduleContainer: ViewStyle;
  scheduleItem: ViewStyle;
  classCard: ViewStyle;
  timeContainer: ViewStyle;
  time: TextStyle;
  classContent: ViewStyle;
  className: TextStyle;
  roomContainer: ViewStyle;
  roomNumber: TextStyle;
  weekInfo: ViewStyle;
  weekText: TextStyle;
  detailsContainer: ViewStyle;
  teacherContainer: ViewStyle;
  teacherName: TextStyle;
  noSchedule: ViewStyle;
  noScheduleText: TextStyle;
  timeIndicatorContainer: ViewStyle;
  timeIndicator: ViewStyle;
  timeIndicatorLine: ViewStyle;
  timeIndicatorArrowContainer: ViewStyle;
  timeIndicatorMove: ViewStyle;
  timeIndicatorArrow: ViewStyle;
  timeLeftText: TextStyle;
  timeWrapper: ViewStyle;
  timeDot: ViewStyle;
  timeDotContainer: ViewStyle;
  classHeaderRow: ViewStyle;
  statusText: TextStyle;
  activeStatusText: TextStyle;
  loadingContainer: ViewStyle;
  loadingText: TextStyle;
  errorContainer: ViewStyle;
  errorText: TextStyle;
  weekInfo2: ViewStyle;
  weekText2: TextStyle;
  headerContainer: ViewStyle;
  contentContainer: ViewStyle;
  leftGradient: ViewStyle;
  rightGradient: ViewStyle;
  selectedDayText: TextStyle;
  selectedDay: ViewStyle;
  groupName: TextStyle;
  recoveryBanner: ViewStyle;
  recoveryTitle: TextStyle;
  recoveryInfo: TextStyle;
  recoveryReason: TextStyle;
  recoveryDot: ViewStyle;
  recoveryDayItem: ViewStyle;
  recoveryDayText: TextStyle;
  selectedRecoveryDay: ViewStyle;
  selectedRecoveryDayText: TextStyle;
  recoveryDayInfoButton: ViewStyle;
  recoveryDayInfoButtonGradient: ViewStyle;
  recoveryDayInfoIcon: TextStyle;
  recoveryDayTooltipContainer: ViewStyle;
  recoveryDayTooltip: ViewStyle;
  recoveryDayTooltipHeader: ViewStyle;
  recoveryDayTooltipTitle: TextStyle;
  closeTooltipButton: ViewStyle;
  closeTooltipText: TextStyle;
  recoveryDayTooltipReason: TextStyle;
  recoveryDayInfoContainer: ViewStyle;
  recoveryDayInfoWrapper: ViewStyle;
  fixedRecoveryInfoContainer: ViewStyle;
  firstTimeIndicatorContainer: ViewStyle;
  firstTimeIndicator: ViewStyle;
  firstTimeIndicatorText: TextStyle;
  firstTimeIndicatorArrow: TextStyle;
  assignmentBadge: ViewStyle;
  assignmentBadgeText: TextStyle;
  dateAssignmentBadge: ViewStyle;
  selectedDateAssignmentBadge: ViewStyle;
  dateAssignmentBadgeText: TextStyle;
  selectedDateAssignmentBadgeText: TextStyle;
  lastDateAssignmentBadge: ViewStyle;
  timeChevronContainer: ViewStyle;
  assignmentsContainer: ViewStyle;
  assignmentsSeparator: ViewStyle;
  assignmentsSectionTitle: TextStyle;
  assignmentItem: ViewStyle;
  assignmentTypeIndicator: ViewStyle;
  assignmentDetails: ViewStyle;
  assignmentTitle: TextStyle;
  assignmentDescription: TextStyle;
  loadingAssignments: ViewStyle;
  loadingAssignmentsText: TextStyle;
  noAssignments: ViewStyle;
  noAssignmentsText: TextStyle;
};

const styles = StyleSheet.create<Styles>({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A', // Darker background for more contrast
  },
  header: {
    padding: 20,
    backgroundColor: '#141414', // Subtle distinction from background
    borderBottomRightRadius: 32,
    borderBottomLeftRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  weekInfo: {
    backgroundColor: '#2C3DCD',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  weekText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  weekInfo2: {
    backgroundColor: '#2C3DCD', // More vibrant blue for consistency
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  weekText2: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  dateList: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 0,
    marginBottom: 0,
    position: 'relative', // Added for absolute positioning of indicators
  },
  dateListContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  dateListScrollContent: {
    paddingVertical: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    gap: 12,
  },
  dateItem: {
    width: 70,
    height: 90,
    borderRadius: 20,
    backgroundColor: '#1A1A1A', // Changed from #3A3A3C to match the app's darker theme
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  activeDateItem: {
    backgroundColor: '#2C3DCD',
    transform: [{ scale: 1.05 }],
  },
  todayDateItem: {
    borderColor: '#2C3DCD',
    borderWidth: 2,
    backgroundColor: '#1A1A1A', // Changed from #0A0A0A for better contrast
  },
  dateDay: {
    color: '#8A8A8D',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  dateNumber: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6, // Increased to make room for today dot
  },
  activeDateText: {
    color: '#FFFFFF',
  },
  todayText: {
    color: '#2C3DCD',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2C3DCD',
    marginTop: 4,
  },
  scheduleContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: '#0A0A0A',
  },
  scheduleItem: {
    marginBottom: 16,
    zIndex: 1,
  },
  classCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
    flexDirection: 'row',
    overflow: 'hidden',
    minHeight: 100,
  },
  timeContainer: {
    width: 90,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderRightWidth: 2,
  },
  time: {
    color: '#8A8A8D',
    fontSize: 14,
    fontWeight: '500',
  },
  classContent: {
    flex: 1,
    padding: 16,
  },
  className: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  roomContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  roomNumber: {
    color: '#8A8A8D',
    fontSize: 14,
    fontWeight: '500',
  },
  detailsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  teacherContainer: {
    flex: 1,
    marginRight: 8,
  },
  teacherName: {
    color: '#8A8A8D',
    fontSize: 14,
    fontWeight: '500',
  },
  noSchedule: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  noScheduleText: {
    color: '#8A8A8D',
    fontSize: 16,
    fontWeight: '500',
  },
  timeIndicatorContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  timeIndicator: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
  timeIndicatorLine: {
    position: 'absolute',
    left: 90,
    right: 0,
    height: 2,
    backgroundColor: '#FF3B30',
    opacity: 0.7,
  },
  timeIndicatorArrowContainer: {
    position: 'absolute',
    left: 83,
    width: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
    borderRadius: 6,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: .5,
    shadowRadius: 6,
    elevation: 8,
  },
  timeIndicatorMove: {
    position: 'absolute',
    left: 0,
    borderColor: 'red',
    width: 2,
    height: 2,
    borderRadius: 5,
  },
  timeIndicatorArrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FF3B30',
    transform: [{ rotate: '180deg' }],
  },
  timeLeftText: {
    position: 'absolute',
    left: 60,
    backgroundColor: '#FF3B30',
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
    zIndex: 100,
  },
  timeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
  timeDotContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8, // Add padding to make it more tappable
  },
  classHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    color: '#8A8A8D',
    fontWeight: '600',
  },
  activeStatusText: {
    color: '#3478F6',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 16,
    textAlign: 'center',
  },
  headerContainer: {
    zIndex: 10,
  },
  contentContainer: {
    flex: 1,
    zIndex: 1,
  },
  leftGradient: {
    position: 'absolute',
    left: 0,
    width: 40,
    top: 0,
    bottom: 0,
    zIndex: 10,
    pointerEvents: 'none',
  },
  rightGradient: {
    position: 'absolute',
    right: 0,
    width: 40,
    top: 0,
    bottom: 0,
    zIndex: 10,
    pointerEvents: 'none',
  },
  selectedDayText: {
    color: '#FFFFFF',
  },
  selectedDay: {
    backgroundColor: '#2C3DCD',
    transform: [{ scale: 1.05 }],
    shadowColor: '#2C3DCD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  groupName: {
    color: '#8A8A8D',
    fontSize: 12,
    marginTop: 4,
  },
  recoveryBanner: {
    backgroundColor: 'rgba(45, 137, 191, 1)',
    borderRadius: 10,
    padding: 16,
    marginVertical: 8,
  },
  recoveryTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  recoveryInfo: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 4,
  },
  recoveryReason: {
    color: '#FF4B4B',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  recoveryDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FF5733',
    marginTop: 4,
  },
  recoveryDayItem: {
    borderColor: '#FF5733',
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  recoveryDayText: {
    color: '#FF5733',
  },
  selectedRecoveryDay: {
    backgroundColor: '#FF5733',
    transform: [{ scale: 1.05 }],
    shadowColor: '#FF5733',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 0, // Remove border when selected
  },
  selectedRecoveryDayText: {
    color: '#FFFFFF',
  },
  recoveryDayInfoButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recoveryDayInfoIcon: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  recoveryDayTooltipContainer: {
    position: 'absolute',
    top: 28,
    right: 0,
    width: 200,
    zIndex: 100,
  },
  recoveryDayTooltip: {
    backgroundColor: '#1C1C1E',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  recoveryDayTooltipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  recoveryDayTooltipTitle: {
    color: '#FF5733',
    fontSize: 14,
    fontWeight: 'bold',
  },
  closeTooltipButton: {
    padding: 4,
  },
  closeTooltipText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  recoveryDayTooltipReason: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.8,
  },
  recoveryDayInfoContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 100,
  },
  recoveryDayInfoWrapper: {
    position: 'relative',
    height: 28, // Provide space for the button
    marginBottom: 4,
    width: '100%',
  },
  recoveryDayInfoButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
    zIndex: 100,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
  },
  fixedRecoveryInfoContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 101,
  },
  firstTimeIndicatorContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -8,
    zIndex: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  firstTimeIndicator: {
    flexDirection: 'row',
    backgroundColor: 'rgba(50, 50, 50, 0.9)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  firstTimeIndicatorText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 8,
  },
  firstTimeIndicatorArrow: {
    color: '#3478F6',
    fontSize: 24,
    fontWeight: 'bold',
  },
  assignmentBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  assignmentBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  dateAssignmentBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: '#FF3B30',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    zIndex: 1,
  },
  selectedDateAssignmentBadge: {
    backgroundColor: '#FF3B30',
  },
  dateAssignmentBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  selectedDateAssignmentBadgeText: {
    color: '#FFFFFF',
  },
  lastDateAssignmentBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: '#FF3B30',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    zIndex: 1,
  },
  timeChevronContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 20,
    height: 20,
  },
  assignmentsContainer: {
    marginTop: 8, 
    paddingTop: 8,
  },
  assignmentsSeparator: {
    height: 1,
    backgroundColor: 'rgba(138, 138, 141, 0.2)',
    marginBottom: 8,
  },
  assignmentsSectionTitle: {
    color: '#8A8A8D',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  assignmentItem: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(60, 60, 60, 0.3)',
    borderRadius: 8,
    padding: 8,
  },
  assignmentTypeIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  assignmentDetails: {
    flex: 1,
  },
  assignmentTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  assignmentDescription: {
    color: '#8A8A8D',
    fontSize: 12,
  },
  loadingAssignments: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  loadingAssignmentsText: {
    color: '#8A8A8D',
    fontSize: 14,
    marginLeft: 8,
  },
  noAssignments: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  noAssignmentsText: {
    color: '#8A8A8D',
    fontSize: 14,
    fontStyle: 'italic',
  },
});
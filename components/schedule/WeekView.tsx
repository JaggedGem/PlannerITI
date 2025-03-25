import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Dimensions, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import React from 'react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { scheduleService, DAYS_MAP, ApiResponse, RecoveryDay } from '@/services/scheduleService';
import { useTranslation } from '@/hooks/useTranslation';
import { useTimeUpdate } from '@/hooks/useTimeUpdate';
import Animated, { useAnimatedStyle, withTiming, withSpring, FadeIn, FadeOut, Layout, useSharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import ViewModeMenu from './ViewModeMenu';
import { SafeAreaView } from 'react-native-safe-area-context';

// Get week start (Monday) from current date
const getWeekStart = (date: Date): Date => {
  const result = new Date(date);
  const day = result.getDay(); // 0 is Sunday, 1 is Monday, etc.
  
  // Calculate days to Monday
  let daysToMonday;
  if (day === 0) { // Sunday
    daysToMonday = -6; // Go back to last week's Monday
  } else if (day === 6) { // Saturday
    daysToMonday = -5; // Go back to this week's Monday
  } else {
    daysToMonday = 1 - day; // Regular case: calculate days to Monday
  }
  
  result.setDate(result.getDate() + daysToMonday);
  return result;
};

interface FormattedHour {
  hour: string;
  period: string;
}

// Format hour in 12h or 24h format based on locale
const formatHourByLocale = (hour: number, isEnglish: boolean): string | FormattedHour => {
  if (!isEnglish) return hour.toString().padStart(2, '0');
  
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return { hour: hour12.toString(), period };
};

// Get minimum and maximum hours from all periods
const getTimeRange = (schedule: Record<string, any[]>): { min: number, max: number } => {
  let min = 24;
  let max = 0;

  // Add null check for schedule and its values
  if (schedule) {
    Object.values(schedule).forEach(dayItems => {
      // Add null check for dayItems before calling forEach
      if (dayItems && Array.isArray(dayItems)) {
        dayItems.forEach(item => {
          // Add null check for item and its properties
          if (item && item.startTime && item.endTime) {
            const startHour = parseInt(item.startTime.split(':')[0]);
            const endHour = parseInt(item.endTime.split(':')[0]);
            if (startHour < min) min = startHour;
            if (endHour > max) max = endHour;
          }
        });
      }
    });
  }

  // Add padding
  return { min: Math.max(7, min - 1), max: Math.min(22, max + 1) };
};

// Calculate position and height for a schedule item
const calculateItemPosition = (
  startTime: string,
  endTime: string,
  hourHeight: number,
  firstHour: number
): { top: number, height: number } => {
  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const [endHours, endMinutes] = endTime.split(':').map(Number);

  const startTimeInMinutes = (startHours - firstHour) * 60 + startMinutes;
  const endTimeInMinutes = (endHours - firstHour) * 60 + endMinutes;
  const durationInMinutes = endTimeInMinutes - startTimeInMinutes;

  const top = (startTimeInMinutes / 60) * hourHeight;
  const height = (durationInMinutes / 60) * hourHeight;
  
  return { top, height };
};

// Generate time slots for the timetable
const generateTimeSlots = (startHour: number, endHour: number): number[] => {
  const slots = [];
  for (let hour = startHour; hour <= endHour; hour++) {
    slots.push(hour);
  }
  return slots;
};

// Add isCurrentTimeSlot helper function
const isCurrentTimeSlot = (startTime: string, endTime: string): boolean => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  
  const currentTimeInMinutes = currentHour * 60 + currentMinute;
  const startTimeInMinutes = startHour * 60 + startMinute;
  const endTimeInMinutes = endHour * 60 + endMinute;
  
  return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes;
};

interface TimetableItemProps {
  item: {
    startTime: string;
    endTime: string;
    className: string;
    roomNumber: string;
  };
  top: number;
  height: number;
  color: string;
  isActive: boolean;
  timeFormat: string;
}

const TimetableItem = ({ item, top, height, color, isActive, timeFormat }: TimetableItemProps) => {
  // Create time display with just hours (no minutes)
  const startHour = parseInt(item.startTime.split(':')[0]);
  const endHour = parseInt(item.endTime.split(':')[0]);
  const timeDisplay = `${startHour}–${endHour}`;
  
  return (
    <Animated.View 
      style={[
        styles.timetableItem, 
        { 
          top, 
          height: Math.max(height, 35), // Slightly taller minimum height
        }
      ]}
      entering={FadeIn
        .duration(200)
        .springify()
        .delay(50)}
      exiting={FadeOut.duration(150)}
      layout={Layout.springify()}
    >
      <LinearGradient
        colors={isActive 
          ? [color, `${color}CC`] // More opacity for active
          : [`${color}99`, `${color}66`]} // Less opacity for inactive
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.itemGradient}
      >
        <Animated.View entering={FadeIn.duration(250)}>
          <Text style={styles.className} numberOfLines={1}>
            {item.className}
          </Text>
        </Animated.View>
        <View style={styles.itemFooter}>
          <Animated.View entering={FadeIn.duration(250).delay(50)}>
            <Text style={styles.roomNumber} numberOfLines={1}>
              {item.roomNumber}
            </Text>
          </Animated.View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

const RecoveryDayInfo = ({ reason }: { reason: string }) => {
  const [showInfo, setShowInfo] = useState(false);
  
  // Add animated value for popup transitions
  const popupAnimation = useAnimatedStyle(() => {
    return {
      opacity: withTiming(showInfo ? 1 : 0, { duration: 200 }),
      transform: [
        { 
          scale: withSpring(showInfo ? 1 : 0.9, {
            damping: 15,
            stiffness: 150,
          })
        },
        { 
          translateY: withSpring(showInfo ? 0 : -10, {
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
          scale: withSpring(showInfo ? 0.9 : 1, {
            damping: 15,
            stiffness: 150,
          })
        }
      ]
    };
  }, [showInfo]);

  return (
    <>
      <Animated.View style={buttonAnimation}>
        <TouchableOpacity 
          style={styles.recoveryDayInfoButton}
          onPress={() => setShowInfo(!showInfo)}
          activeOpacity={0.7}
          hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
        >
          <LinearGradient
            colors={['#FF5733DD', '#FF5733AA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.recoveryDayInfoButtonGradient}
          >
            <Text style={styles.recoveryDayInfoIcon}>ⓘ</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
      
      {/* Reason tooltip that appears when info button is pressed */}
      <Animated.View 
        style={[styles.recoveryDayTooltipContainer, popupAnimation]}
        pointerEvents={showInfo ? 'auto' : 'none'}
      >
        <View style={styles.recoveryDayTooltip}>
          <View style={styles.recoveryDayTooltipHeader}>
            <Text style={styles.recoveryDayTooltipTitle}>Recovery Day</Text>
            <TouchableOpacity 
              style={styles.closeTooltipButton}
              onPress={() => setShowInfo(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeTooltipText as TextStyle}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.recoveryDayTooltipReason}>
            {reason || 'No reason provided'}
          </Text>
        </View>
      </Animated.View>
    </>
  );
};

interface CurrentTimeIndicatorProps {
  hourHeight: number;
  firstHour: number;
  timestamp: number;
  schedule: Record<string, any[]>;
}

const CurrentTimeIndicator = ({ hourHeight, firstHour, timestamp, schedule }: CurrentTimeIndicatorProps) => {
  const currentTime = new Date(timestamp);
  const hours = currentTime.getHours();
  const minutes = currentTime.getMinutes();
  
  const totalMinutesSinceFirstHour = (hours - firstHour) * 60 + minutes;
  const position = (totalMinutesSinceFirstHour / 60) * hourHeight;

  // Don't show indicator if before first hour
  if (hours < firstHour) return null;
  
  // Get latest end time for the day
  const now = new Date();
  const currentDay = DAYS_MAP[now.getDay() as keyof typeof DAYS_MAP];
  const todaySchedule = schedule[currentDay as keyof typeof schedule] || [];
  
  if (todaySchedule.length > 0) {
    const latestEndTime = todaySchedule.reduce((latest: number, item: { endTime: string }) => {
      const [endHour, endMinute] = item.endTime.split(':').map(Number);
      const endTimeInMinutes = endHour * 60 + endMinute;
      return Math.max(latest, endTimeInMinutes);
    }, 0);
    
    const currentTimeInMinutes = hours * 60 + minutes;
    if (currentTimeInMinutes > latestEndTime) return null;
  }

  return (
    <View style={[styles.currentTimeIndicator, { top: position }]}>
      <View style={styles.currentTimeIndicatorDot} />
      <View style={styles.currentTimeIndicatorLine} />
    </View>
  );
};

type Styles = {
  container: ViewStyle;
  content: ViewStyle;
  headerContainer: ViewStyle;
  header: ViewStyle;
  pageTitle: TextStyle;
  weekInfo: ViewStyle;
  weekText: TextStyle;
  daysHeader: ViewStyle;
  dayColumn: ViewStyle;
  dayName: TextStyle;
  dateText: TextStyle;
  timetableContainer: ViewStyle;
  timeColumn: ViewStyle;
  timeSlot: ViewStyle;
  timeHour: TextStyle;
  timePeriod: TextStyle;
  gridContainer: ViewStyle;
  dayContent: ViewStyle;
  timetableItem: ViewStyle;
  itemGradient: ViewStyle;
  className: TextStyle;
  roomNumber: TextStyle;
  itemFooter: ViewStyle;
  navigationControls: ViewStyle;
  navButton: ViewStyle;
  navButtonText: TextStyle;
  currentTimeIndicator: ViewStyle;
  currentTimeIndicatorLine: ViewStyle;
  currentTimeIndicatorDot: ViewStyle;
  emptySchedule: TextStyle;
  loadingContainer: ViewStyle;
  loadingText: TextStyle;
  errorContainer: ViewStyle;
  errorText: TextStyle;
  todayColumn: ViewStyle;
  currentHourHighlight: ViewStyle;
  recoveryDot: TextStyle;
  recoveryDayInfo: ViewStyle;
  recoveryDayInfoIcon: TextStyle;
  recoveryDayInfoButton: ViewStyle;
  recoveryDayInfoButtonGradient: ViewStyle;
  recoveryDayTooltipContainer: ViewStyle;
  recoveryDayTooltip: ViewStyle;
  recoveryDayTooltipHeader: ViewStyle;
  recoveryDayTooltipTitle: TextStyle;
  closeTooltipButton: ViewStyle;
  closeTooltipText: TextStyle; // Changed from ViewStyle to TextStyle
  recoveryDayTooltipReason: TextStyle;
  weekendColumn: ViewStyle;
  gridLine: ViewStyle;
};

// Define a type for schedule items
type ScheduleItem = {
  period: string;
  startTime: string;
  endTime: string;
  className: string;
  teacherName: string;
  roomNumber: string;
  isEvenWeek?: boolean;
  group?: string;
  _height?: number;
  hasNextItem?: boolean;
  isCustom?: boolean;
  color?: string;
  isRecoveryDay?: boolean;
  recoveryReason?: string;
  replacedDayName?: string;
};

export default function WeekView() {
  const [scheduleData, setScheduleData] = useState<ApiResponse | null>(null);
  const [weekSchedule, setWeekSchedule] = useState<Record<string, ScheduleItem[]>>({
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState(scheduleService.getSettings());
  const now = new Date();
  const currentDay = now.getDay();
  const isWeekend = currentDay === 0 || currentDay === 6;
  
  // Check if current Saturday is a recovery day
  const currentSaturday = new Date(now);
  if (currentDay === 0) { // If Sunday
    currentSaturday.setDate(now.getDate() - 1); // Yesterday was Saturday
  }
  const saturdayIsRecovery = scheduleService.isRecoveryDay(currentSaturday) !== null;
  
  // Initialize weekOffset based on recovery days and weekend status
  const [weekOffset, setWeekOffset] = useState(() => {
    if (isWeekend) {
      if ((currentDay === 6 && saturdayIsRecovery) || // Saturday and it's a recovery day
          (currentDay === 0 && saturdayIsRecovery)) { // Sunday and yesterday was recovery
        return 0; // Stay on current week
      }
      return 1; // Go to next week
    }
    return 0; // Weekday - stay on current week
  });
  const { t, formatDate } = useTranslation();
  const currentTime = useTimeUpdate();
  const verticalScrollRef = useRef<ScrollView>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const fadeAnim = useSharedValue(1);
  
  // Initialize settings ref at the top level
  const settingsRef = useRef(scheduleService.getSettings());

  // Calculate current week start date (Monday)
  const weekStartDate = new Date();
  weekStartDate.setDate(weekStartDate.getDate() + (weekOffset * 7));
  const weekStart = getWeekStart(weekStartDate);
  
  // Check if current week is even
  const isEvenWeek = scheduleService.isEvenWeek(weekStartDate);

  // Helper to get date for specific day in week
  const getDateForDay = (weekStartDate: Date, dayOffset: number) => {
    const date = new Date(weekStartDate);
    date.setDate(weekStartDate.getDate() + dayOffset);
    return date;
  };

  // Make fetchSchedule and updateWeekSchedule use useCallback
  const fetchSchedule = useCallback(async (groupId?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await scheduleService.getClassSchedule(groupId);
      setScheduleData(data);
      
      // Process recovery days for this week
      const recoveryDays = data.recoveryDays || [];
      
      // Get weekend recovery days for current week
      const weekendRecoveryDays = recoveryDays.filter(rd => {
        const rdDate = new Date(rd.date);
        const startOfWeek = new Date(weekStart);
        const endOfWeek = new Date(weekStart);
        endOfWeek.setDate(weekStart.getDate() + 6);
        
        return rdDate >= startOfWeek && 
               rdDate <= endOfWeek && 
               (rdDate.getDay() === 0 || rdDate.getDay() === 6) &&
               rd.isActive && 
               (rd.groupId === '' || rd.groupId === settings.selectedGroupId);
      });

      // Build the schedule object with async/await
      const newWeekSchedule: Record<string, ScheduleItem[]> = {
        monday: await scheduleService.getScheduleForDay(data, 'monday', getDateForDay(weekStart, 0)),
        tuesday: await scheduleService.getScheduleForDay(data, 'tuesday', getDateForDay(weekStart, 1)),
        wednesday: await scheduleService.getScheduleForDay(data, 'wednesday', getDateForDay(weekStart, 2)),
        thursday: await scheduleService.getScheduleForDay(data, 'thursday', getDateForDay(weekStart, 3)),
        friday: await scheduleService.getScheduleForDay(data, 'friday', getDateForDay(weekStart, 4))
      };
      
      // Add recovery days if any
      if (weekendRecoveryDays.length > 0) {
        // Process each weekend recovery day one by one
        for (const rd of weekendRecoveryDays) {
          const dayKey = `weekend_${rd.date}`;
          newWeekSchedule[dayKey] = await scheduleService.getScheduleForDay(
            data, 
            rd.replacedDay.toLowerCase() as keyof ApiResponse['data'], 
            new Date(rd.date)
          );
        }
      }
      
      setWeekSchedule(newWeekSchedule);
      setIsLoading(false);
    } catch (error) {
      setError(t('schedule').error || 'Failed to load schedule');
      setIsLoading(false);
    }
  }, [t, weekStart, settings.selectedGroupId]);

  // Schedule update function wrapped in useCallback
  const updateWeekSchedule = useCallback(async () => {
    if (scheduleData) {
      const recoveryDays = scheduleData.recoveryDays || [];
      const weekendRecoveryDays = recoveryDays.filter(rd => {
        const rdDate = new Date(rd.date);
        const startOfWeek = new Date(weekStart);
        const endOfWeek = new Date(weekStart);
        endOfWeek.setDate(weekStart.getDate() + 6);
        
        return rdDate >= startOfWeek && 
               rdDate <= endOfWeek && 
               (rdDate.getDay() === 0 || rdDate.getDay() === 6) &&
               rd.isActive && 
               (rd.groupId === '' || rd.groupId === settings.selectedGroupId);
      });

      // Build the schedule object with async/await
      const newWeekSchedule: Record<string, ScheduleItem[]> = {
        monday: await scheduleService.getScheduleForDay(scheduleData, 'monday', getDateForDay(weekStart, 0)),
        tuesday: await scheduleService.getScheduleForDay(scheduleData, 'tuesday', getDateForDay(weekStart, 1)),
        wednesday: await scheduleService.getScheduleForDay(scheduleData, 'wednesday', getDateForDay(weekStart, 2)),
        thursday: await scheduleService.getScheduleForDay(scheduleData, 'thursday', getDateForDay(weekStart, 3)),
        friday: await scheduleService.getScheduleForDay(scheduleData, 'friday', getDateForDay(weekStart, 4))
      };
      
      // Add recovery days if any
      if (weekendRecoveryDays.length > 0) {
        // Process each weekend recovery day one by one
        for (const rd of weekendRecoveryDays) {
          const dayKey = `weekend_${rd.date}`;
          newWeekSchedule[dayKey] = await scheduleService.getScheduleForDay(
            scheduleData,
            rd.replacedDay.toLowerCase() as keyof ApiResponse['data'],
            new Date(rd.date)
          );
        }
      }
      
      setWeekSchedule(newWeekSchedule);
    }
  }, [scheduleData, weekStart, settings.selectedGroupId]);

  // Add useEffect for initial schedule load
  useEffect(() => {
    // Call the async fetchSchedule function
    const initializeSchedule = async () => {
      await fetchSchedule();
    };
    
    initializeSchedule();
  }, []);

  // Settings subscription effect for updates when settings change
  useEffect(() => {
    // Capture current references to avoid stale closures
    const currUpdateWeekSchedule = updateWeekSchedule;
    const currFetchSchedule = fetchSchedule;
    const currScheduleData = scheduleData;
    
    const updateHandler = async () => {
      // Get latest settings
      const newSettings = scheduleService.getSettings();
      const prevSettings = settingsRef.current;
      
      // Update the ref and state
      settingsRef.current = newSettings;
      setSettings(newSettings);
      
      // Skip updates if we don't have schedule data yet
      if (!currScheduleData) return;
      
      // Handle group ID change (full refetch needed)
      if (newSettings.selectedGroupId !== prevSettings.selectedGroupId) {
        currFetchSchedule(newSettings.selectedGroupId);
        return;
      }
      
      // Check if custom periods have changed
      const oldCustomPeriods = JSON.stringify(prevSettings.customPeriods);
      const newCustomPeriods = JSON.stringify(newSettings.customPeriods);
      
      if (oldCustomPeriods !== newCustomPeriods) {
        // Force update by calling updateWeekSchedule directly - now with await
        await currUpdateWeekSchedule();
        return;
      }
      
      // For all other changes, also update week schedule
      await currUpdateWeekSchedule();
    };
    
    // Subscribe to settings changes
    const unsubscribe = scheduleService.subscribe(updateHandler);
    
    return () => unsubscribe();
  }, [scheduleData, updateWeekSchedule, fetchSchedule]);

  // Calculate day dates for the week, including weekend recovery days if they exist
  const normalDayCount = 5; // Monday-Friday
  const recoveryDays = scheduleData?.recoveryDays || [];
  const weekendRecoveryDays = recoveryDays.filter(rd => {
    const rdDate = new Date(rd.date);
    const startOfWeek = new Date(weekStart);
    const endOfWeek = new Date(weekStart);
    endOfWeek.setDate(weekStart.getDate() + 6);
    
    return rdDate >= startOfWeek && 
           rdDate <= endOfWeek && 
           (rdDate.getDay() === 0 || rdDate.getDay() === 6) &&
           rd.isActive && 
           (rd.groupId === '' || rd.groupId === settings.selectedGroupId);
  });

  const totalDays = weekSchedule.monday.length > 0 ? normalDayCount + weekendRecoveryDays.length : normalDayCount;
  
  const dayDates = Array.from({ length: totalDays }, (_, i) => {
    // First 5 days are the normal weekdays
    if (i < normalDayCount) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      
      // Check if this is a recovery day
      const recoveryDay = recoveryDays.find(rd => {
        const rdDate = rd.date.split('-').map(Number);
        return date.getFullYear() === rdDate[0] && 
              date.getMonth() + 1 === rdDate[1] && 
              date.getDate() === rdDate[2] &&
              rd.isActive &&
              (rd.groupId === '' || rd.groupId === settings.selectedGroupId);
      });
      
      return {
        date,
        dayName: t('weekdays').short[date.getDay()],
        dayNumber: date.getDate(),
        isToday: date.toDateString() === new Date().toDateString(),
        recoveryDay: recoveryDay,
        isWeekend: false,
        dayKey: DAYS_MAP[date.getDay() as keyof typeof DAYS_MAP]
      };
    } else {
      // Weekend recovery days
      const weekendIndex = i - normalDayCount;
      const recoveryDay = weekendRecoveryDays[weekendIndex];
      const date = new Date(recoveryDay.date);
      
      return {
        date,
        dayName: t('weekdays').short[date.getDay()],
        dayNumber: date.getDate(),
        isToday: date.toDateString() === new Date().toDateString(),
        recoveryDay: recoveryDay,
        isWeekend: true,
        dayKey: `weekend_${recoveryDay.date}`
      };
    }
  });

  // Calculate time range
  const { min: firstHour, max: lastHour } = scheduleData
    ? getTimeRange(weekSchedule)
    : { min: 8, max: 17 };

  // Generate time slots
  const timeSlots = generateTimeSlots(firstHour, lastHour);

  // Calculate timetable dimensions
  const windowWidth = Dimensions.get('window').width;
  const hourHeight = 65; // Slightly more compact
  const timeColumnWidth = 30; // Even narrower time column
  const dayColumnWidth = (windowWidth - timeColumnWidth - 8) / Math.min(totalDays, 6); // Limit to 6 columns max for readability
  const timetableHeight = (lastHour - firstHour + 1) * hourHeight;

  // Get current hour for highlighting
  const nowHour = new Date().getHours();

  // Function to navigate between weeks with animation
  const navigateWeek = (direction: number) => {
    // Set slide direction for animation (original code)
    setSlideDirection(direction > 0 ? 'right' : 'left');
    
    // Update week offset
    setWeekOffset(prev => prev + direction);
    
    // Force an update of the week schedule
    if (scheduleData) {
      const updateScheduleForNewWeek = async () => {
        await updateWeekSchedule();
      };
      
      updateScheduleForNewWeek();
    }
  };

  // Fix goToCurrentWeek to keep original animation while handling async updates
  const goToCurrentWeek = () => {
    // Set slide direction for animation (original code)
    setSlideDirection(weekOffset > 0 ? 'left' : 'right');
    
    setWeekOffset(0);
    
    // Force an update of the week schedule
    if (scheduleData) {
      const updateCurrentWeek = async () => {
        await updateWeekSchedule();
      };
      
      updateCurrentWeek();
    }
  };

  // Function to get color for a subject with improved color palette
  const getSubjectColor = (subjectName: string): string => {
    // More vibrant, design-friendly color palette
    const colors = [
      '#4361EE', // Royal Blue
      '#F72585', // Pink
      '#4CC9F0', // Cyan
      '#7209B7', // Purple
      '#3A86FF', // Blue
      '#FB5607', // Orange
      '#06D6A0', // Teal
      '#FFBE0B', // Yellow
      '#8338EC', // Violet
      '#FF006E', // Hot Pink
      '#38B000', // Green
      '#FF5400', // Orange Red
    ];
    
    let hash = 0;
    for (let i = 0; i < subjectName.length; i++) {
      hash = subjectName.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  // Format week display text
  const weekDisplayText = () => {
    const weekStartFormatted = formatDate(weekStart, { day: 'numeric', month: 'short' });
    const weekEndDate = new Date(weekStart);
    weekEndDate.setDate(weekStart.getDate() + 4);
    const weekEndFormatted = formatDate(weekEndDate, { day: 'numeric', month: 'short' });
    return `${weekStartFormatted} - ${weekEndFormatted}`;
  };

  // Show loading state
  if (isLoading && !scheduleData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3478F6" />
          <Text style={styles.loadingText}>{t('schedule').loading}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show error state
  if (error && !scheduleData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.pageTitle}>{t('tabs').schedule}</Text>
          <View style={styles.weekInfo}>
            <Text style={styles.weekText}>
              {isEvenWeek ? t('schedule').evenWeek : t('schedule').oddWeek}
            </Text>
          </View>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <Text style={styles.pageTitle}>{t('tabs').schedule}</Text>
          <TouchableOpacity 
            style={styles.weekInfo}
            onPress={() => setIsMenuOpen(true)}
          >
            <Text style={styles.weekText}>
              {isEvenWeek ? t('schedule').evenWeek : t('schedule').oddWeek}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Week navigation controls */}
        <View style={styles.navigationControls}>
          <TouchableOpacity onPress={() => navigateWeek(-1)} style={styles.navButton}>
            <Text style={styles.navButtonText}>◀ {t('schedule').prevWeek}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={goToCurrentWeek} style={[styles.navButton, weekOffset === 0 && { opacity: 0.5 }]}>
            <Animated.View
              entering={FadeIn.duration(150)}
              exiting={FadeOut.duration(150)}
              layout={Layout.springify()}
            >
              <Text style={styles.navButtonText}>
                {weekDisplayText()}
              </Text>
            </Animated.View>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => navigateWeek(1)} style={styles.navButton}>
            <Text style={styles.navButtonText}>{t('schedule').nextWeek} ▶</Text>
          </TouchableOpacity>
        </View>

        {/* Days header with animation */}
        <Animated.View 
          style={styles.daysHeader}
          entering={FadeIn.duration(200)}
          layout={Layout.springify()}
        >
          {/* Empty space for time column alignment */}
          <View style={{ width: timeColumnWidth }} />
          
          {dayDates.map((day, index) => (
            <Animated.View 
              key={index} 
              style={[
                styles.dayColumn,
                { width: dayColumnWidth }, 
                day.isToday && styles.todayColumn,
                day.isWeekend && styles.weekendColumn
              ]}
              entering={FadeIn.duration(200).delay(index * 50)}
              layout={Layout.springify()}
            >
              <Text style={styles.dayName}>{day.dayName}</Text>
              <Text style={styles.dateText}>{day.dayNumber}</Text>
            </Animated.View>
          ))}
        </Animated.View>
      </View>

      <View style={styles.content}>
        <ScrollView
          ref={verticalScrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ minHeight: timetableHeight + 20 }}
        >
          <Animated.View 
            style={styles.timetableContainer}
            entering={FadeIn.duration(200)}
            layout={Layout.springify()}
          >
            {/* Time slots column */}
            <View style={[styles.timeColumn, { width: timeColumnWidth }]}>
              {timeSlots.map((hour, index) => {
                const formattedHour = formatHourByLocale(hour, settings.language === 'en');
                const isCurrentHour = hour === nowHour && weekOffset === 0;
                
                return (
                  <View 
                    key={index} 
                    style={[
                      styles.timeSlot, 
                      { height: hourHeight },
                      isCurrentHour && styles.currentHourHighlight
                    ]}
                  >
                    {typeof formattedHour === 'string' ? (
                      <Text style={styles.timeHour}>{formattedHour}</Text>
                    ) : (
                      <>
                        <Text style={styles.timeHour}>{formattedHour.hour}</Text>
                        <Text style={styles.timePeriod}>{formattedHour.period}</Text>
                      </>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Grid container - contains all days and grid lines */}
            <View style={[styles.gridContainer, { width: windowWidth - timeColumnWidth - 8 }]}>

              {/* Horizontal grid lines */}
              {timeSlots.map((hour, index) => (
                <View 
                  key={`grid-${index}`} 
                  style={[
                    styles.gridLine,
                    { 
                      top: index * hourHeight,
                      width: '100%'
                    },
                    hour === nowHour && weekOffset === 0 && { backgroundColor: 'rgba(52, 120, 246, 0.12)' }
                  ]}
                />
              ))}

              {/* Day columns */}
              {dayDates.map((day, dayIndex) => {
                const dayKey = day.dayKey;
                const dayItems = weekSchedule[dayKey as keyof typeof weekSchedule] || [];
                const isToday = day.isToday;
                const isWeekend = day.isWeekend;
                const isRecoveryDay = day.recoveryDay != null;

                // Filter items based on current week (odd/even)
                const filteredItems = dayItems.filter(item => 
                  item.isEvenWeek === undefined || item.isEvenWeek === isEvenWeek
                );

                return (
                  <Animated.View 
                    key={`day_${dayIndex}`} 
                    style={[
                      styles.dayContent, 
                      { 
                        width: dayColumnWidth,
                        height: timetableHeight,
                        left: dayIndex * dayColumnWidth,
                      },
                      isToday && { backgroundColor: 'rgba(52, 120, 246, 0.03)' },
                      (isRecoveryDay || isWeekend) && { backgroundColor: 'rgba(255, 87, 51, 0.05)' }
                    ]}
                    entering={FadeIn.duration(150).delay(dayIndex * 30)}
                    layout={Layout.springify()}
                  >

                    {/* Show recovery day info button when this is a recovery day */}
                    {isRecoveryDay && day.recoveryDay && (
                      <RecoveryDayInfo reason={day.recoveryDay.reason || ''} />
                    )}

                    {/* Render schedule items */}
                    {filteredItems.map((item, itemIndex) => {                      
                      const { top, height } = calculateItemPosition(
                        item.startTime,
                        item.endTime,
                        hourHeight,
                        firstHour
                      );
                      
                      // Use custom color for custom periods, otherwise generate color from class name
                      const color = item.isCustom && item.color ? item.color : getSubjectColor(item.className);
                      const isActive = isToday && isCurrentTimeSlot(item.startTime, item.endTime);

                      // Create simplified item with only necessary props
                      const simplifiedItem = {
                        startTime: item.startTime,
                        endTime: item.endTime,
                        className: item.className,
                        roomNumber: item.roomNumber
                      };

                      return (
                        <TimetableItem 
                          key={itemIndex}
                          item={simplifiedItem}
                          top={top}
                          height={height}
                          color={color}
                          isActive={isActive}
                          timeFormat={settings.language}
                        />
                      );
                    })}

                    {/* Only show empty message if there are no filtered items */}
                    {filteredItems.length === 0 && (
                      <Text style={[
                        styles.emptySchedule,
                        isRecoveryDay && { marginTop: 30 }
                      ]}>
                        {t('schedule').noClassesDay}
                      </Text>
                    )}

                    {/* Show current time indicator if it's today */}
                    {isToday && weekOffset === 0 && (
                      <CurrentTimeIndicator 
                        hourHeight={hourHeight}
                        firstHour={firstHour}
                        timestamp={currentTime.getTime()}
                        schedule={weekSchedule}
                      />
                    )}
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>
        </ScrollView>
      </View>

      <ViewModeMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        isEvenWeek={isEvenWeek}
        weekText={isEvenWeek ? t('schedule').evenWeek : t('schedule').oddWeek}
        currentView="week"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create<Styles>({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  content: {
    flex: 1,
  },
  headerContainer: {
    backgroundColor: '#141414',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
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
  navigationControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  navButton: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonText: {
    color: '#2C3DCD',
    fontSize: 14,
    fontWeight: '600',
  },
  daysHeader: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  dayColumn: {
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    position: 'relative',
  },
  todayColumn: {
    backgroundColor: 'rgba(44, 61, 205, 0.1)', // Using #2C3DCD with 0.1 opacity
  },
  recoveryIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 6,
    height: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recoveryDot: {
    fontSize: 8,
    color: '#FF5733',
  },
  recoveryDayInfo: {
    position: 'absolute',
    top: 0,
    left: 2,
    right: 2,
    zIndex: 10,
  },
  recoveryDayInfoButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    zIndex: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
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
    right: 5,
    width: 200,
    zIndex: 100,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  recoveryDayTooltip: {
    backgroundColor: '#1C1C1E', // Dark background
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
  } as TextStyle,
  recoveryDayTooltipReason: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.8,
  },
  dayName: {
    color: '#8A8A8D',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  dateText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  timetableContainer: {
    flexDirection: 'row',
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  timeColumn: {
    alignItems: 'center',
  },
  timeSlot: {
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  timeHour: {
    color: '#8A8A8D',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  timePeriod: {
    color: '#8A8A8D',
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: -3,
  },
  gridContainer: {
    position: 'relative',
    height: '100%',
  },
  gridLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  dayContent: {
    position: 'absolute',
    top: 0,
    marginHorizontal: 2,
    borderRadius: 8,
  },
  timetableItem: {
    position: 'absolute',
    left: 2,
    right: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  itemGradient: {
    flex: 1,
    padding: 6,
    justifyContent: 'space-between',
  },
  className: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomNumber: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '500',
    opacity: 0.9,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  currentTimeIndicator: {
		position: 'absolute',
		left: 0,
		right: 0,
		flexDirection: 'row',
		alignItems: 'center',
		zIndex: 50,
	},
	currentTimeIndicatorLine: {
		flex: 1,
		height: 2,
		backgroundColor: '#FF3B30',
		opacity: 0.7,
	},
	currentTimeIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF3B30',
    marginRight: 2,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
	},
	emptySchedule: {
    color: '#8A8A8D',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 30,
    opacity: 0.7,
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
	weekendColumn: {
    backgroundColor: 'rgba(255, 87, 51, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 87, 51, 0.2)',
	},
	currentHourHighlight: {
		backgroundColor: 'rgba(52, 120, 246, 0.08)', // Light blue background for current hour
	},
});
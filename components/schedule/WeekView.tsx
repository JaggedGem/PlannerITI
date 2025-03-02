import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Dimensions, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState, useRef } from 'react';
import { scheduleService, DAYS_MAP, ApiResponse } from '@/services/scheduleService';
import { useTranslation } from '@/hooks/useTranslation';
import { useTimeUpdate } from '@/hooks/useTimeUpdate';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import ViewModeMenu from './ViewModeMenu';

// Get week start (Monday) from current date
const getWeekStart = (date: Date): Date => {
  const result = new Date(date);
  const day = result.getDay() || 7; // Convert Sunday (0) to 7
  if (day !== 1) { // If not Monday
    result.setHours(-24 * (day - 1)); // Go back to Monday
  }
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

  Object.values(schedule).forEach(dayItems => {
    dayItems.forEach(item => {
      const startHour = parseInt(item.startTime.split(':')[0]);
      const endHour = parseInt(item.endTime.split(':')[0]);
      if (startHour < min) min = startHour;
      if (endHour > max) max = endHour;
    });
  });

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
    <View 
      style={[
        styles.timetableItem, 
        { 
          top, 
          height: Math.max(height, 35), // Slightly taller minimum height
        }
      ]}
    >
      <LinearGradient
        colors={isActive 
          ? [color, `${color}CC`] // More opacity for active
          : [`${color}99`, `${color}66`]} // Less opacity for inactive
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.itemGradient}
      >
        <Text style={styles.className} numberOfLines={1}>
          {item.className}
        </Text>
        <View style={styles.itemFooter}>
          <Text style={styles.roomNumber} numberOfLines={1}>
            {item.roomNumber}
          </Text>
        </View>
      </LinearGradient>
    </View>
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
  gridLine: ViewStyle;
  currentHourHighlight: ViewStyle;
};

export default function WeekView() {
    const [scheduleData, setScheduleData] = useState<ApiResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [settings, setSettings] = useState(scheduleService.getSettings());
    const [weekOffset, setWeekOffset] = useState(0);
    const { t, formatDate } = useTranslation();
    const currentTime = useTimeUpdate();
    const verticalScrollRef = useRef<ScrollView>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
  
    // Calculate current week start date (Monday)
    const weekStartDate = new Date();
    weekStartDate.setDate(weekStartDate.getDate() + (weekOffset * 7));
    const weekStart = getWeekStart(weekStartDate);
    
    // Check if current week is even
    const isEvenWeek = scheduleService.isEvenWeek(weekStartDate);
  
    // Schedule data fetching function
    const fetchSchedule = async (groupId?: string) => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await scheduleService.getClassSchedule(groupId);
        setScheduleData(data);
        setIsLoading(false);
      } catch (error) {
        // Silent error handling
        setIsLoading(false);
      }
    };
  
    // Calculate day dates for the week
    const dayDates = Array.from({ length: 5 }, (_, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      return {
        date,
        dayName: t('weekdays').short[date.getDay()],
        dayNumber: date.getDate(),
        isToday: date.toDateString() === new Date().toDateString()
      };
    });
  
    // Get schedule for all days in selected week
    const weekSchedule = {
      monday: scheduleData ? scheduleService.getScheduleForDay(scheduleData, 'monday') : [],
      tuesday: scheduleData ? scheduleService.getScheduleForDay(scheduleData, 'tuesday') : [],
      wednesday: scheduleData ? scheduleService.getScheduleForDay(scheduleData, 'wednesday') : [],
      thursday: scheduleData ? scheduleService.getScheduleForDay(scheduleData, 'thursday') : [],
      friday: scheduleData ? scheduleService.getScheduleForDay(scheduleData, 'friday') : [],
    };
  
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
    const dayColumnWidth = (windowWidth - timeColumnWidth - 16) / 5; // Account for padding
    const timetableHeight = (lastHour - firstHour + 1) * hourHeight;
  
    // Get current hour for highlighting
    const nowHour = new Date().getHours();
  
    // Effects for settings, data fetching, etc.
    useEffect(() => {
      const unsubscribe = scheduleService.subscribe(() => {
        const newSettings = scheduleService.getSettings();
        setSettings(newSettings);
        
        // Refresh schedule data when the group changes
        if (newSettings.selectedGroupId !== settings.selectedGroupId) {
          fetchSchedule(newSettings.selectedGroupId);
        }
      });
      return () => unsubscribe();
    }, [settings]);
  
    // Initial schedule data fetching effect
    useEffect(() => {
      fetchSchedule();
    }, []);
  
    // Scroll to current time on mount
    useEffect(() => {
      const scrollToCurrentTime = () => {
        if (verticalScrollRef.current && currentTime) {
          const now = new Date();
          const currentHour = now.getHours();
          
          if (currentHour >= firstHour && currentHour <= lastHour) {
            const scrollPosition = (currentHour - firstHour - 1) * hourHeight;
            verticalScrollRef.current.scrollTo({
              y: Math.max(0, scrollPosition),
              animated: true
            });
          }
        }
      };
      
      // Wait for layout to complete
      setTimeout(scrollToCurrentTime, 500);
    }, [firstHour, lastHour, scheduleData]);
  
    // Function to check if an item is currently active
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
  
    // Function to navigate between weeks
    const navigateWeek = (direction: number) => {
      setWeekOffset(prev => prev + direction);
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
  
    // Reset to current week
    const goToCurrentWeek = () => {
      setWeekOffset(0);
    };
  
    // Show loading state
    if (isLoading && !scheduleData) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3478F6" />
            <Text style={styles.loadingText}>Loading schedule...</Text>
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
              <Text style={styles.navButtonText}>{weekDisplayText()}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => navigateWeek(1)} style={styles.navButton}>
              <Text style={styles.navButtonText}>{t('schedule').nextWeek} ▶</Text>
            </TouchableOpacity>
          </View>
  
          {/* Days header */}
          <View style={styles.daysHeader}>
            {/* Empty space for time column alignment */}
            <View style={{ width: timeColumnWidth }} />
            
            {dayDates.map((day, index) => (
              <View 
                key={index} 
                style={[
                  styles.dayColumn,
                  { width: dayColumnWidth }, 
                  day.isToday && styles.todayColumn
                ]}
              >
                <Text style={styles.dayName}>{day.dayName}</Text>
                <Text style={styles.dateText}>{day.dayNumber}</Text>
              </View>
            ))}
          </View>
        </View>
  
        <View style={styles.content}>
          <ScrollView
            ref={verticalScrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ minHeight: timetableHeight + 20 }}
          >
            <View style={styles.timetableContainer}>
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
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map((day, dayIndex) => {
                  const dayItems = weekSchedule[day as keyof typeof weekSchedule] || [];
                  const isToday = dayDates[dayIndex].isToday;
  
                  // Filter items based on current week (odd/even)
                  const filteredItems = dayItems.filter(item => 
                    item.isEvenWeek === undefined || item.isEvenWeek === isEvenWeek
                  );
  
                  return (
                    <View 
                      key={day} 
                      style={[
                        styles.dayContent, 
                        { 
                          width: dayColumnWidth,
                          height: timetableHeight,
                          left: dayIndex * dayColumnWidth,
                        },
                        isToday && { backgroundColor: 'rgba(52, 120, 246, 0.03)' }
                      ]}
                    >
                      {/* Render schedule items */}
                      {filteredItems.map((item, itemIndex) => {
                        const { top, height } = calculateItemPosition(
                          item.startTime,
                          item.endTime,
                          hourHeight,
                          firstHour
                        );
                        const color = getSubjectColor(item.className);
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
  
                      {/* If day is empty, show empty message */}
                      {filteredItems.length === 0 && (
                        <Text style={styles.emptySchedule}>
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
                    </View>
                  );
                })}
              </View>
            </View>
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
      paddingHorizontal: 12,
      marginBottom: 12,
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
    },
    todayColumn: {
      backgroundColor: 'rgba(44, 61, 205, 0.1)', // Using #2C3DCD with 0.1 opacity
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
    currentHourHighlight: {
      backgroundColor: 'rgba(44, 61, 205, 0.08)',
      borderRadius: 4,
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
  });
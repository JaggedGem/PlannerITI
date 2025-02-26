import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Dimensions, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { scheduleService, DAYS_MAP, ApiResponse } from '@/services/scheduleService';
import { useTranslation } from '@/hooks/useTranslation';
import { useTimeUpdate } from '@/hooks/useTimeUpdate';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

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

type Styles = {
  container: ViewStyle;
  header: ViewStyle;
  headerTop: ViewStyle;
  monthYear: TextStyle;
  weekDays: ViewStyle;
  dayItem: ViewStyle;
  selectedDay: ViewStyle;
  dayName: TextStyle;
  dayNumber: TextStyle;
  selectedText: TextStyle;
  scheduleList: ViewStyle;
  scheduleItem: ViewStyle;
  classCard: ViewStyle;
  timeContainer: ViewStyle;
  time: TextStyle;
  classContent: ViewStyle;
  className: TextStyle;
  classDetails: ViewStyle;
  teacherName: TextStyle;
  roomNumber: TextStyle;
  weekInfo: ViewStyle;
  weekText: TextStyle;
  noSchedule: ViewStyle;
  noScheduleText: TextStyle;
  timeIndicatorContainer: ViewStyle;
  timeIndicator: ViewStyle;
  timeIndicatorLine: ViewStyle;
  timeIndicatorArrowContainer: ViewStyle;
  timeIndicatorArrow: ViewStyle;
  timeLeftText: TextStyle;
  timeWrapper: ViewStyle;
  timeDot: ViewStyle;
  classHeaderRow: ViewStyle;
  statusText: TextStyle;
  activeStatusText: TextStyle;
  loadingContainer: ViewStyle;
  loadingText: TextStyle;
  errorContainer: ViewStyle;
  errorText: TextStyle;
  weekDaysContent: ViewStyle;
  todayItem: ViewStyle;
  todayText: TextStyle;
  todayDot: ViewStyle;
  headerContainer: ViewStyle;
  contentContainer: ViewStyle;
  teacherContainer: ViewStyle;
  groupName: TextStyle;
};

type ScheduleItem = {
  isBreak?: boolean;
  startTime: string;
  endTime: string;
  className: string;
  teacherName: string;
  roomNumber: string;
  _height?: number;
  hasNextItem?: boolean;
};

export default function Schedule() {
  const [scheduleData, setScheduleData] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [settings, setSettings] = useState(scheduleService.getSettings());
  const isEvenWeek = scheduleService.isEvenWeek(selectedDate);
  const { t, formatDate } = useTranslation();
  const scrollViewRef = useRef<ScrollView>(null);
  const currentScrollIndex = useRef(3); // Default to center position

  // Generate 7 days for the week view starting from Monday
  const weekDays = useMemo(() => {
    const startOfWeek = new Date(selectedDate);
    startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay() + 1);

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      return {
        date,
        dayName: t('weekdays').short[date.getDay()],
        dayNumber: date.getDate(),
        isToday: date.toDateString() === new Date().toDateString()
      };
    });
  }, [selectedDate, t]);

  const getDaySchedule = useCallback(() => {
    if (!scheduleData) return [];
    const day = selectedDate.getDay();
    if (day === 0 || day === 6) return []; // Return empty array for weekends
    
    const dayKey = DAYS_MAP[day as keyof typeof DAYS_MAP];
    if (!dayKey) return [];
    return scheduleService.getScheduleForDay(scheduleData, dayKey);
  }, [scheduleData, selectedDate]);

  const todaySchedule = getDaySchedule();
  const currentTime = useTimeUpdate();

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

  const isCurrentTimeInSchedule = (item: ScheduleItem, nextItem: ScheduleItem | undefined): boolean => {
    const [startHours, startMinutes] = item.startTime.split(':').map(Number);
    const [endHours, endMinutes] = item.endTime.split(':').map(Number);
    const currentHours = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();

    const currentTimeInMinutes = currentHours * 60 + currentMinutes;
    const startTimeInMinutes = startHours * 60 + startMinutes;
    const endTimeInMinutes = endHours * 60 + endMinutes;

    return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes;
  };

  // Schedule data fetching function
  const fetchSchedule = async (groupId?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await scheduleService.getClassSchedule(groupId);
      setScheduleData(data);
    } catch (error) {
      setError('Unable to load schedule. Please try again later.');
      console.error('Failed to fetch schedule:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Scroll to today on mount
  useEffect(() => {
    if (scrollViewRef.current) {
      const today = new Date();
      const dayIndex = weekDays.findIndex(day => 
        day.date.toDateString() === today.toDateString()
      );
      if (dayIndex !== -1) {
        currentScrollIndex.current = dayIndex; // Set initial index
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({
            x: dayIndex * ((Dimensions.get('window').width - 40) / 5),
            animated: false
          });
        }, 100);
      }
    }
  }, [weekDays]);

  // Settings subscription effect
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

  const scrollToDate = useCallback((date: Date) => {
    if (!scrollViewRef.current) return;
    
    const dateIndex = weekDays.findIndex(
      d => d.date.toDateString() === date.toDateString()
    );
    
    if (dateIndex !== -1) {
      scrollViewRef.current.scrollTo({
        x: dateIndex * ((Dimensions.get('window').width - 40) / 5),
        animated: true
      });
    }
  }, [weekDays]);

  const handleDayPress = useCallback((date: Date) => {
    setSelectedDate(date);
    scrollToDate(date);
  }, [scrollToDate]);

  // Update weekDays when selectedDate changes
  useEffect(() => {
    scrollToDate(selectedDate);
  }, [selectedDate, scrollToDate]);

  const currentTimestamp = currentTime.getTime();

  const TimeIndicator = useCallback((props: TimeIndicatorProps & { hasNextItem?: boolean }) => {
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
      
      const position = progress * props.containerHeight;
      const showOnTop = position > props.containerHeight / 2;

      return {
        transform: [{ 
          translateY: withTiming(showOnTop ? -24 : 24, { duration: 300 }) 
        }],
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
              // Use item's end time to show minutes until current period ends
              const [endHours, endMinutes] = props.endTime.split(':').map(Number);
              
              const endTime = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                endHours,
                endMinutes
              );

              // Calculate minutes remaining in current period
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

  // Add error and loading states to the render
  if (isLoading && !scheduleData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerContainer}>
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={styles.monthYear}>
                {formatDate(selectedDate, { 
                  month: 'long',
                  year: 'numeric'
                })}
              </Text>
              <View style={styles.weekInfo}>
                <Text style={styles.weekText}>
                  {isEvenWeek ? t('schedule').evenWeek : t('schedule').oddWeek}
                </Text>
              </View>
            </View>
            <ScrollView 
              ref={scrollViewRef}
              horizontal 
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={(Dimensions.get('window').width - 40) / 5}
              style={styles.weekDays}
              contentContainerStyle={styles.weekDaysContent}
            >
              {weekDays.map((day, index) => (
                <TouchableOpacity 
                  key={index} 
                  onPress={() => handleDayPress(day.date)}
                  style={[
                    styles.dayItem,
                    day.date.getDate() === selectedDate.getDate() && styles.selectedDay,
                    day.isToday && day.date.getDate() !== selectedDate.getDate() && styles.todayItem
                  ]}
                >
                  <Text style={[
                    styles.dayName,
                    day.date.getDate() === selectedDate.getDate() && styles.selectedText,
                    day.isToday && day.date.getDate() !== selectedDate.getDate() && styles.todayText
                  ]}>
                    {day.dayName}
                  </Text>
                  <Text style={[
                    styles.dayNumber,
                    day.date.getDate() === selectedDate.getDate() && styles.selectedText,
                    day.isToday && day.date.getDate() !== selectedDate.getDate() && styles.todayText
                  ]}>
                    {day.dayNumber}
                  </Text>
                  {day.isToday && day.date.getDate() !== selectedDate.getDate() && <View style={styles.todayDot} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3478F6" />
          <Text style={styles.loadingText}>Loading schedule...</Text>
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
              <Text style={styles.monthYear}>
                {formatDate(selectedDate, { 
                  month: 'long',
                  year: 'numeric'
                })}
              </Text>
              <View style={styles.weekInfo}>
                <Text style={styles.weekText}>
                  {isEvenWeek ? t('schedule').evenWeek : t('schedule').oddWeek}
                </Text>
              </View>
            </View>
            <ScrollView 
              ref={scrollViewRef}
              horizontal 
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={(Dimensions.get('window').width - 40) / 5}
              style={styles.weekDays}
              contentContainerStyle={styles.weekDaysContent}
            >
              {weekDays.map((day, index) => (
                <TouchableOpacity 
                  key={index} 
                  onPress={() => handleDayPress(day.date)}
                  style={[
                    styles.dayItem,
                    day.date.getDate() === selectedDate.getDate() && styles.selectedDay,
                    day.isToday && day.date.getDate() !== selectedDate.getDate() && styles.todayItem
                  ]}
                >
                  <Text style={[
                    styles.dayName,
                    day.date.getDate() === selectedDate.getDate() && styles.selectedText,
                    day.isToday && day.date.getDate() !== selectedDate.getDate() && styles.todayText
                  ]}>
                    {day.dayName}
                  </Text>
                  <Text style={[
                    styles.dayNumber,
                    day.date.getDate() === selectedDate.getDate() && styles.selectedText,
                    day.isToday && day.date.getDate() !== selectedDate.getDate() && styles.todayText
                  ]}>
                    {day.dayNumber}
                  </Text>
                  {day.isToday && day.date.getDate() !== selectedDate.getDate() && <View style={styles.todayDot} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Handle empty schedule differently for weekends
  const isWeekend = selectedDate.getDay() === 0 || selectedDate.getDay() === 6;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.monthYear}>
              {formatDate(selectedDate, { 
                month: 'long',
                year: 'numeric'
              })}
            </Text>
            <View style={styles.weekInfo}>
              <Text style={styles.weekText}>
                {isEvenWeek ? t('schedule').evenWeek : t('schedule').oddWeek}
              </Text>
            </View>
          </View>
          <ScrollView 
            ref={scrollViewRef}
            horizontal 
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={(Dimensions.get('window').width - 40) / 5}
            style={styles.weekDays}
            contentContainerStyle={styles.weekDaysContent}
          >
            {weekDays.map((day, index) => (
              <TouchableOpacity 
                key={index} 
                onPress={() => handleDayPress(day.date)}
                style={[
                  styles.dayItem,
                  day.date.getDate() === selectedDate.getDate() && styles.selectedDay,
                  day.isToday && day.date.getDate() !== selectedDate.getDate() && styles.todayItem
                ]}
              >
                <Text style={[
                  styles.dayName,
                  day.date.getDate() === selectedDate.getDate() && styles.selectedText,
                  day.isToday && day.date.getDate() !== selectedDate.getDate() && styles.todayText
                ]}>
                  {day.dayName}
                </Text>
                <Text style={[
                  styles.dayNumber,
                  day.date.getDate() === selectedDate.getDate() && styles.selectedText,
                  day.isToday && day.date.getDate() !== selectedDate.getDate() && styles.todayText
                ]}>
                  {day.dayNumber}
                </Text>
                {day.isToday && day.date.getDate() !== selectedDate.getDate() && <View style={styles.todayDot} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      <View style={styles.contentContainer}>
        <ScrollView style={styles.scheduleList}>
          {isWeekend ? (
            <View style={styles.noSchedule}>
              <Text style={styles.noScheduleText}>{t('schedule').noClassesWeekend}</Text>
            </View>
          ) : todaySchedule.length === 0 ? (
            <View style={styles.noSchedule}>
              <Text style={styles.noScheduleText}>{t('schedule').noClassesDay}</Text>
            </View>
          ) : (
            todaySchedule.map((item, index) => {
              if (item.isEvenWeek !== undefined && item.isEvenWeek !== isEvenWeek) {
                return null;
              }

              const nextItem = todaySchedule[index + 1];
              const showTimeIndicator = isCurrentTimeInSchedule(item, nextItem);

              return (
                <View 
                  key={index} 
                  style={[styles.scheduleItem]}
                  onLayout={(event) => {
                    item._height = event.nativeEvent.layout.height;
                  }}
                >
                  <View style={[styles.classCard, {
                    borderLeftColor: getSubjectColor(item.className)
                  }]}>
                    <View style={[styles.timeContainer, {
                      borderRightColor: 'rgba(138, 138, 141, 0.2)'
                    }]}>
                      <View style={styles.timeWrapper}>
                        <View style={[styles.timeDot, { backgroundColor: getSubjectColor(item.className) }]} />
                        <Text style={[styles.time, { marginBottom: 'auto' }]}>
                          {formatTimeByLocale(item.startTime, settings.language === 'en')}
                        </Text>
                      </View>
                      <Text style={[styles.time, { marginTop: 'auto' }]}>
                        {formatTimeByLocale(item.endTime, settings.language === 'en')}
                      </Text>
                    </View>
                    <View style={styles.classContent}>
                      <View style={styles.classHeaderRow}>
                        <Text style={styles.className}>{item.className}</Text>
                        <Text style={[styles.statusText, showTimeIndicator && styles.activeStatusText]}>
                          {showTimeIndicator ? 'Now' : 
                            (() => {
                              const currentTimeMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
                              const [startHours, startMinutes] = item.startTime.split(':').map(Number);
                              const startTimeMinutes = startHours * 60 + startMinutes;
                              
                              if (currentTimeMinutes < startTimeMinutes) {
                                const previousItem = index > 0 ? todaySchedule[index - 1] : null;
                                if (previousItem && isCurrentTimeInSchedule(previousItem, item)) {
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
                                  return `In ${minutesUntilStart}m`;
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
                                  return `In ${minutesUntilStart}m`;
                                }
                              }
                              return '';
                            })()
                          }
                        </Text>
                      </View>
                      <View style={styles.classDetails}>
                        <View style={styles.teacherContainer}>
                          <Text style={styles.teacherName}>{item.teacherName}</Text>
                          {item.group && item.group !== 'Clasă intreagă' && item.group !== 'Clas� intreag�' && (
                            <Text style={styles.groupName}>
                              {item.group === 'Subgroup 1' ? t('subgroup').group1 : t('subgroup').group2}
                            </Text>
                          )}
                        </View>
                        <Text style={styles.roomNumber}>{t('schedule').room} {item.roomNumber}</Text>
                      </View>
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
      </View>
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
  
  let hash = 0;
  for (let i = 0; i < subjectName.length; i++) {
    hash = subjectName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

const styles = StyleSheet.create<Styles>({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    padding: 20,
    backgroundColor: '#141414',
    borderBottomRightRadius: 32,
    borderBottomLeftRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10, // Added to ensure header stays on top
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  monthYear: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 16,
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
  weekDays: {
    marginHorizontal: -20,
  },
  weekDaysContent: {
    paddingHorizontal: 16,
  },
  dayItem: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 16,
    width: (Dimensions.get('window').width - 40) / 5,
    backgroundColor: '#1A1A1A',
    marginHorizontal: 4,
    height: 80,
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
  todayItem: {
    borderColor: '#2C3DCD',
    borderWidth: 2,
  },
  dayName: {
    color: '#8A8A8D',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  dayNumber: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  selectedText: {
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
  scheduleList: {
    flex: 1,
    padding: 20,
    marginTop: -20, // Pull content up slightly
    backgroundColor: '#0A0A0A', // Ensure background color is consistent
  },
  scheduleItem: {
    marginBottom: 12, // Slightly reduced margin between items
    zIndex: 1, // Ensure cards are visible
  },
  classCard: {
    backgroundColor: '#232433',
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
    flexDirection: 'row',
    overflow: 'hidden',
    minHeight: 100, // Default height for classes
    marginVertical: 4, // Add spacing to prevent shadow clipping
  },
  timeContainer: {
    width: 80,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderRightWidth: 1,
    minHeight: 100,
  },
  time: {
    color: '#8A8A8D',
    fontSize: 12,
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
  },
  classDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  teacherName: {
    color: '#8A8A8D',
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  roomNumber: {
    color: '#8A8A8D',
    fontSize: 14,
  },
  noSchedule: {
    padding: 20,
    alignItems: 'center',
  },
  noScheduleText: {
    color: '#8A8A8D',
    fontSize: 16,
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
    left: 70,
    right: 0,
    height: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeIndicatorLine: {
    position: 'absolute',
    left: 6,
    right: 0,
    height: 2,
    backgroundColor: '#FF3B30',
    opacity: 0.5,
  },
  timeIndicatorArrowContainer: {
    position: 'absolute',
    left: 0,
    width: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
    borderRadius: 6,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  timeIndicatorArrow: { // Added missing style
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
    left: -30,
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
  },
  timeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 'auto',
  },
  timeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
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
  teacherContainer: {
    flex: 1,
    marginRight: 8,
  },
  groupName: {
    color: '#8A8A8D',
    fontSize: 12,
    marginTop: 4,
  },
});
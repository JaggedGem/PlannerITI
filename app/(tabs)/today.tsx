import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Dimensions, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { scheduleService, CLASS_ID, DAYS_MAP, ApiResponse } from '@/services/scheduleService';
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
};

export default function Today() {
  const [scheduleData, setScheduleData] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [settings, setSettings] = useState(scheduleService.getSettings());
  const currentDate = new Date();
  const isEvenWeek = scheduleService.isEvenWeek(selectedDate);
  const { t, formatDate } = useTranslation();

  // Generate 7 days centered around today
  const weekDates = useMemo(() => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 3); // Start 3 days before today

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      return {
        date,
        day: t('weekdays').short[date.getDay()],
        dateNum: date.getDate(),
        isToday: date.toDateString() === currentDate.toDateString()
      };
    });
  }, [currentDate, t]);

  const todaySchedule = scheduleData 
    ? scheduleService.getScheduleForDay(scheduleData, DAYS_MAP[selectedDate.getDay() as keyof typeof DAYS_MAP])
    : [];

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
    const [endHours, endMinutes] = nextItem ? nextItem.startTime.split(':').map(Number) : item.endTime.split(':').map(Number);
    const currentHours = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();

    const currentTimeInMinutes = currentHours * 60 + currentMinutes;
    const startTimeInMinutes = startHours * 60 + startMinutes;
    const endTimeInMinutes = endHours * 60 + endMinutes;

    return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes;
  };

  // Settings subscription effect
  useEffect(() => {
    const unsubscribe = scheduleService.subscribe(() => {
      setSettings(scheduleService.getSettings());
    });
    return () => unsubscribe();
  }, []);

  // Schedule data fetching effect
  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await scheduleService.getClassSchedule(CLASS_ID);
        setScheduleData(data);
      } catch (error) {
        setError('Unable to load schedule. Please try again later.');
        console.error('Failed to fetch schedule:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSchedule();
  }, []);

  const scrollViewRef = useRef<ScrollView>(null);
  
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
    // Only allow selecting dates within the 7-day range
    const dateTime = date.getTime();
    const minDate = weekDates[0].date.getTime();
    const maxDate = weekDates[6].date.getTime();
    
    if (dateTime >= minDate && dateTime <= maxDate) {
      setSelectedDate(date);
      scrollToDate(date);
    }
  }, [scrollToDate, weekDates]);

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

  const TimeIndicator = useCallback((props: TimeIndicatorProps) => {
    const animatedStyle = useAnimatedStyle(() => {
      'worklet';
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentSeconds = now.getSeconds();
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
    }, []);

    const animatedTimeStyle = useAnimatedStyle(() => {
      'worklet';
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentSeconds = now.getSeconds();
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
    }, [props.containerHeight]);

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
              style={styles.dateList}
              contentContainerStyle={styles.dateListContent}
            >
              {weekDates.map((date, index) => (
                <TouchableOpacity 
                  key={index} 
                  onPress={() => handleDatePress(date.date)}
                  style={[
                    styles.dateItem,
                    date.date.getDate() === selectedDate.getDate() && styles.selectedDay,
                    date.isToday && date.date.getDate() !== selectedDate.getDate() && styles.todayDateItem
                  ]}
                >
                  <Text style={[
                    styles.dateDay, 
                    date.date.getDate() === selectedDate.getDate() && styles.selectedDayText,
                    date.isToday && date.date.getDate() !== selectedDate.getDate() && styles.todayText
                  ]}>
                    {date.day}
                  </Text>
                  <Text style={[
                    styles.dateNumber, 
                    date.date.getDate() === selectedDate.getDate() && styles.selectedDayText,
                    date.isToday && date.date.getDate() !== selectedDate.getDate() && styles.todayText
                  ]}>
                    {date.dateNum}
                  </Text>
                  {date.isToday && date.date.getDate() !== selectedDate.getDate() && <View style={styles.todayDot} />}
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
              <Text style={styles.headerTitle}>
                {formatDate(selectedDate, { 
                  month: 'long',
                  day: 'numeric',
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
              style={styles.dateList}
              contentContainerStyle={styles.dateListContent}
            >
              {weekDates.map((date, index) => (
                <TouchableOpacity 
                  key={index} 
                  onPress={() => handleDatePress(date.date)}
                  style={[
                    styles.dateItem,
                    date.date.getDate() === selectedDate.getDate() && styles.selectedDay,
                    date.isToday && date.date.getDate() !== selectedDate.getDate() && styles.todayDateItem
                  ]}
                >
                  <Text style={[
                    styles.dateDay, 
                    date.date.getDate() === selectedDate.getDate() && styles.selectedDayText,
                    date.isToday && date.date.getDate() !== selectedDate.getDate() && styles.todayText
                  ]}>
                    {date.day}
                  </Text>
                  <Text style={[
                    styles.dateNumber, 
                    date.date.getDate() === selectedDate.getDate() && styles.selectedDayText,
                    date.isToday && date.date.getDate() !== selectedDate.getDate() && styles.todayText
                  ]}>
                    {date.dateNum}
                  </Text>
                  {date.isToday && date.date.getDate() !== selectedDate.getDate() && <View style={styles.todayDot} />}
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
            style={styles.dateList}
            contentContainerStyle={styles.dateListContent}
          >
            {weekDates.map((date, index) => (
              <TouchableOpacity 
                key={index} 
                onPress={() => handleDatePress(date.date)}
                style={[
                  styles.dateItem,
                  date.date.getDate() === selectedDate.getDate() && styles.selectedDay,
                  date.isToday && date.date.getDate() !== selectedDate.getDate() && styles.todayDateItem
                ]}
              >
                <Text style={[
                  styles.dateDay, 
                  date.date.getDate() === selectedDate.getDate() && styles.selectedDayText,
                  date.isToday && date.date.getDate() !== selectedDate.getDate() && styles.todayText
                ]}>
                  {date.day}
                </Text>
                <Text style={[
                  styles.dateNumber, 
                  date.date.getDate() === selectedDate.getDate() && styles.selectedDayText,
                  date.isToday && date.date.getDate() !== selectedDate.getDate() && styles.todayText
                ]}>
                  {date.dateNum}
                </Text>
                {date.isToday && date.date.getDate() !== selectedDate.getDate() && <View style={styles.todayDot} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      <View style={styles.contentContainer}>
        <ScrollView style={styles.scheduleContainer}>
          {isWeekend ? (
            <View style={styles.noSchedule}>
              <Text style={styles.noScheduleText}>{t('schedule').noClassesWeekend}</Text>
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
                    borderLeftColor: getSubjectColor(item.className),
                    backgroundColor: '#232433',
                    shadowOpacity: 0.1,
                    minHeight: 100,
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
                                  // If this is the first class and it hasn't started
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
                      <View style={styles.detailsContainer}>
                        <View style={styles.teacherContainer}>
                          <Text style={styles.teacherName}>{item.teacherName}</Text>
                          {item.group && item.group !== 'Clasă intreagă' && item.group !== 'Clas� intreag�' && (
                            <Text style={styles.groupName}>
                              {item.group === 'Subgroup 1' ? t('subgroup').group1 : t('subgroup').group2}
                            </Text>
                          )}
                        </View>
                        <View style={styles.roomContainer}>
                          <Text style={styles.roomNumber}>{t('schedule').room} {item.roomNumber}</Text>
                        </View>
                      </View>
                    </View>
                    {showTimeIndicator && (
                      <TimeIndicator 
                        startTime={item.startTime} 
                        endTime={item.endTime} // Use item's end time for the period indicator
                        containerHeight={item._height || 100}
                        hasNextItem={item.hasNextItem}
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
  teacherContainer: ViewStyle; // Changed from TextStyle to ViewStyle
  teacherName: TextStyle;
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
  weekInfo2: ViewStyle;
  weekText2: TextStyle;
  headerContainer: ViewStyle;
  contentContainer: ViewStyle;
  selectedDayText: TextStyle;  // Added missing style
  selectedDay: ViewStyle;
  groupName: TextStyle; // Added missing style
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 16,
    letterSpacing: 0.5,
  },
  weekInfo: {
    backgroundColor: '#2C3DCD', // More vibrant blue
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
    marginHorizontal: -20,
  },
  dateListContent: {
    paddingHorizontal: 16,
  },
  dateItem: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 16,
    width: (Dimensions.get('window').width - 40) / 5,
    backgroundColor: '#1A1A1A',
    marginHorizontal: 4,
    height: 80,
  },
  activeDateItem: {
    backgroundColor: '#2C3DCD',
    transform: [{ scale: 1.05 }],
    shadowColor: '#2C3DCD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  todayDateItem: {
    borderColor: '#2C3DCD',
    borderWidth: 2,
  },
  dateDay: {
    color: '#8A8A8D',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  dateNumber: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
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
    backgroundColor: '#0A0A0A', // Ensure background color is consistent
  },
  scheduleItem: {
    marginBottom: 16,
    zIndex: 1,
  },
  classCard: {
    backgroundColor: '#232433',
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
  missingBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 10,
  },
  missingText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
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
    left: 70,
    right: 0,
    height: 2,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
  timeIndicatorLine: {
    position: 'absolute',
    left: 6,
    right: 0,
    height: 2,
    backgroundColor: '#FF3B30',
    opacity: 0.7,
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
    shadowRadius: 6,
    elevation: 8,
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
});
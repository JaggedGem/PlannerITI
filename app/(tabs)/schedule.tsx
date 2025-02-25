import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Dimensions, ViewStyle, TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState, useCallback } from 'react';
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
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [settings, setSettings] = useState(scheduleService.getSettings());
  const isEvenWeek = scheduleService.isEvenWeek(selectedDate);
  const { t, formatDate } = useTranslation();

  const isWeekend = selectedDate.getDay() === 0 || selectedDate.getDay() === 6;
  
  // Get the start of the week (Monday)
  const startOfWeek = new Date(selectedDate);
  startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay() + 1);

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
    const [endHours, endMinutes] = nextItem ? nextItem.startTime.split(':').map(Number) : item.endTime.split(':').map(Number);
    const currentHours = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();

    const currentTimeInMinutes = currentHours * 60 + currentMinutes;
    const startTimeInMinutes = startHours * 60 + startMinutes;
    const endTimeInMinutes = endHours * 60 + endMinutes;

    return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes;
  };

  const weekDays = Array.from({ length: 5 }, (_, i) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    return {
      date,
      dayName: t('weekdays').short[date.getDay()],
      dayNumber: date.getDate(),
    };
  });

  const handleDayPress = (date: Date) => {
    setSelectedDate(date);
  };

  const TimeIndicator = useCallback((props: TimeIndicatorProps & { hasNextItem?: boolean }) => {
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

  // Add schedule data fetching effect
  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const data = await scheduleService.getClassSchedule(CLASS_ID);
        setScheduleData(data);
      } catch (error) {
        console.error('Failed to fetch schedule:', error);
      }
    };

    fetchSchedule();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
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
        <View style={styles.weekDays}>
          {weekDays.map((day, index) => (
            <TouchableOpacity 
              key={index} 
              onPress={() => handleDayPress(day.date)}
              style={[
                styles.dayItem,
                day.date.getDate() === selectedDate.getDate() && styles.selectedDay
              ]}
            >
              <Text style={[
                styles.dayName,
                day.date.getDate() === selectedDate.getDate() && styles.selectedText
              ]}>
                {day.dayName}
              </Text>
              <Text style={[
                styles.dayNumber,
                day.date.getDate() === selectedDate.getDate() && styles.selectedText
              ]}>
                {day.dayNumber}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

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
                    <View style={styles.classDetails}>
                      <Text style={styles.teacherName}>{item.teacherName}</Text>
                      <Text style={styles.roomNumber}>{t('schedule').room} {item.roomNumber}</Text>
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
    backgroundColor: '#1a1b26',
  },
  header: {
    padding: 20,
    backgroundColor: '#232433',
    borderBottomRightRadius: 24,
    borderBottomLeftRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  monthYear: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
    marginRight: 16,
  },
  weekInfo: {
    backgroundColor: '#3478F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  weekText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  weekDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  dayItem: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    minWidth: 40,
  },
  selectedDay: {
    backgroundColor: '#3478F6',
    transform: [{ scale: 1.05 }],
    shadowColor: '#3478F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 6,
  },
  dayName: {
    color: '#8A8A8D',
    fontSize: 12,
    fontWeight: '600',
  },
  dayNumber: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  selectedText: {
    color: '#fff',
  },
  scheduleList: {
    flex: 1,
    padding: 20,
  },
  scheduleItem: {
    marginBottom: 12, // Slightly reduced margin between items
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
});
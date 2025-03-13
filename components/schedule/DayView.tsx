import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Dimensions, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { scheduleService, DAYS_MAP, ApiResponse } from '@/services/scheduleService';
import { useTranslation } from '@/hooks/useTranslation';
import { useTimeUpdate } from '@/hooks/useTimeUpdate';
import Animated, { useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import ViewModeMenu from './ViewModeMenu';

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

export default function DayView() {
  const [scheduleData, setScheduleData] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [settings, setSettings] = useState(scheduleService.getSettings());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [todaySchedule, setTodaySchedule] = useState<any[]>([]);
  const currentDate = new Date();
  const isEvenWeek = scheduleService.isEvenWeek(selectedDate);
  const { t, formatDate } = useTranslation();
  const recoveryDay = useMemo(() => scheduleService.isRecoveryDay(selectedDate), [selectedDate]);

  // Generate current week dates (Monday to Friday, plus Saturday if it's a recovery day)
  const weekDates = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 is Sunday, 1 is Monday, etc.

    // Calculate the Monday date
    const monday = new Date(today);
    let daysFromMonday;

    // If it's weekend (Saturday or Sunday), calculate next week's Monday
    if (currentDay === 0 || currentDay === 6) {
      daysFromMonday = currentDay === 0 ? 1 : 2; // Sunday: +1, Saturday: +2
    } else {
      daysFromMonday = currentDay === 0 ? -6 : 1 - currentDay;
    }

    monday.setDate(today.getDate() + daysFromMonday);

    // First generate Monday-Friday
    const dates = Array.from({ length: 5 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      return {
        date,
        day: t('weekdays').short[date.getDay()],
        dateNum: date.getDate(),
        isToday: date.toDateString() === currentDate.toDateString(),
        isRecoveryDay: scheduleService.isRecoveryDay(date) !== null
      };
    });

    // Check if Saturday is a recovery day, and if so, add it to the array
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5); // Saturday is 5 days from Monday

    const saturdayIsRecovery = scheduleService.isRecoveryDay(saturday) !== null;

    if (saturdayIsRecovery) {
      dates.push({
        date: saturday,
        day: t('weekdays').short[saturday.getDay()],
        dateNum: saturday.getDate(),
        isToday: saturday.toDateString() === currentDate.toDateString(),
        isRecoveryDay: true
      });
    }

    return dates;
  }, [currentDate, t]);

  // Update schedule when date changes or scheduleData changes
  useEffect(() => {
    const updateSchedule = async () => {
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
        
        const daySchedule = await scheduleService.getScheduleForDay(
          scheduleData,
          dayKey,
          selectedDate // Pass the actual date to check for recovery days
        );
        setTodaySchedule(daySchedule);
      }
    };
    updateSchedule();
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

  // Schedule update function
  const updateSchedule = async () => {
    if (scheduleData) {
      const daySchedule = await scheduleService.getScheduleForDay(
        scheduleData,
        DAYS_MAP[selectedDate.getDay() as keyof typeof DAYS_MAP]
      );
      setTodaySchedule(daySchedule);
    }
  };

  // Settings subscription effect - update for both groupId and subgroup changes
  useEffect(() => {
    const unsubscribe = scheduleService.subscribe(() => {
      const newSettings = scheduleService.getSettings();
      setSettings(newSettings);

      // Refresh schedule data when the group changes or subgroup changes
      if (newSettings.selectedGroupId !== settings.selectedGroupId || newSettings.group !== settings.group) {
        fetchSchedule(newSettings.selectedGroupId);
      }
      // Just update today's schedule if only subgroup changed
      else if (newSettings.group !== settings.group && scheduleData) {
        updateSchedule();
      }
    });
    return () => unsubscribe();
  }, [settings.selectedGroupId, settings.group, scheduleData]);

  // Schedule data fetching effect
  useEffect(() => {
    fetchSchedule();
  }, []);

  const fetchSchedule = async (groupId?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await scheduleService.getClassSchedule(groupId);
      setScheduleData(data);
    } catch (error) {
      setError('Unable to load schedule. Please try again later.');
      // Silent error handling
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  };

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
    // Only allow selecting dates within the 5-day range (Monday to Friday)
    const dateTime = date.getTime();
    const minDate = weekDates[0].date.getTime();
    const maxDate = weekDates[5].date.getTime();

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

      // The height of the container is 80 (the height property of the time indicator is min-height: 25px);
      const position = progress * (props.containerHeight - 100) + 28; // We need to add the height of the item
      const showOnTop = -1 * position > props.containerHeight / 2; // Show the text only when we need to show time

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
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dateListScrollContent}
            >
              {weekDates.map((date, index) => (
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
                // Keep the recovery-info item but just use it to display the banner
                if (item.period === 'recovery-info') {
                  // We're already showing the recovery day banner separately
                  return null;
                }

                if (item.isEvenWeek !== undefined && item.isEvenWeek !== isEvenWeek) {
                  return null;
                }

                const nextItem = todaySchedule[index + 1];
                const showTimeIndicator = isCurrentTimeInSchedule(item);

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
                      }]}
                      >
                        <Text style={[styles.time, { marginBottom: 'auto' }]}>
                          {formatTimeByLocale(item.startTime, settings.language === 'en')}
                        </Text>
                        
                        {/* Dot positioned in the middle */}
                        <View style={styles.timeDotContainer}>
                          <View style={[styles.timeDot, { backgroundColor: getSubjectColor(item.className) }]} />
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
                                    return `${t('schedule').in} ${minutesUntilStart}m`;
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
    marginTop: 20,
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
    marginBottom: 8,
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
    backgroundColor: '#0A0A0A',
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
});
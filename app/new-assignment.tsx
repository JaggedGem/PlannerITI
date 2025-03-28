import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  TouchableOpacity, 
  Modal, 
  FlatList,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  StatusBar,
  Animated as RNAnimated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSpring, 
  withSequence,
  FadeIn,
  FadeOut,
  Layout,
  runOnJS
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { format, isToday, isTomorrow, isSameDay } from 'date-fns';
import { addAssignment, AssignmentType } from '../utils/assignmentStorage';
import { scheduleService, DAYS_MAP, Subject, CustomPeriod } from '../services/scheduleService';
import { useTranslation } from '@/hooks/useTranslation';

// Extend Subject type to include custom period properties
interface ExtendedSubject extends Subject {
  isCustomPeriod?: boolean;
  color?: string;
}

// Add this custom toggle component at the top level, before the NewAssignmentScreen function
const CustomToggle = ({ 
  value, 
  onValueChange, 
  disabled = false, 
  size = 'medium' 
}: { 
  value: boolean; 
  onValueChange: (value: boolean) => void; 
  disabled?: boolean;
  size?: 'small' | 'medium';
}) => {
  const animatedValue = React.useRef(new RNAnimated.Value(value ? 1 : 0)).current;
  
  React.useEffect(() => {
    RNAnimated.timing(animatedValue, {
      toValue: value ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [value]);
  
  const trackWidth = size === 'small' ? 40 : 50;
  const trackHeight = size === 'small' ? 22 : 28;
  const thumbSize = size === 'small' ? 18 : 24;
  const thumbMargin = (trackHeight - thumbSize) / 2;
  
  const thumbPosition = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [thumbMargin, trackWidth - thumbSize - thumbMargin]
  });
  
  const trackColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: disabled ? ['#222222', '#444444'] : ['#2A2A2A', '#2C3DCD']
  });
  
  return (
    <TouchableOpacity 
      activeOpacity={0.8}
      onPress={() => !disabled && onValueChange(!value)}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <RNAnimated.View 
        style={{
          width: trackWidth,
          height: trackHeight,
          borderRadius: trackHeight / 2,
          backgroundColor: trackColor,
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: value ? '#2C3DCD' : '#4D4D4D',
        }}
      >
        <RNAnimated.View 
          style={{
            width: thumbSize,
            height: thumbSize,
            borderRadius: thumbSize / 2,
            backgroundColor: disabled ? '#777777' : value ? '#FFFFFF' : '#f4f3f4',
            transform: [{ translateX: thumbPosition }],
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.2,
            shadowRadius: 1,
            elevation: 2,
          }}
        />
      </RNAnimated.View>
    </TouchableOpacity>
  );
};

// Add Day names array for the mini calendar - will be replaced with translations inside component
const DAYS_DEFAULT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Basic structure for quick options, will be populated with translations inside component
const QUICK_DATE_OPTIONS_DEFAULT = [
  { label: 'Today', days: 0 },
  { label: 'Tomorrow', days: 1 },
  { label: 'Next Week', days: 7 },
  { label: 'In 2 Weeks', days: 14 },
];

// Basic structure for time presets, will be populated with translations inside component
const TIME_PRESETS_DEFAULT = [
  { label: '1st Period', hour: 8, minute: 0 },
  { label: '2nd Period', hour: 9, minute: 30 },
  { label: '3rd Period', hour: 11, minute: 20 },
  { label: '4th Period', hour: 12, minute: 50 },
  { label: '5th Period', hour: 14, minute: 20 },
];

// Extract QuickOption component outside DatePicker for better stability
const QuickOption = React.memo(({ 
  days, 
  label, 
  index, 
  selectedDate,
  onSelect 
}: { 
  days: number; 
  label: string; 
  index: number;
  selectedDate: Date;
  onSelect: (days: number) => void;
}) => {
  const isSelected = React.useMemo(() => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    return isSameDay(targetDate, selectedDate);
  }, [selectedDate.toDateString(), days]);

  return (
    <Animated.View
      entering={FadeIn.delay(index * 40).duration(150).withCallback((_finished) => {})}
      layout={Layout.duration(300).springify().mass(0.8)}
    >
      <TouchableOpacity
        style={[
          styles.quickDateButton,
          isSelected && styles.quickDateButtonSelected
        ]}
        onPress={() => onSelect(days)}
      >
        <Text style={[
          styles.quickDateButtonText,
          isSelected && styles.quickDateButtonTextSelected
        ]}>
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

// Add DatePicker component
const DatePicker = ({ 
  selectedDate, 
  onDateChange,
  formatDate,
  days = DAYS_DEFAULT,
  quickDateOptions = QUICK_DATE_OPTIONS_DEFAULT,
  currentLanguage
}: { 
  selectedDate: Date; 
  onDateChange: (date: Date) => void;
  formatDate: (date: Date) => string;
  days?: string[];
  quickDateOptions?: { label: string, days: number }[];
  currentLanguage: string;
}) => {
  const [calendarMonth, setCalendarMonth] = useState(new Date(selectedDate));
  const [showCalendar, setShowCalendar] = useState(false);
  const chevronRotation = useSharedValue(0);
  const monthTransition = useSharedValue(0);
  const selectedCellScale = useSharedValue(1);
  const calendarOpacity = useSharedValue(0);
  const calendarScale = useSharedValue(0.95);
  
  // Update chevron rotation when calendar visibility changes
  useEffect(() => {
    chevronRotation.value = withSpring(showCalendar ? 1 : 0, {
      damping: 15,
      stiffness: 150,
      mass: 0.6,
    });
    
    // Animate calendar appearance
    if (showCalendar) {
      calendarOpacity.value = withTiming(1, { duration: 180 });
      calendarScale.value = withSpring(1, { 
        damping: 14,
        stiffness: 200,
        mass: 0.7 
      });
    } else {
      calendarOpacity.value = withTiming(0, { duration: 150 });
      calendarScale.value = withTiming(0.95, { duration: 150 });
    }
  }, [showCalendar]);
  
  // Animate chevron rotation
  const chevronStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { rotate: `${chevronRotation.value * 180}deg` }
      ]
    };
  });

  // Update calendar to match selected date's month
  useEffect(() => {
    // Only update if the month is different than the current view
    if (calendarMonth.getMonth() !== selectedDate.getMonth() || 
        calendarMonth.getFullYear() !== selectedDate.getFullYear()) {
      // Trigger month change animation
      monthTransition.value = selectedDate > calendarMonth ? 1 : -1;
      
      // Then update the month
      setCalendarMonth(new Date(selectedDate));
      
      // Reset transition value after animation
      setTimeout(() => {
        monthTransition.value = 0;
      }, 300);
    }
  }, [selectedDate]);
  
  // Month change animation style
  const monthAnimStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { 
          translateX: withSpring(
            monthTransition.value * 0, // No horizontal movement
            { damping: 18, stiffness: 150 }
          ) 
        },
        { 
          scale: withSpring(
            monthTransition.value === 0 ? 1 : 0.96, 
            { damping: 15, stiffness: 180 }
          ) 
        },
        {
          translateY: withSpring(
            monthTransition.value === 0 ? 0 : monthTransition.value * 10,
            { damping: 15, stiffness: 180 }
          )
        }
      ],
      opacity: withSpring(
        monthTransition.value === 0 ? 1 : 0.7,
        { damping: 20, stiffness: 180 }
      )
    };
  });
  
  // Calendar container animation style
  const calendarContainerStyle = useAnimatedStyle(() => {
    return {
      opacity: calendarOpacity.value,
      transform: [
        { scale: calendarScale.value }
      ],
      height: showCalendar ? 'auto' : 0,
      overflow: 'hidden'
    };
  });
  
  // Generate calendar days for current month view
  const generateCalendarDays = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    
    // Get first day of month and total days in month
    const firstDayOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Get the day of week for the first day (0 = Sunday, 6 = Saturday)
    const firstDayOfWeek = firstDayOfMonth.getDay();
    
    // Create array for calendar grid (6 rows x 7 columns max)
    const calendarDays = [];
    
    // Previous month days to show
    for (let i = 0; i < firstDayOfWeek; i++) {
      const prevMonthDate = new Date(year, month, -firstDayOfWeek + i + 1);
      calendarDays.push({
        date: prevMonthDate,
        isCurrentMonth: false,
        isSelected: false,
        isToday: isSameDay(prevMonthDate, new Date())
      });
    }
    
    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      calendarDays.push({
        date,
        isCurrentMonth: true,
        isSelected: isSameDay(date, selectedDate),
        isToday: isSameDay(date, new Date())
      });
    }
    
    // Next month days to fill the grid (if needed)
    const totalDaysShown = calendarDays.length;
    const remainingDays = 42 - totalDaysShown; // 6 rows x 7 days
    
    for (let i = 1; i <= remainingDays; i++) {
      const nextMonthDate = new Date(year, month + 1, i);
      calendarDays.push({
        date: nextMonthDate,
        isCurrentMonth: false,
        isSelected: false,
        isToday: isSameDay(nextMonthDate, new Date())
      });
    }
    
    return calendarDays;
  };
  
  const isSameDay = (date1: Date, date2: Date) => {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
  };
  
  const navigateMonth = (direction: number) => {
    // Set transition direction for animation
    monthTransition.value = direction;
    
    // Update the month
    const newMonth = new Date(calendarMonth);
    newMonth.setMonth(calendarMonth.getMonth() + direction);
    setCalendarMonth(newMonth);
    
    // Reset transition value after animation
    setTimeout(() => {
      monthTransition.value = 0;
    }, 300);
  };
  
  const selectDate = (date: Date) => {
    // Animate the selected cell with a pulse effect
    selectedCellScale.value = withSequence(
      withTiming(1.1, { duration: 120 }),
      withTiming(1, { duration: 120 })
    );
    
    const newDate = new Date(selectedDate);
    newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    onDateChange(newDate);
    
    // Animate calendar closing smoothly instead of abrupt timeout
    calendarOpacity.value = withTiming(0, { duration: 75 });
    calendarScale.value = withTiming(0.95, { duration: 75 }, () => {
      // Only hide calendar after animation completes
      runOnJS(setShowCalendar)(false);
    });
  };
  
  // Select quick option function with memoization to preserve stability
  const selectQuickOption = React.useCallback((days: number) => {
    const today = new Date();
    const newDate = new Date();
    newDate.setDate(today.getDate() + days);
    
    // If the new date is in a different month than current view, 
    // set the proper direction for transition animation
    if (newDate.getMonth() !== calendarMonth.getMonth() || 
        newDate.getFullYear() !== calendarMonth.getFullYear()) {
      
      monthTransition.value = newDate > calendarMonth ? 1 : -1;
      setCalendarMonth(new Date(newDate));
      
      // Reset transition value after animation
      setTimeout(() => {
        monthTransition.value = 0;
      }, 300);
    }
    
    // Update the selected date
    const updatedDate = new Date(selectedDate);
    updatedDate.setFullYear(newDate.getFullYear(), newDate.getMonth(), newDate.getDate());
    onDateChange(updatedDate);
  }, [calendarMonth, selectedDate, onDateChange]);
  
  const calendarDays = generateCalendarDays();
  
  // Check if today is in current view
  const today = new Date();
  const isCurrentDayInView = calendarDays.some(day => 
    day.isCurrentMonth && isSameDay(day.date, today)
  );
  
  return (
    <View style={styles.datePickerContainer}>
      <View style={styles.dateSelectionHeader}>
        <TouchableOpacity
          style={styles.dateDisplay}
          onPress={() => setShowCalendar(!showCalendar)}
        >
          <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
          <Animated.View style={chevronStyle}>
            <Ionicons
              name="chevron-down"
              size={20}
              color="#FFFFFF"
            />
          </Animated.View>
        </TouchableOpacity>
      </View>
      
      <View style={styles.quickOptionsContainer}>
        <ScrollView 
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickOptionsScrollContent}
        >
          {quickDateOptions.map((option, index) => (
            <QuickOption
              key={`quick-option-${option.days}`}
              days={option.days}
              label={option.label}
              index={index}
              selectedDate={selectedDate}
              onSelect={selectQuickOption}
            />
          ))}
        </ScrollView>
      </View>
      
      <Animated.View style={calendarContainerStyle}>
        <Animated.View style={styles.calendarContainer}>
          <View style={styles.calendarHeader}>
            <TouchableOpacity onPress={() => navigateMonth(-1)}>
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.calendarTitle}>
              {calendarMonth.toLocaleDateString(currentLanguage, { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity onPress={() => navigateMonth(1)}>
              <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.calendarDaysHeader}>
            {days.map((day, index) => (
              <Text key={index} style={styles.calendarDayHeaderText}>{day}</Text>
            ))}
          </View>
          
          <Animated.View 
            style={[styles.calendarGrid, monthAnimStyle]}
          >
            {calendarDays.map((day, index) => {
              const isToday = isSameDay(day.date, new Date());
              const isSelected = isSameDay(day.date, selectedDate);
              
              // Use static styles instead of animated styles for each cell to avoid performance issues
              return (
                <View key={index} style={styles.calendarDayWrapper}>
                  <TouchableOpacity
                    style={[
                      styles.calendarDay,
                      isSelected && styles.calendarDaySelected,
                      isToday && styles.calendarDayToday,
                      !day.isCurrentMonth && styles.calendarDayOtherMonth
                    ]}
                    onPress={() => selectDate(day.date)}
                    disabled={!day.isCurrentMonth}
                  >
                    <Text style={[
                      styles.calendarDayText,
                      !day.isCurrentMonth && styles.calendarDayTextOtherMonth,
                      isToday && !isSelected && styles.calendarDayTextToday,  // Only apply today text color if not selected
                      isSelected && styles.calendarDayTextSelected,  // Always apply selected text style last
                    ]}>
                      {day.date.getDate()}
                    </Text>
                    {isToday && <View style={styles.todayDot} />}
                  </TouchableOpacity>
                </View>
              );
            })}
          </Animated.View>
          
          {/* Show "Today" button if current day is not in view */}
          {!isCurrentDayInView && (
            <TouchableOpacity
              style={styles.todayButton}
              onPress={() => {
                monthTransition.value = new Date() > calendarMonth ? 1 : -1;
                const today = new Date();
                setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                setTimeout(() => {
                  monthTransition.value = 0;
                }, 300);
              }}
            >
              <Text style={styles.todayButtonText}>Today</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
};

// Add TimePicker component
const TimePicker = ({ 
  selectedTime, 
  onTimeChange,
  timePresets = TIME_PRESETS_DEFAULT
}: { 
  selectedTime: Date; 
  onTimeChange: (date: Date) => void;
  timePresets?: { label: string, hour: number, minute: number }[];
}) => {
  const { currentLanguage } = useTranslation();
  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);
  
  // Animation shared values
  const hourRotation = useSharedValue(0);
  const minuteRotation = useSharedValue(0);
  const amPmScale = useSharedValue(1);
  const presetButtonScale = useSharedValue(1);
  
  // Use 24-hour format for Romanian and Russian
  const shouldUse24HourFormat = currentLanguage === 'ro' || currentLanguage === 'ru';
  
  const getTimeString = (date: Date) => {
    if (shouldUse24HourFormat) {
      // 24-hour format for Romanian and Russian
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    } else {
      // 12-hour format with AM/PM for English
      const hours = date.getHours() > 12 ? date.getHours() - 12 : date.getHours() === 0 ? 12 : date.getHours();
      const minutes = date.getMinutes() < 10 ? `0${date.getMinutes()}` : date.getMinutes();
      const period = date.getHours() >= 12 ? 'PM' : 'AM';
      return `${hours}:${minutes} ${period}`;
    }
  };
  
  const updateHour = (hour: number) => {
    // Animate hour change
    hourRotation.value = withSequence(
      withTiming(5, { duration: 100 }),
      withTiming(0, { duration: 100 })
    );
    
    const newTime = new Date(selectedTime);
    
    if (shouldUse24HourFormat) {
      // In 24-hour format, just set the hour directly
      newTime.setHours(hour);
    } else {
      // In 12-hour format, adjust based on AM/PM
      const isPM = selectedTime.getHours() >= 12;
      const adjustedHour = isPM ? (hour === 12 ? 12 : hour + 12) : (hour === 12 ? 0 : hour);
      newTime.setHours(adjustedHour);
    }
    
    onTimeChange(newTime);
  };
  
  const updateMinute = (minute: number) => {
    // Animate minute change
    minuteRotation.value = withSequence(
      withTiming(5, { duration: 100 }),
      withTiming(0, { duration: 100 })
    );
    
    const newTime = new Date(selectedTime);
    newTime.setMinutes(minute);
    onTimeChange(newTime);
  };
  
  const toggleAmPm = () => {
    // Animate AM/PM toggle
    amPmScale.value = withSequence(
      withTiming(0.9, { duration: 80 }),
      withTiming(1.1, { duration: 100 }),
      withTiming(1, { duration: 100 })
    );
    
    const newTime = new Date(selectedTime);
    const currentHours = newTime.getHours();
    const newHours = currentHours >= 12 
      ? (currentHours === 12 ? 0 : currentHours - 12)
      : (currentHours === 0 ? 12 : currentHours + 12);
    newTime.setHours(newHours);
    onTimeChange(newTime);
  };
  
  // Hour animation style
  const hourAnimStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: hourRotation.value }
      ]
    };
  });
  
  // Minute animation style
  const minuteAnimStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: minuteRotation.value }
      ]
    };
  });
  
  // AM/PM animation style
  const amPmAnimStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: amPmScale.value }
      ]
    };
  });
  
  // Animation for preset buttons
  const animatePresetButton = () => {
    presetButtonScale.value = withSequence(
      withTiming(0.95, { duration: 80 }),
      withTiming(1, { duration: 120 })
    );
  };
  
  // Remove the custom renderPresets function and restore the original ScrollView with mapping
  return (
    <View style={styles.timePickerContainer}>
      <Animated.Text 
        style={[styles.timeDisplay, { 
          fontSize: 24, 
          fontWeight: '600',
          textAlign: 'center',
          marginBottom: 15
        }]}
        entering={FadeIn.duration(200)}
      >
        {getTimeString(selectedTime)}
      </Animated.Text>
      
      <View style={styles.timePresetContainer}>
        <ScrollView 
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.timePresetScrollContent}
        >
          {timePresets.map((preset, index) => {
            const presetDate = new Date(selectedTime);
            presetDate.setHours(preset.hour, preset.minute);
            const presetTimeString = getTimeString(presetDate);
            const isSelected = selectedTime.getHours() === preset.hour && 
                           selectedTime.getMinutes() === preset.minute;
            
            return (
              <Animated.View
                key={index}
                entering={FadeIn.delay(index * 50).duration(180)}
              >
                <TouchableOpacity
                  style={[
                    styles.timePresetButton,
                    isSelected && styles.timePresetButtonSelected
                  ]}
                  onPress={() => {
                    animatePresetButton();
                    const newTime = new Date(selectedTime);
                    newTime.setHours(preset.hour, preset.minute);
                    onTimeChange(newTime);
                  }}
                >
                  <Text style={[
                    styles.timePresetButtonText,
                    isSelected && styles.timePresetButtonTextSelected
                  ]}>
                    {preset.label} ({presetTimeString})
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </ScrollView>
      </View>
      
      <View style={styles.timeWheelContainer}>
        <View style={styles.timeWheelGroup}>
          <Text style={styles.timeWheelLabel}>Hour</Text>
          <View style={styles.timeWheel}>
            <TouchableOpacity 
              style={styles.timeWheelButton}
              onPress={() => {
                if (shouldUse24HourFormat) {
                  // 24-hour format logic
                  const currentHour = selectedTime.getHours();
                  const nextHour = currentHour === 23 ? 0 : currentHour + 1;
                  updateHour(nextHour);
                } else {
                  // 12-hour format logic
                  const currentHour = selectedTime.getHours() % 12 || 12;
                  const nextHour = currentHour === 12 ? 1 : currentHour + 1;
                  updateHour(nextHour);
                }
              }}
            >
              <Ionicons name="chevron-up" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            
            <Animated.Text style={[styles.timeWheelText, hourAnimStyle]}>
              {shouldUse24HourFormat 
                ? selectedTime.getHours().toString().padStart(2, '0') 
                : (selectedTime.getHours() % 12 || 12)}
            </Animated.Text>
            
            <TouchableOpacity 
              style={styles.timeWheelButton}
              onPress={() => {
                if (shouldUse24HourFormat) {
                  // 24-hour format logic
                  const currentHour = selectedTime.getHours();
                  const prevHour = currentHour === 0 ? 23 : currentHour - 1;
                  updateHour(prevHour);
                } else {
                  // 12-hour format logic
                  const currentHour = selectedTime.getHours() % 12 || 12;
                  const prevHour = currentHour === 1 ? 12 : currentHour - 1;
                  updateHour(prevHour);
                }
              }}
            >
              <Ionicons name="chevron-down" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
        
        <Text style={styles.timeWheelSeparator}>:</Text>
        
        <View style={styles.timeWheelGroup}>
          <Text style={styles.timeWheelLabel}>Minute</Text>
          <View style={styles.timeWheel}>
            <TouchableOpacity 
              style={styles.timeWheelButton}
              onPress={() => {
                const currentMinute = selectedTime.getMinutes();
                const nextMinute = Math.min(55, currentMinute + 5);
                if (currentMinute === 55) updateMinute(0);
                else updateMinute(nextMinute);
              }}
            >
              <Ionicons name="chevron-up" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            
            <Animated.Text style={[styles.timeWheelText, minuteAnimStyle]}>
              {selectedTime.getMinutes() < 10 
                ? `0${selectedTime.getMinutes()}` 
                : selectedTime.getMinutes()}
            </Animated.Text>
            
            <TouchableOpacity 
              style={styles.timeWheelButton}
              onPress={() => {
                const currentMinute = selectedTime.getMinutes();
                if (currentMinute === 0) updateMinute(55);
                else updateMinute(Math.max(0, currentMinute - 5));
              }}
            >
              <Ionicons name="chevron-down" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
        
        {!shouldUse24HourFormat && (
          <View style={styles.timeWheelGroup}>
            <Text style={styles.timeWheelLabel}>AM/PM</Text>
            <Animated.View style={amPmAnimStyle}>
              <TouchableOpacity 
                style={styles.amPmToggle}
                onPress={toggleAmPm}
              >
                <Text style={styles.amPmToggleText}>
                  {selectedTime.getHours() >= 12 ? 'PM' : 'AM'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}
      </View>
    </View>
  );
};

// Define keyword mappings for different languages
const ASSIGNMENT_TYPE_KEYWORDS = {
  en: {
    [AssignmentType.HOMEWORK]: ['homework', 'assignment', 'exercise', 'task', 'work'],
    [AssignmentType.TEST]: ['test', 'quiz', 'evaluation', 'assessment'],
    [AssignmentType.EXAM]: ['exam', 'final', 'midterm', 'examination'],
    [AssignmentType.PROJECT]: ['project', 'design', 'develop'],
    [AssignmentType.QUIZ]: ['quiz', 'questionnaire', 'questions'],
    [AssignmentType.LAB]: ['lab', 'laboratory', 'experiment', 'practical'],
    [AssignmentType.ESSAY]: ['essay', 'paper', 'composition', 'writing', 'report'],
    [AssignmentType.PRESENTATION]: ['presentation', 'slides', 'speech', 'talk', 'demo']
  },
  ro: {
    [AssignmentType.HOMEWORK]: ['temă', 'tema', 'exercițiu', 'exercitiu', 'sarcină', 'sarcina', 'lucrare'],
    [AssignmentType.TEST]: ['test', 'testare', 'evaluare', 'verificare'],
    [AssignmentType.EXAM]: ['examen', 'examinare', 'sesiune', 'finală', 'finala'],
    [AssignmentType.PROJECT]: ['proiect', 'proiecte', 'plan'],
    [AssignmentType.QUIZ]: ['quiz', 'chestionar', 'întrebări', 'intrebari', 'test rapid'],
    [AssignmentType.LAB]: ['laborator', 'lab', 'experiment', 'practică', 'practica'],
    [AssignmentType.ESSAY]: ['eseu', 'compunere', 'lucrare', 'redactare', 'articol'],
    [AssignmentType.PRESENTATION]: ['prezentare', 'discurs', 'slide', 'expunere', 'slideuri']
  },
  ru: {
    [AssignmentType.HOMEWORK]: ['домашняя', 'домашка', 'задание', 'упражнение', 'работа', 'домашнее'],
    [AssignmentType.TEST]: ['тест', 'контрольная', 'проверка', 'контроль'],
    [AssignmentType.EXAM]: ['экзамен', 'сессия', 'итоговый', 'финальный'],
    [AssignmentType.PROJECT]: ['проект', 'разработка', 'проектирование'],
    [AssignmentType.QUIZ]: ['опрос', 'викторина', 'тест', 'вопросы'],
    [AssignmentType.LAB]: ['лабораторная', 'лаба', 'эксперимент', 'практика'],
    [AssignmentType.ESSAY]: ['эссе', 'сочинение', 'письмо', 'статья', 'доклад'],
    [AssignmentType.PRESENTATION]: ['презентация', 'доклад', 'слайды', 'выступление']
  }
};

export default function NewAssignmentScreen() {
  const { t, currentLanguage } = useTranslation();
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [courseName, setCourseName] = useState('');
  const [dueDate, setDueDate] = useState(new Date());
  const [isPriority, setIsPriority] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [useNextPeriod, setUseNextPeriod] = useState(true);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [nextPeriodInfo, setNextPeriodInfo] = useState<{day: string, time: string, weekText?: string, isCurrentWeek?: boolean, isTomorrow?: boolean} | null>(null);
  const [loadingNextPeriod, setLoadingNextPeriod] = useState(false);
  const [assignmentType, setAssignmentType] = useState<AssignmentType>(AssignmentType.HOMEWORK);
  const [autoDetectedType, setAutoDetectedType] = useState<boolean>(false);
  
  // Assignment type modal state
  const [isTypeModalVisible, setIsTypeModalVisible] = useState(false);
  
  // Subject selection states
  const [subjectSelectionMode, setSubjectSelectionMode] = useState<'recent'|'all'|'custom'>('recent');
  
  // Subjects data
  const [subjects, setSubjects] = useState<ExtendedSubject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [filteredSubjects, setFilteredSubjects] = useState<ExtendedSubject[]>([]);
  const [searchText, setSearchText] = useState('');
  
  // Custom periods from settings
  const [customPeriods, setCustomPeriods] = useState<CustomPeriod[]>([]);
  
  // Modal state
  const [isSubjectsModalVisible, setIsSubjectsModalVisible] = useState(false);
  
  useEffect(() => {
    // Load subjects from scheduleService
    const loadSubjects = async () => {
      setLoadingSubjects(true);
      try {
        // Cast the result to ExtendedSubject[] to ensure type compatibility
        const subjectsData = await scheduleService.getSubjects() as ExtendedSubject[];
        setSubjects(subjectsData);
        
        // Load custom periods from settings
        const settings = scheduleService.getSettings();
        setCustomPeriods(settings.customPeriods);
        
        // Set filtered subjects based on selection mode
        updateFilteredSubjects(subjectsData, subjectSelectionMode);
        
        // Find current active period or first period of the day
        const scheduleData = await scheduleService.getClassSchedule();
        const today = new Date();
        const dayIndex = today.getDay(); // 0 = Sunday, 6 = Saturday
        
        // Handle weekday vs weekend separately
        if (dayIndex !== 0 && dayIndex !== 6) {
          // Weekday case
          // Convert day index to day name
          const dayName = dayIndex === 1 ? 'monday' :
                          dayIndex === 2 ? 'tuesday' :
                          dayIndex === 3 ? 'wednesday' :
                          dayIndex === 4 ? 'thursday' :
                          dayIndex === 5 ? 'friday' : 'monday';
          
          // Check if this is an even or odd week
          const isEvenWeek = scheduleService.isEvenWeek(today);
          
          try {
            // Get today's schedule with proper await
            const todaySchedule = await scheduleService.getScheduleForDay(scheduleData, dayName as any, today);
            
            // Verify we have a valid schedule array
            if (!todaySchedule || !Array.isArray(todaySchedule)) {
              console.error('Today schedule is not an array:', todaySchedule);
              if (subjectsData.length > 0) {
                setSelectedSubjectId(subjectsData[0].id);
                setCourseName(subjectsData[0].name);
                await updateNextPeriodInfo(subjectsData[0].id);
              }
              setLoadingSubjects(false);
              return;
            }
            
            const currentHour = today.getHours();
            const currentMinute = today.getMinutes();
            const currentTimeInMinutes = currentHour * 60 + currentMinute;
            
            // Filter periods by current week type
            const relevantPeriods = todaySchedule.filter(
              period => period.isEvenWeek === undefined || period.isEvenWeek === isEvenWeek
            );
            
            // Find current or next period (within 10 minutes)
            let targetPeriod = null;
            
            // First check for current period or one that just ended (within 10 mins)
            for (const period of relevantPeriods) {
              if (!period.startTime || !period.endTime) continue;
              
              const [startHour, startMinute] = period.startTime.split(':').map(Number);
              const [endHour, endMinute] = period.endTime.split(':').map(Number);
              
              const startTimeInMinutes = startHour * 60 + startMinute;
              const endTimeInMinutes = endHour * 60 + endMinute;
              
              // Check if this period is currently in progress
              if (currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes) {
                targetPeriod = period;
                break;
              }
              
              // Check if period just ended (within 10 minutes)
              if (currentTimeInMinutes > endTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes + 10) {
                targetPeriod = period;
                break;
              }
            }
            
            // If no current period, get first period of the day
            if (!targetPeriod && relevantPeriods.length > 0) {
              // Sort periods by start time
              const sortedPeriods = [...relevantPeriods].sort((a, b) => {
                if (!a.startTime) return 1;
                if (!b.startTime) return -1;
                
                const [aHours, aMinutes] = a.startTime.split(':').map(Number);
                const [bHours, bMinutes] = b.startTime.split(':').map(Number);
                
                return (aHours * 60 + aMinutes) - (bHours * 60 + bMinutes);
              });
              
              // Get the first period of the day
              targetPeriod = sortedPeriods[0];
            }
            
            // Set selected subject based on the target period
            if (targetPeriod && targetPeriod.className) {
              // Find corresponding subject in subjects list
              const matchingSubject = subjectsData.find(
                subject => subject.name === targetPeriod.className
              );
              
              if (matchingSubject) {
                setSelectedSubjectId(matchingSubject.id);
                setCourseName(matchingSubject.name);
                updateNextPeriodInfo(matchingSubject.id).catch(err => 
                  console.error("Error updating next period info:", err)
                );
              } else if (subjectsData.length > 0) {
                // Fallback to first subject if no matching subject found
                setSelectedSubjectId(subjectsData[0].id);
                setCourseName(subjectsData[0].name);
                updateNextPeriodInfo(subjectsData[0].id).catch(err => 
                  console.error("Error updating next period info:", err)
                );
              }
            } else if (subjectsData.length > 0) {
              // If no target period found, default to first subject
              setSelectedSubjectId(subjectsData[0].id);
              setCourseName(subjectsData[0].name);
              updateNextPeriodInfo(subjectsData[0].id).catch(err => 
                console.error("Error updating next period info:", err)
              );
            }
          } catch (error) {
            console.error('Error processing today schedule:', error);
            if (subjectsData.length > 0) {
              setSelectedSubjectId(subjectsData[0].id);
              setCourseName(subjectsData[0].name);
              await updateNextPeriodInfo(subjectsData[0].id);
            }
          }
          
        } else {
          // Weekend case - get Friday's schedule
          const fridayName = 'friday';
          const fridayDate = new Date(today);
          
          // Calculate how many days to go back to get to Friday (5 = Friday)
          const daysToFriday = dayIndex === 0 ? 2 : 1; // Sunday: go back 2, Saturday: go back 1
          fridayDate.setDate(today.getDate() - daysToFriday);
          
          // Check if this is an even or odd week for Friday
          const isEvenWeek = scheduleService.isEvenWeek(fridayDate);
          
          try {
            // Get Friday's schedule with proper await
            const fridaySchedule = await scheduleService.getScheduleForDay(scheduleData, fridayName as any, fridayDate);
            
            // Verify we have a valid schedule array
            if (!fridaySchedule || !Array.isArray(fridaySchedule)) {
              console.error('Friday schedule is not an array:', fridaySchedule);
              if (subjectsData.length > 0) {
                setSelectedSubjectId(subjectsData[0].id);
                setCourseName(subjectsData[0].name);
                await updateNextPeriodInfo(subjectsData[0].id);
              }
              setLoadingSubjects(false);
              return;
            }
            
            // Filter periods by week type for Friday
            const relevantFridayPeriods = fridaySchedule.filter(
              period => period.isEvenWeek === undefined || period.isEvenWeek === isEvenWeek
            );
            
            // Sort Friday periods by start time
            const sortedFridayPeriods = [...relevantFridayPeriods].sort((a, b) => {
              if (!a.startTime) return 1;
              if (!b.startTime) return -1;
              
              const [aHours, aMinutes] = a.startTime.split(':').map(Number);
              const [bHours, bMinutes] = b.startTime.split(':').map(Number);
              
              return (aHours * 60 + aMinutes) - (bHours * 60 + bMinutes);
            });
            
            // Get the first period of Friday if available
            if (sortedFridayPeriods.length > 0) {
              const fridayFirstPeriod = sortedFridayPeriods[0];
              
              // Find corresponding subject in subjects list
              const matchingSubject = subjectsData.find(
                subject => subject.name === fridayFirstPeriod.className
              );
              
              if (matchingSubject) {
                setSelectedSubjectId(matchingSubject.id);
                setCourseName(matchingSubject.name);
                updateNextPeriodInfo(matchingSubject.id);
              } else if (subjectsData.length > 0) {
                // Fallback to first subject if no matching subject found
                setSelectedSubjectId(subjectsData[0].id);
                setCourseName(subjectsData[0].name);
                updateNextPeriodInfo(subjectsData[0].id);
              }
            } else if (subjectsData.length > 0) {
              // No Friday periods - use first subject
              setSelectedSubjectId(subjectsData[0].id);
              setCourseName(subjectsData[0].name);
              updateNextPeriodInfo(subjectsData[0].id);
            }
          } catch (error) {
            console.error('Error processing Friday schedule:', error);
            if (subjectsData.length > 0) {
              setSelectedSubjectId(subjectsData[0].id);
              setCourseName(subjectsData[0].name);
              await updateNextPeriodInfo(subjectsData[0].id);
            }
          }
        }
      } catch (error) {
        console.error('Error loading subjects:', error);
        // Fallback on error - select first subject if available
        if (subjects.length > 0) {
          setSelectedSubjectId(subjects[0].id);
          setCourseName(subjects[0].name);
          await updateNextPeriodInfo(subjects[0].id);
        }
      } finally {
        setLoadingSubjects(false);
      }
    };
    
    loadSubjects();
  }, []);
  
  // Update filtered subjects when mode changes
  useEffect(() => {
    updateFilteredSubjects(subjects, subjectSelectionMode);
  }, [subjectSelectionMode, subjects, customPeriods]);
  
  // Add this new useEffect to update next period info when subjects or selectedSubjectId changes
  useEffect(() => {
    // Only try to update if we have a selected subject ID and subjects have loaded
    if (selectedSubjectId && subjects.length > 0) {
      updateNextPeriodInfo(selectedSubjectId).catch(err => 
        console.error("Error updating next period info:", err)
      );
    }
  }, [selectedSubjectId, subjects]);
  
  // Filter subjects based on search text
  useEffect(() => {
    if (searchText) {
      const filtered = subjects.filter(subject => 
        subject.name.toLowerCase().includes(searchText.toLowerCase())
      );
      setFilteredSubjects(filtered);
    } else {
      updateFilteredSubjects(subjects, subjectSelectionMode);
    }
  }, [searchText, subjects, subjectSelectionMode]);
  
  const updateFilteredSubjects = (allSubjects: ExtendedSubject[], mode: string) => {
    if (mode === 'recent') {
      // Get current day or Friday if weekend
      const today = new Date();
      const dayIndex = today.getDay(); // 0 = Sunday, 6 = Saturday
      
      // If it's weekend, use Friday's schedule
      const targetDayIndex = (dayIndex === 0 || dayIndex === 6) ? 5 : dayIndex;
      
      // Convert day index to day name
      const dayName = targetDayIndex === 1 ? 'monday' :
                      targetDayIndex === 2 ? 'tuesday' :
                      targetDayIndex === 3 ? 'wednesday' :
                      targetDayIndex === 4 ? 'thursday' :
                      targetDayIndex === 5 ? 'friday' : 'monday'; // Default to Monday
      
      // Get subjects for the current day asynchronously
      const getTodaySubjects = async () => {
        try {
          // Get schedule data
          const scheduleData = await scheduleService.getClassSchedule();
          
          // Check if this is an even or odd week
          const isEvenWeek = scheduleService.isEvenWeek(today);
          
          // Get today's schedule with proper await
          const todaySchedule = await scheduleService.getScheduleForDay(scheduleData, dayName as any, today);
          
          // Check if todaySchedule exists and is an array
          if (!todaySchedule || !Array.isArray(todaySchedule)) {
            console.error('Today schedule is not an array:', todaySchedule);
            setFilteredSubjects(allSubjects.slice(0, 5));
            return;
          }
          
          // Sort schedule by start time
          const sortedSchedule = [...todaySchedule].sort((a, b) => {
            const timeA = a.startTime.split(':').map(Number);
            const timeB = b.startTime.split(':').map(Number);
            return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
          });
          
          // Extract unique subjects from today's schedule in order of appearance
          const todaySubjectNames: string[] = [];
          sortedSchedule.forEach(period => {
            // Only include periods that are for all weeks or match the current week type
            if (
              period.className && 
              !todaySubjectNames.includes(period.className) &&
              (period.isEvenWeek === undefined || period.isEvenWeek === isEvenWeek)
            ) {
              todaySubjectNames.push(period.className);
            }
          });
          
          // Filter and sort subjects that are in today's schedule based on their appearance time
          const todaySubjects = todaySubjectNames
            .map(name => allSubjects.find(subject => subject.name === name))
            .filter(subject => subject !== undefined) as ExtendedSubject[];
          
          // If no subjects found for today, show first 5
          if (todaySubjects.length === 0) {
            setFilteredSubjects(allSubjects.slice(0, 5));
          } else {
            setFilteredSubjects(todaySubjects);
          }
        } catch (error) {
          console.error('Error getting today subjects:', error);
          // Fallback to first 5 subjects
          setFilteredSubjects(allSubjects.slice(0, 5));
        }
      };
      
      // Initial set to avoid delay
      setFilteredSubjects(allSubjects.slice(0, 5));
      
      // Update with today's subjects
      getTodaySubjects();
    } else if (mode === 'all') {
      // Show all subjects
      setFilteredSubjects(allSubjects);
    } else if (mode === 'custom') {
      // For custom mode, we'll create temporary Subject objects from customPeriods
      const customSubjectsFromPeriods = customPeriods
        .filter(period => period.isEnabled)
        .map(period => ({
          id: period._id,
          name: period.name || 'Custom Period',
          isCustom: true,
          isCustomPeriod: true, // Flag to identify this is from a custom period
          color: period.color
        }));
      
      setFilteredSubjects(customSubjectsFromPeriods);
    }
  };
  
  // Update next period information when subject selection changes
  const updateNextPeriodInfo = async (subjectId: string) => {
    // Find the selected subject
    const subject = subjects.find(s => s.id === subjectId) || 
                   filteredSubjects.find(s => s.id === subjectId);
    
    if (!subject) {
      setNextPeriodInfo(null);
      return;
    }
    
    // Handle custom periods differently
    if (subject.isCustomPeriod) {
      setLoadingNextPeriod(true);
      try {
        // Find the custom period
        const customPeriod = customPeriods.find(p => p._id === subject.id);
        if (!customPeriod) {
          throw new Error('Custom period not found');
        }
        
        // Get today's date
        const today = new Date();
        const todayDayIndex = today.getDay(); // 0 = Sunday, 6 = Saturday
        
        // Find the next occurrence of this period
        let nextDate = new Date();
        let dayIncrement = 1; // Default to tomorrow
        
        // If period has specific days scheduled
        if (customPeriod.daysOfWeek && customPeriod.daysOfWeek.length > 0) {
          // Convert day indexes to JS day indexes (0-6, where 0 is Sunday)
          // Our daysOfWeek uses 1-5 for Monday-Friday
          const periodDayIndexes = customPeriod.daysOfWeek.map(day => day === 5 ? 5 : day);
          
          // Find next available day
          let foundNextDay = false;
          
          // Check up to 7 days forward to find the next occurrence
          for (let i = 1; i <= 7; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() + i);
            const checkDayIndex = checkDate.getDay();
            
            // Skip weekends unless specifically included
            if ((checkDayIndex === 0 || checkDayIndex === 6) && 
                !periodDayIndexes.includes(checkDayIndex)) {
              continue;
            }
            
            // Convert Sunday (0) to 7 for easier comparison with our 1-5 indexes
            const adjustedDayIndex = checkDayIndex === 0 ? 7 : checkDayIndex;
            
            // If this day is in the period's schedule or the period doesn't specify days
            if (periodDayIndexes.includes(adjustedDayIndex) || periodDayIndexes.length === 0) {
              dayIncrement = i;
              foundNextDay = true;
              break;
            }
          }
          
          // If no day found in next 7 days, default to tomorrow
          if (!foundNextDay) {
            dayIncrement = 1;
          }
        }
        
        // Set the next date
        nextDate.setDate(today.getDate() + dayIncrement);
        
        // Set time from custom period
        let hours = 9;
        let minutes = 0;
        
        if (customPeriod.starttime) {
          const [periodHours, periodMinutes] = customPeriod.starttime.split(':').map(Number);
          hours = periodHours || hours;
          minutes = periodMinutes || minutes;
        }
        
        nextDate.setHours(hours, minutes, 0, 0);
        
        // Set due date
        setDueDate(nextDate);
        
        // Check if it's tomorrow
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const nextDateCopy = new Date(nextDate);
        nextDateCopy.setHours(0, 0, 0, 0);
        
        const isTomorrow = nextDateCopy.getTime() === tomorrow.getTime();
        
        // Calculate which week this is relative to the current date
        // Get the current week's Monday (first day of week)
        const currentWeekMonday = new Date(today);
        const dayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday, etc.
        // Adjust to get Monday (if today is Sunday (0), we go back 6 days)
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        currentWeekMonday.setDate(today.getDate() - daysFromMonday);
        
        // Get the next week's Monday
        const nextWeekMonday = new Date(currentWeekMonday);
        nextWeekMonday.setDate(currentWeekMonday.getDate() + 7);
        
        // Get the current week's Friday (last day of the week)
        const currentWeekFriday = new Date(currentWeekMonday);
        currentWeekFriday.setDate(currentWeekMonday.getDate() + 4); // +4 days from Monday is Friday
        
        // Get the next week's Friday
        const nextWeekFriday = new Date(nextWeekMonday);
        nextWeekFriday.setDate(nextWeekMonday.getDate() + 4);
        
        // Reset all time components to just compare dates
        [currentWeekMonday, currentWeekFriday, nextWeekMonday, nextWeekFriday].forEach(date => {
          date.setHours(0, 0, 0, 0);
        });
        
        // Determine which week the due date falls in
        let weekText = '';
        // Check if the date is between Monday and Friday of the current week
        if (nextDateCopy >= currentWeekMonday && nextDateCopy <= currentWeekFriday) {
          weekText = ''; // Empty for current week
        } 
        // Check if the date is between Monday and Friday of next week
        else if (nextDateCopy >= nextWeekMonday && nextDateCopy <= nextWeekFriday) {
          weekText = t('assignments').days.nextWeek.toLowerCase(); // Lowercase "next week"
        } 
        // For dates beyond next week
        else if (nextDateCopy > nextWeekFriday) {
          // Calculate weeks difference for dates beyond next week
          const weekDifference = Math.ceil((nextDateCopy.getTime() - currentWeekMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
          weekText = `${t('assignments').days.in} ${weekDifference} ${t('assignments').days.weeks}`;
        }
        
        // Format day name with "this" prefix for current week in English
        let dayDisplay = '';
        if (isTomorrow) {
          dayDisplay = t('assignments').days.tomorrow;
        } else {
          const dayName = nextDate.toLocaleDateString(currentLanguage, { weekday: 'long' });
          // For current week, add "this" before the day in English language
          const isCurrentWeek = nextDateCopy >= currentWeekMonday && nextDateCopy <= currentWeekFriday;
          if (isCurrentWeek && currentLanguage.startsWith('en')) {
            // Add "this" prefix for English
            dayDisplay = `this ${dayName}`;
          } else {
            dayDisplay = dayName;
          }
        }
        
        // Create next period info with the proper day name
        setNextPeriodInfo({
          day: dayDisplay,
          time: formatPeriodTime(`${hours}:${minutes}`),
          isTomorrow: isTomorrow,
          weekText: weekText,
          isCurrentWeek: nextDateCopy >= currentWeekMonday && nextDateCopy <= currentWeekFriday
        });
        
        // Enable next period
        setUseNextPeriod(true);
        
      } catch (error) {
        console.error('Error setting next period for custom period:', error);
        setUseNextPeriod(false);
        setShowAdvancedOptions(true);
        setNextPeriodInfo(null);
      } finally {
        setLoadingNextPeriod(false);
      }
      return;
    }
    
    setLoadingNextPeriod(true);
    try {
      // Get the schedule data for the current group
      const scheduleData = await scheduleService.getClassSchedule();
      
      // Get today's date and the next 14 days to search for upcoming periods (extended to handle bi-weekly classes)
      const today = new Date();
      let foundNextPeriod = false;
      
      // Search through the next 14 days to find the next period for this subject
      for (let i = 0; i <= 14; i++) {
        const searchDate = new Date(today);
        searchDate.setDate(today.getDate() + i);
        
        // Get day name (monday, tuesday, etc.)
        const dayIndex = searchDate.getDay();
        if (dayIndex === 0 || dayIndex === 6) {
          // Skip weekends unless there's a recovery day
          const recoveryDay = scheduleService.isRecoveryDay(searchDate);
          if (!recoveryDay) continue;
        }
        
        // Convert day index to day name
        const dayName = dayIndex === 0 ? 'sunday' : 
                        dayIndex === 1 ? 'monday' :
                        dayIndex === 2 ? 'tuesday' :
                        dayIndex === 3 ? 'wednesday' :
                        dayIndex === 4 ? 'thursday' :
                        dayIndex === 5 ? 'friday' : 'saturday';
        
        try {
          // Get schedule for this day - now with proper await
          const daySchedule = await scheduleService.getScheduleForDay(scheduleData, dayName as any, searchDate);
          
          // Check if daySchedule exists and is an array
          if (!daySchedule || !Array.isArray(daySchedule)) {
            continue;
          }
          
          // Check if this is an even or odd week
          const isEvenWeek = scheduleService.isEvenWeek(searchDate);
          
          // Find the first period for this subject that matches both:
          // 1. The correct subject name
          // 2. Either has no isEvenWeek property (applies to both weeks), 
          //    or its isEvenWeek property matches the current week's type
          const subjectPeriod = daySchedule.find(period => 
            period.className === subject.name && 
            (period.isEvenWeek === undefined || period.isEvenWeek === isEvenWeek) &&
            // If we're looking at today, only include periods that haven't started yet
            (i > 0 || (
              period.startTime && 
              isPeriodInFuture(period.startTime)
            ))
          );
          
          if (subjectPeriod) {
            // Get readable day format
            const dayString = searchDate.toLocaleDateString(currentLanguage, { weekday: 'long' });
            
            // Format time
            const formattedTime = formatPeriodTime(subjectPeriod.startTime);
            
            // Calculate which week this is relative to the current date
            const todayDate = new Date(today);
            const currentYear = todayDate.getFullYear();
            const currentMonth = todayDate.getMonth();
            const currentDay = todayDate.getDate();
            
            // Get the current week's Monday (first day of week)
            const currentWeekMonday = new Date(todayDate);
            const dayOfWeek = todayDate.getDay(); // 0 is Sunday, 1 is Monday, etc.
            // Adjust to get Monday (if today is Sunday (0), we go back 6 days)
            const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            currentWeekMonday.setDate(currentDay - daysFromMonday);
            
            // Get the next week's Monday
            const nextWeekMonday = new Date(currentWeekMonday);
            nextWeekMonday.setDate(currentWeekMonday.getDate() + 7);
            
            // Get the current week's Friday (last day of the week)
            const currentWeekFriday = new Date(currentWeekMonday);
            currentWeekFriday.setDate(currentWeekMonday.getDate() + 4); // +4 days from Monday is Friday
            
            // Get the next week's Friday
            const nextWeekFriday = new Date(nextWeekMonday);
            nextWeekFriday.setDate(nextWeekMonday.getDate() + 4);
            
            // Reset all time components to just compare dates
            [currentWeekMonday, currentWeekFriday, nextWeekMonday, nextWeekFriday].forEach(date => {
              date.setHours(0, 0, 0, 0);
            });
            
            // Clone the search date to avoid modifying it
            const searchDateCopy = new Date(searchDate);
            searchDateCopy.setHours(0, 0, 0, 0);
            
            // Check if the date is tomorrow
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            const isTomorrow = searchDateCopy.getTime() === tomorrow.getTime();
            
            let weekText = '';
            // Check if the date is between Monday and Friday of the current week
            if (searchDateCopy >= currentWeekMonday && searchDateCopy <= currentWeekFriday) {
              weekText = ''; // Empty for current week
            } 
            // Check if the date is between Monday and Friday of next week
            else if (searchDateCopy >= nextWeekMonday && searchDateCopy <= nextWeekFriday) {
              weekText = t('assignments').days.nextWeek.toLowerCase(); // Lowercase "next week"
            } 
            // For dates beyond next week
            else {
              // Calculate weeks difference for dates beyond next week
              const weekDifference = Math.ceil((searchDateCopy.getTime() - currentWeekMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
              weekText = `${t('assignments').days.in} ${weekDifference} ${t('assignments').days.weeks}`;
            }
            
            // Determine if we need to prefix the day with "this" for current week
            const isCurrentWeek = searchDateCopy >= currentWeekMonday && searchDateCopy <= currentWeekFriday;
            // For current week, add "this" before the day, based on current language
            const thisPrefix = currentLanguage.startsWith('en') ? 'this ' : 
                              currentLanguage.startsWith('es') ? 'este ' : '';
            const displayDay = isCurrentWeek ? `${thisPrefix}${dayString}` : dayString;
            
            // Set next period info
            setNextPeriodInfo({
              day: displayDay,
              time: formattedTime,
              weekText: weekText,
              isCurrentWeek: searchDateCopy >= currentWeekMonday && searchDateCopy <= currentWeekFriday,
              isTomorrow: isTomorrow
            });
            
            // Update due date to match next period
            const newDueDate = new Date(searchDate);
            const [hours, minutes] = subjectPeriod.startTime.split(':').map(Number);
            newDueDate.setHours(hours, minutes, 0, 0);
            setDueDate(newDueDate);
            
            foundNextPeriod = true;
            break;
          }
        } catch (error) {
          console.error(`Error getting schedule for day ${dayName}:`, error);
          continue;
        }
      }
      
      // If no next period was found in the next 14 days
      if (!foundNextPeriod) {
        // Create a default due date (today + 2 days)
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 2);
        defaultDate.setHours(10, 30, 0, 0);
        setDueDate(defaultDate);
        
        // Disable "Use next period" and show advanced options instead
        setUseNextPeriod(false);
        setShowAdvancedOptions(true);
        
        // Set next period info to null to indicate no period was found
        setNextPeriodInfo(null);
      }
    } catch (error) {
      console.error('Error getting next period:', error);
      // Fallback to default date
      const fallbackDate = new Date();
      fallbackDate.setDate(fallbackDate.getDate() + 2);
      fallbackDate.setHours(10, 30, 0, 0);
      setDueDate(fallbackDate);
      
      // Disable "Use next period" and show advanced options instead
      setUseNextPeriod(false);
      setShowAdvancedOptions(true);
      
      // Set next period info to null
      setNextPeriodInfo(null);
    } finally {
      setLoadingNextPeriod(false);
    }
  };
  
  // Helper function to check if a period time is in the future
  const isPeriodInFuture = (timeString: string): boolean => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const now = new Date();
    const periodTime = new Date();
    periodTime.setHours(hours, minutes, 0, 0);
    return periodTime > now;
  };
  
  // Helper function to format period time
  const formatPeriodTime = (timeString: string): string => {
    const [hours, minutes] = timeString.split(':').map(Number);
    
    // Use 24-hour format for non-English languages
    if (!currentLanguage.startsWith('en')) {
      return `${hours < 10 ? '0' + hours : hours}:${minutes < 10 ? '0' + minutes : minutes}`;
    } else {
      // Use 12-hour format with AM/PM for English
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${minutes < 10 ? '0' + minutes : minutes} ${period}`;
    }
  };
  
  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString(currentLanguage, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  // Format time for display
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(currentLanguage, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Save assignment and navigate back
  const handleSave = async () => {
    if (!title || !courseName) {
      Alert.alert("Error", "Please enter a title and select a course");
      return;
    }
    
    // Get the selected subject
    const selectedSubject = subjects.find(s => s.id === selectedSubjectId) || 
                          filteredSubjects.find(s => s.id === selectedSubjectId);
    
    await addAssignment({
      title,
      description,
      courseCode: selectedSubject?.name || courseName, // Use subject name as course code
      courseName: courseName,
      dueDate: dueDate.toISOString(),
      isPriority,
      subjectId: selectedSubjectId || undefined,
      assignmentType: assignmentType
    });
    
    router.back();
  };
  
  // Cancel and navigate back
  const handleCancel = () => {
    router.back();
  };
  
  // Manual date update functions
  const adjustDate = (days: number) => {
    const newDate = new Date(dueDate);
    newDate.setDate(newDate.getDate() + days);
    setDueDate(newDate);
  };
  
  const adjustHour = (hours: number) => {
    const newDate = new Date(dueDate);
    newDate.setHours(newDate.getHours() + hours);
    setDueDate(newDate);
  };
  
  const adjustMinute = (minutes: number) => {
    const newDate = new Date(dueDate);
    newDate.setMinutes(newDate.getMinutes() + minutes);
    setDueDate(newDate);
  };

  // Handle subject selection and next period update
  const handleSubjectSelect = (subject: ExtendedSubject) => {
    setSelectedSubjectId(subject.id);
    setCourseName(subject.name);
    updateNextPeriodInfo(subject.id).catch(err => 
      console.error("Error updating next period info:", err)
    );
    setIsSubjectsModalVisible(false);
  };

  // Toggle next period selection
  const toggleNextPeriod = () => {
    const newValue = !useNextPeriod;
    setUseNextPeriod(newValue);
    // If turning off next period, always show advanced options
    if (!newValue) {
      setShowAdvancedOptions(true);
    }
  };

  // Render a subject item for the modal
  const renderSubjectItem = ({ item }: { item: ExtendedSubject }) => (
    <TouchableOpacity
      style={[
        styles.subjectCard,
        selectedSubjectId === item.id && styles.subjectCardSelected,
        // Add colored border for custom periods
        item.isCustomPeriod && { borderLeftWidth: 4, borderLeftColor: item.color || '#2C3DCD' }
      ]}
      onPress={() => handleSubjectSelect(item)}
      activeOpacity={0.7}
    >
      <View style={styles.subjectMainInfo}>
        <Text style={styles.subjectName} numberOfLines={1} ellipsizeMode="tail">
          {item.name}
        </Text>
        {item.isCustomPeriod ? (
          <Text style={[styles.customBadge, { backgroundColor: item.color || '#2C3DCD' }]}>Period</Text>
        ) : item.isCustom && (
          <Text style={styles.customBadge}>Custom</Text>
        )}
      </View>
      {selectedSubjectId === item.id && (
        <Ionicons name="checkmark-circle" size={24} color="#2C3DCD" />
      )}
    </TouchableOpacity>
  );

  // Function to detect assignment type from title
  const detectAssignmentTypeFromTitle = (text: string) => {
    if (!text) return null;
    
    // Convert to lowercase for case-insensitive matching
    const lowerText = text.toLowerCase();
    
    // Get keywords based on current language (default to English if language not supported)
    const keywordsMap = ASSIGNMENT_TYPE_KEYWORDS[currentLanguage as 'en' | 'ro' | 'ru'] || ASSIGNMENT_TYPE_KEYWORDS.en;
    
    // Check each assignment type's keywords
    for (const [type, keywords] of Object.entries(keywordsMap)) {
      for (const keyword of keywords) {
        // Look for whole word matches or word boundaries where possible
        const wordPattern = new RegExp(`\\b${keyword}\\b|\\s${keyword}|^${keyword}|${keyword}\\s|${keyword}$`, 'i');
        if (wordPattern.test(lowerText) || lowerText.includes(keyword)) {
          return type as AssignmentType;
        }
      }
    }
    
    // If no match in current language, try other languages as fallback
    for (const lang of Object.keys(ASSIGNMENT_TYPE_KEYWORDS) as Array<'en' | 'ro' | 'ru'>) {
      if (lang === currentLanguage) continue; // Skip current language as we already checked it
      
      const otherLangKeywords = ASSIGNMENT_TYPE_KEYWORDS[lang];
      for (const [type, keywords] of Object.entries(otherLangKeywords)) {
        for (const keyword of keywords) {
          // Look for whole word matches or word boundaries where possible
          const wordPattern = new RegExp(`\\b${keyword}\\b|\\s${keyword}|^${keyword}|${keyword}\\s|${keyword}$`, 'i');
          if (wordPattern.test(lowerText) || lowerText.includes(keyword)) {
            return type as AssignmentType;
          }
        }
      }
    }
    
    return null;
  };
  
  // Update title and check for assignment type
  const handleTitleChange = (text: string) => {
    setTitle(text);
    
    // Only try to auto-detect if the user hasn't manually selected a type yet
    // or if auto-detection has already happened (so we can update it)
    if (!text || (!autoDetectedType && assignmentType !== AssignmentType.HOMEWORK)) {
      return;
    }
    
    const detectedType = detectAssignmentTypeFromTitle(text);
    if (detectedType) {
      setAssignmentType(detectedType);
      setAutoDetectedType(true);
      
      // Automatically set priority for test, exam, or quiz
      if (detectedType === AssignmentType.TEST || detectedType === AssignmentType.EXAM || detectedType === AssignmentType.QUIZ) {
        setIsPriority(true);
      }
    }
  };
  
  // Handle manual type selection
  const handleTypeSelection = (type: AssignmentType) => {
    setAssignmentType(type);
    setIsTypeModalVisible(false);
    setAutoDetectedType(false); // User manually selected a type
    
    // Automatically set priority for test, exam, or quiz
    if (type === AssignmentType.TEST || type === AssignmentType.EXAM || type === AssignmentType.QUIZ) {
      setIsPriority(true);
    }
  };

  // Render a type item for selection
  const renderTypeItem = (type: AssignmentType) => {
    // Get icon for this specific type
    const getIconForType = () => {
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

    return (
      <TouchableOpacity
        key={type}
        style={[
          styles.typeCard,
          assignmentType === type && styles.typeCardSelected
        ]}
        onPress={() => handleTypeSelection(type)}
        activeOpacity={0.7}
      >
        <View style={styles.typeMainInfo}>
          <Ionicons 
            name={getIconForType()} 
            size={24} 
            color={assignmentType === type ? "#2C3DCD" : "#FFFFFF"} 
            style={{marginRight: 12}}
          />
          <Text style={[
            styles.typeName,
            assignmentType === type && {color: '#2C3DCD', fontWeight: '600'}
          ]}>
            {t('assignments').types[type.toLowerCase() as 'homework' | 'test' | 'exam' | 'project' | 'quiz' | 'lab' | 'essay' | 'presentation' | 'other']}
          </Text>
        </View>
        {assignmentType === type && (
          <Ionicons name="checkmark-circle" size={24} color="#2C3DCD" />
        )}
      </TouchableOpacity>
    );
  };

  // Get icon for current assignment type in the selector
  const getTypeIcon = () => {
    switch (assignmentType) {
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

  // Find selected subject 
  const selectedSubject = subjects.find(s => s.id === selectedSubjectId) || 
                          filteredSubjects.find(s => s.id === selectedSubjectId);

  // Replace DAYS and QUICK_DATE_OPTIONS with dynamic translations
  const DAYS = t('weekdays').short;
  
  // Define date options with proper fallbacks
  const QUICK_DATE_OPTIONS = [
    { label: t('assignments').days.today, days: 0 },
    { label: t('assignments').days.tomorrow, days: 1 },
    { label: t('assignments').days.nextWeek, days: 7 },
    { label: t('assignments').days.inTwoWeeks, days: 14 },
  ];
  
  // Define time presets with translations
  const TIME_PRESETS = [
    { label: t('assignments').periods.first, hour: 8, minute: 0 },
    { label: t('assignments').periods.second, hour: 9, minute: 30 },
    { label: t('assignments').periods.third, hour: 11, minute: 20 },
    { label: t('assignments').periods.fourth, hour: 12, minute: 50 },
    { label: t('assignments').periods.fifth, hour: 14, minute: 20 },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('assignments').addNew}</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>{t('settings').customPeriods.cancel}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={handleSave} 
            style={[styles.saveButton, (!title || !courseName) && styles.saveButtonDisabled]}
            disabled={!title || !courseName}
          >
            <Text style={[styles.saveButtonText, (!title || !courseName) && styles.saveButtonTextDisabled]}>{t('assignments').save}</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <FlatList
        data={[{ key: 'formContent' }]}
        showsVerticalScrollIndicator={false}
        keyExtractor={item => item.key}
        renderItem={({ item }) => (
          <View style={styles.formContainer}>
            <Animated.View entering={FadeIn.duration(300).delay(50)}>
              <Text style={styles.label}>{t('assignments').title}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('assignments').titlePlaceholder}
                placeholderTextColor="#8A8A8D"
                value={title}
                onChangeText={handleTitleChange}
                maxLength={50}
              />
              {autoDetectedType && (
                <Text style={styles.autoDetectedNote}>
                  {t('assignments').autoDetectedType}
                </Text>
              )}
            </Animated.View>
            
            {/* Add Assignment Type Selector */}
            <Animated.View entering={FadeIn.duration(300).delay(75)}>
              <Text style={styles.label}>{t('assignments').type}</Text>
              <TouchableOpacity
                style={styles.typeSelector}
                onPress={() => setIsTypeModalVisible(true)}
              >
                <View style={styles.typeDisplay}>
                  <Ionicons name={getTypeIcon()} size={20} color="#FFFFFF" style={styles.typeIcon} />
                  <Text style={styles.typeText}>
                    {t('assignments').types[assignmentType.toLowerCase() as 'homework' | 'test' | 'exam' | 'project' | 'quiz' | 'lab' | 'essay' | 'presentation' | 'other']}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={20} color="#8A8A8D" />
              </TouchableOpacity>
            </Animated.View>
            
            <Animated.View entering={FadeIn.duration(300).delay(100)}>
              <Text style={styles.label}>{t('assignments').description} ({t('assignments').optional})</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={t('assignments').descriptionPlaceholder}
                placeholderTextColor="#8A8A8D"
                value={description}
                onChangeText={setDescription}
                multiline
                maxLength={200}
              />
            </Animated.View>
            
            <Animated.View entering={FadeIn.duration(300).delay(150)}>
              <Text style={styles.label}>{t('grades').form.subject}</Text>
              <TouchableOpacity
                style={styles.subjectSelector}
                onPress={() => setIsSubjectsModalVisible(true)}
              >
                {selectedSubject ? (
                  <View style={styles.selectedSubjectDisplay}>
                    <Text style={styles.selectedSubjectText}>{selectedSubject.name}</Text>
                    {selectedSubject.isCustom && (
                      <Text style={styles.customBadgeSmall}>{t('assignments').custom}</Text>
                    )}
                  </View>
                ) : (
                  <Text style={styles.subjectPlaceholder}>{t('assignments').selectSubject}</Text>
                )}
                <Ionicons name="chevron-down" size={20} color="#8A8A8D" />
              </TouchableOpacity>
            </Animated.View>
            
            {/* Next Period Option */}
            {selectedSubjectId && (
              <Animated.View entering={FadeIn.duration(300).delay(200)} style={styles.nextPeriodContainer}>
                <View style={styles.nextPeriodHeader}>
                  <Text style={[
                    styles.label, 
                    !nextPeriodInfo && styles.labelDisabled,
                    { marginTop: 0, marginBottom: 0 }
                  ]}>{t('assignments').useNextPeriod}</Text>
                  <CustomToggle
                    value={useNextPeriod}
                    onValueChange={toggleNextPeriod}
                    disabled={!nextPeriodInfo}
                  />
                </View>
                
                {!nextPeriodInfo && selectedSubjectId && (
                  <View style={styles.warningContainer}>
                    <Ionicons name="alert-circle" size={16} color="#FFA500" />
                    <Text style={styles.warningText}>
                      {t('assignments').noUpcomingClasses} {selectedSubject?.name || t('assignments').thisSubject} {t('assignments').inNextTwoWeeks}
                    </Text>
                  </View>
                )}
                
                {useNextPeriod && (
                  <Animated.View 
                    entering={FadeIn.duration(200)} 
                    exiting={FadeOut.duration(200)}
                    layout={Layout.springify()}
                    style={styles.nextPeriodInfo}
                  >
                    {loadingNextPeriod ? (
                      <View style={styles.loadingNextPeriod}>
                        <ActivityIndicator size="small" color="#2C3DCD" />
                        <Text style={styles.nextPeriodText}>{t('assignments').findingNextClass}</Text>
                      </View>
                    ) : nextPeriodInfo ? (
                      <Text style={styles.nextPeriodText}>
                        {t('assignments').assignmentDueText}
                        {nextPeriodInfo.weekText ? (
                          <Text style={{ color: '#2C3DCD' }}> {nextPeriodInfo.weekText}</Text>
                        ) : null}
                        
                        {nextPeriodInfo.weekText ? ` ${t('assignments').on} ` : ' '}
                        
                        {nextPeriodInfo.isTomorrow ? (
                          <Text style={{ color: '#2C3DCD' }}>{t('assignments').days.tomorrow}</Text>
                        ) : (
                          <Text style={{ color: '#2C3DCD' }}>{nextPeriodInfo.day}</Text>
                        )} {t('assignments').at} <Text style={{ color: '#2C3DCD' }}>{nextPeriodInfo.time}</Text>
                      </Text>
                    ) : (
                      <Text style={styles.nextPeriodText}>
                        {t('assignments').noUpcomingClassesFound}
                      </Text>
                    )}
                  </Animated.View>
                )}
              </Animated.View>
            )}
            
            {/* Advanced Options Panel (Due Date & Time) */}
            {!useNextPeriod && (
              <Animated.View 
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(200)}
                layout={Layout.springify()}
              >
                <Animated.View entering={FadeIn.duration(200).delay(50)}>
                  <Text style={styles.label}>{t('assignments').dueDate}</Text>
                  <DatePicker
                    selectedDate={dueDate}
                    onDateChange={setDueDate}
                    formatDate={formatDate}
                    days={DAYS}
                    quickDateOptions={QUICK_DATE_OPTIONS}
                    currentLanguage={currentLanguage}
                  />
              </Animated.View>
                
                <Animated.View entering={FadeIn.duration(200).delay(100)}>
                  <Text style={styles.label}>{t('assignments').dueTime}</Text>
                  <TimePicker
                    selectedTime={dueDate}
                    onTimeChange={setDueDate}
                    timePresets={TIME_PRESETS}
                  />
                </Animated.View>
              </Animated.View>
            )}
            
            <Animated.View entering={FadeIn.duration(300).delay(400)} style={styles.priorityContainer}>
              <Text style={styles.label}>{t('assignments').markAsPriority}</Text>
              <CustomToggle
                value={isPriority}
                onValueChange={setIsPriority}
              />
            </Animated.View>
            
            {/* Add spacing at the bottom for better scroll experience */}
            <View style={styles.bottomSpacing} />
          </View>
        )}
      />
      
      {/* Subject Selection Modal */}
      <Modal
        visible={isSubjectsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsSubjectsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('assignments').selectSubject}</Text>
              <TouchableOpacity 
                onPress={() => setIsSubjectsModalVisible(false)}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.tabsContainer}>
            <View style={styles.segmentedControl}>
              <TouchableOpacity 
                style={[
                  styles.segmentButton, 
                  subjectSelectionMode === 'recent' && styles.segmentButtonActive
                ]}
                onPress={() => setSubjectSelectionMode('recent')}
              >
                <Text style={[
                  styles.segmentButtonText,
                  subjectSelectionMode === 'recent' && styles.segmentButtonTextActive
                ]}>{t('assignments').recent}</Text>
              </TouchableOpacity>
                
                <View style={styles.segmentSeparator} />
                
              <TouchableOpacity 
                style={[
                  styles.segmentButton, 
                  subjectSelectionMode === 'all' && styles.segmentButtonActive
                ]}
                onPress={() => setSubjectSelectionMode('all')}
              >
                <Text style={[
                  styles.segmentButtonText,
                  subjectSelectionMode === 'all' && styles.segmentButtonTextActive
                ]}>{t('assignments').all}</Text>
              </TouchableOpacity>
                
                <View style={styles.segmentSeparator} />
                
              <TouchableOpacity 
                style={[
                  styles.segmentButton, 
                  subjectSelectionMode === 'custom' && styles.segmentButtonActive
                ]}
                onPress={() => setSubjectSelectionMode('custom')}
              >
                <Text style={[
                  styles.segmentButtonText,
                  subjectSelectionMode === 'custom' && styles.segmentButtonTextActive
                ]}>{t('assignments').custom}</Text>
              </TouchableOpacity>
              </View>
            </View>
            
            <TextInput
              style={styles.searchInput}
              placeholder={t('settings').group.search}
              placeholderTextColor="#8A8A8D"
              value={searchText}
              onChangeText={setSearchText}
            />
            
            {loadingSubjects ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#2C3DCD" />
                <Text style={styles.loadingText}>{t('assignments').loadingSubjects}</Text>
              </View>
            ) : filteredSubjects.length > 0 ? (
              <View style={{ flex: 1 }}>
                <Animated.FlatList
                  data={filteredSubjects}
                  renderItem={renderSubjectItem}
                  keyExtractor={item => item.id}
                  style={styles.subjectsList}
                  contentContainerStyle={{ paddingBottom: 20 }}
                  showsVerticalScrollIndicator={true}
                  entering={FadeIn.duration(300)}
                  key={`subjects-list-${subjectSelectionMode}`}
                />
              </View>
            ) : (
              <View style={styles.noSubjectsContainer}>
                <Text style={styles.noSubjectsText}>
                  {subjectSelectionMode === 'custom' 
                    ? t('assignments').noCustomSubjects
                    : t('assignments').noSubjects}
                </Text>
              </View>
            )}
            
            {subjectSelectionMode === 'custom' && (
              <View style={styles.customInputContainer}>
                <Text style={styles.modalSubtitle}>{'Select a custom period'}</Text>
                {customPeriods.length === 0 ? (
                  <View style={styles.emptyListContainer}>
                    <Text style={styles.emptyListText}>{t('settings').customPeriods.noPeriodsYet}</Text>
                    <TouchableOpacity
                      style={styles.settingsLinkButton}
                      onPress={() => {
                        setIsSubjectsModalVisible(false);
                        router.push('/(tabs)/settings');
                      }}
                    >
                      <Text style={styles.settingsLinkButtonText}>{'Go to Settings'}</Text>
                    </TouchableOpacity>
                  </View>
                ) : filteredSubjects.length > 0 ? (
                  <View style={{ flex: 1 }}>
                    <Animated.FlatList
                      data={filteredSubjects}
                      renderItem={renderSubjectItem}
                      keyExtractor={item => item.id}
                      style={styles.subjectsList}
                      contentContainerStyle={{ paddingBottom: 20 }}
                      showsVerticalScrollIndicator={true}
                    />
                  </View>
                ) : (
                  <View style={styles.emptyListContainer}>
                    <Text style={styles.emptyListText}>
                      {searchText
                        ? `${t('settings').group.notFound || 'No periods found matching'} "${searchText}"`
                        : 'No enabled custom periods found'}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
      
      {/* Assignment Type Selection Modal */}
      <Modal
        visible={isTypeModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsTypeModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('assignments').type}</Text>
              <TouchableOpacity 
                onPress={() => setIsTypeModalVisible(false)}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.typesList}>
              {Object.values(AssignmentType).map(type => renderTypeItem(type))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    backgroundColor: '#141414',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  headerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    padding: 8,
  },
  cancelButtonText: {
    color: '#FF3B30',
    fontSize: 17,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#2C3DCD',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#292929',
    borderWidth: 1,
    borderColor: '#3e3e3e',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  saveButtonTextDisabled: {
    color: '#6e6e6e',
  },
  formContainer: {
    flex: 1,
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 16,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333333',
  },
  segmentButton: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#2C3DCD',
    borderRadius: 8,
  },
  segmentButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  segmentButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  segmentSeparator: {
    width: 1,
    backgroundColor: '#333333',
    alignSelf: 'stretch',
    marginVertical: 8,
  },
  priorityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  nextPeriodContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  nextPeriodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center', // Ensure vertical centering
  },
  nextPeriodInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  nextPeriodText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 5,
  },
  advancedOptionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  advancedOptionsButtonText: {
    color: '#3478F6',
    fontSize: 16,
    fontWeight: '500',
  },
  pickerContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    overflow: 'hidden',
    minHeight: 100,
    maxHeight: 300,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 20,
    justifyContent: 'center',
  },
  loadingText: {
    color: '#8A8A8D',
    marginLeft: 8,
  },
  datePickerContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  dateSelectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  quickOptionsContainer: {
    marginVertical: 10,
  },
  quickOptionsScrollContent: {
    paddingHorizontal: 5,
    paddingBottom: 5,
  },
  quickDateButton: {
    backgroundColor: '#242424',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 6,
    minWidth: 80,
  },
  quickDateButtonSelected: {
    backgroundColor: '#2C3DCD',
  },
  quickDateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center', // Ensure text is centered
  },
  quickDateButtonTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  calendarContainer: {
    marginTop: 8,
    backgroundColor: '#242424',
    borderRadius: 12,
    padding: 12,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  calendarDaysHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  calendarDayHeaderText: {
    color: '#A0A0A0',
    fontSize: 12,
    width: 32,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  calendarDayWrapper: {
    width: '14.28%',
    alignItems: 'center',
    marginBottom: 8,
  },
  calendarDay: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDaySelected: {
    backgroundColor: '#2C3DCD',
  },
  calendarDayToday: {
    borderWidth: 1,
    borderColor: '#2C3DCD',
  },
  calendarDayOtherMonth: {
    opacity: 0.3,
  },
  calendarDayText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  calendarDayTextSelected: {
    color: '#FFFFFF',  // Ensure this is white
    fontWeight: '600',
  },
  calendarDayTextToday: {
    color: '#2C3DCD',
  },
  calendarDayTextOtherMonth: {
    color: '#888888',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2C3DCD',
    position: 'absolute',
    bottom: 2,
  },
  todayButton: {
    backgroundColor: '#2C3DCD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'center',
    marginTop: 8,
  },
  todayButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Time picker styles
  timePickerContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  timeDisplay: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  timePresetContainer: {
    marginBottom: 16,
  },
  timePresetScrollContent: {
    paddingBottom: 8,
  },
  timePresetButton: {
    backgroundColor: '#242424',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
  },
  timePresetButtonSelected: {
    backgroundColor: '#2C3DCD',
  },
  timePresetButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  timePresetButtonTextSelected: {
    fontWeight: '600',
  },
  timeWheelContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeWheelGroup: {
    alignItems: 'center',
    marginHorizontal: 8,
  },
  timeWheelLabel: {
    color: '#8A8A8D',
    fontSize: 12,
    marginBottom: 4,
  },
  timeWheel: {
    alignItems: 'center',
  },
  timeWheelButton: {
    padding: 8,
  },
  timeWheelText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    marginVertical: 4,
  },
  timeWheelSeparator: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
    marginHorizontal: 4,
  },
  amPmToggle: {
    backgroundColor: '#2C3DCD',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 20,
  },
  amPmToggleText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  subjectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    backgroundColor: '#1C1C1E',
    marginHorizontal: 2,
    marginVertical: 2,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  subjectCardSelected: {
    backgroundColor: '#0F1A4A',
    borderColor: '#2C3DCD',
    borderWidth: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#2C3DCD',
  },
  subjectMainInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  subjectName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  customBadge: {
    backgroundColor: '#2C3DCD',
    color: '#FFFFFF',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
    marginLeft: 8,
  },
  customBadgeSmall: {
    backgroundColor: '#2C3DCD',
    color: '#FFFFFF',
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    overflow: 'hidden',
    marginLeft: 8,
  },
  subjectsList: {
    flex: 1,
    paddingHorizontal: 2,
    paddingTop: 4,
    width: '100%',
  },
  searchInput: {
    backgroundColor: '#242424',
    color: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    marginBottom: 8,
  },
  noSubjectsContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  noSubjectsText: {
    color: '#8A8A8D',
    fontSize: 16,
  },
  customInputContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  courseInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  courseInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    paddingVertical: 8,
    marginRight: 10,
  },
  addButton: {
    backgroundColor: '#2C3DCD',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 40,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#121214',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '70%',
    padding: 20,
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tabsContainer: {
    marginVertical: 12,
    borderRadius: 12,
    overflow: 'hidden',
    padding: 2,
    backgroundColor: '#1C1C1E',
  },
  subjectSelector: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedSubjectDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedSubjectText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  subjectPlaceholder: {
    color: '#8A8A8D',
    fontSize: 16,
  },
  loadingNextPeriod: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  labelDisabled: {
    color: '#777777',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: '#333333',
    marginTop: 8,
  },
  warningText: {
    color: '#FFA500',
    fontSize: 13,
    marginLeft: 6,
    flex: 1,
  },
  activeStatusText: {
    color: '#2C3DCD',
  },
  typeSelector: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIcon: {
    marginRight: 10,
  },
  typeText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  typesList: {
    flex: 1,
    paddingHorizontal: 2,
    paddingTop: 4,
    width: '100%',
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    backgroundColor: '#1C1C1E',
    marginHorizontal: 2,
    marginVertical: 2,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  typeCardSelected: {
    backgroundColor: '#0F1A4A',
    borderColor: '#2C3DCD',
    borderWidth: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#2C3DCD',
  },
  typeMainInfo: {
    flex: 1,
  },
  typeName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  typeIconContainer: {
    marginRight: 10,
  },
  typeNameSelected: {
    color: '#2C3DCD',
  },
  autoDetectedNote: {
    color: '#8A8A8D',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic'
  },
  timePickerWrapper: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  emptyListContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyListText: {
    color: '#8A8A8D',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 12,
  },
  settingsLinkButton: {
    backgroundColor: '#2C3DCD',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  settingsLinkButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 12,
    marginTop: 4,
  },
  customPeriodsContainer: {
    flex: 1,
  },
  noPeriods: {
    color: '#8A8A8D',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
}); 
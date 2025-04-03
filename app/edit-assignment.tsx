import React, { useState, useRef, useEffect, memo } from 'react';
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
  Animated as RNAnimated,
  Pressable,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
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
import { 
  updateAssignment, 
  AssignmentType, 
  getAssignments,
  getSubtasksForAssignment 
} from '../utils/assignmentStorage';
import { scheduleService, DAYS_MAP, Subject, CustomPeriod } from '../services/scheduleService';
import { useTranslation } from '@/hooks/useTranslation';
import { ModernDropdownPortal } from '@/components/ModernDropdownPortal';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SegmentItem } from '@/components/modernDropdown';

// Import the components from new-assignment.tsx
// For a real app, these would be separated into their own files
// Interface for ExtendedSubject
interface ExtendedSubject extends Subject {
  isCustomPeriod?: boolean;
  color?: string;
}

// ✂️ Custom toggle component and other components from new-assignment.tsx would be here
// For brevity, I'm not including them in this example as they would be identical

// Key to store highlighted assignment IDs
const HIGHLIGHTED_ASSIGNMENTS_KEY = 'highlighted_assignments';

// Add Day names array for the mini calendar - will be replaced with translations inside component
const DAYS_DEFAULT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Basic structure for quick options, will be populated with translations inside component
const QUICK_DATE_OPTIONS_DEFAULT = [
  { label: 'Today', days: 0 },
  { label: 'Tomorrow', days: 1 },
  { label: 'Next Week', days: 7 },
  { label: 'In 2 Weeks', days: 14 },
];

// Add TIME_PRESETS_DEFAULT after QUICK_DATE_OPTIONS_DEFAULT
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
  onSelect,
  currentLanguage
}: { 
  days: number; 
  label: string; 
  index: number;
  selectedDate: Date;
  onSelect: (days: number) => void;
  currentLanguage: string;
}) => {
  const isSelected = React.useMemo(() => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    return isSameDay(targetDate, selectedDate);
  }, [selectedDate.toDateString(), days]);
  
  // Format date for display
  const dateString = React.useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString(currentLanguage, {
      month: 'short',
      day: 'numeric'
    });
  }, [days, currentLanguage]);

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
        <Text style={[
          styles.quickDateTimeText,
          isSelected && styles.quickDateTimeTextSelected
        ]}>
          {dateString}
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
  
  const checkSameDay = (date1: Date, date2: Date) => {
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
    // update the calendar month too
    if (newDate.getMonth() !== calendarMonth.getMonth() ||
        newDate.getFullYear() !== calendarMonth.getFullYear()) {
      setCalendarMonth(new Date(newDate.getFullYear(), newDate.getMonth(), 1));
    }
    
    // Copy time from the existing selected date
    newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
    onDateChange(newDate);
  }, [selectedDate, calendarMonth, onDateChange]);
  
  // Check if current day is visible in calendar view
  const isCurrentDayInView = (() => {
    const today = new Date();
    return (
      today.getMonth() === calendarMonth.getMonth() &&
      today.getFullYear() === calendarMonth.getFullYear()
    );
  })();
  
  // Get month name based on current language
  const monthName = (() => {
    const options: Intl.DateTimeFormatOptions = { month: 'long' };
    return new Intl.DateTimeFormat(currentLanguage, options).format(calendarMonth);
  })();
  
  // Get year
  const year = calendarMonth.getFullYear();
  
  const calendarDays = generateCalendarDays();
  
  return (
    <View style={styles.datePickerContainer}>
      {/* Quick Date Categories in horizontal ScrollView */}
      <View style={styles.quickOptionsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickOptionsScrollContent}
        >
          {quickDateOptions.map((option, index) => (
            <QuickOption
              key={`quick-${option.days}`}
              days={option.days}
              label={option.label}
              index={index}
              selectedDate={selectedDate}
              onSelect={selectQuickOption}
              currentLanguage={currentLanguage}
            />
          ))}
        </ScrollView>
      </View>
      
      <TouchableOpacity 
        style={styles.dateDisplayButton}
        onPress={() => setShowCalendar(!showCalendar)}
      >
        <Ionicons name="calendar-outline" size={20} color="#3478F6" />
        <Text style={styles.dateDisplayText}>
          {formatDate(selectedDate)}
        </Text>
        <Animated.View style={chevronStyle}>
          <Ionicons 
            name="chevron-down" 
            size={16} 
            color="#8E8E93" 
          />
        </Animated.View>
      </TouchableOpacity>
      
      <Animated.View style={[styles.calendarContainer, calendarContainerStyle]}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity 
            style={styles.calendarNavButton}
            onPress={() => navigateMonth(-1)}
          >
            <Ionicons name="chevron-back" size={20} color="#8E8E93" />
          </TouchableOpacity>
          
          <Animated.View style={monthAnimStyle}>
            <Text style={styles.calendarMonthYear}>
              {`${monthName} ${year}`}
            </Text>
          </Animated.View>
          
          <TouchableOpacity 
            style={styles.calendarNavButton}
            onPress={() => navigateMonth(1)}
          >
            <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.calendarDaysHeader}>
          {days.map((day, index) => (
            <Text key={`day-${index}`} style={styles.calendarDayHeaderText}>
              {day}
            </Text>
          ))}
        </View>
        
        <Animated.View 
          style={styles.calendarDaysGrid}
          entering={FadeIn.duration(200)}
        >
          {calendarDays.map((day, index) => {
            const isSelected = checkSameDay(day.date, selectedDate);
            const isToday = day.isToday;
            
            return (
              <View key={`cell-${index}`} style={styles.calendarDayCell}>
                <TouchableOpacity
                  style={[
                    styles.calendarDayButton,
                    isSelected && styles.calendarDayButtonSelected,
                    isToday && !isSelected && styles.calendarDayButtonToday,
                  ]}
                  onPress={() => selectDate(day.date)}
                  disabled={!day.isCurrentMonth}
                >
                  <Text style={[
                    styles.calendarDayText,
                    !day.isCurrentMonth && styles.calendarDayTextOtherMonth,
                    isToday && !isSelected && styles.calendarDayTextToday,
                    isSelected && styles.calendarDayTextSelected,
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
            <Text style={styles.todayButtonText}>
              {quickDateOptions[0]?.label || 'Today'}
            </Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
};

// Add TimePicker component after DatePicker component
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
                    {preset.label}
                  </Text>
                  <Text style={[
                    styles.timePresetTimeText,
                    isSelected && styles.timePresetTimeTextSelected
                  ]}>
                    {presetTimeString}
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

// Add the CustomToggle component from new-assignment.tsx
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

// Modified to handle editing an existing assignment
export default function EditAssignmentScreen() {
  // Get assignment id from route params
  const { id } = useLocalSearchParams<{ id: string }>();
  
  // State for loading the assignment
  const [isLoading, setIsLoading] = useState(true);
  
  // State for saving
  const [isSaving, setIsSaving] = useState(false);
  
  // State for assignment fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(new Date());
  const [isPriority, setIsPriority] = useState(false);
  const [assignmentType, setAssignmentType] = useState<AssignmentType>(AssignmentType.HOMEWORK);
  const [selectedSubject, setSelectedSubject] = useState<ExtendedSubject | null>(null);
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [periodId, setPeriodId] = useState<string | undefined>(undefined);
  const [subjectId, setSubjectId] = useState<string | undefined>(undefined);
  const [subtasks, setSubtasks] = useState<{id: string, title: string, isCompleted: boolean}[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  
  // Refs for inputs
  const titleInputRef = useRef<TextInput>(null);
  
  // Translation hook
  const { t, currentLanguage } = useTranslation();
  
  // Add state for modals inside EditAssignmentScreen
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isTypeModalVisible, setIsTypeModalVisible] = useState(false);
  const [isSubjectsModalVisible, setIsSubjectsModalVisible] = useState(false);
  const [subjects, setSubjects] = useState<ExtendedSubject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  
  // Load the assignment data
  useEffect(() => {
    const loadAssignment = async () => {
      try {
        setIsLoading(true);
        const assignments = await getAssignments();
        const assignment = assignments.find(a => a.id === id);
        
        if (!assignment) {
          Alert.alert(
            'Error',
            'Assignment not found.',
            [{ text: 'OK', onPress: () => router.back() }]
          );
          return;
        }
        
        // Set state from assignment
        setTitle(assignment.title);
        setDescription(assignment.description || '');
        setDueDate(new Date(assignment.dueDate));
        setIsPriority(assignment.isPriority);
        setAssignmentType(assignment.assignmentType);
        setCourseCode(assignment.courseCode);
        setCourseName(assignment.courseName);
        setPeriodId(assignment.periodId);
        setSubjectId(assignment.subjectId);
        
        // Load subtasks
        const storedSubtasks = await getSubtasksForAssignment(assignment.id);
        setSubtasks(storedSubtasks);
        
        // If assignment has a subject ID, try to find and select the subject
        if (assignment.subjectId) {
          try {
            const allSubjects = await scheduleService.getSubjects();
            const subj = allSubjects.find((s: Subject) => s.id === assignment.subjectId);
            if (subj) {
              setSelectedSubject(subj);
            }
          } catch (error) {
            console.error('Error loading subject:', error);
          }
        }
      } catch (error) {
        console.error('Error loading assignment:', error);
        Alert.alert(
          'Error',
          'Failed to load assignment. Please try again.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } finally {
        setIsLoading(false);
      }
    };
    
    if (id) {
      loadAssignment();
    } else {
      router.back();
    }
  }, [id]);
  
  // Handle saving the updated assignment
  const handleUpdate = async () => {
    if (!title.trim()) {
      Alert.alert(
        'Error',
        'Please enter a title for the assignment.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    try {
      setIsSaving(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Prepare the updated assignment data
      const updatedAssignment = {
        title: title.trim(),
        description: description.trim(),
        dueDate: dueDate.toISOString(),
        isPriority,
        assignmentType,
        courseCode: selectedSubject ? selectedSubject.name : courseName,
        courseName: selectedSubject ? selectedSubject.name : courseName,
        periodId: periodId,
        subjectId: selectedSubject ? selectedSubject.id : subjectId,
        subtasks
      };
      
      // Update the assignment
      await updateAssignment(id, updatedAssignment);
      
      // Navigate back
      router.back();
    } catch (error) {
      console.error('Error updating assignment:', error);
      Alert.alert(
        'Error',
        'Failed to update assignment. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle cancellation
  const handleCancel = () => {
    router.back();
  };
  
  // Handle adding a subtask
  const handleAddSubtask = () => {
    if (newSubtaskTitle.trim() === '') return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newSubtask = {
      id: Date.now().toString(),
      title: newSubtaskTitle.trim(),
      isCompleted: false
    };
    
    setSubtasks([...subtasks, newSubtask]);
    setNewSubtaskTitle('');
  };
  
  // Handle removing a subtask
  const handleRemoveSubtask = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubtasks(subtasks.filter(subtask => subtask.id !== id));
  };
  
  // Handle type selection
  const handleTypeSelection = (type: AssignmentType) => {
    setAssignmentType(type);
    setIsTypeModalVisible(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  
  // Get icon for each assignment type
  const getTypeIcon = (): any => {
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
  
  // If still loading, show loading indicator
  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#3478F6" />
        <Text style={styles.loadingText}>{t('assignments').loading}</Text>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={handleCancel}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={28} color="#3478F6" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('assignments').editTitle}</Text>
        <TouchableOpacity 
          style={[styles.saveButton, !title.trim() && styles.saveButtonDisabled]}
          onPress={handleUpdate}
          disabled={!title.trim() || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>{t('assignments').update}</Text>
          )}
        </TouchableOpacity>
      </View>
      
      {/* Main Content */}
      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.formContainer}
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={20}
      >
        {/* Title Input */}
        <View style={styles.inputContainer}>
          <TextInput
            ref={titleInputRef}
            style={styles.titleInput}
            placeholder={t('assignments').titlePlaceholder}
            placeholderTextColor="#8A8A8D"
            value={title}
            onChangeText={setTitle}
            autoCapitalize="sentences"
            autoCorrect={true}
            maxLength={100}
          />
        </View>
        
        {/* Description Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>
            {t('assignments').description}
            <Text style={styles.optionalText}> ({t('assignments').optional})</Text>
          </Text>
          <TextInput
            style={styles.descriptionInput}
            placeholder={t('assignments').descriptionPlaceholder}
            placeholderTextColor="#8A8A8D"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            autoCapitalize="sentences"
            autoCorrect={true}
            maxLength={500}
          />
        </View>
        
        {/* Assignment Type */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>{t('assignments').type}</Text>
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
        </View>
        
        {/* Due Date - show DatePicker immediately */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>{t('assignments').dueDate}</Text>
          <DatePicker
            selectedDate={dueDate}
            onDateChange={setDueDate}
            formatDate={(date) => date.toLocaleDateString(currentLanguage, {
              weekday: 'short',
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })}
            currentLanguage={currentLanguage}
            days={t('weekdays').short}
            quickDateOptions={[
              { label: t('assignments').days.today, days: 0 },
              { label: t('assignments').days.tomorrow, days: 1 },
              { label: t('assignments').days.nextWeek, days: 7 },
              { label: t('assignments').days.inTwoWeeks, days: 14 },
            ]}
          />
        </View>
        
        {/* Due Time - show TimePicker immediately */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>{t('assignments').dueTime}</Text>
          <TimePicker
            selectedTime={dueDate}
            onTimeChange={(time) => {
              const newDate = new Date(dueDate);
              newDate.setHours(time.getHours(), time.getMinutes());
              setDueDate(newDate);
            }}
            timePresets={[
              { label: t('assignments').periods.first, hour: 8, minute: 0 },
              { label: t('assignments').periods.second, hour: 9, minute: 30 },
              { label: t('assignments').periods.third, hour: 11, minute: 20 },
              { label: t('assignments').periods.fourth, hour: 12, minute: 50 },
              { label: t('assignments').periods.fifth, hour: 14, minute: 20 },
            ]}
          />
        </View>
        
        {/* Priority Toggle */}
        <View style={styles.inputContainer}>
          <View style={styles.toggleRow}>
            <Text style={styles.inputLabel}>{t('assignments').markAsPriority}</Text>
            <CustomToggle
              value={isPriority}
              onValueChange={setIsPriority}
            />
          </View>
        </View>
        
        {/* Subtasks */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>{t('assignments').subtasks.title}</Text>
          
          {/* Existing Subtasks */}
          {subtasks.map((subtask, index) => (
            <View key={subtask.id} style={styles.subtaskItem}>
              <TouchableOpacity
                style={styles.subtaskCheckbox}
                onPress={() => {
                  const updatedSubtasks = [...subtasks];
                  updatedSubtasks[index].isCompleted = !updatedSubtasks[index].isCompleted;
                  setSubtasks(updatedSubtasks);
                }}
              >
                {subtask.isCompleted && (
                  <Ionicons name="checkmark" size={16} color="#3478F6" />
                )}
              </TouchableOpacity>
              <Text style={[
                styles.subtaskTitle,
                subtask.isCompleted && styles.subtaskTitleCompleted
              ]}>
                {subtask.title}
              </Text>
              <TouchableOpacity
                style={styles.subtaskDeleteButton}
                onPress={() => handleRemoveSubtask(subtask.id)}
              >
                <Ionicons name="close-circle" size={18} color="#8A8A8D" />
              </TouchableOpacity>
            </View>
          ))}
          
          {/* Add New Subtask */}
          <View style={styles.addSubtaskContainer}>
            <TextInput
              style={styles.subtaskInput}
              placeholder={t('assignments').subtasks.placeholder}
              placeholderTextColor="#8A8A8D"
              value={newSubtaskTitle}
              onChangeText={setNewSubtaskTitle}
              onSubmitEditing={handleAddSubtask}
            />
            <TouchableOpacity
              style={[
                styles.addSubtaskButton,
                newSubtaskTitle.trim() === '' && styles.addSubtaskButtonDisabled
              ]}
              onPress={handleAddSubtask}
              disabled={newSubtaskTitle.trim() === ''}
            >
              <Ionicons 
                name="add" 
                size={20} 
                color={newSubtaskTitle.trim() === '' ? "#8A8A8D" : "#FFFFFF"} 
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.subtaskHint}>{t('assignments').subtasks.hint}</Text>
        </View>
      </KeyboardAwareScrollView>

      {/* Assignment Type Selection Modal - Using Portal */}
      <ModernDropdownPortal
        title={t('assignments').type}
        isVisible={isTypeModalVisible}
        onClose={() => setIsTypeModalVisible(false)}
        items={Object.values(AssignmentType).map(type => {
          // Get appropriate icon for this type
          const getTypeSpecificIcon = () => {
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
          
          return {
            id: type,
            label: t('assignments').types[type.toLowerCase() as 'homework' | 'test' | 'exam' | 'project' | 'quiz' | 'lab' | 'essay' | 'presentation' | 'other'],
            icon: <Ionicons 
              name={getTypeSpecificIcon() as any} 
              size={24}
              color="#FFFFFF"
            />,
            isSelected: type === assignmentType
          };
        })}
        selectedItemId={assignmentType}
        onSelectItem={(item: SegmentItem) => handleTypeSelection(item.id as AssignmentType)}
        maxOptions={7}
      />
    </SafeAreaView>
  );
}

// Simplified styles - in a real app, you'd import the styles from shared file
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141414',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#141414',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  saveButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#3478F6',
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#2A2A2A',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  scrollView: {
    flex: 1,
  },
  formContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  inputContainer: {
    marginTop: 24,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  optionalText: {
    color: '#8A8A8D',
    fontWeight: '400',
  },
  titleInput: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  descriptionInput: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#FFFFFF',
    height: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  typeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  typeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIcon: {
    marginRight: 8,
  },
  typeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  datePickerContainer: {
    marginTop: 8,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  datePickerContent: {
    flexDirection: 'column',
    width: '100%',
  },
  dateDisplayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  dateDisplayText: {
    color: '#FFFFFF',
    fontSize: 16,
    flex: 1,
    marginLeft: 8,
  },
  quickOptionsContainer: {
    marginBottom: 0,
    paddingHorizontal: 4,
    paddingBottom: 2,
  },
  quickOptionsScrollContent: {
    paddingHorizontal: 4,
    paddingBottom: 2,
  },
  calendarContainer: {
    marginTop: 8,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calendarNavButton: {
    padding: 8,
    borderRadius: 8,
  },
  calendarMonthYear: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  calendarDaysHeader: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  calendarDayHeaderText: {
    flex: 1,
    textAlign: 'center',
    color: '#8A8A8D',
    fontSize: 12,
    fontWeight: '600',
  },
  calendarDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayCell: {
    width: '14.28%',
    padding: 2,
    alignItems: 'center',
  },
  calendarDayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  calendarDayButtonSelected: {
    backgroundColor: '#3478F6',
  },
  calendarDayButtonToday: {
    borderWidth: 1,
    borderColor: '#3478F6',
  },
  calendarDayText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  calendarDayTextOtherMonth: {
    color: '#4D4D4D',
  },
  calendarDayTextToday: {
    color: '#3478F6',
    fontWeight: '600',
  },
  calendarDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  todayDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3478F6',
  },
  todayButton: {
    alignSelf: 'center',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3478F6',
  },
  todayButtonText: {
    color: '#3478F6',
    fontSize: 14,
    fontWeight: '500',
  },
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
    backgroundColor: '#3478F6',
  },
  timePresetButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  timePresetButtonTextSelected: {
    fontWeight: '600',
  },
  timePresetTimeText: {
    color: '#8A8A8D',
    fontSize: 12,
  },
  timePresetTimeTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // Time wheel styles
  timeWheelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  timeWheelGroup: {
    alignItems: 'center',
    marginHorizontal: 8,
  },
  timeWheelLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    marginBottom: 8,
    opacity: 0.7,
  },
  timeWheel: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#242424',
    borderRadius: 12,
    padding: 8,
    width: 80,
  },
  timeWheelButton: {
    padding: 8,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeWheelText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '600',
    marginVertical: 8,
  },
  timeWheelSeparator: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '600',
    marginHorizontal: 10,
  },
  amPmToggle: {
    backgroundColor: '#242424',
    padding: 10,
    borderRadius: 12,
    width: 80,
    alignItems: 'center',
  },
  amPmToggleText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  datePickerButtonText: {
    color: '#FFFFFF',
    marginLeft: 8,
    fontSize: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subtaskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  subtaskCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#3478F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  subtaskTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
  },
  subtaskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#8A8A8D',
  },
  subtaskDeleteButton: {
    padding: 4,
  },
  addSubtaskContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  subtaskInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    padding: 4,
  },
  addSubtaskButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3478F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSubtaskButtonDisabled: {
    backgroundColor: '#2A2A2A',
  },
  subtaskHint: {
    color: '#8A8A8D',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  quickDateButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#242424',
    borderRadius: 8,
    marginRight: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333333',
    minWidth: 100,
  },
  quickDateButtonSelected: {
    backgroundColor: '#3478F6',
    borderColor: '#3478F6',
  },
  quickDateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 4,
  },
  quickDateButtonTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  quickDateTimeText: {
    color: '#8A8A8D',
    fontSize: 12,
  },
  quickDateTimeTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
}); 
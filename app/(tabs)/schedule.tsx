import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { scheduleService, CLASS_ID, DAYS_MAP, ApiResponse } from '@/services/scheduleService';
import { useTranslation } from '@/hooks/useTranslation';

export default function Schedule() {
  const [scheduleData, setScheduleData] = useState<ApiResponse | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const isEvenWeek = scheduleService.isEvenWeek(selectedDate);
  const { t, formatDate } = useTranslation();
  const [settings, setSettings] = useState(scheduleService.getSettings());

  useEffect(() => {
    const unsubscribe = scheduleService.subscribe(() => {
      setSettings(scheduleService.getSettings());
    });
    return () => unsubscribe();
  }, []);

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

  // Get the start of the week (Monday)
  const startOfWeek = new Date(selectedDate);
  startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay() + 1);

  // Generate array of 5 days (Monday to Friday)
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

  const getDaySchedule = () => {
    if (!scheduleData) return [];
    const day = selectedDate.getDay();
    if (day === 0 || day === 6) return []; // Return empty array for weekends
    
    const dayKey = DAYS_MAP[day as keyof typeof DAYS_MAP];
    if (!dayKey) return [];
    return scheduleService.getScheduleForDay(scheduleData, dayKey);
  };

  const todaySchedule = getDaySchedule();
  const isWeekend = selectedDate.getDay() === 0 || selectedDate.getDay() === 6;

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
            // Skip items that don't match the current week type
            if (item.isEvenWeek !== undefined && item.isEvenWeek !== isEvenWeek) {
              return null;
            }

            return (
              <View key={index} style={styles.scheduleItem}>
                <View style={styles.timeSlot}>
                  <Text style={styles.time}>{item.startTime}</Text>
                  <Text style={styles.time}>{item.endTime}</Text>
                </View>
                <View style={[styles.classCard, { borderLeftColor: getSubjectColor(item.className) }]}>
                  <Text style={styles.className}>{item.className}</Text>
                  <View style={styles.classDetails}>
                    <Text style={styles.teacherName}>{item.teacherName}</Text>
                    <Text style={styles.roomNumber}>{t('schedule').room} {item.roomNumber}</Text>
                  </View>
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

const styles = StyleSheet.create({
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
    flexDirection: 'row',
    marginBottom: 16,
  },
  timeSlot: {
    width: 60,
    justifyContent: 'center',
  },
  time: {
    color: '#8A8A8D',
    fontSize: 12,
    fontWeight: '500',
  },
  classCard: {
    flex: 1,
    backgroundColor: '#232433',
    borderRadius: 12,
    padding: 16,
    marginLeft: 12,
    borderLeftWidth: 4,
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
});
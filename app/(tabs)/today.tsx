import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { scheduleService, CLASS_ID, DAYS_MAP, ApiResponse } from '@/services/scheduleService';
import { useTranslation } from '@/hooks/useTranslation';

export default function Today() {
  const [scheduleData, setScheduleData] = useState<ApiResponse | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const currentDate = new Date();
  const isEvenWeek = scheduleService.isEvenWeek(selectedDate);
  const { t, formatDate } = useTranslation();
  const [settings, setSettings] = useState(scheduleService.getSettings());
  
  useEffect(() => {
    const unsubscribe = scheduleService.subscribe(() => {
      setSettings(scheduleService.getSettings());
    });
    return () => unsubscribe();
  }, []);

  // Generate 5 days starting from current day
  const weekDates = Array.from({ length: 5 }, (_, i) => {
    const date = new Date(currentDate);
    date.setDate(currentDate.getDate() + i);
    return {
      date,
      day: t('weekdays').short[date.getDay()],
      dateNum: date.getDate(),
    };
  });

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

  const handleDatePress = (date: Date) => {
    setSelectedDate(date);
  };

  const todaySchedule = scheduleData 
    ? scheduleService.getScheduleForDay(scheduleData, DAYS_MAP[selectedDate.getDay() as keyof typeof DAYS_MAP])
    : [];

  // Handle empty schedule differently for weekends
  const isWeekend = selectedDate.getDay() === 0 || selectedDate.getDay() === 6;

  return (
    <SafeAreaView style={styles.container}>
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
        <View style={styles.dateList}>
          {weekDates.map((date, index) => (
            <TouchableOpacity 
              key={index} 
              onPress={() => handleDatePress(date.date)}
              style={[
                styles.dateItem,
                date.dateNum === selectedDate.getDate() && styles.activeDateItem
              ]}
            >
              <Text style={[
                styles.dateDay, 
                date.dateNum === selectedDate.getDate() && styles.activeDateText
              ]}>
                {date.day}
              </Text>
              <Text style={[
                styles.dateNumber, 
                date.dateNum === selectedDate.getDate() && styles.activeDateText
              ]}>
                {date.dateNum}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

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

            return (
              <View key={index} style={styles.scheduleItem}>
                <View style={styles.timeContainer}>
                  <Text style={styles.time}>{item.startTime}</Text>
                  <Text style={styles.time}>{item.endTime}</Text>
                </View>
                <View style={[styles.classInfo, { borderLeftColor: getSubjectColor(item.className) }]}>
                  <View style={styles.classContent}>
                    <Text style={styles.className}>{item.className}</Text>
                    <View style={styles.detailsContainer}>
                      <View style={styles.teacherContainer}>
                        <Text style={styles.teacherName}>{item.teacherName}</Text>
                      </View>
                      <View style={styles.roomContainer}>
                        <Text style={styles.roomNumber}>{t('schedule').room} {item.roomNumber}</Text>
                      </View>
                    </View>
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
  
  // Generate a number from the subject name
  let hash = 0;
  for (let i = 0; i < subjectName.length; i++) {
    hash = subjectName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Use the hash to pick a color
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
    marginRight: 16,
  },
  dateList: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  dateItem: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    minWidth: 60,
  },
  activeDateItem: {
    backgroundColor: '#3478F6',
    transform: [{ scale: 1.05 }],
    shadowColor: '#3478F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 6,
  },
  dateDay: {
    color: '#8A8A8D',
    fontSize: 14,
    fontWeight: '600',
  },
  dateNumber: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 4,
  },
  activeDateText: {
    color: '#fff',
  },
  scheduleContainer: {
    flex: 1,
    padding: 20,
  },
  scheduleItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timeContainer: {
    width: 80,
    justifyContent: 'center',
  },
  time: {
    color: '#8A8A8D',
    fontSize: 14,
    fontWeight: '500',
  },
  classInfo: {
    flex: 1,
    backgroundColor: '#232433',
    borderRadius: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  classContent: {
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
});
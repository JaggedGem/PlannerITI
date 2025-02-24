import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ClassScheduleItem {
  startTime: string;
  endTime: string;
  className: string;
  roomNumber: string;
  status?: 'missing' | 'none';
  color?: string;
}

export default function Today() {
  const currentDate = new Date('2023-10-18');
  
  const schedule: ClassScheduleItem[] = [
    {
      startTime: '09:10 AM',
      endTime: '10:00 AM',
      className: 'MGT 101 - Organization Management',
      roomNumber: 'Room 101',
      status: 'missing',
      color: '#FFA500'
    },
    {
      startTime: '09:10 AM',
      endTime: '10:00 AM',
      className: 'EC 203 - Principles Macroeconomics',
      roomNumber: 'Room 213',
      status: 'missing',
      color: '#00CED1'
    },
    {
      startTime: '10:10 AM',
      endTime: '11:00 AM',
      className: 'EC 202 - Principles Microeconomics',
      roomNumber: 'Room 302',
      color: '#FF69B4'
    },
    {
      startTime: '11:10 AM',
      endTime: '12:00 AM',
      className: 'FN 215 - Financial Management',
      roomNumber: 'Room 111',
      color: '#4169E1'
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>October 18th, 2023</Text>
        <View style={styles.dateList}>
          {[18, 19, 20, 21, 22].map((date, index) => (
            <View 
              key={date} 
              style={[
                styles.dateItem,
                date === 18 && styles.activeDateItem
              ]}
            >
              <Text style={[styles.dateDay, date === 18 && styles.activeDateText]}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][index]}
              </Text>
              <Text style={[styles.dateNumber, date === 18 && styles.activeDateText]}>
                {date}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView style={styles.scheduleContainer}>
        {schedule.map((item, index) => (
          <View key={index} style={styles.scheduleItem}>
            <View style={styles.timeContainer}>
              <Text style={styles.time}>{item.startTime}</Text>
              <Text style={styles.time}>{item.endTime}</Text>
            </View>
            <View style={[styles.classInfo, { borderLeftColor: item.color }]}>
              <Text style={styles.className}>{item.className}</Text>
              <View style={styles.roomContainer}>
                <Text style={styles.roomNumber}>{item.roomNumber}</Text>
                {item.status === 'missing' && (
                  <View style={styles.missingBadge}>
                    <Text style={styles.missingText}>Missing assignment</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1b26',
  },
  header: {
    padding: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 20,
  },
  dateList: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateItem: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
  },
  activeDateItem: {
    backgroundColor: '#3478F6',
  },
  dateDay: {
    color: '#666',
    fontSize: 16,
  },
  dateNumber: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
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
  },
  time: {
    color: '#666',
    fontSize: 14,
  },
  classInfo: {
    flex: 1,
    backgroundColor: '#2a2b36',
    borderRadius: 10,
    padding: 15,
    borderLeftWidth: 4,
  },
  className: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  roomContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  roomNumber: {
    color: '#666',
    fontSize: 14,
  },
  missingBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 10,
  },
  missingText: {
    color: 'white',
    fontSize: 12,
  },
});
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Switch,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { addAssignment, getCourses } from '../utils/assignmentStorage';
import { scheduleService, Period, DAYS_MAP } from '../services/scheduleService';
import { Picker } from '@react-native-picker/picker';
import Animated, { FadeInUp } from 'react-native-reanimated';

// Define picker item type
interface PickerItem {
  label: string;
  value: string;
  day?: string;
  time?: string;
  color?: string;
}

interface Course {
  code: string;
  name: string;
}

interface UniquePeriod {
  id: string;
  className: string;
  day: string;
  period: string;
  time: string;
}

export default function NewAssignmentScreen() {
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [dueDate, setDueDate] = useState(new Date());
  const [isPriority, setIsPriority] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  
  // Periods data
  const [uniquePeriods, setUniquePeriods] = useState<UniquePeriod[]>([]);
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [viewMode, setViewMode] = useState<'courses' | 'periods'>('courses');
  
  useEffect(() => {
    // Load periods directly from scheduleService
    const loadPeriods = async () => {
      setLoadingPeriods(true);
      try {
        const { selectedGroupId } = scheduleService.getSettings();
        const scheduleData = await scheduleService.getClassSchedule(selectedGroupId);
        
        // Create a Map to track unique periods by their class name
        const periodsMap = new Map<string, UniquePeriod>();
        
        // Process all days of the week
        Object.entries(DAYS_MAP).forEach(([dayNum, dayName]) => {
          const formattedDayName = dayName.charAt(0).toUpperCase() + dayName.slice(1);
          const dayItems = scheduleService.getScheduleForDay(scheduleData, dayName as any);
          
          // Process each period of the day
          dayItems.forEach(item => {
            // Skip recovery info items
            if (item.period === 'recovery-info') return;
            
            // Create unique ID for this specific period
            const periodId = `${dayName}_${item.period}`;
            
            // Create period object
            const periodObj: UniquePeriod = {
              id: periodId,
              className: item.className,
              day: formattedDayName,
              period: item.period,
              time: `${item.startTime} - ${item.endTime}`
            };
            
            // Use class name as a key to avoid duplicates
            if (!periodsMap.has(item.className)) {
              periodsMap.set(item.className, periodObj);
            }
          });
        });
        
        // Convert Map to array
        setUniquePeriods(Array.from(periodsMap.values()));
      } catch (error) {
        console.error('Error loading periods:', error);
      } finally {
        setLoadingPeriods(false);
      }
    };
    
    // Load available courses
    const loadCourses = async () => {
      try {
        const courses = await getCourses();
        setAvailableCourses(courses);
        if (courses.length > 0) {
          setCourseCode(courses[0].code);
          setCourseName(courses[0].name);
        }
      } catch (error) {
        console.error('Error loading courses:', error);
      }
    };
    
    loadPeriods();
    loadCourses();
  }, []);
  
  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  // Format time for display
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Save assignment and navigate back
  const handleSave = async () => {
    if (!title || !courseCode) {
      Alert.alert("Error", "Please enter a title and select a course");
      return;
    }
    
    await addAssignment({
      title,
      description,
      courseCode,
      courseName: courseName || courseCode,
      dueDate: dueDate.toISOString(),
      isPriority,
      periodId: selectedPeriodId || undefined
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>New Assignment</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={handleSave} 
            style={[styles.saveButton, (!title || !courseCode) && styles.saveButtonDisabled]}
            disabled={!title || !courseCode}
          >
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInUp.duration(300).delay(50)}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="Assignment title"
            placeholderTextColor="#8A8A8D"
            value={title}
            onChangeText={setTitle}
            maxLength={50}
          />
        </Animated.View>
        
        <Animated.View entering={FadeInUp.duration(300).delay(100)}>
          <Text style={styles.label}>Description (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Add details about the assignment"
            placeholderTextColor="#8A8A8D"
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={200}
          />
        </Animated.View>
        
        <Animated.View entering={FadeInUp.duration(300).delay(150)}>
          <View style={styles.sectionHeader}>
            <Text style={styles.label}>Course or Period</Text>
            <View style={styles.segmentedControl}>
              <TouchableOpacity 
                style={[
                  styles.segmentButton, 
                  viewMode === 'courses' && styles.segmentButtonActive
                ]}
                onPress={() => setViewMode('courses')}
              >
                <Text style={[
                  styles.segmentButtonText,
                  viewMode === 'courses' && styles.segmentButtonTextActive
                ]}>Courses</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.segmentButton, 
                  viewMode === 'periods' && styles.segmentButtonActive
                ]}
                onPress={() => setViewMode('periods')}
              >
                <Text style={[
                  styles.segmentButtonText,
                  viewMode === 'periods' && styles.segmentButtonTextActive
                ]}>Periods</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {viewMode === 'courses' ? (
            <View style={styles.pickerContainer}>
              {availableCourses.length > 0 ? (
                <View>
                  {availableCourses.map((course) => (
                    <TouchableOpacity
                      key={course.code}
                      style={[
                        styles.courseCard,
                        courseCode === course.code && styles.courseCardSelected
                      ]}
                      onPress={() => {
                        setCourseCode(course.code);
                        setCourseName(course.name);
                      }}
                    >
                      <View style={styles.courseInfo}>
                        <Text style={styles.courseCode}>{course.code}</Text>
                        <Text style={styles.courseName}>{course.name}</Text>
                      </View>
                      {courseCode === course.code && (
                        <Ionicons name="checkmark-circle" size={24} color="#3478F6" />
                      )}
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={styles.newCourseButton}
                    onPress={() => {
                      setCourseCode('');
                      setCourseName('');
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={20} color="#3478F6" />
                    <Text style={styles.newCourseText}>Add New Course</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.courseInputContainer}>
                  <View style={styles.courseInputRow}>
                    <Text style={styles.courseInputLabel}>Course Code:</Text>
                    <TextInput
                      style={styles.courseInput}
                      value={courseCode}
                      onChangeText={setCourseCode}
                      placeholder="e.g. MATH101"
                      placeholderTextColor="#8A8A8D"
                    />
                  </View>
                  <View style={styles.courseInputRow}>
                    <Text style={styles.courseInputLabel}>Course Name:</Text>
                    <TextInput
                      style={styles.courseInput}
                      value={courseName}
                      onChangeText={setCourseName}
                      placeholder="e.g. Calculus"
                      placeholderTextColor="#8A8A8D"
                    />
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.pickerContainer}>
              {loadingPeriods ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#3478F6" />
                  <Text style={styles.loadingText}>Loading periods...</Text>
                </View>
              ) : (
                <View>
                  {uniquePeriods.map((period) => (
                    <TouchableOpacity
                      key={period.id}
                      style={[
                        styles.periodCard,
                        selectedPeriodId === period.id && styles.periodCardSelected
                      ]}
                      onPress={() => {
                        setSelectedPeriodId(period.id);
                        setCourseCode(''); // Clear course when period is selected
                        setCourseName(period.className);
                      }}
                    >
                      <View style={styles.periodMainInfo}>
                        <Text style={styles.periodClassName}>{period.className}</Text>
                        <Text style={styles.periodDetails}>
                          {period.day}, Period {period.period}
                        </Text>
                      </View>
                      <View style={styles.periodTimeInfo}>
                        <Text style={styles.periodTime}>{period.time}</Text>
                        {selectedPeriodId === period.id && (
                          <Ionicons name="checkmark-circle" size={24} color="#3478F6" />
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
          
          {courseCode === '' && viewMode === 'courses' && (
            <View style={styles.courseInputContainer}>
              <View style={styles.courseInputRow}>
                <Text style={styles.courseInputLabel}>Course Code:</Text>
                <TextInput
                  style={styles.courseInput}
                  value={courseCode}
                  onChangeText={setCourseCode}
                  placeholder="e.g. MATH101"
                  placeholderTextColor="#8A8A8D"
                />
              </View>
              <View style={styles.courseInputRow}>
                <Text style={styles.courseInputLabel}>Course Name:</Text>
                <TextInput
                  style={styles.courseInput}
                  value={courseName}
                  onChangeText={setCourseName}
                  placeholder="e.g. Calculus"
                  placeholderTextColor="#8A8A8D"
                />
              </View>
            </View>
          )}
        </Animated.View>
        
        <Animated.View entering={FadeInUp.duration(300).delay(250)}>
          <Text style={styles.label}>Due Date</Text>
          <View style={styles.datePickerContainer}>
            <View style={styles.dateButtonsRow}>
              <TouchableOpacity 
                style={styles.dateAdjustButton} 
                onPress={() => adjustDate(-1)}
              >
                <Ionicons name="chevron-back" size={22} color="#3478F6" />
              </TouchableOpacity>
              
              <View style={styles.dateDisplay}>
                <Text style={styles.dateText}>{formatDate(dueDate)}</Text>
              </View>
              
              <TouchableOpacity 
                style={styles.dateAdjustButton} 
                onPress={() => adjustDate(1)}
              >
                <Ionicons name="chevron-forward" size={22} color="#3478F6" />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
        
        <Animated.View entering={FadeInUp.duration(300).delay(300)}>
          <Text style={styles.label}>Due Time</Text>
          <View style={styles.datePickerContainer}>
            <View style={styles.timeButtonsRow}>
              <View style={styles.timeSection}>
                <TouchableOpacity 
                  style={styles.timeAdjustButton} 
                  onPress={() => adjustHour(1)}
                >
                  <Ionicons name="chevron-up" size={22} color="#3478F6" />
                </TouchableOpacity>
                
                <Text style={styles.timeText}>
                  {dueDate.getHours() > 12 ? dueDate.getHours() - 12 : dueDate.getHours() === 0 ? 12 : dueDate.getHours()}
                </Text>
                
                <TouchableOpacity 
                  style={styles.timeAdjustButton} 
                  onPress={() => adjustHour(-1)}
                >
                  <Ionicons name="chevron-down" size={22} color="#3478F6" />
                </TouchableOpacity>
              </View>
              
              <Text style={styles.timeSeparator}>:</Text>
              
              <View style={styles.timeSection}>
                <TouchableOpacity 
                  style={styles.timeAdjustButton} 
                  onPress={() => adjustMinute(5)}
                >
                  <Ionicons name="chevron-up" size={22} color="#3478F6" />
                </TouchableOpacity>
                
                <Text style={styles.timeText}>
                  {dueDate.getMinutes() < 10 ? `0${dueDate.getMinutes()}` : dueDate.getMinutes()}
                </Text>
                
                <TouchableOpacity 
                  style={styles.timeAdjustButton} 
                  onPress={() => adjustMinute(-5)}
                >
                  <Ionicons name="chevron-down" size={22} color="#3478F6" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.timeSection}>
                <TouchableOpacity 
                  style={styles.timeAdjustButton} 
                  onPress={() => {
                    const newDate = new Date(dueDate);
                    if (newDate.getHours() >= 12) {
                      newDate.setHours(newDate.getHours() - 12);
                    } else {
                      newDate.setHours(newDate.getHours() + 12);
                    }
                    setDueDate(newDate);
                  }}
                >
                  <Text style={styles.amPmText}>
                    {dueDate.getHours() >= 12 ? 'PM' : 'AM'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Animated.View>
        
        <Animated.View entering={FadeInUp.duration(300).delay(400)} style={styles.priorityContainer}>
          <Text style={styles.label}>Mark as Priority</Text>
          <Switch
            value={isPriority}
            onValueChange={setIsPriority}
            trackColor={{ false: '#3e3e3e', true: '#2C3DCD' }}
            thumbColor={isPriority ? '#3478F6' : '#f4f3f4'}
            ios_backgroundColor="#3e3e3e"
          />
        </Animated.View>
        
        {/* Add spacing at the bottom for better scroll experience */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
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
    backgroundColor: '#3478F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    backgroundColor: 'rgba(52, 120, 246, 0.4)',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
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
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333333',
  },
  segmentButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  segmentButtonActive: {
    backgroundColor: '#3478F6',
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
  priorityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  pickerContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    overflow: 'hidden',
  },
  picker: {
    color: '#FFFFFF',
    backgroundColor: 'transparent',
  },
  pickerItem: {
    fontSize: 16,
    height: 120,
    color: '#FFFFFF',
  },
  courseInputContainer: {
    padding: 12,
  },
  courseInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  courseInputLabel: {
    width: 100,
    color: '#FFFFFF',
    fontSize: 14,
  },
  courseInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    paddingVertical: 4,
  },
  bottomSpacing: {
    height: 40,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  loadingText: {
    color: '#8A8A8D',
    marginLeft: 8,
  },
  datePickerContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    padding: 12,
  },
  dateButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateAdjustButton: {
    padding: 8,
  },
  dateDisplay: {
    flex: 1,
    alignItems: 'center',
  },
  dateText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  timeButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeSection: {
    alignItems: 'center',
    width: 60,
  },
  timeAdjustButton: {
    padding: 8,
  },
  timeText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  timeSeparator: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginHorizontal: 8,
  },
  amPmText: {
    color: '#3478F6',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 16,
  },
  courseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  courseCardSelected: {
    backgroundColor: 'rgba(52, 120, 246, 0.1)',
  },
  courseInfo: {
    flex: 1,
  },
  courseCode: {
    color: '#3478F6',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  courseName: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  newCourseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    justifyContent: 'center',
  },
  newCourseText: {
    color: '#3478F6',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  periodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  periodCardSelected: {
    backgroundColor: 'rgba(52, 120, 246, 0.1)',
  },
  periodMainInfo: {
    flex: 1,
  },
  periodClassName: {
    color: '#3478F6',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  periodDetails: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  periodTimeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  periodTime: {
    color: '#8A8A8D',
    fontSize: 14,
    marginRight: 8,
  }
}); 
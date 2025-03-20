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
  Alert,
  FlatList,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { addAssignment } from '../utils/assignmentStorage';
import { scheduleService, DAYS_MAP, Subject } from '../services/scheduleService';
import Animated, { FadeInUp } from 'react-native-reanimated';

export default function NewAssignmentScreen() {
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [courseName, setCourseName] = useState('');
  const [dueDate, setDueDate] = useState(new Date());
  const [isPriority, setIsPriority] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [useNextPeriod, setUseNextPeriod] = useState(true);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [nextPeriodInfo, setNextPeriodInfo] = useState<{day: string, time: string} | null>(null);
  const [loadingNextPeriod, setLoadingNextPeriod] = useState(false);
  
  // Subject selection states
  const [subjectSelectionMode, setSubjectSelectionMode] = useState<'recent'|'all'|'custom'>('recent');
  
  // Subjects data
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [filteredSubjects, setFilteredSubjects] = useState<Subject[]>([]);
  const [searchText, setSearchText] = useState('');
  
  // Modal state
  const [isSubjectsModalVisible, setIsSubjectsModalVisible] = useState(false);
  
  useEffect(() => {
    // Load subjects from scheduleService
    const loadSubjects = async () => {
      setLoadingSubjects(true);
      try {
        const subjectsData = await scheduleService.getSubjects();
        setSubjects(subjectsData);
        
        // Set filtered subjects based on selection mode
        updateFilteredSubjects(subjectsData, subjectSelectionMode);
        
        // Set default subject if available
        if (subjectsData.length > 0) {
          setSelectedSubjectId(subjectsData[0].id);
          setCourseName(subjectsData[0].name);
          updateNextPeriodInfo(subjectsData[0].id).catch(err => 
            console.error("Error updating next period info:", err)
          );
        }
      } catch (error) {
        console.error('Error loading subjects:', error);
      } finally {
        setLoadingSubjects(false);
      }
    };
    
    loadSubjects();
  }, []);
  
  // Update filtered subjects when mode changes
  useEffect(() => {
    updateFilteredSubjects(subjects, subjectSelectionMode);
  }, [subjectSelectionMode, subjects]);
  
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
  
  const updateFilteredSubjects = (allSubjects: Subject[], mode: string) => {
    if (mode === 'recent') {
      // Show recent subjects (first 5)
      setFilteredSubjects(allSubjects.slice(0, 5));
    } else if (mode === 'all') {
      // Show all subjects
      setFilteredSubjects(allSubjects);
    } else if (mode === 'custom') {
      // Show only custom subjects
      const customSubjects = allSubjects.filter(s => s.isCustom);
      
      // Ensure unique subjects by ID
      const uniqueSubjects = Array.from(
        new Map(customSubjects.map(item => [item.id, item])).values()
      );
      
      setFilteredSubjects(uniqueSubjects);
    }
  };
  
  // Update next period information when subject selection changes
  const updateNextPeriodInfo = async (subjectId: string) => {
    // Find the selected subject
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject) {
      setNextPeriodInfo(null);
      return;
    }
    
    setLoadingNextPeriod(true);
    try {
      // Get the schedule data for the current group
      const scheduleData = await scheduleService.getClassSchedule();
      
      // Get today's date and the next 7 days to search for upcoming periods
      const today = new Date();
      let foundNextPeriod = false;
      
      // Search through the next 7 days to find the next period for this subject
      for (let i = 0; i < 7; i++) {
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
        
        // Get schedule for this day
        const daySchedule = scheduleService.getScheduleForDay(scheduleData, dayName, searchDate);
        
        // Find the first period for this subject
        const subjectPeriod = daySchedule.find(period => 
          period.className === subject.name && 
          // If we're looking at today, only include periods that haven't started yet
          (i > 0 || (
            period.startTime && 
            isPeriodInFuture(period.startTime)
          ))
        );
        
        if (subjectPeriod) {
          // Get readable day format
          const dayString = searchDate.toLocaleDateString('en-US', { weekday: 'long' });
          
          // Format time
          const formattedTime = formatPeriodTime(subjectPeriod.startTime);
          
          // Set next period info
          setNextPeriodInfo({
            day: dayString,
            time: formattedTime
          });
          
          // Update due date to match next period
          const newDueDate = new Date(searchDate);
          const [hours, minutes] = subjectPeriod.startTime.split(':').map(Number);
          newDueDate.setHours(hours, minutes, 0, 0);
          setDueDate(newDueDate);
          
          foundNextPeriod = true;
          break;
        }
      }
      
      // If no next period was found in the next 7 days
      if (!foundNextPeriod) {
        // Create a default due date (today + 2 days)
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 2);
        defaultDate.setHours(10, 30, 0, 0);
        
        setNextPeriodInfo({
          day: "No upcoming classes found",
          time: "10:30 AM"
        });
        setDueDate(defaultDate);
      }
    } catch (error) {
      console.error('Error getting next period:', error);
      // Fallback to default date
      const fallbackDate = new Date();
      fallbackDate.setDate(fallbackDate.getDate() + 2);
      fallbackDate.setHours(10, 30, 0, 0);
      setDueDate(fallbackDate);
      
      setNextPeriodInfo({
        day: "Next class",
        time: "10:30 AM"
      });
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
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes < 10 ? '0' + minutes : minutes} ${period}`;
  };
  
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
    if (!title || !courseName) {
      Alert.alert("Error", "Please enter a title and select a course");
      return;
    }
    
    await addAssignment({
      title,
      description,
      courseCode: '',
      courseName: courseName,
      dueDate: dueDate.toISOString(),
      isPriority,
      subjectId: selectedSubjectId || undefined
    });
    
    router.back();
  };
  
  // Add new custom subject
  const handleAddCustomSubject = async () => {
    if (!courseName) {
      Alert.alert("Error", "Please enter a course name");
      return;
    }
    
    // Check if this custom subject already exists
    const existingSubject = subjects.find(
      s => s.isCustom && s.name.toLowerCase() === courseName.toLowerCase()
    );
    
    if (existingSubject) {
      // If it exists, just select it instead of creating a duplicate
      setSelectedSubjectId(existingSubject.id);
      updateNextPeriodInfo(existingSubject.id).catch(err => 
        console.error("Error updating next period info:", err)
      );
      Alert.alert("Info", `Subject "${courseName}" already exists and has been selected.`);
      setIsSubjectsModalVisible(false);
      return;
    }
    
    try {
      const newSubject = await scheduleService.addCustomSubject(courseName);
      
      // Add to subjects array without duplicates
      setSubjects(prev => {
        // Ensure no duplicates by checking IDs
        const exists = prev.some(s => s.id === newSubject.id);
        if (exists) return prev;
        return [...prev, newSubject];
      });
      
      setSelectedSubjectId(newSubject.id);
      updateNextPeriodInfo(newSubject.id).catch(err => 
        console.error("Error updating next period info:", err)
      );
      Alert.alert("Success", `Added new subject: ${courseName}`);
      setIsSubjectsModalVisible(false);
    } catch (error) {
      console.error("Error adding custom subject:", error);
      Alert.alert("Error", "Failed to add custom subject");
    }
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
  const handleSubjectSelect = (subject: Subject) => {
    setSelectedSubjectId(subject.id);
    setCourseName(subject.name);
    updateNextPeriodInfo(subject.id).catch(err => 
      console.error("Error updating next period info:", err)
    );
    setIsSubjectsModalVisible(false);
  };

  // Toggle next period selection
  const toggleNextPeriod = () => {
    setUseNextPeriod(!useNextPeriod);
    if (!useNextPeriod) {
      setShowAdvancedOptions(false);
    }
  };

  // Render a subject item for the modal
  const renderSubjectItem = ({ item }: { item: Subject }) => (
    <TouchableOpacity
      style={[
        styles.subjectCard,
        selectedSubjectId === item.id && styles.subjectCardSelected
      ]}
      onPress={() => handleSubjectSelect(item)}
    >
      <View style={styles.subjectMainInfo}>
        <Text style={styles.subjectName}>{item.name}</Text>
        {item.isCustom && (
          <Text style={styles.customBadge}>Custom</Text>
        )}
      </View>
      {selectedSubjectId === item.id && (
        <Ionicons name="checkmark-circle" size={24} color="#3478F6" />
      )}
    </TouchableOpacity>
  );

  // Find the currently selected subject
  const selectedSubject = subjects.find(s => s.id === selectedSubjectId);

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
            style={[styles.saveButton, (!title || !courseName) && styles.saveButtonDisabled]}
            disabled={!title || !courseName}
          >
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <FlatList
        data={[{ key: 'formContent' }]}
        showsVerticalScrollIndicator={false}
        keyExtractor={item => item.key}
        renderItem={({ item }) => (
          <View style={styles.formContainer}>
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
              <Text style={styles.label}>Subject</Text>
              <TouchableOpacity
                style={styles.subjectSelector}
                onPress={() => setIsSubjectsModalVisible(true)}
              >
                {selectedSubject ? (
                  <View style={styles.selectedSubjectDisplay}>
                    <Text style={styles.selectedSubjectText}>{selectedSubject.name}</Text>
                    {selectedSubject.isCustom && (
                      <Text style={styles.customBadgeSmall}>Custom</Text>
                    )}
                  </View>
                ) : (
                  <Text style={styles.subjectPlaceholder}>Select a subject</Text>
                )}
                <Ionicons name="chevron-down" size={20} color="#8A8A8D" />
              </TouchableOpacity>
            </Animated.View>
            
            {/* Next Period Option */}
            {selectedSubjectId && (
              <Animated.View entering={FadeInUp.duration(300).delay(200)} style={styles.nextPeriodContainer}>
                <View style={styles.nextPeriodHeader}>
                  <Text style={styles.label}>Use Next Period</Text>
                  <Switch
                    value={useNextPeriod}
                    onValueChange={toggleNextPeriod}
                    trackColor={{ false: '#3e3e3e', true: '#2C3DCD' }}
                    thumbColor={useNextPeriod ? '#3478F6' : '#f4f3f4'}
                    ios_backgroundColor="#3e3e3e"
                  />
                </View>
                
                {useNextPeriod && (
                  <View style={styles.nextPeriodInfo}>
                    {loadingNextPeriod ? (
                      <View style={styles.loadingNextPeriod}>
                        <ActivityIndicator size="small" color="#3478F6" />
                        <Text style={styles.nextPeriodText}>Finding next class period...</Text>
                      </View>
                    ) : nextPeriodInfo ? (
                      <Text style={styles.nextPeriodText}>
                        This assignment will be due on {nextPeriodInfo.day} at {nextPeriodInfo.time}
                      </Text>
                    ) : (
                      <Text style={styles.nextPeriodText}>
                        No upcoming classes found. Default due date set.
                      </Text>
                    )}
                  </View>
                )}
              </Animated.View>
            )}
            
            {/* Show/Hide Advanced Options Button */}
            {!useNextPeriod && (
              <Animated.View entering={FadeInUp.duration(300).delay(250)}>
                <TouchableOpacity 
                  style={styles.advancedOptionsButton}
                  onPress={() => setShowAdvancedOptions(!showAdvancedOptions)}
                >
                  <Text style={styles.advancedOptionsButtonText}>
                    {showAdvancedOptions ? 'Hide Advanced Options' : 'Show Advanced Options'}
                  </Text>
                  <Ionicons 
                    name={showAdvancedOptions ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color="#3478F6" 
                  />
                </TouchableOpacity>
              </Animated.View>
            )}
            
            {/* Advanced Options Panel (Due Date & Time) */}
            {!useNextPeriod && showAdvancedOptions && (
              <>
                <Animated.View entering={FadeInUp.duration(300).delay(300)}>
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
                
                <Animated.View entering={FadeInUp.duration(300).delay(350)}>
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
              </>
            )}
            
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
              <Text style={styles.modalTitle}>Select Subject</Text>
              <TouchableOpacity onPress={() => setIsSubjectsModalVisible(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            
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
                ]}>Recent</Text>
              </TouchableOpacity>
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
                ]}>All</Text>
              </TouchableOpacity>
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
                ]}>Custom</Text>
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.searchInput}
              placeholder="Search subjects..."
              placeholderTextColor="#8A8A8D"
              value={searchText}
              onChangeText={setSearchText}
            />
            
            {loadingSubjects ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#3478F6" />
                <Text style={styles.loadingText}>Loading subjects...</Text>
              </View>
            ) : filteredSubjects.length > 0 ? (
              <FlatList
                data={filteredSubjects}
                renderItem={renderSubjectItem}
                keyExtractor={item => item.id}
                style={styles.subjectsList}
              />
            ) : (
              <View style={styles.noSubjectsContainer}>
                <Text style={styles.noSubjectsText}>
                  {subjectSelectionMode === 'custom' 
                    ? 'No custom subjects found'
                    : 'No subjects found'}
                </Text>
              </View>
            )}
            
            {subjectSelectionMode === 'custom' && (
              <View style={styles.customInputContainer}>
                <View style={styles.courseInputRow}>
                  <TextInput
                    style={styles.courseInput}
                    value={courseName}
                    onChangeText={setCourseName}
                    placeholder="Enter subject name"
                    placeholderTextColor="#8A8A8D"
                  />
                  <TouchableOpacity 
                    style={styles.addButton}
                    onPress={handleAddCustomSubject}
                    disabled={!courseName}
                  >
                    <Text style={styles.addButtonText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
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
    marginVertical: 12,
  },
  segmentButton: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
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
    alignItems: 'center',
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
  subjectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  subjectCardSelected: {
    backgroundColor: 'rgba(52, 120, 246, 0.1)',
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
    backgroundColor: '#3478F6',
    color: '#FFFFFF',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
    marginLeft: 8,
  },
  customBadgeSmall: {
    backgroundColor: '#3478F6',
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
    backgroundColor: '#3478F6',
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
    backgroundColor: '#141414',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '70%',
    padding: 20,
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
}); 
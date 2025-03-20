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
  Modal,
  Animated as RNAnimated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { addAssignment } from '../utils/assignmentStorage';
import { scheduleService, DAYS_MAP, Subject } from '../services/scheduleService';
import Animated, { 
  FadeInUp, 
  FadeOutDown, 
  FadeIn, 
  FadeOut,
  Layout,
  SlideInRight,
  SlideOutLeft
} from 'react-native-reanimated';

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
            backgroundColor: disabled ? '#777777' : value ? '#2C3DCD' : '#f4f3f4',
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
  const [nextPeriodInfo, setNextPeriodInfo] = useState<{day: string, time: string, weekText?: string} | null>(null);
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
        
        // Find current active period or first period of the day
        const scheduleData = await scheduleService.getClassSchedule();
        const today = new Date();
        const dayIndex = today.getDay(); // 0 = Sunday, 6 = Saturday
        
        // Skip if weekend unless there's a recovery day
        if (dayIndex !== 0 && dayIndex !== 6) {
          // Convert day index to day name
          const dayName = dayIndex === 1 ? 'monday' :
                          dayIndex === 2 ? 'tuesday' :
                          dayIndex === 3 ? 'wednesday' :
                          dayIndex === 4 ? 'thursday' :
                          dayIndex === 5 ? 'friday' : 'monday';
          
          // Check if this is an even or odd week
          const isEvenWeek = scheduleService.isEvenWeek(today);
          
          // Get today's schedule
          const todaySchedule = scheduleService.getScheduleForDay(scheduleData, dayName, today);
          
          // Find current active period or the next period
          const now = new Date();
          const currentHour = now.getHours();
          const currentMinute = now.getMinutes();
          const currentTimeInMinutes = currentHour * 60 + currentMinute;
          
          // Filter periods by current week type
          const relevantPeriods = todaySchedule.filter(
            period => period.isEvenWeek === undefined || period.isEvenWeek === isEvenWeek
          );
          
          // Find current or closest upcoming period
          let targetPeriod = null;
          
          // Find if a period is currently in progress
          for (const period of relevantPeriods) {
            if (!period.startTime || !period.endTime) continue;
            
            const [startHour, startMinute] = period.startTime.split(':').map(Number);
            const [endHour, endMinute] = period.endTime.split(':').map(Number);
            
            const startTimeInMinutes = startHour * 60 + startMinute;
            const endTimeInMinutes = endHour * 60 + endMinute;
            
            // Check if this period is currently in progress or we're just after it (within 10 minutes)
            if ((currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes) ||
                (currentTimeInMinutes > endTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes + 10)) {
              targetPeriod = period;
              break;
            }
          }
          
          // If no current period, find the first period of the day
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
        } else if (subjectsData.length > 0) {
          // Weekend fallback - use first subject
          setSelectedSubjectId(subjectsData[0].id);
          setCourseName(subjectsData[0].name);
          updateNextPeriodInfo(subjectsData[0].id).catch(err => 
            console.error("Error updating next period info:", err)
          );
        }
      } catch (error) {
        console.error('Error loading subjects:', error);
        // Fallback on error - select first subject if available
        if (subjects.length > 0) {
          setSelectedSubjectId(subjects[0].id);
          setCourseName(subjects[0].name);
          updateNextPeriodInfo(subjects[0].id).catch(err => 
            console.error("Error updating next period info:", err)
          );
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
          
          // Get today's schedule
          const todaySchedule = scheduleService.getScheduleForDay(scheduleData, dayName, today);
          
          // Extract unique subjects from today's schedule, considering week type
          const todaySubjectNames = new Set<string>();
          todaySchedule.forEach(period => {
            // Only include periods that are for all weeks or match the current week type
            if (period.className && (period.isEvenWeek === undefined || period.isEvenWeek === isEvenWeek)) {
              todaySubjectNames.add(period.className);
            }
          });
          
          // Filter subjects that are in today's schedule
          const todaySubjects = allSubjects.filter(subject => 
            todaySubjectNames.has(subject.name)
          );
          
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
        
        // Get schedule for this day
        const daySchedule = scheduleService.getScheduleForDay(scheduleData, dayName, searchDate);
        
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
          const dayString = searchDate.toLocaleDateString('en-US', { weekday: 'long' });
          
          // Format time
          const formattedTime = formatPeriodTime(subjectPeriod.startTime);
          
          // Calculate which week this is relative to the current date
          const currentWeek = Math.floor(today.getTime() / (7 * 24 * 60 * 60 * 1000));
          const dueWeek = Math.floor(searchDate.getTime() / (7 * 24 * 60 * 60 * 1000));
          const weekDifference = dueWeek - currentWeek;
          
          let weekText = '';
          if (weekDifference === 0) {
            weekText = 'this week';
          } else if (weekDifference === 1) {
            weekText = 'next week';
          } else {
            weekText = `in ${weekDifference} weeks`;
          }
          
          // Set next period info
          setNextPeriodInfo({
            day: dayString,
            time: formattedTime,
            weekText: weekText
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
    const newValue = !useNextPeriod;
    setUseNextPeriod(newValue);
    // If turning off next period, always show advanced options
    if (!newValue) {
      setShowAdvancedOptions(true);
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
        <Ionicons name="checkmark-circle" size={24} color="#2C3DCD" />
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
            <Text style={[styles.saveButtonText, (!title || !courseName) && styles.saveButtonTextDisabled]}>Save</Text>
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
                  <Text style={[styles.label, !nextPeriodInfo && styles.labelDisabled]}>Use Next Period</Text>
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
                      No upcoming classes found for {selectedSubject?.name || "this subject"} in the next two weeks.
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
                        <Text style={styles.nextPeriodText}>Finding next class period...</Text>
                      </View>
                    ) : nextPeriodInfo ? (
                      <Text style={styles.nextPeriodText}>
                        This assignment will be due {nextPeriodInfo.weekText ? `${nextPeriodInfo.weekText} on ` : 'on '}
                        {nextPeriodInfo.day} at {nextPeriodInfo.time}
                      </Text>
                    ) : (
                      <Text style={styles.nextPeriodText}>
                        No upcoming classes found. Please set a custom due date below.
                      </Text>
                    )}
                  </Animated.View>
                )}
              </Animated.View>
            )}
            
            {/* Advanced Options Panel (Due Date & Time) */}
            {!useNextPeriod && (
              <Animated.View 
                entering={FadeInUp.duration(200)}
                exiting={FadeOutDown.duration(200)}
                layout={Layout.springify()}
              >
                <Animated.View entering={FadeInUp.duration(200).delay(50)}>
                  <Text style={styles.label}>Due Date</Text>
                  <View style={styles.datePickerContainer}>
                    <View style={styles.dateButtonsRow}>
                      <TouchableOpacity 
                        style={styles.dateAdjustButton} 
                        onPress={() => adjustDate(-1)}
                      >
                        <Ionicons name="chevron-back" size={22} color="#2C3DCD" />
                      </TouchableOpacity>
                      
                      <View style={styles.dateDisplay}>
                        <Text style={styles.dateText}>{formatDate(dueDate)}</Text>
                      </View>
                      
                      <TouchableOpacity 
                        style={styles.dateAdjustButton} 
                        onPress={() => adjustDate(1)}
                      >
                        <Ionicons name="chevron-forward" size={22} color="#2C3DCD" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </Animated.View>
                
                <Animated.View entering={FadeInUp.duration(200).delay(100)}>
                  <Text style={styles.label}>Due Time</Text>
                  <View style={styles.datePickerContainer}>
                    <View style={styles.timeButtonsRow}>
                      <View style={styles.timeSection}>
                        <TouchableOpacity 
                          style={styles.timeAdjustButton} 
                          onPress={() => adjustHour(1)}
                        >
                          <Ionicons name="chevron-up" size={22} color="#2C3DCD" />
                        </TouchableOpacity>
                        
                        <Text style={styles.timeText}>
                          {dueDate.getHours() > 12 ? dueDate.getHours() - 12 : dueDate.getHours() === 0 ? 12 : dueDate.getHours()}
                        </Text>
                        
                        <TouchableOpacity 
                          style={styles.timeAdjustButton} 
                          onPress={() => adjustHour(-1)}
                        >
                          <Ionicons name="chevron-down" size={22} color="#2C3DCD" />
                        </TouchableOpacity>
                      </View>
                      
                      <Text style={styles.timeSeparator}>:</Text>
                      
                      <View style={styles.timeSection}>
                        <TouchableOpacity 
                          style={styles.timeAdjustButton} 
                          onPress={() => adjustMinute(5)}
                        >
                          <Ionicons name="chevron-up" size={22} color="#2C3DCD" />
                        </TouchableOpacity>
                        
                        <Text style={styles.timeText}>
                          {dueDate.getMinutes() < 10 ? `0${dueDate.getMinutes()}` : dueDate.getMinutes()}
                        </Text>
                        
                        <TouchableOpacity 
                          style={styles.timeAdjustButton} 
                          onPress={() => adjustMinute(-5)}
                        >
                          <Ionicons name="chevron-down" size={22} color="#2C3DCD" />
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
              </Animated.View>
            )}
            
            <Animated.View entering={FadeInUp.duration(300).delay(400)} style={styles.priorityContainer}>
              <Text style={styles.label}>Mark as Priority</Text>
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
              <Text style={styles.modalTitle}>Select Subject</Text>
              <TouchableOpacity onPress={() => setIsSubjectsModalVisible(false)}>
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
                  ]}>Recent</Text>
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
                  ]}>All</Text>
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
                  ]}>Custom</Text>
                </TouchableOpacity>
              </View>
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
                <ActivityIndicator size="small" color="#2C3DCD" />
                <Text style={styles.loadingText}>Loading subjects...</Text>
              </View>
            ) : filteredSubjects.length > 0 ? (
              <Animated.FlatList
                data={filteredSubjects}
                renderItem={renderSubjectItem}
                keyExtractor={item => item.id}
                style={styles.subjectsList}
                entering={FadeIn.duration(300)}
                key={subjectSelectionMode}
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
    color: '#2C3DCD',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 16,
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
}); 
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, TextInput, Switch, ScrollView, Alert, Platform, StatusBar } from 'react-native';
import { Colors } from '../constants/Colors';
import { useColorScheme } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { addAssignment, sampleCourses } from '../utils/assignmentStorage';
import { LinearGradient } from 'expo-linear-gradient';

export default function NewAssignment() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const darkMode = colorScheme === 'dark';
  
  const [title, setTitle] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(sampleCourses[0]);
  const [details, setDetails] = useState('');
  const [isPriority, setIsPriority] = useState(false);
  const [isAllDay, setIsAllDay] = useState(true);
  const [hasAlert, setHasAlert] = useState(true);
  const [dueDate, setDueDate] = useState(new Date());
  
  const formattedDate = `${dueDate.toLocaleDateString('en-US', { weekday: 'long' })}, ${dueDate.getDate()}${getDaySuffix(dueDate.getDate())} ${dueDate.toLocaleDateString('en-US', { month: 'long' })}`;
  
  const handleSave = async () => {
    // Validate title
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title for the assignment');
      return;
    }
    
    // Create new assignment object
    const newAssignment = {
      id: Date.now().toString(),
      title: title.trim(),
      className: `${selectedCourse.code} - ${selectedCourse.name}`,
      courseCode: selectedCourse.code,
      courseName: selectedCourse.name,
      details: details.trim(),
      isPriority,
      dueDate: dueDate.toISOString(),
      isCompleted: false,
    };
    
    // Save the assignment
    await addAssignment(newAssignment);
    
    // Navigate back to assignments
    router.back();
  };

  const handleCancel = () => {
    router.back();
  };

  // Get course color using the same function as DayView.tsx
  const getCourseColor = (subjectName: string): string => {
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
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#141414', '#0A0A0A']}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New assignment</Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={styles.saveButton}>Save</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.content}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="Eg. Read Book"
            placeholderTextColor="#8A8A8D"
            value={title}
            onChangeText={setTitle}
          />
          
          <Text style={[styles.label, { marginTop: 20 }]}>Class name</Text>
          <TouchableOpacity 
            style={styles.dropdown}
          >
            <Text style={styles.dropdownText}>
              {selectedCourse.code} - {selectedCourse.name}
            </Text>
            <Feather name="chevron-down" size={20} color="#8A8A8D" />
          </TouchableOpacity>
          
          <Text style={[styles.label, { marginTop: 20 }]}>Details</Text>
          <TextInput
            style={styles.detailsInput}
            placeholder="Eg. Read from page 100 to 150"
            placeholderTextColor="#8A8A8D"
            value={details}
            onChangeText={setDetails}
            multiline
            numberOfLines={4}
          />
          
          <View style={styles.checkboxRow}>
            <TouchableOpacity 
              style={styles.checkbox}
              onPress={() => setIsPriority(!isPriority)}
            >
              {isPriority ? (
                <View style={styles.checkedBox}>
                  <Feather name="check" size={14} color="white" />
                </View>
              ) : (
                <View style={styles.uncheckedBox} />
              )}
            </TouchableOpacity>
            <Text style={styles.checkboxLabel}>Set as priority</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>All day</Text>
            <Switch
              value={isAllDay}
              onValueChange={setIsAllDay}
              trackColor={{ false: '#303030', true: '#3478F6' }}
              thumbColor={'white'}
              ios_backgroundColor={'#303030'}
            />
          </View>
          
          <Text style={styles.dateLabel}>{formattedDate}</Text>
          
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Alert</Text>
            <Switch
              value={hasAlert}
              onValueChange={setHasAlert}
              trackColor={{ false: '#303030', true: '#3478F6' }}
              thumbColor={'white'}
              ios_backgroundColor={'#303030'}
            />
          </View>
          
          <Text style={styles.alertLabel}>1 day before class</Text>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

// Helper function to get day suffix (st, nd, rd, th)
function getDaySuffix(day: number): string {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    borderBottomWidth: 1,
    borderBottomColor: '#232433',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  cancelButton: {
    fontSize: 16,
    color: '#3478F6',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3478F6',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  input: {
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: '#232433',
    color: '#FFFFFF',
  },
  dropdown: {
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#232433',
  },
  dropdownText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  detailsInput: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    textAlignVertical: 'top',
    minHeight: 100,
    backgroundColor: '#232433',
    color: '#FFFFFF',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  checkbox: {
    marginRight: 10,
  },
  uncheckedBox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderRadius: 4,
    borderColor: '#8A8A8D',
  },
  checkedBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3478F6',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  divider: {
    height: 1,
    marginVertical: 24,
    backgroundColor: '#232433',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  toggleLabel: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  dateLabel: {
    fontSize: 16,
    marginTop: 12,
    marginLeft: 4,
    color: '#8A8A8D',
  },
  alertLabel: {
    fontSize: 16,
    marginTop: 12,
    marginLeft: 4,
    color: '#3478F6',
  },
}); 
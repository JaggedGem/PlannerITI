import AsyncStorage from '@react-native-async-storage/async-storage';
import { scheduleService, Period } from '../services/scheduleService';
import { format, isSameDay, isToday, isTomorrow, addDays, parseISO } from 'date-fns';

// Storage key
const ASSIGNMENTS_STORAGE_KEY = 'assignments';

// Assignment interface
export interface Assignment {
  id: string;
  title: string;
  description: string;
  courseCode: string;
  courseName: string;
  dueDate: string; // ISO date string
  isCompleted: boolean;
  isPriority: boolean;
  periodId?: string; // Optional period ID from scheduleService
}

// Assignment group interface for grouping by date
export interface AssignmentGroup {
  title: string;
  date: string;
  assignments: Assignment[];
}

// Get all assignments
export const getAssignments = async (): Promise<Assignment[]> => {
  try {
    const assignmentsJson = await AsyncStorage.getItem(ASSIGNMENTS_STORAGE_KEY);
    return assignmentsJson ? JSON.parse(assignmentsJson) : [];
  } catch (error) {
    console.error('Error getting assignments:', error);
    return [];
  }
};

// Save assignments
export const saveAssignments = async (assignments: Assignment[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(assignments));
  } catch (error) {
    console.error('Error saving assignments:', error);
  }
};

// Add a new assignment
export const addAssignment = async (assignment: Omit<Assignment, 'id' | 'isCompleted'>): Promise<Assignment> => {
  const newAssignment: Assignment = {
    ...assignment,
    id: Date.now().toString(),
    isCompleted: false,
  };
  
  const assignments = await getAssignments();
  assignments.push(newAssignment);
  await saveAssignments(assignments);
  
  return newAssignment;
};

// Toggle assignment completion
export const toggleAssignmentCompletion = async (id: string): Promise<void> => {
  const assignments = await getAssignments();
  const index = assignments.findIndex(a => a.id === id);
  
  if (index !== -1) {
    assignments[index].isCompleted = !assignments[index].isCompleted;
    await saveAssignments(assignments);
  }
};

// Delete an assignment
export const deleteAssignment = async (id: string): Promise<void> => {
  const assignments = await getAssignments();
  const filteredAssignments = assignments.filter(a => a.id !== id);
  await saveAssignments(filteredAssignments);
};

// Update an assignment
export const updateAssignment = async (id: string, updates: Partial<Assignment>): Promise<void> => {
  const assignments = await getAssignments();
  const index = assignments.findIndex(a => a.id === id);
  
  if (index !== -1) {
    assignments[index] = { ...assignments[index], ...updates };
    await saveAssignments(assignments);
  }
};

// Group assignments by date
export const groupAssignmentsByDate = (assignments: Assignment[]): AssignmentGroup[] => {
  // Create a map to group assignments by date
  const groupMap: Map<string, Assignment[]> = new Map();
  
  // Sort assignments by due date
  const sortedAssignments = [...assignments].sort((a, b) => {
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
  
  // Group assignments by day
  sortedAssignments.forEach(assignment => {
    const dueDate = new Date(assignment.dueDate);
    let dateKey = format(dueDate, 'yyyy-MM-dd');
    
    if (!groupMap.has(dateKey)) {
      groupMap.set(dateKey, []);
    }
    
    groupMap.get(dateKey)?.push(assignment);
  });
  
  // Convert map to array of groups
  const groups: AssignmentGroup[] = [];
  
  groupMap.forEach((assignmentsForDate, dateKey) => {
    const date = parseISO(dateKey);
    let title = format(date, 'EEEE, MMM d');
    
    // Special handling for today and tomorrow
    if (isToday(date)) {
      title = 'Today';
    } else if (isTomorrow(date)) {
      title = 'Tomorrow';
    }
    
    groups.push({
      title,
      date: format(date, 'MMMM d, yyyy'),
      assignments: assignmentsForDate,
    });
  });
  
  return groups;
};

// Get all course names and codes
export const getCourses = async (): Promise<{code: string, name: string}[]> => {
  const assignments = await getAssignments();
  
  // Create a map to deduplicate courses
  const coursesMap = new Map<string, {code: string, name: string}>();
  
  assignments.forEach(assignment => {
    if (!coursesMap.has(assignment.courseCode)) {
      coursesMap.set(assignment.courseCode, {
        code: assignment.courseCode,
        name: assignment.courseName
      });
    }
  });
  
  // Convert map to array
  return Array.from(coursesMap.values());
};

// Get all periods from schedule service
export const getSchedulePeriods = async (): Promise<Period[]> => {
  try {
    // Get the current selected group ID from scheduleService
    const { selectedGroupId } = scheduleService.getSettings();
    
    // Fetch the schedule for the selected group
    const scheduleData = await scheduleService.getClassSchedule(selectedGroupId);
    
    // Return the periods from the schedule data
    return scheduleData.periods || [];
  } catch (error) {
    console.error('Error getting schedule periods:', error);
    return [];
  }
};

// Get a formatted list of periods for the assignment form
export const getFormattedPeriods = async (): Promise<{label: string, value: string}[]> => {
  const periods = await getSchedulePeriods();
  
  return periods.map(period => ({
    label: `Period ${period._id}: ${period.starttime} - ${period.endtime}`,
    value: period._id
  }));
};

// Get period by ID
export const getPeriodById = async (periodId: string): Promise<Period | undefined> => {
  const periods = await getSchedulePeriods();
  return periods.find(period => period._id === periodId);
}; 
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define assignment types
export type ChecklistItem = {
  id: string;
  title: string;
  note: string;
  isCompleted: boolean;
};

export type Assignment = {
  id: string;
  title: string;
  className: string;
  courseCode: string;
  courseName: string;
  details?: string;
  isPriority: boolean;
  dueDate: string;
  isCompleted: boolean;
};

export type AssignmentGroup = {
  title: string;
  date: string;
  assignments: Assignment[];
};

// Storage keys
const STORAGE_KEY = 'assignments';
const COURSES_KEY = 'courses';

// Sample courses
export const sampleCourses = [
  { id: 'mgt101', code: 'MGT 101', name: 'Organization Management', color: '#FFB400' },
  { id: 'ec203', code: 'EC 203', name: 'Principles Macroeconomics', color: '#00B8D9' },
  { id: 'fn215', code: 'FN 215', name: 'Financial Management', color: '#36B37E' },
];

// Get all assignments
export const getAssignments = async (): Promise<Assignment[]> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting assignments:', error);
    return [];
  }
};

// Save assignments
export const saveAssignments = async (assignments: Assignment[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
  } catch (error) {
    console.error('Error saving assignments:', error);
  }
};

// Add a new assignment
export const addAssignment = async (assignment: Assignment): Promise<void> => {
  try {
    const assignments = await getAssignments();
    assignments.push(assignment);
    await saveAssignments(assignments);
  } catch (error) {
    console.error('Error adding assignment:', error);
  }
};

// Update an assignment
export const updateAssignment = async (updatedAssignment: Assignment): Promise<void> => {
  try {
    const assignments = await getAssignments();
    const index = assignments.findIndex(a => a.id === updatedAssignment.id);
    
    if (index !== -1) {
      assignments[index] = updatedAssignment;
      await saveAssignments(assignments);
    }
  } catch (error) {
    console.error('Error updating assignment:', error);
  }
};

// Delete an assignment
export const deleteAssignment = async (id: string): Promise<void> => {
  try {
    const assignments = await getAssignments();
    const filteredAssignments = assignments.filter(a => a.id !== id);
    await saveAssignments(filteredAssignments);
  } catch (error) {
    console.error('Error deleting assignment:', error);
  }
};

// Toggle assignment completion
export const toggleAssignmentCompletion = async (id: string): Promise<void> => {
  try {
    const assignments = await getAssignments();
    const index = assignments.findIndex(a => a.id === id);
    
    if (index !== -1) {
      assignments[index].isCompleted = !assignments[index].isCompleted;
      await saveAssignments(assignments);
    }
  } catch (error) {
    console.error('Error toggling assignment completion:', error);
  }
};

// Group assignments by date
export const groupAssignmentsByDate = (assignments: Assignment[]): AssignmentGroup[] => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const todayStr = today.toDateString();
  const tomorrowStr = tomorrow.toDateString();
  
  const groups: { [key: string]: AssignmentGroup } = {};
  
  // Initialize today and tomorrow groups
  groups[todayStr] = { title: 'Today', date: formatDate(today), assignments: [] };
  groups[tomorrowStr] = { title: 'Tomorrow', date: formatDate(tomorrow), assignments: [] };
  
  // Group assignments
  assignments.forEach(assignment => {
    const dueDate = new Date(assignment.dueDate);
    const dueDateStr = dueDate.toDateString();
    
    if (!groups[dueDateStr]) {
      groups[dueDateStr] = {
        title: formatDateTitle(dueDate),
        date: formatDate(dueDate),
        assignments: [],
      };
    }
    
    groups[dueDateStr].assignments.push(assignment);
  });
  
  // Sort groups by date
  return Object.values(groups)
    .filter(group => group.assignments.length > 0 || group.title === 'Today' || group.title === 'Tomorrow')
    .sort((a, b) => {
      if (a.title === 'Today') return -1;
      if (b.title === 'Today') return 1;
      if (a.title === 'Tomorrow') return -1;
      if (b.title === 'Tomorrow') return 1;
      return 0;
    });
};

// Format date for display
const formatDate = (date: Date): string => {
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'long',
    month: 'long', 
    day: 'numeric',
    year: 'numeric'
  };
  
  return date.toLocaleDateString('en-US', options);
};

// Format date title
const formatDateTitle = (date: Date): string => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  } else {
    return formatDate(date);
  }
}; 
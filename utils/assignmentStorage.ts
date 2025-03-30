import AsyncStorage from '@react-native-async-storage/async-storage';
import { scheduleService, Period, Subject, SubGroupType, PeriodAssignmentCount } from '../services/scheduleService';
import { format, isSameDay, isToday, isTomorrow, addDays, parseISO } from 'date-fns';
import {
  scheduleForNewAssignment,
  handleCompletionStateChange,
  cancelForDeletedAssignment,
  updateNotificationsForUpdatedAssignment
} from './notificationHelper';

// Storage key
const ASSIGNMENTS_STORAGE_KEY = 'assignments';

// Assignment type enum
export enum AssignmentType {
  HOMEWORK = 'Homework',
  TEST = 'Test',
  EXAM = 'Exam',
  PROJECT = 'Project',
  QUIZ = 'Quiz',
  LAB = 'Lab',
  ESSAY = 'Essay',
  PRESENTATION = 'Presentation',
  OTHER = 'Other'
}

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
  assignmentType: AssignmentType; // Type of assignment
  periodId?: string; // Optional period ID from scheduleService
  subjectId?: string; // Optional subject ID from scheduleService
  isOrphaned?: boolean; // Flag to mark if the assignment's subject no longer exists in current group
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
    const assignments = assignmentsJson ? JSON.parse(assignmentsJson) : [];
    
    // Ensure backward compatibility with older assignments without a type
    return assignments.map((assignment: any) => ({
      ...assignment,
      assignmentType: assignment.assignmentType || AssignmentType.HOMEWORK // Default to HOMEWORK for older entries
    }));
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

// Helper function to update assignment counts in schedule service
const updateAssignmentCountsInSchedule = async () => {
  try {
    const assignments = await getAssignments();
    
    // Only include non-completed assignments in the counts
    const activeAssignments = assignments.filter(a => !a.isCompleted);
    
    // Group assignments by date
    const assignmentsByDate = new Map<string, Assignment[]>();
    
    // First group assignments by due date
    activeAssignments.forEach(assignment => {
      const dueDate = new Date(assignment.dueDate);
      const dateKey = format(dueDate, 'yyyy-MM-dd');
      
      if (!assignmentsByDate.has(dateKey)) {
        assignmentsByDate.set(dateKey, []);
      }
      
      assignmentsByDate.get(dateKey)?.push(assignment);
    });
    
    // Create the final counts array with date information
    const counts: PeriodAssignmentCount[] = [];
    
    // Process each date's assignments
    assignmentsByDate.forEach((dateAssignments, dateKey) => {
      // Create maps for period and course counts for this date
      const periodCounts = new Map<string, number>();
      const courseCounts = new Map<string, number>();
      
      // Count assignments by period and course for this date
      dateAssignments.forEach(assignment => {
        // Count by period if available
        if (assignment.periodId) {
          const current = periodCounts.get(assignment.periodId) || 0;
          periodCounts.set(assignment.periodId, current + 1);
        }
        
        // Count by course code
        const current = courseCounts.get(assignment.courseCode) || 0;
        courseCounts.set(assignment.courseCode, current + 1);
      });
      
      // Add period-based counts with date information
      periodCounts.forEach((count, periodId) => {
        counts.push({
          periodId,
          courseCode: '',
          count,
          dateKey  // Add date information
        });
      });
      
      // Add course-based counts with date information
      courseCounts.forEach((count, courseCode) => {
        counts.push({
          periodId: '',
          courseCode,
          count,
          dateKey  // Add date information
        });
      });
    });
    
    // Update counts in schedule service
    await scheduleService.updateAssignmentCounts(counts);
  } catch (error) {
    console.error('Error updating assignment counts:', error);
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
  
  // Schedule notifications for the new assignment only
  await scheduleForNewAssignment(newAssignment);
  
  // Update assignment counts
  await updateAssignmentCountsInSchedule();
  
  return newAssignment;
};

// Toggle assignment completion
export const toggleAssignmentCompletion = async (id: string): Promise<void> => {
  const assignments = await getAssignments();
  const index = assignments.findIndex(a => a.id === id);
  
  if (index !== -1) {
    const wasCompleted = assignments[index].isCompleted;
    assignments[index].isCompleted = !wasCompleted;
    await saveAssignments(assignments);
    
    // Handle notifications based on completion state
    await handleCompletionStateChange(assignments[index], wasCompleted, id);
    
    // Update assignment counts
    await updateAssignmentCountsInSchedule();
  }
};

// Delete assignment
export const deleteAssignment = async (id: string): Promise<void> => {
  const assignments = await getAssignments();
  const updatedAssignments = assignments.filter(a => a.id !== id);
  await saveAssignments(updatedAssignments);
  
  // Cancel notifications for deleted assignment
  await cancelForDeletedAssignment(id);
  
  // Update assignment counts
  await updateAssignmentCountsInSchedule();
};

// Update an assignment
export const updateAssignment = async (id: string, updates: Partial<Assignment>): Promise<void> => {
  const assignments = await getAssignments();
  const index = assignments.findIndex(a => a.id === id);
  
  if (index !== -1) {
    const updatedAssignment = { ...assignments[index], ...updates };
    assignments[index] = updatedAssignment;
    await saveAssignments(assignments);
    
    // Reschedule notifications for the updated assignment
    await updateNotificationsForUpdatedAssignment(id, updatedAssignment);
    
    // Update assignment counts
    await updateAssignmentCountsInSchedule();
  }
};

// Initialize the assignment counts when module is loaded
(async () => {
  await updateAssignmentCountsInSchedule();
})();

// Group assignments by date
export const groupAssignmentsByDate = (
  assignments: Assignment[],
  t?: any,
  formatDate?: (date: Date, options: Intl.DateTimeFormatOptions) => string
): AssignmentGroup[] => {
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
    let title;
    let formattedDate;
    
    // If translations are provided, use them
    if (t) {
      // Special handling for today and tomorrow
      if (isToday(date)) {
        title = t('assignments').days.today;
      } else if (isTomorrow(date)) {
        title = t('assignments').days.tomorrow;
      } else {
        // Get the day of the week
        const dayOfWeek = t('weekdays').long[date.getDay()];
        // Get the month
        const month = t('months')[date.getMonth()];
        // Format as "Day, Month Day"
        title = `${dayOfWeek}, ${month} ${date.getDate()}`;
      }
      
      // Format the date with localization if formatDate is provided
      if (formatDate) {
        formattedDate = formatDate(date, { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      } else {
        formattedDate = format(date, 'MMMM d, yyyy');
      }
    } else {
      // Fallback to English formats if no translations are provided
      title = format(date, 'EEEE, MMM d');
      if (isToday(date)) {
        title = 'Today';
      } else if (isTomorrow(date)) {
        title = 'Tomorrow';
      }
      formattedDate = format(date, 'MMMM d, yyyy');
    }
    
    groups.push({
      title,
      date: formattedDate,
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

// Get assignments for a specific period
export const getAssignmentsForPeriod = async (periodId: string): Promise<Assignment[]> => {
  try {
    const assignments = await getAssignments();
    return assignments.filter(assignment => 
      assignment.periodId === periodId && 
      !assignment.isCompleted
    );
  } catch (error) {
    console.error('Error getting assignments for period:', error);
    return [];
  }
};

// Get assignments for a specific course on a specific date
export const getAssignmentsForCourseAndDate = async (
  courseCode: string, 
  date: Date
): Promise<Assignment[]> => {
  try {
    const assignments = await getAssignments();
    const dateString = format(date, 'yyyy-MM-dd');
    
    return assignments.filter(assignment => 
      assignment.courseCode === courseCode && 
      format(new Date(assignment.dueDate), 'yyyy-MM-dd') === dateString &&
      !assignment.isCompleted
    );
  } catch (error) {
    console.error('Error getting assignments for course and date:', error);
    return [];
  }
};

// Handle orphaned assignments when a group changes
export const handleGroupChange = async (groupId?: string | SubGroupType): Promise<boolean> => {
  try {
    const assignments = await getAssignments();
    let hasChanges = false;
    
    // FORCE REFRESH the subjects for the new group
    const currentSubjects = await scheduleService.refreshSubjects();
    
    // Create subject ID and name sets for faster lookups
    const subjectIds = new Set(currentSubjects.map(s => s.id));
    const subjectNames = new Set(currentSubjects.map(s => s.name.toLowerCase()));
    
    // Process each assignment
    const updatedAssignments = await Promise.all(assignments.map(async (assignment) => {
      // First check if this is an orphaned assignment that should be restored
      if (assignment.isOrphaned) {
        // Check if subject ID exists in current group
        const idExists = assignment.subjectId && subjectIds.has(assignment.subjectId);
        
        // Check if subject name exists in current group
        const nameExists = assignment.courseName && 
          subjectNames.has(assignment.courseName.toLowerCase());
        
        // If either ID or name match, restore the assignment
        if (idExists || nameExists) {
          // If name matches but ID doesn't, update the ID
          if (!idExists && nameExists && assignment.courseName) {
            // Find the subject with matching name
            const matchedSubject = currentSubjects.find(
              s => s.name.toLowerCase() === assignment.courseName?.toLowerCase()
            );
            
            if (matchedSubject) {
              hasChanges = true;
              return {
                ...assignment,
                subjectId: matchedSubject.id,
                isOrphaned: false
              };
            }
          } else {
            // Direct ID match - just restore
            hasChanges = true;
            return {
              ...assignment,
              isOrphaned: false
            };
          }
        }
        
        return assignment;
      } else {
        // For non-orphaned assignments, check if they should become orphaned
        // Check if subject ID exists in current group
        const idExists = assignment.subjectId && subjectIds.has(assignment.subjectId);
        
        // Check if subject name exists in current group
        const nameExists = assignment.courseName && 
          subjectNames.has(assignment.courseName.toLowerCase());
        
        // If neither ID nor name match, mark as orphaned
        if (!idExists && !nameExists) {
          hasChanges = true;
          return {
            ...assignment,
            isOrphaned: true
          };
        } else if (!idExists && nameExists) {
          // If name matches but ID doesn't, update the ID
          const matchedSubject = currentSubjects.find(
            s => s.name.toLowerCase() === assignment.courseName?.toLowerCase()
          );
          
          if (matchedSubject) {
            hasChanges = true;
            return {
              ...assignment,
              subjectId: matchedSubject.id,
              isOrphaned: false
            };
          }
        }
        
        // Subject exists, no changes needed
        return assignment;
      }
    }));
    
    // Save changes if any assignments were updated
    if (hasChanges) {
      await saveAssignments(updatedAssignments);
    }
    
    return hasChanges;
  } catch (error) {
    return false;
  }
};

// Export the update function so it can be called from assignments.tsx
export const refreshAssignmentCounts = async (): Promise<void> => {
  await updateAssignmentCountsInSchedule();
};
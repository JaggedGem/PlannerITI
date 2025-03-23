import AsyncStorage from '@react-native-async-storage/async-storage';
import { scheduleService, Period, Subject, SubGroupType } from '../services/scheduleService';
import { format, isSameDay, isToday, isTomorrow, addDays, parseISO } from 'date-fns';

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

// Handle orphaned assignments when a group changes
export const handleGroupChange = async (groupId?: string | SubGroupType): Promise<boolean> => {
  try {
    console.log("Processing assignments for group change", { groupId });
    const assignments = await getAssignments();
    let hasChanges = false;
    
    // FORCE REFRESH the subjects for the new group
    console.log("Forcing subject refresh for the new group");
    const currentSubjects = await scheduleService.refreshSubjects();
    
    console.log(`Found ${currentSubjects.length} subjects in the current group:`, 
      currentSubjects.map(s => ({ id: s.id, name: s.name })));
    
    // Create subject ID and name sets for faster lookups
    const subjectIds = new Set(currentSubjects.map(s => s.id));
    const subjectNames = new Set(currentSubjects.map(s => s.name.toLowerCase()));
    
    console.log(`Subject IDs: ${Array.from(subjectIds).join(', ')}`);
    console.log(`Subject names: ${Array.from(subjectNames).join(', ')}`);
    
    // Diagnostic: Log all orphaned assignments
    const orphanedAssignments = assignments.filter(a => a.isOrphaned);
    console.log(`Found ${orphanedAssignments.length} orphaned assignments:`, 
      orphanedAssignments.map(a => ({ 
        title: a.title, 
        subject: a.courseName, 
        subjectId: a.subjectId 
      })));
    
    // Process each assignment
    const updatedAssignments = await Promise.all(assignments.map(async (assignment) => {
      // First check if this is an orphaned assignment that should be restored
      if (assignment.isOrphaned) {
        console.log(`Checking orphaned assignment: "${assignment.title}" (${assignment.courseName}, ID: ${assignment.subjectId || 'none'})`);
        
        // Check if subject ID exists in current group
        const idExists = assignment.subjectId && subjectIds.has(assignment.subjectId);
        console.log(`  - Subject ID match: ${idExists ? 'FOUND' : 'NOT FOUND'}`);
        
        // Check if subject name exists in current group
        const nameExists = assignment.courseName && 
          subjectNames.has(assignment.courseName.toLowerCase());
        console.log(`  - Subject name match: ${nameExists ? 'FOUND' : 'NOT FOUND'} for "${assignment.courseName?.toLowerCase()}"`);
        
        // If either ID or name match, restore the assignment
        if (idExists || nameExists) {
          // If name matches but ID doesn't, update the ID
          if (!idExists && nameExists && assignment.courseName) {
            // Find the subject with matching name
            const matchedSubject = currentSubjects.find(
              s => s.name.toLowerCase() === assignment.courseName?.toLowerCase()
            );
            
            if (matchedSubject) {
              console.log(`Restoring orphaned assignment with updated subject ID: "${assignment.title}" → ${matchedSubject.name}`);
              hasChanges = true;
              return {
                ...assignment,
                subjectId: matchedSubject.id,
                isOrphaned: false
              };
            }
          } else {
            // Direct ID match - just restore
            console.log(`Restoring orphaned assignment: "${assignment.title}"`);
            hasChanges = true;
            return {
              ...assignment,
              isOrphaned: false
            };
          }
        }
        
        // If we get here, the assignment is still orphaned
        console.log(`Assignment remains orphaned: "${assignment.title}"`);
        return assignment;
      } else {
        // For non-orphaned assignments, check if they should become orphaned
        console.log(`Checking if assignment should be orphaned: "${assignment.title}" (${assignment.courseName}, ID: ${assignment.subjectId || 'none'})`);
        
        // Check if subject ID exists in current group
        const idExists = assignment.subjectId && subjectIds.has(assignment.subjectId);
        
        // Check if subject name exists in current group
        const nameExists = assignment.courseName && 
          subjectNames.has(assignment.courseName.toLowerCase());
        
        console.log(`  - Subject ID exists: ${idExists ? 'YES' : 'NO'}`);
        console.log(`  - Subject name exists: ${nameExists ? 'YES' : 'NO'}`);
        
        // If neither ID nor name match, mark as orphaned
        if (!idExists && !nameExists) {
          console.log(`Marking assignment as orphaned: "${assignment.title}" (${assignment.courseName})`);
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
            console.log(`Updating subject ID for assignment: "${assignment.title}" → ${matchedSubject.name}`);
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
      console.log(`Saving ${updatedAssignments.length} assignments with updated orphaned status`);
      await saveAssignments(updatedAssignments);
    } else {
      console.log("No assignments needed updates");
    }
    
    return hasChanges;
  } catch (error) {
    console.error('Error handling group change for assignments:', error);
    // Don't rethrow the error - just return false instead to avoid UI breaks
    return false;
  }
};
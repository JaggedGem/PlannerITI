import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
// Types imported inline to avoid circular dependency
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

export interface Assignment {
  id: string;
  title: string;
  description: string;
  courseCode: string;
  courseName: string;
  dueDate: string;
  isCompleted: boolean;
  isPriority: boolean;
  assignmentType: AssignmentType;
  periodId?: string;
  subjectId?: string;
  isOrphaned?: boolean;
  subtasks?: any[];
}
import { formatDistanceToNow, addHours, addDays, parseISO, format, startOfDay, isBefore, isAfter, differenceInDays } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import the required types
export enum SchedulableTriggerInputTypes {
  TIME_INTERVAL = 'timeInterval',
  DATE = 'date',
  DAILY = 'daily',
  WEEKLY = 'weekly'
}

// Storage keys
const NOTIFICATION_SETTINGS_KEY = '@planner_notification_settings';
const DAILY_DIGEST_KEY = '@planner_daily_digest';
const ASSIGNMENTS_STORAGE_KEY = 'assignments'; // Match the key in assignmentStorage.ts

// Define notification settings type
export interface NotificationSettings {
  enabled: boolean;
  notificationTime: string; // ISO string
  examReminderDays: number;
  testReminderDays: number;
  quizReminderDays: number;
  projectReminderDays: number;
  homeworkReminderDays: number;
  otherReminderDays: number;
  dailyRemindersForExams: boolean;
  dailyRemindersForTests: boolean;
  dailyRemindersForQuizzes: boolean;
}

// Interface for grouped notifications
interface AssignmentDigest {
  date: string; // ISO string for the day
  assignments: {
    id: string;
    title: string;
    courseInfo: string;
    type: AssignmentType;
    dueDate: string;
  }[];
  lastNotified: string; // ISO string of when we last sent a notification for this digest
}

// Default notification settings
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  notificationTime: new Date(new Date().setHours(20, 0, 0, 0)).toISOString(), // 8:00 PM by default
  examReminderDays: 7,
  testReminderDays: 5,
  quizReminderDays: 3,
  projectReminderDays: 5,
  homeworkReminderDays: 2,
  otherReminderDays: 1,
  dailyRemindersForExams: true,
  dailyRemindersForTests: true,
  dailyRemindersForQuizzes: true
};

// Get emoji for assignment type
function getAssignmentTypeEmoji(type: AssignmentType): string {
  switch (type) {
    case AssignmentType.EXAM:
      return '📝'; // Exam
    case AssignmentType.TEST:
      return '✏️'; // Test
    case AssignmentType.QUIZ:
      return '❓'; // Quiz
    case AssignmentType.PROJECT:
      return '🏗️'; // Project
    case AssignmentType.HOMEWORK:
      return '📚'; // Homework
    default:
      return '📋'; // Other
  }
}

// Save notification settings
export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving notification settings:', error);
    throw error;
  }
}

// Get notification settings
export async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    const settings = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    
    if (settings) {
      return { 
        ...DEFAULT_NOTIFICATION_SETTINGS, 
        ...JSON.parse(settings) 
      };
    }
    
    // If no settings found, save and return defaults
    await saveNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS);
    return DEFAULT_NOTIFICATION_SETTINGS;
  } catch (error) {
    console.error('Error getting notification settings:', error);
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

// Save daily digest
async function saveDailyDigest(digests: AssignmentDigest[]): Promise<void> {
  try {
    await AsyncStorage.setItem(DAILY_DIGEST_KEY, JSON.stringify(digests));
  } catch (error) {
    console.error('Error saving daily digest:', error);
  }
}

// Get daily digest
async function getDailyDigest(): Promise<AssignmentDigest[]> {
  try {
    const data = await AsyncStorage.getItem(DAILY_DIGEST_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting daily digest:', error);
    return [];
  }
}

// Request permissions for notifications
export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });

    // Create assignment-specific channel
    await Notifications.setNotificationChannelAsync('assignments', {
      name: 'Assignments',
      description: 'Notifications for assignment due dates and reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3478F6',
    });
    
    // Create daily digest channel
    await Notifications.setNotificationChannelAsync('daily-digest', {
      name: 'Daily Assignment Digest',
      description: 'Daily summary of upcoming assignments',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4CAF50',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      return;
    }
    
    // Get push token
    token = (await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PROJECT_ID,
    })).data;
  }

  return token;
}

// Configure notification handler
export function configureNotifications() {
  // Set up the notification handler for how notifications should appear to users
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

// Generate notification ID for an assignment
function getNotificationId(assignmentId: string, type: 'due' | 'reminder' | 'early-reminder' | 'daily') {
  return `assignment-${assignmentId}-${type}`;
}

// Get the channel ID based on assignment type
function getChannelId(assignmentType: AssignmentType): string {
  return Platform.OS === 'android' ? 'assignments' : 'default';
}

// Helper to truncate text to prevent notification cutoff
function truncateText(text: string, maxLength: number = 80): string {
  if (!text) return '';
  return text.length <= maxLength ? text : text.substring(0, maxLength - 3) + '...';
}

// Format course info for consistent, concise display
function formatCourseInfo(courseCode?: string, courseName?: string): string {
  if (!courseCode && !courseName) return '';
  
  // Use course code if available (preferred for brevity)
  if (courseCode) return courseCode;
  
  // Fallback to course name, but truncate if too long
  return truncateText(courseName || '', 30);
}

// Schedule a notification with navigation data
async function scheduleNotification(
  title: string,
  body: string,
  triggerDate: Date,
  data: any,
  identifier: string,
  channelId: string = 'default'
) {
  try {
    // Cancel any existing notification with the same identifier
    await Notifications.cancelScheduledNotificationAsync(identifier);

    // Only schedule if the time is in the future
    const now = new Date();
    if (triggerDate > now) {
      // Calculate seconds from now
      const secondsFromNow = Math.floor((triggerDate.getTime() - now.getTime()) / 1000);
      
      if (secondsFromNow > 0) {
        // Add navigation data to route to assignments tab
        const notificationData = {
          ...data,
          navigateTo: 'assignments', // Used to navigate when notification is tapped
        };
        
        // Ensure title and body don't exceed safe limits
        // Most platforms show ~50 chars for title, ~100 for body without truncation
        const safeTitle = truncateText(title, 70);
        const safeBody = truncateText(body, 240);
        
        await Notifications.scheduleNotificationAsync({
          content: {
            title: safeTitle,
            body: safeBody,
            data: notificationData,
            sound: true,
            ...(Platform.OS === 'android' ? { channelId } : {}),
          },
          trigger: {
            type: SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: secondsFromNow,
          },
          identifier,
        });
      }
    }
  } catch (error) {
    console.error('Error scheduling notification:', error);
  }
}

// Get reminder days for an assignment type based on settings
async function getReminderDaysForType(type: AssignmentType): Promise<number> {
  const settings = await getNotificationSettings();
  
  switch (type) {
    case AssignmentType.EXAM:
      return settings.examReminderDays;
    case AssignmentType.TEST:
      return settings.testReminderDays;
    case AssignmentType.QUIZ:
      return settings.quizReminderDays;
    case AssignmentType.PROJECT:
      return settings.projectReminderDays;
    case AssignmentType.HOMEWORK:
      return settings.homeworkReminderDays;
    default:
      return settings.otherReminderDays;
  }
}

// Check if daily reminders should be scheduled for an assignment type
async function shouldSendDailyReminder(type: AssignmentType): Promise<boolean> {
  const settings = await getNotificationSettings();
  
  switch (type) {
    case AssignmentType.EXAM:
      return settings.dailyRemindersForExams;
    case AssignmentType.TEST:
      return settings.dailyRemindersForTests;
    case AssignmentType.QUIZ:
      return settings.dailyRemindersForQuizzes;
    default:
      return false; // No daily reminders for other types by default
  }
}

// Schedule individual critical notifications for an assignment (due soon, day before)
async function scheduleIndividualNotifications(assignment: Assignment): Promise<void> {
  try {
    const settings = await getNotificationSettings();
    const dueDate = parseISO(assignment.dueDate);
    const now = new Date();
    
    // Skip scheduling if the assignment is already overdue
    if (dueDate <= now) {
      return;
    }
    
    const courseInfo = formatCourseInfo(assignment.courseCode, assignment.courseName);
    const channelId = getChannelId(assignment.assignmentType);
    const typeEmoji = getAssignmentTypeEmoji(assignment.assignmentType);
    
    // Truncate assignment title to prevent notification cutoff
    const title = truncateText(assignment.title, 60);
    
    // 1. Due date notification (1 hour before)
    const dueNotificationTime = new Date(dueDate.getTime() - 60 * 60 * 1000); // 1 hour before
    
    if (dueNotificationTime > now) {
      await scheduleNotification(
        `${typeEmoji} ${assignment.assignmentType}`,
        `"${title}" (${courseInfo}) due in 1 hour.`,
        dueNotificationTime,
        { assignmentId: assignment.id, type: 'due' },
        getNotificationId(assignment.id, 'due'),
        channelId
      );
    }

    // 2. Day before reminder (24 hours before)
    const reminderDate = addHours(dueDate, -24);
    
    if (reminderDate > now) {
      await scheduleNotification(
        `⏰ ${assignment.assignmentType}`,
        `"${title}" (${courseInfo}) due tomorrow at ${format(dueDate, 'h:mm a')}.`,
        reminderDate,
        { assignmentId: assignment.id, type: 'reminder' },
        getNotificationId(assignment.id, 'reminder'),
        channelId
      );
    }

    // 3. Initial reminder at X days before (based on settings)
    const reminderDays = await getReminderDaysForType(assignment.assignmentType);
    const initialReminderDate = addDays(dueDate, -reminderDays);
    
    // Only schedule if today is exactly reminderDays before due date (or we're exactly at that point)
    const today = startOfDay(now);
    const reminderDay = startOfDay(initialReminderDate);
    
    if (isSameDay(today, reminderDay) && initialReminderDate > now) {
      await scheduleNotification(
        `🔔 ${assignment.assignmentType}`,
        `"${title}" (${courseInfo}) due in ${reminderDays} days.`,
        initialReminderDate,
        { assignmentId: assignment.id, type: 'early-reminder' },
        getNotificationId(assignment.id, 'early-reminder'),
        channelId
      );
    }

    // 4. Daily reminders if enabled for this assignment type
    const shouldSendDaily = await shouldSendDailyReminder(assignment.assignmentType);
    
    if (shouldSendDaily) {
      // Calculate days between now and due date
      const daysUntilDue = differenceInDays(dueDate, now);
      
      // Only schedule daily reminders if within the reminder window
      if (daysUntilDue <= reminderDays && daysUntilDue > 1) { // Don't send daily on the last day (we have a 24h notification)
        // Schedule for today at notification time
        const notificationTimeDate = new Date(settings.notificationTime);
        const todayNotificationTime = new Date();
        todayNotificationTime.setHours(
          notificationTimeDate.getHours(),
          notificationTimeDate.getMinutes(),
          0, 0
        );
        
        // Only schedule if it's still in the future
        if (todayNotificationTime > now) {
          await scheduleNotification(
            `📅 ${assignment.assignmentType}`,
            `"${title}" (${courseInfo}) due in ${daysUntilDue} days.`,
            todayNotificationTime,
            { assignmentId: assignment.id, type: 'daily' },
            getNotificationId(assignment.id, 'daily'),
            channelId
          );
        }
      }
    }

    // 5. Priority assignments get an extra reminder 1 hour before
    if (assignment.isPriority) {
      const priorityReminderTime = new Date(dueDate.getTime() - 60 * 60 * 1000); // 1 hour before
      
      if (priorityReminderTime > now) {
        await scheduleNotification(
          `⚠️ PRIORITY: ${assignment.assignmentType}`,
          `"${title}" (${courseInfo}) due in 1 hour!`,
          priorityReminderTime,
          { assignmentId: assignment.id, type: 'priority-reminder' },
          `assignment-${assignment.id}-priority-reminder`,
          channelId
        );
      }
    }
  } catch (error) {
    console.error('Error scheduling individual notifications:', error);
  }
}

// Get all assignments due on a specific day
function getAssignmentsDueOnDay(assignments: Assignment[], day: Date): Assignment[] {
  const startOfDueDate = startOfDay(day);
  return assignments.filter(assignment => {
    const assignmentDueDate = parseISO(assignment.dueDate);
    return isSameDay(assignmentDueDate, startOfDueDate);
  });
}

// Check if an assignment should be in the daily digest based on its due date and settings
async function shouldIncludeInDigest(assignment: Assignment): Promise<boolean> {
  const settings = await getNotificationSettings();
  const dueDate = parseISO(assignment.dueDate);
  const now = new Date();
  
  // First check if assignment is already overdue
  if (dueDate <= now) {
    return false;
  }
  
  const daysUntilDue = differenceInDays(dueDate, now);
  
  // Get reminder days for this assignment type
  const reminderDays = await getReminderDaysForType(assignment.assignmentType);
  
  // Only include if the assignment is due within the reminder days window
  return daysUntilDue <= reminderDays;
}

// Function to create a more visually structured digest message
function createDigestMessage(assignments: AssignmentDigest['assignments']): string {
  if (assignments.length === 0) return 'No assignments due soon.';
  
  // Group by type for better organization
  const byType = assignments.reduce((acc, curr) => {
    if (!acc[curr.type]) {
      acc[curr.type] = [];
    }
    acc[curr.type].push({
      title: curr.title,
      courseInfo: curr.courseInfo,
      dueDate: curr.dueDate
    });
    return acc;
  }, {} as Record<AssignmentType, Array<{title: string, courseInfo: string, dueDate: string}>>);
  
  // Build a concise message with limited length
  let message = '';
  
  for (const [type, items] of Object.entries(byType)) {
    const typeEmoji = getAssignmentTypeEmoji(type as AssignmentType);
    message += `${typeEmoji} ${type}${items.length > 1 ? 's' : ''}: \n`;
    
    // If there are many assignments, only show the first few
    const maxItemsToShow = 5;
    const displayItems = items.length > maxItemsToShow ? items.slice(0, maxItemsToShow) : items;
    
    displayItems.forEach(item => {
      // Format just the time part of the due date
      const dueTime = format(parseISO(item.dueDate), 'h:mm a');
      
      // Extract just the course code for brevity
      const courseCode = item.courseInfo.split(' - ')[0];
      
      // Truncate title if needed to avoid very long lines
      const truncatedTitle = truncateText(item.title, 60);
      
      // Simplified format: "Assignment name" (CourseCode) at Time
      message += `  • "${truncatedTitle}" (${courseCode}) at ${dueTime}\n`;
    });
    
    // If we truncated the list, add a note
    if (items.length > maxItemsToShow) {
      message += `  • + ${items.length - maxItemsToShow} more...\n`;
    }
    
    message += '\n';
  }
  
  // Ensure the entire message doesn't get too long
  return truncateText(message.trim(), 700);
}

// Create and schedule a single daily notification at the specified time with all upcoming assignments
export async function createAndScheduleDailyDigest(assignments: Assignment[], sendNow: boolean = false): Promise<void> {
  try {
    const settings = await getNotificationSettings();
    if (!settings.enabled) return;
    
    const now = new Date();
    // Filter out completed assignments and assignments that are already overdue
    const incompleteAssignments = assignments.filter(a => 
      !a.isCompleted && 
      parseISO(a.dueDate) > now // Exclude assignments past their due date
    );
    
    // Get notification time from settings
    const notificationTimeDate = new Date(settings.notificationTime);
    
    // Create notification time - either now or at the configured time
    const notificationTime = sendNow 
      ? new Date(now.getTime() + 5000) // Send 5 seconds from now
      : (() => {
          // Create today's notification time (at the configured time)
          const todayNotificationTime = new Date();
          todayNotificationTime.setHours(
            notificationTimeDate.getHours(),
            notificationTimeDate.getMinutes(),
            0, 0
          );
          
          // If today's notification time has already passed, schedule for tomorrow
          if (todayNotificationTime <= now) {
            todayNotificationTime.setDate(todayNotificationTime.getDate() + 1);
          }
          
          return todayNotificationTime;
        })();
    
    // Group assignments by day for the next 14 days
    const assignmentsByDay: Record<string, Assignment[]> = {};
    
    for (let i = 0; i < 14; i++) {
      const targetDate = addDays(now, i);
      const dateKey = format(targetDate, 'yyyy-MM-dd');
      
      // Get assignments due on this day
      const dueOnDay = incompleteAssignments.filter(assignment => {
        const dueDate = parseISO(assignment.dueDate);
        return isSameDay(dueDate, targetDate);
      });
      
      // Filter assignments based on reminder day settings
      const validAssignments = await Promise.all(
        dueOnDay.map(async assignment => {
          const reminderDays = await getReminderDaysForType(assignment.assignmentType);
          const dueDate = parseISO(assignment.dueDate);
          const daysUntilDue = differenceInDays(dueDate, now);
          
          // Only include if it's within the reminder window
          return (daysUntilDue <= reminderDays) ? assignment : null;
        })
      );
      
      // Filter out nulls and store the assignments for this day
      const filteredAssignments = validAssignments.filter(a => a !== null) as Assignment[];
      if (filteredAssignments.length > 0) {
        assignmentsByDay[dateKey] = filteredAssignments;
      }
    }
    
    // If no upcoming assignments, don't schedule a notification
    if (Object.keys(assignmentsByDay).length === 0) {
      return;
    }
    
    // Cancel any existing daily digest notification
    await Notifications.cancelScheduledNotificationAsync('daily-digest-notification');
    
    // Prepare data for the notification
    const digestData: {
      dayTitle: string;
      date: string;
      assignments: {
        id: string;
        title: string;
        courseInfo: string;
        type: AssignmentType;
        dueDate: string;
      }[];
    }[] = [];
    
    for (const [dateKey, dayAssignments] of Object.entries(assignmentsByDay)) {
      const date = parseISO(dateKey);
      let dayTitle;
      
      // Format the day title
      if (isSameDay(date, now)) {
        dayTitle = 'Today';
      } else if (isSameDay(date, addDays(now, 1))) {
        dayTitle = 'Tomorrow';
      } else {
        dayTitle = format(date, 'EEEE, MMM d'); // e.g., "Monday, Jan 15"
      }
      
      digestData.push({
        dayTitle,
        date: dateKey,
        assignments: dayAssignments.map(a => ({
          id: a.id,
          title: truncateText(a.title, 60),
          courseInfo: formatCourseInfo(a.courseCode, a.courseName),
          type: a.assignmentType,
          dueDate: a.dueDate
        }))
      });
    }
    
    // Sort by date
    digestData.sort((a, b) => a.date.localeCompare(b.date));
    
    // Build the notification content
    let title = '';
    let body = '';
    
    // Get total assignment count
    const totalAssignments = digestData.reduce((count, day) => count + day.assignments.length, 0);
    
    if (digestData.length === 1) {
      // Single day format
      const day = digestData[0];
      title = `📚 ${day.assignments.length} Assignment${day.assignments.length > 1 ? 's' : ''} for ${day.dayTitle}`;
      
      // If there are too many assignments, use a more compact format
      if (day.assignments.length <= 5) {
        body = createDigestMessage(day.assignments);
      } else {
        // For many assignments, show count by type
        const countByType = day.assignments.reduce((acc, curr) => {
          acc[curr.type] = (acc[curr.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        body = 'Assignment summary:\n';
        
        for (const [type, count] of Object.entries(countByType)) {
          const typeEmoji = getAssignmentTypeEmoji(type as AssignmentType);
          body += `${typeEmoji} ${count} ${type}${count > 1 ? 's' : ''}\n`;
        }
        
        // Only add "tap to view details" if we're showing a summary rather than all assignments
        body += '\nTap to view details.';
      }
    } else {
      // Multiple days format - use a more summarized approach
      title = `📚 ${totalAssignments} Assignment${totalAssignments > 1 ? 's' : ''} This Week`;
      
      // Summarize by day
      for (const day of digestData) {
        body += `📅 ${day.dayTitle}: ${day.assignments.length} assignment${day.assignments.length > 1 ? 's' : ''}\n`;
        
        // Only show details for the first 2 days to keep it concise
        if (day === digestData[0] || day === digestData[1]) {
          // Group by type for more efficient display
          const typeGroups = day.assignments.reduce((acc, curr) => {
            if (!acc[curr.type]) acc[curr.type] = [];
            acc[curr.type].push(curr);
            return acc;
          }, {} as Record<string, any[]>);
          
          for (const [type, items] of Object.entries(typeGroups)) {
            const typeEmoji = getAssignmentTypeEmoji(type as AssignmentType);
            if (items.length === 1) {
              const item = items[0];
              body += `  ${typeEmoji} "${truncateText(item.title, 50)}" (${item.courseInfo})\n`;
            } else {
              body += `  ${typeEmoji} ${items.length} ${type}s\n`;
            }
          }
        }
        
        body += '\n';
      }
      
      // Only add "tap to view all" if there are more than 2 days or we're summarizing the assignments
      const hasMoreDays = digestData.length > 2;
      const hasHiddenAssignments = digestData.slice(0, 2).some(day => {
        const typeGroups = day.assignments.reduce((acc, curr) => {
          if (!acc[curr.type]) acc[curr.type] = [];
          acc[curr.type].push(curr);
          return acc;
        }, {} as Record<string, any[]>);
        
        return Object.values(typeGroups).some(items => items.length > 1);
      });
      
      body = truncateText(body.trim(), 700);
      
      if (hasMoreDays || hasHiddenAssignments) {
        body += '\n\nTap to view all.';
      }
    }
    
    // Schedule the daily digest notification
    await scheduleNotification(
      title,
      body,
      notificationTime,
      { type: 'digest', data: digestData, navigateTo: 'assignments' },
      'daily-digest-notification',
      Platform.OS === 'android' ? 'daily-digest' : 'default'
    );
  } catch (error) {
    console.error('Error creating daily digest:', error);
  }
}

// Schedule notifications for a single assignment
export async function scheduleNotificationForAssignment(assignment: Assignment): Promise<void> {
  try {
    // Get notification settings
    const settings = await getNotificationSettings();
    
    // Don't schedule if notifications are disabled or assignment is completed
    if (!settings.enabled || assignment.isCompleted) {
      return;
    }

    const dueDate = parseISO(assignment.dueDate);
    const now = new Date();
    
    // Schedule critical individual notifications (due soon, day before)
    await scheduleIndividualNotifications(assignment);
    
    // Update the daily digest to include this assignment
    // Use getAssignments directly from AsyncStorage to avoid dynamic imports
    try {
      const assignmentsJson = await AsyncStorage.getItem(ASSIGNMENTS_STORAGE_KEY);
      const allAssignments = assignmentsJson ? JSON.parse(assignmentsJson) : [];
      
      // Map to ensure all assignments have a type (for backward compatibility)
      const processedAssignments = allAssignments.map((a: any) => ({
        ...a,
        assignmentType: a.assignmentType || AssignmentType.HOMEWORK
      }));
      
      await createAndScheduleDailyDigest(processedAssignments);
    } catch (storageError) {
      console.error('Error reading assignments from storage:', storageError);
    }
    
  } catch (error) {
    console.error('Error scheduling notifications for assignment:', error);
  }
}

// Schedule notifications for all assignments
export async function scheduleAllNotifications(assignments: Assignment[]): Promise<void> {
  try {
    // Get notification settings
    const settings = await getNotificationSettings();
    
    // If notifications are disabled, cancel all and return
    if (!settings.enabled) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      return;
    }
    
    // First cancel all existing notifications to avoid duplicates
    await Notifications.cancelAllScheduledNotificationsAsync();
    
    // Only work with incomplete assignments
    const incompleteAssignments = assignments.filter(a => !a.isCompleted);
    
    // Schedule individual critical notifications for each assignment
    for (const assignment of incompleteAssignments) {
      await scheduleIndividualNotifications(assignment);
    }
    
    // Create and schedule the daily digest
    await createAndScheduleDailyDigest(incompleteAssignments);
  } catch (error) {
    console.error('Error scheduling all notifications:', error);
  }
}

// Cancel notifications for a specific assignment
export async function cancelNotificationsForAssignment(assignmentId: string): Promise<void> {
  try {
    // Cancel all notification types for this assignment
    const notificationTypes = ['due', 'reminder', 'early-reminder', 'priority-reminder', 'daily'];
    for (const type of notificationTypes) {
      const identifier = type === 'priority-reminder' 
        ? `assignment-${assignmentId}-priority-reminder` 
        : getNotificationId(assignmentId, type as any);
      
      await Notifications.cancelScheduledNotificationAsync(identifier);
    }
    
    // Get all assignments to update the daily digest
    try {
      const assignmentsJson = await AsyncStorage.getItem(ASSIGNMENTS_STORAGE_KEY);
      const allAssignments = assignmentsJson ? JSON.parse(assignmentsJson) : [];
      
      // Map to ensure all assignments have a type (for backward compatibility)
      const processedAssignments = allAssignments
        .map((a: any) => ({
          ...a,
          assignmentType: a.assignmentType || AssignmentType.HOMEWORK
        }))
        .filter((a: any) => a.id !== assignmentId); // Remove the deleted assignment
      
      // Reschedule the daily digest without this assignment
      await createAndScheduleDailyDigest(processedAssignments);
    } catch (storageError) {
      console.error('Error reading assignments from storage:', storageError);
    }
  } catch (error) {
    console.error('Error cancelling notifications:', error);
  }
}

// Initialize the notification system
export async function initializeNotifications(): Promise<void> {
  try {
    // Configure notification behavior
    configureNotifications();
    
    // Request permission
    await registerForPushNotificationsAsync();
    
    // Load settings but don't schedule anything yet
    // This prevents sending all notifications at once on app startup
    await getNotificationSettings();
  } catch (error) {
    console.error('Error initializing notifications:', error);
  }
}

// Helper function to check if two dates are on the same day
function isSameDay(date1: Date, date2: Date): boolean {
  return date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear();
}

// Check and reschedule notifications (can be called on app start)
export async function checkAndRescheduleNotifications(assignments: Assignment[]): Promise<void> {
  try {
    // Get notification settings
    const settings = await getNotificationSettings();
    
    // If notifications are disabled, don't reschedule
    if (!settings.enabled) {
      return;
    }
    
    // Get all scheduled notifications
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    
    // Extract assignment IDs from scheduled notifications
    const scheduledAssignmentIds = new Set<string>();
    const scheduledTypes = new Map<string, Set<string>>();
    
    scheduledNotifications.forEach(notification => {
      const assignmentId = notification.content.data?.assignmentId;
      const type = notification.content.data?.type;
      
      if (assignmentId) {
        scheduledAssignmentIds.add(assignmentId);
        
        // Track which notification types are already scheduled for each assignment
        if (!scheduledTypes.has(assignmentId)) {
          scheduledTypes.set(assignmentId, new Set());
        }
        
        if (type) {
          scheduledTypes.get(assignmentId)?.add(type);
        }
      }
    });
    
    // Find incomplete assignments
    const now = new Date();
    const incompleteAssignments = assignments.filter(a => 
      !a.isCompleted && 
      parseISO(a.dueDate) > now // Exclude assignments past their due date
    );
    
    // Process each assignment individually to schedule only needed notifications
    for (const assignment of incompleteAssignments) {
      const dueDate = parseISO(assignment.dueDate);
      
      // Skip if assignment due date is in the past (redundant check, but keeping for safety)
      if (dueDate <= now) {
        continue;
      }
      
      const assignmentTypes = scheduledTypes.get(assignment.id) || new Set();
      const daysUntilDue = differenceInDays(dueDate, now);
      const reminderDays = await getReminderDaysForType(assignment.assignmentType);
      
      // Check if we need to schedule the initial reminder
      if (!assignmentTypes.has('early-reminder') && daysUntilDue <= reminderDays && daysUntilDue >= reminderDays - 1) {
        // If we're exactly at the reminder day threshold or just entered it
        const today = startOfDay(now);
        const reminderDay = startOfDay(addDays(dueDate, -reminderDays));
        
        if (isSameDay(today, reminderDay)) {
          await scheduleIndividualNotifications(assignment);
          continue; // Skip to next assignment, all notifications scheduled
        }
      }
      
      // Check if we need to schedule day-before notification
      if (!assignmentTypes.has('reminder') && daysUntilDue <= 1 && daysUntilDue > 0) {
        await scheduleIndividualNotifications(assignment);
        continue;
      }
      
      // Check if we need to schedule hour-before notification
      if (!assignmentTypes.has('due') && daysUntilDue < 1) {
        const hoursTilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        
        if (hoursTilDue <= 1 && hoursTilDue > 0) {
          await scheduleIndividualNotifications(assignment);
          continue;
        }
      }
      
      // Check if daily reminders are enabled and we need today's reminder
      const shouldSendDaily = await shouldSendDailyReminder(assignment.assignmentType);
      if (shouldSendDaily && !assignmentTypes.has('daily') && daysUntilDue <= reminderDays && daysUntilDue > 1) {
        // Schedule just today's reminder
        const notificationTimeDate = new Date(settings.notificationTime);
        const todayNotificationTime = new Date();
        todayNotificationTime.setHours(
          notificationTimeDate.getHours(),
          notificationTimeDate.getMinutes(),
          0, 0
        );
        
        // Only schedule if the notification time is still in the future
        if (todayNotificationTime > now) {
          const courseInfo = formatCourseInfo(assignment.courseCode, assignment.courseName);
          const channelId = getChannelId(assignment.assignmentType);
          
          await scheduleNotification(
            `📅 ${assignment.assignmentType}`,
            `"${truncateText(assignment.title, 30)}" (${courseInfo}) due in ${daysUntilDue} days.`,
            todayNotificationTime,
            { assignmentId: assignment.id, type: 'daily' },
            getNotificationId(assignment.id, 'daily'),
            channelId
          );
        }
      }
    }
    
    // Always update daily digest to ensure it's current
    await createAndScheduleDailyDigest(incompleteAssignments);
    
  } catch (error) {
    console.error('Error checking and rescheduling notifications:', error);
  }
}

// Get remaining time text for an assignment
export function getRemainingTimeText(dueDate: string): string {
  try {
    const date = parseISO(dueDate);
    const now = new Date();
    
    if (date < now) {
      return '⏰ Overdue';
    }
    
    const timeRemaining = formatDistanceToNow(date, { addSuffix: true });
    return `⏳ ${timeRemaining}`;
  } catch (error) {
    console.error('Error formatting remaining time:', error);
    return 'Unknown';
  }
} 
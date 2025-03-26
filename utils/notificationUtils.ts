import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import type { Assignment } from './assignmentStorage';
import { AssignmentType } from './assignmentStorage';
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

// Save notification settings
export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
    console.log('Notification settings saved');
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
      console.log('Failed to get push token for push notification!');
      return;
    }
    
    // Get push token
    token = (await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PROJECT_ID,
    })).data;
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

// Configure notification handler
export function configureNotifications() {
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

// Schedule a notification 
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
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            data,
            sound: true,
            ...(Platform.OS === 'android' ? { channelId } : {}),
          },
          trigger: {
            type: SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: secondsFromNow,
          },
          identifier,
        });
        console.log(`Scheduled notification: ${identifier} for ${triggerDate.toISOString()} (${secondsFromNow} seconds from now)`);
      } else {
        console.log(`Skipped immediate notification: ${identifier}`);
      }
    } else {
      console.log(`Skipped past notification: ${identifier} for ${triggerDate.toISOString()}`);
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
    const courseInfo = assignment.courseCode ? `${assignment.courseCode} - ${assignment.courseName}` : assignment.courseName;
    const channelId = getChannelId(assignment.assignmentType);
    
    // 1. Due date notification (1 hour before)
    const dueNotificationTime = new Date(dueDate.getTime() - 60 * 60 * 1000); // 1 hour before
    
    if (dueNotificationTime > now) {
      await scheduleNotification(
        `${assignment.assignmentType} Due Soon`,
        `${assignment.title} for ${courseInfo} is due in 1 hour.`,
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
        `${assignment.assignmentType} Due Tomorrow`,
        `${assignment.title} for ${courseInfo} is due tomorrow.`,
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
        `${assignment.assignmentType} Coming Up`,
        `${assignment.title} for ${courseInfo} is due in ${reminderDays} days.`,
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
            `${assignment.assignmentType} Reminder`,
            `${assignment.title} for ${courseInfo} is due in ${daysUntilDue} days.`,
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
          `PRIORITY: ${assignment.assignmentType} Due Very Soon`,
          `${assignment.title} for ${courseInfo} is due in 1 hour.`,
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
  
  // Build a more structured message
  let message = '';
  
  for (const [type, items] of Object.entries(byType)) {
    message += `📌 ${type}${items.length > 1 ? 's' : ''}: \n`;
    
    items.forEach(item => {
      // Format the time part of the due date
      const dueTime = format(parseISO(item.dueDate), 'h:mm a');
      message += `  • ${item.title} (${item.courseInfo}) @ ${dueTime}\n`;
    });
    
    message += '\n';
  }
  
  return message.trim();
}

// Create and schedule a single daily notification at the specified time with all upcoming assignments
export async function createAndScheduleDailyDigest(assignments: Assignment[], sendNow: boolean = false): Promise<void> {
  try {
    const settings = await getNotificationSettings();
    if (!settings.enabled) return;
    
    const now = new Date();
    const incompleteAssignments = assignments.filter(a => !a.isCompleted);
    
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
      console.log('No upcoming assignments to notify about');
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
          title: a.title,
          courseInfo: a.courseCode ? `${a.courseCode} - ${a.courseName}` : a.courseName,
          type: a.assignmentType,
          dueDate: a.dueDate
        }))
      });
    }
    
    // Sort by date
    digestData.sort((a, b) => a.date.localeCompare(b.date));
    
    // Build the notification content
    let title = '📚 Your Daily Assignment Summary';
    let body = '';
    
    if (digestData.length === 1) {
      // Single day format
      const day = digestData[0];
      title = `📚 Assignments for ${day.dayTitle}`;
      body = createDigestMessage(day.assignments);
    } else {
      // Multiple days format
      for (const day of digestData) {
        body += `📅 ${day.dayTitle}:\n`;
        body += createDigestMessage(day.assignments);
        body += '\n\n';
      }
    }
    
    // Schedule the daily digest notification
    await scheduleNotification(
      title,
      body,
      notificationTime,
      { type: 'digest', data: digestData },
      'daily-digest-notification',
      Platform.OS === 'android' ? 'daily-digest' : 'default'
    );
    
    console.log(`Scheduled daily digest notification for ${notificationTime.toISOString()}`);
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
      console.log('Notifications are disabled, canceled all scheduled notifications');
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
    
    console.log(`Scheduled notifications for ${incompleteAssignments.length} assignments`);
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
    
    console.log(`Cancelled notifications for assignment: ${assignmentId}`);
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
    const settings = await getNotificationSettings();
    console.log('Notification system initialized with settings:', settings.enabled ? 'enabled' : 'disabled');
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
    const incompleteAssignments = assignments.filter(a => !a.isCompleted);
    
    // Process each assignment individually to schedule only needed notifications
    for (const assignment of incompleteAssignments) {
      const dueDate = parseISO(assignment.dueDate);
      const now = new Date();
      
      // Skip if assignment due date is in the past
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
          const courseInfo = assignment.courseCode ? `${assignment.courseCode} - ${assignment.courseName}` : assignment.courseName;
          const channelId = getChannelId(assignment.assignmentType);
          
          await scheduleNotification(
            `${assignment.assignmentType} Reminder`,
            `${assignment.title} for ${courseInfo} is due in ${daysUntilDue} days.`,
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
      return 'Overdue';
    }
    
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (error) {
    console.error('Error formatting remaining time:', error);
    return 'Unknown';
  }
}

// Send test notification (for debugging purposes)
export async function sendTestNotification(type: AssignmentType = AssignmentType.TEST): Promise<void> {
  try {
    // Create test assignment data
    const testAssignment: Assignment = {
      id: 'test-' + Date.now(),
      title: 'Test Assignment',
      description: 'This is a test notification to verify your notification settings',
      courseCode: 'TEST101',
      courseName: 'Notification Testing',
      dueDate: addHours(new Date(), 2).toISOString(), // Due in 2 hours
      isCompleted: false,
      isPriority: true,
      assignmentType: type,
    };
    
    // Send immediate test notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Test: ${type} Due Soon`,
        body: `${testAssignment.title} for ${testAssignment.courseCode} - ${testAssignment.courseName} is due in 2 hours.`,
        data: { isTest: true },
        sound: true,
      },
      trigger: null, // Send immediately
    });
    
    console.log('Test notification sent');
  } catch (error) {
    console.error('Error sending test notification:', error);
    throw error;
  }
}

// Test notification timing (for debugging purposes)
export async function testNotificationTiming(): Promise<void> {
  try {
    const settings = await getNotificationSettings();
    
    // 1. Immediate notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Immediate Test Notification',
        body: 'This notification appears immediately.',
        data: { isTest: true },
        sound: true,
      },
      trigger: null, // Send immediately
    });
    
    // 2. Notification in 30 seconds
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Delayed Test Notification',
        body: 'This notification appears 30 seconds after the test began.',
        data: { isTest: true },
        sound: true,
      },
      trigger: {
        type: SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 30,
      },
    });
    
    // 3. Notification at the user's configured time
    const notificationTimeDate = new Date(settings.notificationTime);
    const todayAtNotificationTime = new Date();
    todayAtNotificationTime.setHours(
      notificationTimeDate.getHours(),
      notificationTimeDate.getMinutes(),
      0,
      0
    );
    
    // If the notification time has already passed for today, schedule for tomorrow
    if (todayAtNotificationTime <= new Date()) {
      todayAtNotificationTime.setDate(todayAtNotificationTime.getDate() + 1);
    }
    
    // Calculate seconds until the notification time
    const secondsUntilNotificationTime = Math.floor(
      (todayAtNotificationTime.getTime() - new Date().getTime()) / 1000
    );
    
    const formattedTime = format(
      todayAtNotificationTime, 
      'h:mm a' // Format as "3:30 PM"
    );
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Scheduled Test Notification',
        body: `This notification appears at your configured time (${formattedTime}).`,
        data: { isTest: true },
        sound: true,
      },
      trigger: {
        type: SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntilNotificationTime,
      },
    });
    
    console.log('Notification timing test initiated');
  } catch (error) {
    console.error('Error testing notification timing:', error);
    throw error;
  }
} 
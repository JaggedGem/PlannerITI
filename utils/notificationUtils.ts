import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import type { Assignment } from './assignmentStorage';
import { AssignmentType } from './assignmentStorage';
import { formatDistanceToNow, addHours, addDays, parseISO, format } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import the required types
export enum SchedulableTriggerInputTypes {
  TIME_INTERVAL = 'timeInterval',
  DATE = 'date',
  DAILY = 'daily',
  WEEKLY = 'weekly'
}

// Storage key for notification settings
const NOTIFICATION_SETTINGS_KEY = '@planner_notification_settings';

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
    const courseInfo = assignment.courseCode ? `${assignment.courseCode} - ${assignment.courseName}` : assignment.courseName;
    const channelId = getChannelId(assignment.assignmentType);
    
    // 1. Due date notification (30 minutes before)
    const dueNotificationTime = new Date(dueDate.getTime() - 30 * 60 * 1000); // 30 minutes before
    
    if (dueNotificationTime > now) {
      await scheduleNotification(
        `${assignment.assignmentType} Due Soon`,
        `${assignment.title} for ${courseInfo} is due in 30 minutes.`,
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

    // 3. Early reminder based on assignment type
    const earlyReminderDays = await getReminderDaysForType(assignment.assignmentType);
    if (earlyReminderDays > 1) { // Only do early reminder if it's more than 1 day
      const earlyReminderDate = addDays(dueDate, -earlyReminderDays);
      
      if (earlyReminderDate > now) {
        await scheduleNotification(
          `${assignment.assignmentType} Coming Up`,
          `${assignment.title} for ${courseInfo} is due in ${earlyReminderDays} days.`,
          earlyReminderDate,
          { assignmentId: assignment.id, type: 'early-reminder' },
          getNotificationId(assignment.id, 'early-reminder'),
          channelId
        );
      }
    }

    // 4. Priority assignments get an extra reminder 1 hour before
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
    
    // 5. Daily reminder at the configured notification time
    const shouldSendDaily = await shouldSendDailyReminder(assignment.assignmentType);
    if (shouldSendDaily) {
      // Get the notification time from settings
      const notificationTimeDate = new Date(settings.notificationTime);
      
      // Create a date object for today at the notification time
      const todayAtNotificationTime = new Date();
      todayAtNotificationTime.setHours(
        notificationTimeDate.getHours(),
        notificationTimeDate.getMinutes(),
        0,
        0
      );
      
      // If the notification time has already passed for today, schedule for tomorrow
      if (todayAtNotificationTime <= now) {
        todayAtNotificationTime.setDate(todayAtNotificationTime.getDate() + 1);
      }
      
      // Only schedule if the due date is after the notification time and not completed
      if (todayAtNotificationTime < dueDate) {
        // Calculate days until due
        const daysUntilDue = Math.ceil((dueDate.getTime() - todayAtNotificationTime.getTime()) / (1000 * 60 * 60 * 24));
        
        await scheduleNotification(
          `${assignment.assignmentType} Reminder`,
          `${assignment.title} for ${courseInfo} is due in ${daysUntilDue} days.`,
          todayAtNotificationTime,
          { assignmentId: assignment.id, type: 'daily' },
          getNotificationId(assignment.id, 'daily'),
          channelId
        );
      }
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
    
    // Schedule notifications for each non-completed assignment
    const incompleteAssignments = assignments.filter(a => !a.isCompleted);
    for (const assignment of incompleteAssignments) {
      await scheduleNotificationForAssignment(assignment);
    }
    
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
    scheduledNotifications.forEach(notification => {
      const assignmentId = notification.content.data?.assignmentId;
      if (assignmentId) {
        scheduledAssignmentIds.add(assignmentId);
      }
    });
    
    // Find incomplete assignments that don't have scheduled notifications
    const incompleteAssignments = assignments.filter(a => !a.isCompleted);
    const unscheduledAssignments = incompleteAssignments.filter(
      assignment => !scheduledAssignmentIds.has(assignment.id)
    );
    
    // Only schedule notifications for assignments that don't have them
    if (unscheduledAssignments.length > 0) {
      console.log(`Scheduling notifications for ${unscheduledAssignments.length} assignments without notifications`);
      
      for (const assignment of unscheduledAssignments) {
        await scheduleNotificationForAssignment(assignment);
      }
    } else {
      console.log('All incomplete assignments already have notifications scheduled');
    }
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { Assignment, AssignmentType, getAssignments } from './assignmentStorage';
import { addDays, parseISO, format, isAfter } from 'date-fns';

// Storage keys
const NOTIFICATION_SETTINGS_KEY = 'notification_settings';
const SCHEDULED_NOTIFICATIONS_KEY = 'scheduled_notifications';

// Default notification time: 5:00 PM
const DEFAULT_NOTIFICATION_TIME = new Date();
DEFAULT_NOTIFICATION_TIME.setHours(17, 0, 0, 0);

// Add a new constant for the last notification update timestamp
const LAST_NOTIFICATION_UPDATE_KEY = 'last_notification_update';
const MIN_RESCHEDULE_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours in milliseconds

// Default notification settings
export interface NotificationSettings {
  enabled: boolean;
  notificationTime: string; // ISO string of time (date part is ignored)
  examReminderDays: number; // Days before exam to start notifications
  testReminderDays: number; // Days before test to start notifications
  quizReminderDays: number; // Days before quiz to start notifications
  homeworkReminderDays: number; // Days before homework to notify
  projectReminderDays: number; // Days before project to notify
  otherReminderDays: number; // Days before other assignments to notify
  dailyRemindersForExams: boolean; // Whether to send daily reminders for exams
  dailyRemindersForTests: boolean; // Whether to send daily reminders for tests
  dailyRemindersForQuizzes: boolean; // Whether to send daily reminders for quizzes
}

// Interface for tracking scheduled notifications
export interface ScheduledNotification {
  assignmentId: string;
  notificationIds: string[]; // Array of notification identifiers
}

// Default notification settings
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  notificationTime: DEFAULT_NOTIFICATION_TIME.toISOString(),
  examReminderDays: 7,
  testReminderDays: 5,
  quizReminderDays: 3,
  homeworkReminderDays: 2,
  projectReminderDays: 3,
  otherReminderDays: 1,
  dailyRemindersForExams: true,
  dailyRemindersForTests: true,
  dailyRemindersForQuizzes: false
};

// Get notification settings
export const getNotificationSettings = async (): Promise<NotificationSettings> => {
  try {
    const settingsJson = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (settingsJson) {
      return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(settingsJson) };
    }
    return DEFAULT_NOTIFICATION_SETTINGS;
  } catch (error) {
    console.error('Error getting notification settings:', error);
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
};

// Save notification settings
export const saveNotificationSettings = async (settings: NotificationSettings): Promise<void> => {
  try {
    await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving notification settings:', error);
  }
};

// Get scheduled notifications
export const getScheduledNotifications = async (): Promise<ScheduledNotification[]> => {
  try {
    const notificationsJson = await AsyncStorage.getItem(SCHEDULED_NOTIFICATIONS_KEY);
    return notificationsJson ? JSON.parse(notificationsJson) : [];
  } catch (error) {
    console.error('Error getting scheduled notifications:', error);
    return [];
  }
};

// Save scheduled notifications
export const saveScheduledNotifications = async (notifications: ScheduledNotification[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(SCHEDULED_NOTIFICATIONS_KEY, JSON.stringify(notifications));
  } catch (error) {
    console.error('Error saving scheduled notifications:', error);
  }
};

// Register for push notifications
export const registerForPushNotificationsAsync = async (): Promise<string | undefined> => {
  let token;
  
  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return undefined;
    }
    
    token = (await Notifications.getExpoPushTokenAsync()).data;
  } else {
    console.log('Must use physical device for push notifications');
  }

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('assignments', {
      name: 'Assignments',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return token;
};

// Modify the scheduleNotificationForAssignment function to be smarter about daily notifications
export const scheduleNotificationForAssignment = async (
  assignment: Assignment,
  settings: NotificationSettings = DEFAULT_NOTIFICATION_SETTINGS
): Promise<string[]> => {
  if (!settings.enabled) return [];
  
  const scheduledIds: string[] = [];
  const dueDate = parseISO(assignment.dueDate);
  const now = new Date();
  
  // Skip if due date is in the past
  if (isAfter(now, dueDate)) return [];
  
  // Get notification time
  const notificationTime = parseISO(settings.notificationTime);
  
  // Determine reminder days based on assignment type
  let reminderDays = settings.otherReminderDays;
  let sendDailyReminders = false;
  
  switch (assignment.assignmentType) {
    case AssignmentType.EXAM:
      reminderDays = settings.examReminderDays;
      sendDailyReminders = settings.dailyRemindersForExams;
      break;
    case AssignmentType.TEST:
      reminderDays = settings.testReminderDays;
      sendDailyReminders = settings.dailyRemindersForTests;
      break;
    case AssignmentType.QUIZ:
      reminderDays = settings.quizReminderDays;
      sendDailyReminders = settings.dailyRemindersForQuizzes;
      break;
    case AssignmentType.HOMEWORK:
      reminderDays = settings.homeworkReminderDays;
      break;
    case AssignmentType.PROJECT:
      reminderDays = settings.projectReminderDays;
      break;
    default:
      reminderDays = settings.otherReminderDays;
  }
  
  // Calculate days until due date
  const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  // Calculate first reminder date
  const firstReminderDate = addDays(dueDate, -reminderDays);
  firstReminderDate.setHours(
    notificationTime.getHours(),
    notificationTime.getMinutes(),
    0,
    0
  );
  
  // Only schedule if the first reminder is in the future
  if (isAfter(firstReminderDate, now)) {
    // Schedule first reminder
    const firstReminderId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${assignment.assignmentType}: ${assignment.title}`,
        body: `Due on ${format(dueDate, 'MMM d')} for ${assignment.courseName}`,
        data: { assignmentId: assignment.id }
      },
      trigger: {
        date: firstReminderDate,
        channelId: 'assignments'
      },
    });
    scheduledIds.push(firstReminderId);
    
    // Schedule daily reminders if enabled, but with improved logic
    if (sendDailyReminders) {
      // Only schedule daily reminders if there are at least 2 days remaining
      // and limit to a reasonable number of notifications
      const maxDailyReminders = Math.min(reminderDays - 1, 3); // Maximum 3 daily reminders
      const dailyReminderDays = [];
      
      // Distribute reminders more sensibly based on days until due
      if (daysUntilDue > 5) {
        // For assignments more than 5 days away, space out reminders
        const interval = Math.max(1, Math.floor(daysUntilDue / 3));
        for (let i = daysUntilDue - interval; i > 1; i -= interval) {
          dailyReminderDays.push(i);
          if (dailyReminderDays.length >= maxDailyReminders) break;
        }
      } else if (daysUntilDue > 1) {
        // For closer assignments, just do a mid-point reminder
        dailyReminderDays.push(Math.floor(daysUntilDue / 2));
      }
      
      // Schedule the calculated daily reminders
      for (const daysLeft of dailyReminderDays) {
        const reminderDate = addDays(dueDate, -daysLeft);
        reminderDate.setHours(
          notificationTime.getHours(),
          notificationTime.getMinutes(),
          0,
          0
        );
        
        if (isAfter(reminderDate, now)) {
          const reminderId = await Notifications.scheduleNotificationAsync({
            content: {
              title: `Reminder: ${assignment.assignmentType} in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`,
              body: `${assignment.title} for ${assignment.courseName} is due on ${format(dueDate, 'MMM d')}`,
              data: { assignmentId: assignment.id }
            },
            trigger: {
              date: reminderDate,
              channelId: 'assignments'
            },
          });
          scheduledIds.push(reminderId);
        }
      }
      
      // Schedule day-of reminder only if the due date is tomorrow or later
      if (daysUntilDue >= 1) {
        const dayOfReminder = new Date(dueDate);
        dayOfReminder.setHours(9, 0, 0, 0); // Earlier in the day
        
        if (isAfter(dayOfReminder, now)) {
          const dayOfId = await Notifications.scheduleNotificationAsync({
            content: {
              title: `${assignment.assignmentType} Today!`,
              body: `${assignment.title} for ${assignment.courseName} is due today`,
              data: { assignmentId: assignment.id }
            },
            trigger: {
              date: dayOfReminder,
              channelId: 'assignments'
            },
          });
          scheduledIds.push(dayOfId);
        }
      }
    }
  }
  
  return scheduledIds;
};

// Cancel scheduled notifications for an assignment
export const cancelNotificationsForAssignment = async (assignmentId: string): Promise<void> => {
  const scheduledNotifications = await getScheduledNotifications();
  const assignmentNotification = scheduledNotifications.find(n => n.assignmentId === assignmentId);
  
  if (assignmentNotification) {
    // Cancel each notification
    for (const notificationId of assignmentNotification.notificationIds) {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    }
    
    // Remove from tracking list
    const updatedNotifications = scheduledNotifications.filter(n => n.assignmentId !== assignmentId);
    await saveScheduledNotifications(updatedNotifications);
  }
};

// Modify the scheduleAllNotifications function to group assignments by due date
export const scheduleAllNotifications = async (assignments: Assignment[]): Promise<void> => {
  try {
    const settings = await getNotificationSettings();
    if (!settings.enabled) return;
    
    // Check when we last updated notifications
    const lastUpdateStr = await AsyncStorage.getItem(LAST_NOTIFICATION_UPDATE_KEY);
    const now = new Date().getTime();
    
    if (lastUpdateStr) {
      const lastUpdate = parseInt(lastUpdateStr, 10);
      
      // Only reschedule if enough time has passed or if we can't parse the timestamp
      if (!isNaN(lastUpdate) && (now - lastUpdate < MIN_RESCHEDULE_INTERVAL)) {
        console.log('Skipping notification reschedule - last update was too recent');
        return;
      }
    }
    
    // Proceed with rescheduling
    // Cancel existing notifications first
    await Notifications.cancelAllScheduledNotificationsAsync();
    
    // Group assignments by due date in YYYY-MM-DD format
    const assignmentsByDueDate: Record<string, Assignment[]> = {};
    const activeAssignments = assignments.filter(a => !a.isCompleted);
    
    for (const assignment of activeAssignments) {
      const dueDate = parseISO(assignment.dueDate);
      const dateKey = format(dueDate, 'yyyy-MM-dd');
      
      if (!assignmentsByDueDate[dateKey]) {
        assignmentsByDueDate[dateKey] = [];
      }
      
      assignmentsByDueDate[dateKey].push(assignment);
    }
    
    // Schedule notifications for each due date group
    const scheduledNotifications: ScheduledNotification[] = [];
    
    for (const [dateKey, dateAssignments] of Object.entries(assignmentsByDueDate)) {
      // Sort assignments by type priority (Exam > Test > Quiz > Project > Homework > Other)
      const sortedAssignments = dateAssignments.sort((a, b) => {
        // Fixed typePriority object with string keys instead of enum values
        const typePriority: Record<string, number> = {
          [AssignmentType.EXAM]: 0,
          [AssignmentType.TEST]: 1,
          [AssignmentType.QUIZ]: 2,
          [AssignmentType.PROJECT]: 3,
          [AssignmentType.HOMEWORK]: 4,
          [AssignmentType.OTHER]: 5,
          [AssignmentType.LAB]: 6,
          [AssignmentType.ESSAY]: 7,
          [AssignmentType.PRESENTATION]: 8
        };
        
        return (typePriority[a.assignmentType] ?? 999) - (typePriority[b.assignmentType] ?? 999);
      });
      
      // Determine the earliest notification time based on assignment type
      let earliestReminderDays = 0;
      let needsDailyReminders = false;
      
      for (const assignment of sortedAssignments) {
        let reminderDays = 0;
        let dailyReminder = false;
        
        switch (assignment.assignmentType) {
          case AssignmentType.EXAM:
            reminderDays = settings.examReminderDays;
            dailyReminder = settings.dailyRemindersForExams;
            break;
          case AssignmentType.TEST:
            reminderDays = settings.testReminderDays;
            dailyReminder = settings.dailyRemindersForTests;
            break;
          case AssignmentType.QUIZ:
            reminderDays = settings.quizReminderDays;
            dailyReminder = settings.dailyRemindersForQuizzes;
            break;
          case AssignmentType.HOMEWORK:
            reminderDays = settings.homeworkReminderDays;
            break;
          case AssignmentType.PROJECT:
            reminderDays = settings.projectReminderDays;
            break;
          default:
            reminderDays = settings.otherReminderDays;
        }
        
        earliestReminderDays = Math.max(earliestReminderDays, reminderDays);
        if (dailyReminder) needsDailyReminders = true;
      }
      
      // Get the due date for this group
      const dueDate = parseISO(dateKey);
      // Fix the date comparison by ensuring both are in milliseconds
      const daysUntilDue = Math.ceil((dueDate.getTime() - now) / (1000 * 60 * 60 * 24));
      
      // Skip if due date is in the past
      if (daysUntilDue <= 0) continue;
      
      // Calculate first reminder date
      const notificationTime = parseISO(settings.notificationTime);
      const firstReminderDate = addDays(dueDate, -earliestReminderDays);
      firstReminderDate.setHours(
        notificationTime.getHours(),
        notificationTime.getMinutes(),
        0,
        0
      );
      
      // Only schedule if the first reminder is in the future
      if (isAfter(firstReminderDate, now)) {
        // Build notification content with all assignments
        const notificationIds: string[] = [];
        
        // Create initial notification title based on the highest priority assignment type
        const mainAssignment = sortedAssignments[0];
        const formattedDueDate = format(dueDate, 'MMM d');
        
        // Group assignments by type
        const groupedByType: Record<string, Assignment[]> = {};
        for (const assignment of sortedAssignments) {
          if (!groupedByType[assignment.assignmentType]) {
            groupedByType[assignment.assignmentType] = [];
          }
          groupedByType[assignment.assignmentType].push(assignment);
        }
        
        // Create notification title
        const title = `${mainAssignment.assignmentType} and more due on ${formattedDueDate}`;
        
        // Create notification body with all assignments by type
        let body = '';
        for (const [type, typeAssignments] of Object.entries(groupedByType)) {
          body += `${type} (${typeAssignments.length}): `;
          body += typeAssignments.map(a => `${a.title} for ${a.courseName}`).join(', ');
          body += '\n';
        }
        
        // Schedule first reminder
        const firstReminderId = await Notifications.scheduleNotificationAsync({
          content: {
            title: title,
            body: body.trim(),
            data: { dateKey, assignmentIds: sortedAssignments.map(a => a.id) }
          },
          trigger: {
            date: firstReminderDate,
            channelId: 'assignments'
          },
        });
        notificationIds.push(firstReminderId);
        
        // Schedule daily reminders if needed
        if (needsDailyReminders && daysUntilDue > 1) {
          // Calculate reminder intervals based on days until due
          const reminderDays: number[] = [];
          
          if (daysUntilDue > 5) {
            // For assignments more than 5 days away, space out reminders
            const interval = Math.max(1, Math.floor(daysUntilDue / 3));
            for (let i = daysUntilDue - interval; i > 1; i -= interval) {
              if (i < earliestReminderDays) continue; // Skip if earlier than the earliest reminder day
              reminderDays.push(i);
              if (reminderDays.length >= 2) break; // Max 2 intermediate reminders
            }
          } else {
            // For closer assignments, just do a mid-point reminder
            const midPoint = Math.floor(daysUntilDue / 2);
            if (midPoint >= 1) {
              reminderDays.push(midPoint);
            }
          }
          
          // Schedule the calculated daily reminders
          for (const daysLeft of reminderDays) {
            const reminderDate = addDays(dueDate, -daysLeft);
            reminderDate.setHours(
              notificationTime.getHours(),
              notificationTime.getMinutes(),
              0,
              0
            );
            
            if (isAfter(reminderDate, now)) {
              const reminderTitle = `Assignments due in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`;
              
              const reminderId = await Notifications.scheduleNotificationAsync({
                content: {
                  title: reminderTitle,
                  body: body.trim(),
                  data: { dateKey, assignmentIds: sortedAssignments.map(a => a.id) }
                },
                trigger: {
                  date: reminderDate,
                  channelId: 'assignments'
                },
              });
              notificationIds.push(reminderId);
            }
          }
          
          // Schedule day-of reminder
          const dayOfReminder = new Date(dueDate);
          dayOfReminder.setHours(9, 0, 0, 0); // Earlier in the day
          
          if (isAfter(dayOfReminder, now)) {
            const dayOfId = await Notifications.scheduleNotificationAsync({
              content: {
                title: `Assignments due today!`,
                body: body.trim(),
                data: { dateKey, assignmentIds: sortedAssignments.map(a => a.id) }
              },
              trigger: {
                date: dayOfReminder,
                channelId: 'assignments'
              },
            });
            notificationIds.push(dayOfId);
          }
        }
        
        // Save notification IDs for all assignments in this group
        for (const assignment of sortedAssignments) {
          scheduledNotifications.push({
            assignmentId: assignment.id,
            notificationIds: [...notificationIds] // Clone array to avoid reference issues
          });
        }
      }
    }
    
    // Save the scheduled notifications for tracking
    await saveScheduledNotifications(scheduledNotifications);
    
    // Update the last notification timestamp
    await AsyncStorage.setItem(LAST_NOTIFICATION_UPDATE_KEY, now.toString());
  } catch (error) {
    console.error('Error scheduling notifications:', error);
  }
};

// Initialize notifications
export const initializeNotifications = async (): Promise<void> => {
  // Set up notification handler
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
  
  // Request permissions
  await registerForPushNotificationsAsync();
};

// Update the test notification function to include the configured notification time
export const sendTestNotification = async (type: AssignmentType = AssignmentType.TEST): Promise<void> => {
  try {
    // Get the notification settings
    const settings = await getNotificationSettings();
    
    // Get existing assignments
    const assignments = await getAssignments();
    const activeAssignments = assignments.filter(a => !a.isCompleted);
    
    if (activeAssignments.length === 0) {
      // If no real assignments exist, create some sample assignments with different due dates
      const tomorrow = addDays(new Date(), 1);
      const nextWeek = addDays(new Date(), 7);
      const inTwoWeeks = addDays(new Date(), 14);
      
      // Create test assignments with different due dates
      const testAssignments = [
        // Tomorrow assignments
        {
          id: `test-test-${Date.now()}`,
          title: 'Chapter Test',
          description: 'Test on chapters 5-8',
          courseName: 'English',
          courseCode: 'ENG202',
          dueDate: tomorrow.toISOString(),
          isCompleted: false,
          isPriority: true,
          assignmentType: AssignmentType.TEST
        },
        {
          id: `test-homework-${Date.now() + 1}`,
          title: 'Essay Assignment',
          description: 'Write a 5-page essay',
          courseName: 'English',
          courseCode: 'ENG202',
          dueDate: tomorrow.toISOString(),
          isCompleted: false,
          isPriority: false,
          assignmentType: AssignmentType.HOMEWORK
        },
        // Next week assignment
        {
          id: `test-exam-${Date.now() + 3}`,
          title: 'Final Exam',
          description: 'Comprehensive exam covering all topics',
          courseName: 'Mathematics',
          courseCode: 'MATH101',
          dueDate: nextWeek.toISOString(),
          isCompleted: false,
          isPriority: true,
          assignmentType: AssignmentType.EXAM
        },
        // In two weeks assignments
        {
          id: `test-project-${Date.now() + 4}`,
          title: 'Term Project',
          description: 'Final project for the semester',
          courseName: 'Computer Science',
          courseCode: 'CS101',
          dueDate: inTwoWeeks.toISOString(),
          isCompleted: false,
          isPriority: true,
          assignmentType: AssignmentType.PROJECT
        },
        {
          id: `test-quiz-${Date.now() + 5}`,
          title: 'Quiz 5',
          description: 'Short quiz on recent materials',
          courseName: 'Physics',
          courseCode: 'PHYS201',
          dueDate: inTwoWeeks.toISOString(),
          isCompleted: false,
          isPriority: false,
          assignmentType: AssignmentType.QUIZ
        }
      ];
      
      // Use these test assignments instead
      activeAssignments.push(...testAssignments);
    }
    
    // Parse the notification time from settings
    const notificationTime = parseISO(settings.notificationTime);
    
    // Format the notification time for display
    const formattedTime = format(notificationTime, 'h:mm a');
    
    // Group assignments by due date in YYYY-MM-DD format
    const assignmentsByDueDate: Record<string, Assignment[]> = {};
    const now = new Date();
    
    // Track if we've sent any notifications
    let notificationSent = false;
    
    // First, filter assignments that should actually trigger notifications based on settings
    for (const assignment of activeAssignments) {
      const dueDate = parseISO(assignment.dueDate);
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      // Determine reminder days based on assignment type
      let reminderDays = settings.otherReminderDays;
      
      switch (assignment.assignmentType) {
        case AssignmentType.EXAM:
          reminderDays = settings.examReminderDays;
          break;
        case AssignmentType.TEST:
          reminderDays = settings.testReminderDays;
          break;
        case AssignmentType.QUIZ:
          reminderDays = settings.quizReminderDays;
          break;
        case AssignmentType.HOMEWORK:
          reminderDays = settings.homeworkReminderDays;
          break;
        case AssignmentType.PROJECT:
          reminderDays = settings.projectReminderDays;
          break;
        default:
          reminderDays = settings.otherReminderDays;
      }
      
      // Only include assignments that would trigger a notification based on settings
      // This simulates what would happen if today was the day the notification would be sent
      if (daysUntilDue <= reminderDays) {
        const dateKey = format(dueDate, 'yyyy-MM-dd');
        
        if (!assignmentsByDueDate[dateKey]) {
          assignmentsByDueDate[dateKey] = [];
        }
        
        assignmentsByDueDate[dateKey].push(assignment);
      }
    }
    
    // Send a test notification for each date that has assignments
    // matching the notification criteria
    for (const dateKey of Object.keys(assignmentsByDueDate)) {
      const dateAssignments = assignmentsByDueDate[dateKey];
      
      // Sort assignments by type priority
      const sortedAssignments = dateAssignments.sort((a, b) => {
        const typePriority: Record<string, number> = {
          [AssignmentType.EXAM]: 0,
          [AssignmentType.TEST]: 1,
          [AssignmentType.QUIZ]: 2,
          [AssignmentType.PROJECT]: 3,
          [AssignmentType.HOMEWORK]: 4,
          [AssignmentType.OTHER]: 5,
          [AssignmentType.LAB]: 6,
          [AssignmentType.ESSAY]: 7,
          [AssignmentType.PRESENTATION]: 8
        };
        
        return (typePriority[a.assignmentType] ?? 999) - (typePriority[b.assignmentType] ?? 999);
      });
      
      // Group assignments by type
      const groupedByType: Record<string, Assignment[]> = {};
      for (const assignment of sortedAssignments) {
        if (!groupedByType[assignment.assignmentType]) {
          groupedByType[assignment.assignmentType] = [];
        }
        groupedByType[assignment.assignmentType].push(assignment);
      }
      
      const dueDate = parseISO(dateKey);
      const formattedDueDate = format(dueDate, 'MMM d');
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      // Create notification title
      const mainAssignment = sortedAssignments[0];
      let title = '';
      
      if (daysUntilDue === 0) {
        title = `Assignments due today!`;
      } else if (sortedAssignments.length > 1) {
        title = `${mainAssignment.assignmentType} and more due on ${formattedDueDate} (in ${daysUntilDue} days)`;
      } else {
        title = `${mainAssignment.assignmentType}: ${mainAssignment.title} due on ${formattedDueDate} (in ${daysUntilDue} days)`;
      }
      
      // Create notification body with all assignments by type
      let body = '';
      for (const [type, typeAssignments] of Object.entries(groupedByType)) {
        body += `${type} (${typeAssignments.length}): `;
        body += typeAssignments.map(a => `${a.title} for ${a.courseName}`).join(', ');
        body += '\n';
      }
      
      // Show notification time and reminder settings
      body += `\n---\nThis notification would be sent at ${formattedTime}`;
      if (daysUntilDue > 0) {
        body += `, ${daysUntilDue} days before the due date.`;
      } else {
        body += ` on the due date.`;
      }
      
      // Add daily reminder information based on the assignment types
      let hasDailyReminders = false;
      for (const assignment of sortedAssignments) {
        switch (assignment.assignmentType) {
          case AssignmentType.EXAM:
            if (settings.dailyRemindersForExams) hasDailyReminders = true;
            break;
          case AssignmentType.TEST:
            if (settings.dailyRemindersForTests) hasDailyReminders = true;
            break;
          case AssignmentType.QUIZ:
            if (settings.dailyRemindersForQuizzes) hasDailyReminders = true;
            break;
        }
      }
      
      if (hasDailyReminders && daysUntilDue > 1) {
        body += `\nAdditional daily reminders would be sent as the due date approaches.`;
      }
      
      // Add a delay between notifications
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Send the notification for this date
      await Notifications.scheduleNotificationAsync({
        content: {
          title: title,
          body: body.trim(),
          data: { 
            dateKey: dateKey, 
            assignmentIds: sortedAssignments.map(a => a.id), 
            isTest: true,
            daysUntilDue,
            notificationTime: formattedTime
          }
        },
        trigger: null, // Send immediately
      });
      
      console.log(`Sent test notification for ${sortedAssignments.length} assignments due on ${formattedDueDate}`);
      notificationSent = true;
    }
    
    // If we didn't send any notifications, explain why
    if (!notificationSent) {
      // Create a summary of notification settings
      const settingsSummary = `
Current notification settings:
- Notification time: ${formattedTime}
- Exams: ${settings.examReminderDays} days before
- Tests: ${settings.testReminderDays} days before
- Quizzes: ${settings.quizReminderDays} days before
- Homework: ${settings.homeworkReminderDays} days before
- Projects: ${settings.projectReminderDays} days before
- Other: ${settings.otherReminderDays} days before
- Daily reminders: ${settings.dailyRemindersForExams ? 'Enabled for exams' : 'Disabled for exams'}, ${settings.dailyRemindersForTests ? 'Enabled for tests' : 'Disabled for tests'}, ${settings.dailyRemindersForQuizzes ? 'Enabled for quizzes' : 'Disabled for quizzes'}
      `.trim();
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "No notifications to send right now",
          body: `Based on your notification settings, none of your assignments would trigger a notification today.\n\n${settingsSummary}`,
          data: { isTest: true }
        },
        trigger: null,
      });
      console.log("Sent test notification explaining no assignments match notification criteria");
    }
  } catch (error) {
    console.error('Error sending test notification:', error);
  }
}; 
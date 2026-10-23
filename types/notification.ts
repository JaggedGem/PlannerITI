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
  dailyRemindersForQuizzes: true,
};

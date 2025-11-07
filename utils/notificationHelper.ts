import type { Assignment } from './assignmentStorage';
import * as Notifications from 'expo-notifications';
import { 
  scheduleNotificationForAssignment, 
  cancelNotificationsForAssignment as cancelNotifications, 
  scheduleAllNotifications as scheduleAll 
} from './notificationUtils';

// Schedule a notification for a new assignment
export async function scheduleForNewAssignment(assignment: Assignment): Promise<void> {
  try {
    await scheduleNotificationForAssignment(assignment);
  } catch (error) {
  }
}

// Handle assignment completion state change
export async function handleCompletionStateChange(
  assignment: Assignment, 
  wasCompleted: boolean,
  id: string
): Promise<void> {
  try {
    if (!wasCompleted) {
      // If assignment was just marked complete, cancel its notifications
      await cancelNotifications(id);
    } else {
      // If assignment was marked incomplete, schedule notifications for this assignment
      await scheduleNotificationForAssignment(assignment);
    }
  } catch (error) {
  }
}

// Cancel notifications for a deleted assignment
export async function cancelForDeletedAssignment(id: string): Promise<void> {
  try {
    await cancelNotifications(id);
  } catch (error) {
  }
}

// Update notifications for an updated assignment
export async function updateNotificationsForUpdatedAssignment(
  id: string,
  assignment: Assignment
): Promise<void> {
  try {
    await cancelNotifications(id);
    
    // Only schedule if not completed
    if (!assignment.isCompleted) {
      await scheduleNotificationForAssignment(assignment);
    }
  } catch (error) {
  }
}

// Re-export the original functions to maintain the API
export const cancelNotificationsForAssignment = cancelNotifications;
export const scheduleAllNotifications = scheduleAll; 
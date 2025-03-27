import { useEffect } from 'react';
import { ExpoRoot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { initializeNotifications, checkAndRescheduleNotifications } from './utils/notificationUtils';
import { getAssignments } from './utils/assignmentStorage';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function App() {
  useEffect(() => {
    const init = async () => {
      try {
        // Initialize notifications system
        await initializeNotifications();
        
        // Check for any assignments missing notifications
        // This uses our improved function that only schedules for assignments without notifications
        const assignments = await getAssignments();
        await checkAndRescheduleNotifications(assignments);
      } catch (error) {
        console.error('Error during app initialization:', error);
      } finally {
        // Hide splash screen once the app is ready
        await SplashScreen.hideAsync();
      }
    };
    
    init();
    
    // Set up notification response handler for navigation
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      
      if (data && data.navigateTo === 'assignments') {
        // Navigate to assignments tab
        router.navigate('/(tabs)/assignments' as any);
      }
    });
    
    // Clean up subscription on unmount
    return () => {
      subscription.remove();
    };
  }, []);

  return <ExpoRoot context={require.context('./app')} />;
}
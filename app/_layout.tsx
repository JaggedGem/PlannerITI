import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { useColorScheme, StatusBar, View } from 'react-native';
import authService from '../services/authService';
import UpdateNotification from '@/components/UpdateNotification';
import LoginNotification from '@/components/LoginNotification';
import GitHubUpdateNotification from '@/components/GitHubUpdateNotification';
import { scheduleService } from '@/services/scheduleService';
import { AuthProvider } from '@/components/auth/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeNotifications } from '@/utils/notificationUtils';
import { getAssignments } from '@/utils/assignmentStorage';
import { scheduleAllNotifications } from '@/utils/notificationUtils';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on /modal/... URLs loads the tab navigator
  initialRouteName: '(tabs)',
};

// Constants
const USER_CACHE_KEY = '@planner_user_cache';
const SKIP_LOGIN_KEY = '@planner_skip_login';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Pre-load auth state values for faster app startup
  useEffect(() => {
    const preloadAuthState = async () => {
      try {
        // Preload values in memory for faster access later
        await Promise.all([
          AsyncStorage.getItem(USER_CACHE_KEY),
          AsyncStorage.getItem(SKIP_LOGIN_KEY)
        ]);
        
        // Start loading user data in background after preloading is done
        setTimeout(() => {
          authService.loadUserData();
        }, 100);
      } catch (error) {
        // Silent error handling
      }
    };
    
    preloadAuthState();
  }, []);

  // Initialize notifications
  useEffect(() => {
    if (loaded) {
      const setupNotifications = async () => {
        try {
          // Initialize notification system
          await initializeNotifications();
          
          // Schedule notifications for existing assignments
          const assignments = await getAssignments();
          await scheduleAllNotifications(assignments);
        } catch (error) {
          console.error('Error setting up notifications:', error);
        }
      };
      
      setupNotifications();
    }
  }, [loaded]);

  // Setup period times sync interval at a random offset to avoid server stress
  useEffect(() => {
    if (loaded) {
      // Initial sync with random delay between 0-60 seconds to distribute load
      const initialDelay = Math.random() * 60 * 1000;
      const syncTimer = setTimeout(() => {
        scheduleService.syncPeriodTimes();
        
        // Then sync every 24 hours at a random minute to distribute load
        setInterval(() => {
          scheduleService.syncPeriodTimes();
        }, 24 * 60 * 60 * 1000);
      }, initialDelay);

      return () => {
        clearTimeout(syncTimer);
      };
    }
  }, [loaded]);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const backgroundColor = isDark ? '#000' : '#fff';

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <AuthProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'default',
            presentation: 'containedTransparentModal',
            headerTransparent: true,
            headerTintColor: isDark ? '#fff' : '#000',
          }}
        >
          <Stack.Screen name="index" options={{ animation: 'none' }} />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="auth" />
          <Stack.Screen 
            name="signup" 
            options={{ 
              headerShown: false,
            }} 
          />
          <Stack.Screen 
            name="forgot-password" 
            options={{ 
              headerShown: false,
            }} 
          />
          <Stack.Screen 
            name="reset-password" 
            options={{ 
              headerShown: false,
            }} 
          />
          <Stack.Screen 
            name="privacy-policy" 
            options={{ 
              headerShown: false,
            }} 
          />
          <Stack.Screen 
            name="new-assignment" 
            options={{ 
              headerShown: false,
            }} 
          />
          <Stack.Screen 
            name="edit-assignment" 
            options={{ 
              headerShown: false,
            }} 
          />
        </Stack>
        <UpdateNotification />
        <GitHubUpdateNotification />
        <LoginNotification />
      </AuthProvider>
    </ThemeProvider>
  );
}

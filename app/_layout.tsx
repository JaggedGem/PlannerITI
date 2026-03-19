import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { useColorScheme, StatusBar, View } from 'react-native';
import authService from '../services/authService';
import UpdateNotification from '@/components/UpdateNotification';
import LoginNotification from '@/components/LoginNotification';
import { scheduleService } from '@/services/scheduleService';
import { updateService } from '@/services/updateService';
import { AuthProvider } from '@/components/auth/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeNotifications } from '@/utils/notificationUtils';
import { getAssignments } from '@/utils/assignmentStorage';
import { scheduleAllNotifications } from '@/utils/notificationUtils';
import { gradesDataService } from '@/services/gradesService';

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
  const [startupReady, setStartupReady] = useState(false);

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

  // Initialize schedule on app startup in Expo Router entrypoint
  useEffect(() => {
    if (!loaded) return;

    const bootstrapSchedule = async () => {
      try {
        await scheduleService.ready();
        await scheduleService.refreshGroups(true);
        await scheduleService.ensureSelectedGroup();
        await scheduleService.refreshSchedule(true);

        // Trigger background grades refresh on app load when IDNP is available.
        const idnp = await AsyncStorage.getItem('@planner_idnp');
        if (idnp) {
          gradesDataService.silentRefresh(idnp).catch(() => {
            // Silent fallback to cached grades data
          });
        }
      } catch (error) {
        // Silent fallback to cached data paths
      }
    };

    bootstrapSchedule();
  }, [loaded]);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    let isMounted = true;

    const runStartupOtaFlow = async () => {
      try {
        const didTriggerReload = await updateService.applyPreparedOtaUpdateOnLaunch();

        // If reload was triggered, this JS runtime will be replaced immediately.
        if (didTriggerReload) {
          return;
        }

        // Prepare the next OTA update without blocking app startup.
        updateService.prepareOtaUpdateForNextLaunch().catch((otaError) => {
          console.error('Error staging OTA update for next launch:', otaError);
        });
      } catch (otaError) {
        console.error('Error during OTA startup flow:', otaError);
      } finally {
        if (isMounted) {
          setStartupReady(true);
        }
      }
    };

    runStartupOtaFlow();

    return () => {
      isMounted = false;
    };
  }, [loaded]);

  useEffect(() => {
    if (loaded && startupReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, startupReady]);

  if (!loaded || !startupReady) {
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
        <LoginNotification />
      </AuthProvider>
    </ThemeProvider>
  );
}

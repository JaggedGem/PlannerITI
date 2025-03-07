import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme, StatusBar } from 'react-native';
import authService from '../services/authService';
import UpdateNotification from '@/components/UpdateNotification';
import { scheduleService } from '@/services/scheduleService';
import { AuthProvider } from '@/components/auth/AuthContext';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on /modal/... URLs loads the tab navigator
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Initialize auth state
  useEffect(() => {
    authService.loadUserData();
  }, []);

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
            animation: 'fade_from_bottom',
            contentStyle: { backgroundColor: isDark ? '#000' : '#fff' },
          }}
        >
          <Stack.Screen name="index" options={{ animation: 'fade' }} />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="auth" options={{ animation: 'fade' }} />
          <Stack.Screen 
            name="signup" 
            options={{ 
              headerShown: true,
              headerTransparent: true,
              headerTintColor: isDark ? '#fff' : '#000',
              animation: 'slide_from_right',
            }} 
          />
          <Stack.Screen 
            name="forgot-password" 
            options={{ 
              headerShown: true,
              headerTransparent: true,
              headerTintColor: isDark ? '#fff' : '#000',
              animation: 'slide_from_right',
            }} 
          />
          <Stack.Screen 
            name="reset-password" 
            options={{ 
              headerShown: true,
              headerTransparent: true,
              headerTintColor: isDark ? '#fff' : '#000',
              animation: 'slide_from_right',
            }} 
          />
          <Stack.Screen 
            name="privacy-policy" 
            options={{ 
              headerShown: true,
              headerTransparent: true,
              headerTintColor: isDark ? '#fff' : '#000',
              animation: 'slide_from_right',
            }} 
          />
        </Stack>
        <UpdateNotification />
      </AuthProvider>
    </ThemeProvider>
  );
}

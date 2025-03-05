import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { useColorScheme } from '@/hooks/useColorScheme';
import UpdateNotification from '@/components/UpdateNotification';
import { scheduleService } from '@/services/scheduleService';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

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

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
      
      {/* Add the UpdateNotification component to check for and handle updates */}
      <UpdateNotification />
    </ThemeProvider>
  );
}

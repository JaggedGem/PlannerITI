import { useEffect } from 'react';
import { ExpoRoot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function App() {
  useEffect(() => {
    // Hide splash screen once the app is ready
    SplashScreen.hideAsync();
  }, []);

  return <ExpoRoot context={require.context('./app')} />;
}
import { Redirect } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleSheet, View } from 'react-native';

const SKIP_LOGIN_KEY = '@planner_skip_login';
const USER_CACHE_KEY = '@planner_user_cache';

export default function Index() {
  // Default to schedule to avoid any flashing - worst case we show schedule briefly and redirect if needed
  const [destination, setDestination] = useState<string>('/(tabs)/schedule');
  
  // Using a layout effect equivalent for React Native to run before painting
  useEffect(() => {
    let isMounted = true;

    const checkCachedData = async () => {
      try {
        // Optimized approach: check for cached data first
        const [cachedUserData, skipLogin] = await Promise.all([
          AsyncStorage.getItem(USER_CACHE_KEY),
          AsyncStorage.getItem(SKIP_LOGIN_KEY)
        ]);
        
        if (isMounted) {
          // Only redirect to auth if we have no cached user data AND have not skipped login
          if (!cachedUserData && skipLogin !== 'true') {
            setDestination('auth');
          }
        }
      } catch (error) {
        // In case of an error, maintain the fallback to schedule
        // The app will sort out auth state on its own
      }
    };
    
    // Run immediately
    checkCachedData();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // Always return a redirect with no delay, preventing any UI flashing
  return <Redirect href={destination as any} />;
}
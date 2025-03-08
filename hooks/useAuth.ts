import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import authService from '@/services/authService';
import { UserData } from '@/services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Key for caching user data
const USER_CACHE_KEY = '@planner_user_cache';

export function useAuth() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Load cached user data immediately and then fetch fresh data
  useEffect(() => {
    const loadCachedUser = async () => {
      try {
        // First try to get from cache for immediate display
        const cachedUserData = await AsyncStorage.getItem(USER_CACHE_KEY);
        if (cachedUserData) {
          setUser(JSON.parse(cachedUserData));
        }
        // Start background loading of fresh data
        loadUserInBackground();
      } catch (error) {
        // If cache read fails, just load from network
        loadUserInBackground();
      } finally {
        // Mark initial loading as complete even if data is still loading in background
        setLoading(false);
        setIsInitialLoad(false);
      }
    };

    loadCachedUser();
  }, []);

  const loadUserInBackground = async () => {
    try {
      const userData = await authService.loadUserData();
      if (userData) {
        // Update state with fresh data
        setUser(userData);
        // Cache the user data for future use
        await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(userData));
      }
    } catch (error) {
      // Silent error handling in background
      console.log("Background user data load failed:", error);
    }
  };

  const loadUser = async () => {
    setLoading(true);
    try {
      const userData = await authService.loadUserData();
      setUser(userData);
      if (userData) {
        await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(userData));
      }
    } catch (error) {
      // If there's an error loading user data, we'll just set user to null
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    await AsyncStorage.removeItem(USER_CACHE_KEY);
    router.replace('/auth');
  };

  return {
    user,
    loading,
    isAuthenticated: !!user,
    isInitialLoad,
    logout,
    reloadUser: loadUser,
  };
}
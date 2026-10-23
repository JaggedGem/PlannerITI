import AsyncStorage from '@react-native-async-storage/async-storage';

import { useCallback, useEffect, useRef, useState } from 'react';

import { DeviceEventEmitter } from 'react-native';

import { router } from 'expo-router';

import authService, { UserData } from '@/services/authService';
import { parseUserData } from '@/utils/authData';

const USER_CACHE_KEY = '@planner_user_cache';

export function useAuth() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const mounted = useRef(false);
  const generation = useRef(0);

  const loadUser = useCallback(async () => {
    const request = ++generation.current;
    try {
      const fresh = await authService.loadUserData();
      if (!mounted.current || request !== generation.current) return;
      if (fresh) {
        setUser(fresh);
        await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(fresh));
      } else if (!authService.isAuthenticated()) {
        setUser(null);
        await AsyncStorage.removeItem(USER_CACHE_KEY);
      }
    } catch (error) {
      console.warn('Could not refresh user data:', error);
    } finally {
      if (mounted.current && request === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const request = generation.current;
    const listener = DeviceEventEmitter.addListener('auth_state_changed', () => {
      if (!authService.isAuthenticated()) {
        generation.current += 1;
        setUser(null);
        setLoading(false);
        setIsInitialLoad(false);
      } else {
        const currentUser = authService.getCurrentUser();
        if (currentUser) setUser(currentUser);
      }
    });
    const initialize = async () => {
      try {
        const raw = await AsyncStorage.getItem(USER_CACHE_KEY);
        const cached = raw ? parseUserData(JSON.parse(raw)) : null;
        if (mounted.current && request === generation.current && cached) {
          setUser(authService.getCurrentUser() ?? cached);
        }
      } catch (error) {
        console.warn('Could not load cached user data:', error);
      } finally {
        if (mounted.current && request === generation.current) {
          setIsInitialLoad(false);
          setLoading(false);
          void loadUser();
        }
      }
    };
    void initialize();
    return () => {
      mounted.current = false;
      generation.current += 1;
      listener.remove();
    };
  }, [loadUser]);

  const logout = useCallback(async () => {
    generation.current += 1;
    await authService.logout();
    if (mounted.current) setUser(null);
    router.replace('/auth');
  }, []);

  const reloadUser = useCallback(async () => {
    setLoading(true);
    await loadUser();
  }, [loadUser]);

  return { user, loading, isAuthenticated: !!user, isInitialLoad, logout, reloadUser };
}
